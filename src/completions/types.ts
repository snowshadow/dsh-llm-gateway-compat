/**
 * OpenAI Chat Completions wire types used by the gateway adapter.
 * Extra gateway fields (`thinking`, extraBody keys) stay on the request as
 * `Record` so this file only names the fields we read from the stream.
 */

export type ThinkingFormat = 'none' | 'reasoning_content' | 'thinking' | 'think-tags'

export type AuthHeader = 'bearer' | 'api-key'

export interface CatalogModel {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
}

export interface GatewayProviderProfile {
  displayName?: string
  baseURL: string
  apiKeyEnv: string
  authHeader: AuthHeader
  models: readonly CatalogModel[]
  extraBody?: Record<string, unknown>
  headers?: Record<string, string>
  thinkingFormat: ThinkingFormat
  includeUsage: boolean
}

export interface WireToolCallDelta {
  index: number
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

export interface WireDelta {
  content?: string | null
  reasoning_content?: string | null
  thinking?: string | null
  tool_calls?: WireToolCallDelta[]
}

export interface WireChunk {
  choices?: Array<{
    delta?: WireDelta
    finish_reason?: string | null
  }>
  usage?: WireUsage | null
}

export interface WireUsage {
  prompt_tokens: number
  completion_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number }
}

export interface WireError {
  error?: { message?: string; type?: string; code?: string }
}
