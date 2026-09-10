/**
 * Host plugin: sanitize streamed tool-call identity, recover known gateway
 * 400s onto `llm-pi-ai` compat, and optionally own Chat Completions routes.
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm'
import '@deepseek-ai/dsh-settings'
import { sanitizeToolCallStream } from './sanitize.js'
import { recoverGatewayError } from './recover.js'
import type { GatewayRequestErrorAction, GatewayRequestErrorPayload } from './recover.js'
import { PI_AI_NS, SETTINGS_NS } from './namespace.js'
import { registerCompletionsAdapter } from './completions/register.js'
import type { ProviderConfig } from './completions/profile.js'

export type { ProviderConfig } from './completions/profile.js'

export { sanitizeToolCallChunk, sanitizeToolCallStream, SYNTHESIZED_CALL_ID_PREFIX } from './sanitize.js'
export { diagnoseGatewayFailure, yamlSnippet } from './diagnose.js'
export { compatAlreadyApplied, compatPatch } from './compat-settings.js'
export { recoverGatewayError } from './recover.js'
export { SETTINGS_NS, PI_AI_NS } from './namespace.js'
export { CompletionsAdapter } from './completions/adapter.js'
export { serializeRequest } from './completions/serialize.js'
export { translate } from './completions/translate.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'llm-gateway-compat'

/** Wait until the LLM service exists so `llm/stream` is dispatched. */
export const inject = ['llm']

export interface Config {
  /** Master switch for stream sanitizing and 400 recovery. */
  enabled: boolean
  /** Classify known gateway 400s and inject a YAML snippet. */
  diagnose: boolean
  /** Persist the matching `llm-pi-ai` compat field and retry the request once. */
  autoApplyCompat: boolean
  /**
   * Chat Completions routes this plugin owns. Empty by default so v0.1/v0.2
   * users keep using `llm-pi-ai` custom providers. Route ids must not collide
   * with `llm-deepseek` or `llm-pi-ai`.
   */
  providers?: Record<string, ProviderConfig>
}

const catalogModel = Schema.object({
  id: Schema.string().required(),
  name: Schema.string(),
  contextWindow: Schema.number(),
  maxTokens: Schema.number(),
})

const providerConfig = Schema.object({
  displayName: Schema.string(),
  baseURL: Schema.string().required(),
  apiKeyEnv: Schema.string().required(),
  authHeader: Schema.union(['bearer', 'api-key'] as const).default('bearer'),
  models: Schema.array(catalogModel).default([]),
  extraBody: Schema.dict(Schema.any()),
  headers: Schema.dict(Schema.string()),
  thinkingFormat: Schema.union(['none', 'reasoning_content', 'thinking', 'think-tags'] as const).default('reasoning_content'),
  includeUsage: Schema.boolean().default(true),
})

export const Config: Schema<Config> = Schema.object({
  enabled: Schema.boolean().default(true),
  diagnose: Schema.boolean().default(true),
  autoApplyCompat: Schema.boolean().default(true),
  providers: Schema.dict(providerConfig).default({}),
})

/**
 * Register stream sanitizing, optional Chat Completions routes, and, when
 * agents/settings are present, gateway 400 recovery.
 * @param ctx - Cordis context that owns `llm/stream`.
 * @param config - composition entry config; settings overlay it live.
 */
export function apply(ctx: Context, config: Config): void {
  let source = (): Config => config
  const retried = new Set<string>()

  ctx.on('llm/stream', (_options, next) => {
    if (!source().enabled) return next()
    return sanitizeToolCallStream(next())
  })

  const completions = registerCompletionsAdapter(ctx, () => source())
  completions.sync()

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NS, Config, config, {
      setSource: (current) => {
        source = current
      },
      onChange: () => {
        completions.sync()
      },
    })
  })

  ctx.inject(['agents', 'settings'], (wired) => {
    wired.on('agent/request-error', async (payload: GatewayRequestErrorPayload, next: () => Promise<GatewayRequestErrorAction>) => {
      const current = source()
      if (!current.enabled || !current.diagnose) return next()
      const action = await recoverGatewayError(
        {
          provider: payload.provider,
          failure: payload.failure,
          autoApply: current.autoApplyCompat,
        },
        {
          getPiAiSection: () => wired.settings.get(PI_AI_NS),
          updatePiAi: (patch) => wired.settings.update(PI_AI_NS, patch),
          inject: (body, summary) => {
            payload.agent.inject(createUserMessage({
              content: [{ type: 'text', text: body }],
              source: {
                kind: 'plugin',
                plugin: name,
                form: 'notice',
                summary: boundContextSummary(summary),
              },
            }))
          },
          retried,
        },
      )
      if (action === 'retry') return { kind: 'retry' }
      return next()
    })
  })
}
