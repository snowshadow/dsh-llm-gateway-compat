/**
 * Direct-fetch Chat Completions adapter for OpenAI-compatible gateways.
 */
import {
  assertUsableApiKey,
  attributionHeaders,
  contentHasImage,
  CONTEXT_WINDOW_EXCEEDED_CODE,
  isContextWindowExceededError,
  isQuotaExceededError,
  LlmAdapter,
  LlmError,
  QUOTA_EXCEEDED_CODE,
  type GenerateOptions,
  type LlmModelInfo,
  type LlmProviderInfo,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { serializeRequest } from './serialize.js'
import { parseSse } from './sse.js'
import { translate } from './translate.js'
import type { GatewayProviderProfile, WireError } from './types.js'

export const DEFAULT_CONTEXT_WINDOW = 128_000
export const PACKAGE_NAME = 'dsh-llm-gateway-compat'

export interface CompletionsAdapterOptions {
  /** Current provider profiles keyed by route id. */
  profiles: () => Readonly<Record<string, GatewayProviderProfile>>
  /**
   * Resolve the API key for one profile. Defaults to `process.env[apiKeyEnv]`.
   * The registering plugin should consult `ctx.credentials` first so keys
   * stored by the Models page / `.credentials.yaml` work.
   */
  resolveApiKey?: (profile: GatewayProviderProfile) => Promise<string>
}

function httpErrorCode(status: number, error?: WireError['error']): string {
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 413) return 'INVALID_REQUEST'
  const detail = [error?.code, error?.type, error?.message].filter(Boolean).join(' ')
  if (isQuotaExceededError(detail)) return QUOTA_EXCEEDED_CODE
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400) {
    if (isContextWindowExceededError(detail)) return CONTEXT_WINDOW_EXCEEDED_CODE
    return 'INVALID_REQUEST'
  }
  if (status >= 500) return 'SERVER'
  return `HTTP_${status}`
}

function authHeaders(profile: GatewayProviderProfile, apiKey: string): Record<string, string> {
  return profile.authHeader === 'api-key'
    ? { 'api-key': apiKey }
    : { authorization: `Bearer ${apiKey}` }
}

function envApiKey(profile: GatewayProviderProfile): string {
  const raw = process.env[profile.apiKeyEnv]
  if (raw === undefined) {
    throw new LlmError(
      `${PACKAGE_NAME}: no API key for ${profile.apiKeyEnv}; store it in $DSH_HOME/.credentials.yaml or export it`,
      'MISSING_CREDENTIAL',
    )
  }
  return assertUsableApiKey(raw, PACKAGE_NAME, profile.apiKeyEnv)
}

function endpoint(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, '')}/chat/completions`
}

/**
 * One adapter instance serves every gateway route the plugin currently owns.
 * Connection facts are re-read per stream so a settings change reaches the
 * next request without re-registration.
 */
export class CompletionsAdapter extends LlmAdapter {
  constructor(private readonly config: CompletionsAdapterOptions) {
    super()
  }

  private profileOf(provider: string): GatewayProviderProfile {
    const profile = this.config.profiles()[provider]
    if (profile === undefined) {
      throw new LlmError(`${PACKAGE_NAME} does not own provider "${provider}"`, 'NO_ADAPTER')
    }
    return profile
  }

  override providerInfo(provider: string): LlmProviderInfo {
    const profile = this.config.profiles()[provider]
    return { id: provider, name: profile?.displayName ?? provider }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const profile = this.profileOf(provider)
    return Promise.resolve(profile.models.map(model => ({
      provider,
      id: model.id,
      name: model.name ?? model.id,
      inputModalities: ['text' as const],
    })))
  }

  override resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    const profile = this.profileOf(provider)
    const configured = profile.models.find(entry => entry.id === model)
    return Promise.resolve({
      provider,
      id: model,
      name: configured?.name ?? model,
      inputModalities: ['text'],
      context: { contextWindow: configured?.contextWindow ?? DEFAULT_CONTEXT_WINDOW },
      ...configured?.maxTokens === undefined ? {} : { defaultMaxTokens: configured.maxTokens },
    })
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.messages.some(message => contentHasImage(message.content))) {
      throw new LlmError(
        'The OpenAI-compat gateway adapter does not send image content.',
        'UNSUPPORTED_CONTENT',
      )
    }
    const profile = this.profileOf(options.provider)
    const apiKey = await (this.config.resolveApiKey ?? envApiKey)(profile)
    const body = serializeRequest(options, profile)
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      ...authHeaders(profile, apiKey),
      ...profile.headers,
      ...attributionHeaders(),
    }
    let response: Response
    try {
      response = await fetch(endpoint(profile.baseURL), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.signal,
      })
    } catch (error: unknown) {
      if (options.signal?.aborted) {
        throw new LlmError('gateway request aborted by caller', 'ABORTED', { cause: error })
      }
      throw new LlmError(`gateway request to ${profile.baseURL} failed`, 'TRANSPORT', { cause: error })
    }

    if (!response.ok) {
      let message = `gateway error (HTTP ${response.status})`
      let providerError: WireError['error']
      try {
        const parsed = await response.json() as WireError
        providerError = parsed.error
        if (providerError?.message) message = providerError.message
      } catch {
        // Keep the HTTP status when the error body is not JSON.
      }
      throw new LlmError(message, httpErrorCode(response.status, providerError), {
        status: response.status,
      })
    }
    if (!response.body) {
      throw new LlmError('gateway returned no response body', 'EMPTY_RESPONSE')
    }
    yield* translate(parseSse(response.body), profile.thinkingFormat)
  }
}
