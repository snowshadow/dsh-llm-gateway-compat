import Schema from '@deepseek-ai/schemastery';
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm';
import { sanitizeToolCallStream } from './sanitize.js';
import { recoverGatewayError } from './recover.js';
import { applyCompatPatch } from './compat-settings.js';
import { registerCompletionsAdapter } from './completions/register.js';
import { readLive } from './live.js';
export { sanitizeToolCallChunk, sanitizeToolCallStream, SYNTHESIZED_CALL_ID_PREFIX } from './sanitize.js';
export { diagnoseGatewayFailure, yamlSnippet } from './diagnose.js';
export { applyCompatPatch, compatAlreadyApplied, compatPatch } from './compat-settings.js';
export { recoverGatewayError } from './recover.js';
export { SETTINGS_NS, PI_AI_NS } from './namespace.js';
export { CompletionsAdapter } from './completions/adapter.js';
export { serializeRequest } from './completions/serialize.js';
export { translate } from './completions/translate.js';
/** Cordis plugin name used by Loader diagnostics. */
export const name = 'llm-gateway-compat';
/** Wait until the LLM service exists so `llm/stream` is dispatched. */
export const inject = ['llm'];
const catalogModel = Schema.object({
    id: Schema.string().required(),
    name: Schema.string(),
    contextWindow: Schema.number(),
    maxTokens: Schema.number(),
});
const providerConfig = Schema.object({
    displayName: Schema.string(),
    baseURL: Schema.string().required(),
    apiKeyEnv: Schema.string().required(),
    authHeader: Schema.union(['bearer', 'api-key']).default('bearer'),
    models: Schema.array(catalogModel).default([]),
    extraBody: Schema.dict(Schema.any()),
    headers: Schema.dict(Schema.string()),
    thinkingFormat: Schema.union(['none', 'reasoning_content', 'thinking', 'think-tags']).default('reasoning_content'),
    includeUsage: Schema.boolean().default(true),
});
export const Config = Schema.object({
    enabled: Schema.boolean().default(true).volatile(),
    diagnose: Schema.boolean().default(true).volatile(),
    autoApplyCompat: Schema.boolean().default(true).volatile(),
    providers: Schema.dict(providerConfig).default({}).volatile(),
});
const PI_AI_PACKAGE = '@deepseek-ai/dsh-llm-pi-ai';
function editorOf(ctx) {
    return ctx.get('configEditor');
}
function piAiEntry(editor) {
    return editor.entries().find(entry => entry.options.name === PI_AI_PACKAGE || entry.options.id === 'llm-pi-ai');
}
function piAiSection(ctx) {
    const editor = editorOf(ctx);
    const entry = editor === undefined ? undefined : piAiEntry(editor);
    const providers = entry?.fiber?.config?.providers;
    if (providers === undefined)
        return undefined;
    return { providers: readLive(providers) };
}
async function writePiAiCompat(ctx, patch) {
    const editor = editorOf(ctx);
    const entry = editor === undefined ? undefined : piAiEntry(editor);
    if (editor === undefined || entry === undefined) {
        throw new Error('llm-pi-ai configuration entry is not available');
    }
    await editor.edit(entry, current => applyCompatPatch(current, patch));
}
function snapshot(config) {
    return {
        enabled: readLive(config.enabled),
        diagnose: readLive(config.diagnose),
        autoApplyCompat: readLive(config.autoApplyCompat),
        providers: readLive(config.providers) ?? {},
    };
}
/**
 * Register stream sanitizing, optional Chat Completions routes, and, when
 * agents are present, gateway 400 recovery.
 * @param ctx - Cordis context that owns `llm/stream`.
 * @param config - composition entry config. Volatile fields update in place.
 */
export function apply(ctx, config) {
    const retried = new Set();
    ctx.on('llm/stream', (_options, next) => {
        if (!snapshot(config).enabled)
            return next();
        return sanitizeToolCallStream(next());
    });
    const completions = registerCompletionsAdapter(ctx, () => snapshot(config));
    completions.sync();
    ctx.on('loader/volatile-update', () => {
        completions.sync();
    });
    ctx.inject(['agents'], (wired) => {
        wired.on('agent/request-error', async (payload, next) => {
            const current = snapshot(config);
            if (!current.enabled || !current.diagnose)
                return next();
            const action = await recoverGatewayError({
                provider: payload.provider,
                failure: payload.failure,
                autoApply: current.autoApplyCompat,
            }, {
                getPiAiSection: () => piAiSection(ctx),
                updatePiAi: patch => writePiAiCompat(ctx, patch),
                inject: (body, summary) => {
                    payload.agent.inject(createUserMessage({
                        content: [{ type: 'text', text: body }],
                        source: {
                            kind: 'llm-gateway-compat',
                            form: 'notice',
                            summary: boundContextSummary(summary),
                        },
                    }));
                },
                retried,
            });
            if (action === 'retry')
                return { kind: 'retry' };
            return next();
        });
    });
}
