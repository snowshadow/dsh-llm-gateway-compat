/**
 * Host plugin: sanitize streamed tool-call identity, recover known gateway
 * 400s onto `llm-pi-ai` compat, and optionally own Chat Completions routes.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import '@deepseek-ai/dsh-settings';
import type { ProviderConfig } from './completions/profile.js';
export type { ProviderConfig } from './completions/profile.js';
export { sanitizeToolCallChunk, sanitizeToolCallStream, SYNTHESIZED_CALL_ID_PREFIX } from './sanitize.js';
export { diagnoseGatewayFailure, yamlSnippet } from './diagnose.js';
export { compatAlreadyApplied, compatPatch } from './compat-settings.js';
export { recoverGatewayError } from './recover.js';
export { SETTINGS_NS, PI_AI_NS } from './namespace.js';
export { CompletionsAdapter } from './completions/adapter.js';
export { serializeRequest } from './completions/serialize.js';
export { translate } from './completions/translate.js';
/** Cordis plugin name used by Loader diagnostics. */
export declare const name = "llm-gateway-compat";
/** Wait until the LLM service exists so `llm/stream` is dispatched. */
export declare const inject: string[];
export interface Config {
    /** Master switch for stream sanitizing and 400 recovery. */
    enabled: boolean;
    /** Classify known gateway 400s and inject a YAML snippet. */
    diagnose: boolean;
    /** Persist the matching `llm-pi-ai` compat field and retry the request once. */
    autoApplyCompat: boolean;
    /**
     * Chat Completions routes this plugin owns. Empty by default so v0.1/v0.2
     * users keep using `llm-pi-ai` custom providers. Route ids must not collide
     * with `llm-deepseek` or `llm-pi-ai`.
     */
    providers?: Record<string, ProviderConfig>;
}
export declare const Config: Schema<Config>;
/**
 * Register stream sanitizing, optional Chat Completions routes, and, when
 * agents/settings are present, gateway 400 recovery.
 * @param ctx - Cordis context that owns `llm/stream`.
 * @param config - composition entry config; settings overlay it live.
 */
export declare function apply(ctx: Context, config: Config): void;
