/**
 * Serialize harness messages into OpenAI Chat Completions for gateways that
 * reject `developer` and `max_completion_tokens`.
 */
import { type GenerateOptions } from '@deepseek-ai/dsh-llm';
import type { GatewayProviderProfile } from './types.js';
/**
 * Build a Chat Completions body. System prompts always use `role: system`;
 * the output cap is always `max_tokens`. extraBody is applied first, then
 * harness-owned fields overwrite it. `max_completion_tokens` is stripped.
 * @param options - harness request.
 * @param profile - the selected gateway profile.
 */
export declare function serializeRequest(options: GenerateOptions, profile: GatewayProviderProfile): Record<string, unknown>;
