/**
 * Rewrite streamed tool-call identity so empty continuation fragments cannot
 * erase a name or id the adapter already emitted.
 *
 * Direction: wrap `llm/stream` output; do not rewrite request messages.
 * Empty strings overwrite in several OpenAI-compatible gateways because
 * adapters treat `id !== undefined` as a real update.
 */
import { type StreamChunk } from '@deepseek-ai/dsh-llm';
/** Per-index identity collected from nonempty fragments. */
interface SeenCall {
    id?: string;
    name?: string;
}
/** Prefix used when a tool-call ends with no id on any fragment. */
export declare const SYNTHESIZED_CALL_ID_PREFIX = "compat_call_";
/**
 * Sanitize one chunk. Identity updates are remembered across the stream.
 * @param chunk - adapter-emitted chunk.
 * @param seen - per-index nonempty id/name memory for this stream.
 */
export declare function sanitizeToolCallChunk(chunk: StreamChunk, seen: Map<number, SeenCall>): StreamChunk;
/**
 * Wrap an adapter chunk stream so empty tool-call id/name fragments do not
 * overwrite earlier nonempty values. `block-end` is the durable identity:
 * a still-empty id becomes `compat_call_<index>`.
 * @param chunks - adapter (or inner waterfall) stream.
 */
export declare function sanitizeToolCallStream(chunks: AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk>;
export {};
