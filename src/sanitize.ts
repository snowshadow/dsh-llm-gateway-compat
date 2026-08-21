/**
 * Rewrite streamed tool-call identity so empty continuation fragments cannot
 * erase a name or id the adapter already emitted.
 *
 * Direction: wrap `llm/stream` output; do not rewrite request messages.
 * Empty strings overwrite in several OpenAI-compatible gateways because
 * adapters treat `id !== undefined` as a real update.
 */
import { CallId, type StreamChunk } from '@deepseek-ai/dsh-llm'

/** Per-index identity collected from nonempty fragments. */
interface SeenCall {
  id?: string
  name?: string
}

/** Prefix used when a tool-call ends with no id on any fragment. */
export const SYNTHESIZED_CALL_ID_PREFIX = 'compat_call_'

function nonempty(value: string | undefined): value is string {
  return value !== undefined && value.length > 0
}

function record(
  seen: Map<number, SeenCall>,
  index: number,
  id: string | undefined,
  name: string | undefined,
): SeenCall {
  let entry = seen.get(index)
  if (entry === undefined) {
    entry = {}
    seen.set(index, entry)
  }
  if (nonempty(id)) entry.id = id
  if (nonempty(name)) entry.name = name
  return entry
}

/**
 * Return a nonempty identity, otherwise the remembered one, otherwise `fallback`.
 * @param current - value on this chunk.
 * @param remembered - last nonempty value for this index.
 * @param fallback - used when neither is nonempty.
 */
function pick(current: string | undefined, remembered: string | undefined, fallback: string): string {
  if (nonempty(current)) return current
  if (nonempty(remembered)) return remembered
  return fallback
}

/**
 * Sanitize one chunk. Identity updates are remembered across the stream.
 * @param chunk - adapter-emitted chunk.
 * @param seen - per-index nonempty id/name memory for this stream.
 */
export function sanitizeToolCallChunk(chunk: StreamChunk, seen: Map<number, SeenCall>): StreamChunk {
  switch (chunk.type) {
    case 'tool-call-delta': {
      const entry = record(seen, chunk.index, chunk.id, chunk.name)
      const id = pick(chunk.id, entry.id, '')
      const name = nonempty(chunk.name) ? chunk.name : entry.name
      return {
        type: 'tool-call-delta',
        index: chunk.index,
        id: CallId(id),
        ...name !== undefined ? { name } : {},
        argumentsDelta: chunk.argumentsDelta,
      }
    }
    case 'block-end': {
      if (chunk.block.type !== 'tool-call') return chunk
      const entry = record(seen, chunk.index, chunk.block.id, chunk.block.name)
      return {
        type: 'block-end',
        index: chunk.index,
        block: {
          type: 'tool-call',
          id: CallId(pick(chunk.block.id, entry.id, `${SYNTHESIZED_CALL_ID_PREFIX}${chunk.index}`)),
          name: pick(chunk.block.name, entry.name, ''),
          arguments: chunk.block.arguments,
        },
      }
    }
    default:
      return chunk
  }
}

/**
 * Wrap an adapter chunk stream so empty tool-call id/name fragments do not
 * overwrite earlier nonempty values. `block-end` is the durable identity:
 * a still-empty id becomes `compat_call_<index>`.
 * @param chunks - adapter (or inner waterfall) stream.
 */
export async function* sanitizeToolCallStream(
  chunks: AsyncIterable<StreamChunk>,
): AsyncIterable<StreamChunk> {
  const seen = new Map<number, SeenCall>()
  for await (const chunk of chunks) {
    yield sanitizeToolCallChunk(chunk, seen)
  }
}
