/**
 * Translate OpenAI-compatible SSE payloads into harness StreamChunks.
 * Empty tool-call id/name fragments never overwrite a nonempty value already
 * seen for that index. Empty initial reasoning does not open a block.
 */
import { type FinishReason, type StreamChunk, type TokenUsage } from '@deepseek-ai/dsh-llm';
import type { ThinkingFormat, WireUsage } from './types.js';
export declare function mapFinishReason(reason: string): FinishReason;
export declare function mapUsage(usage: WireUsage): TokenUsage;
/**
 * Consume SSE data payloads (ending with `[DONE]`) and yield StreamChunks.
 * @param payloads - SSE data payloads from {@link parseSse}.
 * @param format - which reasoning wire field to read.
 */
export declare function translate(payloads: AsyncIterable<string>, format?: ThinkingFormat): AsyncGenerator<StreamChunk>;
