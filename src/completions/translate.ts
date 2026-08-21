/**
 * Translate OpenAI-compatible SSE payloads into harness StreamChunks.
 * Empty tool-call id/name fragments never overwrite a nonempty value already
 * seen for that index. Empty initial reasoning does not open a block.
 */
import { CallId, EMPTY_RESPONSE_CODE, LlmError, type ContentBlock, type FinishReason, type StreamChunk, type TokenUsage } from '@deepseek-ai/dsh-llm'
import { SYNTHESIZED_CALL_ID_PREFIX } from '../sanitize.js'
import { DONE } from './sse.js'
import type { ThinkingFormat, WireChunk, WireUsage } from './types.js'

interface OpenBlock {
  index: number
  kind: 'text' | 'reasoning' | 'tool-call'
  text: string
  callId?: string
  name?: string
}

function nonempty(value: string | undefined | null): value is string {
  return value !== undefined && value !== null && value.length > 0
}

export function mapFinishReason(reason: string): FinishReason {
  switch (reason) {
    case 'stop': return { kind: 'stop' }
    case 'tool_calls': return { kind: 'tool-calls' }
    case 'length': return { kind: 'max-tokens' }
    default:
      return {
        kind: 'error',
        failure: { message: `model stopped: ${reason}`, code: reason.toUpperCase() },
      }
  }
}

export function mapUsage(usage: WireUsage): TokenUsage {
  const cacheRead = usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens
  const reasoning = usage.completion_tokens_details?.reasoning_tokens
  return {
    inputTokens: usage.prompt_tokens - (cacheRead ?? 0),
    outputTokens: usage.completion_tokens,
    ...cacheRead !== undefined ? { cacheReadTokens: cacheRead } : {},
    ...reasoning !== undefined ? { reasoningTokens: reasoning } : {},
  }
}

function closeBlock(block: OpenBlock): ContentBlock {
  switch (block.kind) {
    case 'text': return { type: 'text', text: block.text }
    case 'reasoning': return { type: 'reasoning', text: block.text }
    case 'tool-call': return {
      type: 'tool-call',
      id: CallId(nonempty(block.callId) ? block.callId : `${SYNTHESIZED_CALL_ID_PREFIX}${block.index}`),
      name: block.name ?? '',
      arguments: block.text,
    }
  }
}

function reasoningDelta(delta: { reasoning_content?: string | null; thinking?: string | null }, format: ThinkingFormat): string {
  if (format === 'none' || format === 'think-tags') return ''
  if (format === 'thinking') return typeof delta.thinking === 'string' ? delta.thinking : ''
  return typeof delta.reasoning_content === 'string' ? delta.reasoning_content : ''
}

/**
 * Consume SSE data payloads (ending with `[DONE]`) and yield StreamChunks.
 * @param payloads - SSE data payloads from {@link parseSse}.
 * @param format - which reasoning wire field to read.
 */
export async function* translate(
  payloads: AsyncIterable<string>,
  format: ThinkingFormat = 'reasoning_content',
): AsyncGenerator<StreamChunk> {
  let nextIndex = 0
  let textBlock: OpenBlock | undefined
  let reasoningBlock: OpenBlock | undefined
  const toolBlocks = new Map<number, OpenBlock>()
  const order: OpenBlock[] = []
  let pendingFinish: FinishReason | undefined
  let pendingUsage: TokenUsage | undefined

  function open(kind: OpenBlock['kind']): OpenBlock {
    const block: OpenBlock = { index: nextIndex++, kind, text: '' }
    order.push(block)
    return block
  }

  for await (const payload of payloads) {
    if (payload === DONE) {
      for (const block of order) {
        yield { type: 'block-end', index: block.index, block: closeBlock(block) }
      }
      if (pendingUsage) yield { type: 'usage', usage: pendingUsage }
      const reason = pendingFinish ?? { kind: 'stop' as const }
      yield {
        type: 'finish',
        reason: reason.kind === 'stop' && order.length === 0
          ? {
            kind: 'error',
            failure: { message: 'model returned a completed response with no content', code: EMPTY_RESPONSE_CODE },
          }
          : reason,
      }
      return
    }

    let chunk: WireChunk
    try {
      chunk = JSON.parse(payload) as WireChunk
    } catch {
      throw new LlmError(`malformed SSE payload: ${payload.slice(0, 120)}`, 'MALFORMED_RESPONSE')
    }

    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta
      const reasoning = reasoningDelta(delta ?? {}, format)
      if (reasoning.length > 0) {
        if (!reasoningBlock) {
          reasoningBlock = open('reasoning')
          yield { type: 'block-start', index: reasoningBlock.index, blockType: 'reasoning' }
        }
        reasoningBlock.text += reasoning
        yield { type: 'reasoning-delta', index: reasoningBlock.index, text: reasoning }
      }

      const content = delta?.content
      if (typeof content === 'string' && content.length > 0) {
        if (!textBlock) {
          textBlock = open('text')
          yield { type: 'block-start', index: textBlock.index, blockType: 'text' }
        }
        textBlock.text += content
        yield { type: 'text-delta', index: textBlock.index, text: content }
      }

      for (const call of delta?.tool_calls ?? []) {
        let block = toolBlocks.get(call.index)
        if (!block) {
          block = open('tool-call')
          toolBlocks.set(call.index, block)
          yield { type: 'block-start', index: block.index, blockType: 'tool-call' }
        }
        if (nonempty(call.id)) block.callId = call.id
        if (nonempty(call.function?.name)) block.name = call.function.name
        const fragment = call.function?.arguments ?? ''
        block.text += fragment
        yield {
          type: 'tool-call-delta',
          index: block.index,
          id: CallId(block.callId ?? ''),
          ...block.name !== undefined ? { name: block.name } : {},
          argumentsDelta: fragment,
        }
      }

      if (typeof choice.finish_reason === 'string') {
        pendingFinish = mapFinishReason(choice.finish_reason)
      }
    }

    if (chunk.usage) pendingUsage = mapUsage(chunk.usage)
  }

  throw new LlmError('SSE payload stream ended without [DONE]', 'STREAM_CLOSED')
}
