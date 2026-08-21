import { describe, expect, it } from 'vitest'
import { SYNTHESIZED_CALL_ID_PREFIX } from '../src/sanitize.js'
import { DONE } from '../src/completions/sse.js'
import { translate } from '../src/completions/translate.js'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'

async function collect(payloads: string[], format?: 'none' | 'reasoning_content' | 'thinking' | 'think-tags'): Promise<StreamChunk[]> {
  const out: StreamChunk[] = []
  for await (const chunk of translate(payloadsToAsync(payloads), format)) out.push(chunk)
  return out
}

async function* payloadsToAsync(payloads: string[]): AsyncIterable<string> {
  yield* payloads
}

describe('translate', () => {
  it('keeps a later empty tool-call id/name from overwriting the first fragment', async () => {
    const chunks = await collect([
      JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'bash', arguments: '' } }] } }] }),
      JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: '', function: { name: '', arguments: '{}' } }] } }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
      DONE,
    ])
    expect(chunks.find(chunk => chunk.type === 'block-end')).toEqual({
      type: 'block-end',
      index: 0,
      block: { type: 'tool-call', id: 'call_1', name: 'bash', arguments: '{}' },
    })
  })

  it('synthesizes an id when the gateway never sent one', async () => {
    const chunks = await collect([
      JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{}' } }] } }] }),
      JSON.stringify({ choices: [{ finish_reason: 'tool_calls' }] }),
      DONE,
    ])
    expect(chunks.find(chunk => chunk.type === 'block-end')).toMatchObject({
      block: { type: 'tool-call', id: `${SYNTHESIZED_CALL_ID_PREFIX}0`, name: '', arguments: '{}' },
    })
  })

  it('does not open a reasoning block on an empty first reasoning_content', async () => {
    const chunks = await collect([
      JSON.stringify({ choices: [{ delta: { reasoning_content: '' } }] }),
      JSON.stringify({ choices: [{ delta: { reasoning_content: 'plan' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
      DONE,
    ])
    expect(chunks.filter(chunk => chunk.type === 'block-start').map(chunk => chunk.blockType)).toEqual(['reasoning', 'text'])
  })

  it('reads delta.thinking when thinkingFormat is thinking', async () => {
    const chunks = await collect([
      JSON.stringify({ choices: [{ delta: { thinking: 'hmm' } }] }),
      JSON.stringify({ choices: [{ finish_reason: 'stop' }] }),
      DONE,
    ], 'thinking')
    expect(chunks.find(chunk => chunk.type === 'block-end')).toEqual({
      type: 'block-end',
      index: 0,
      block: { type: 'reasoning', text: 'hmm' },
    })
  })

  it('emits usage before finish and nothing after', async () => {
    const chunks = await collect([
      JSON.stringify({ choices: [{ delta: { content: 'hi' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1 } }),
      DONE,
    ])
    expect(chunks.map(chunk => chunk.type)).toEqual([
      'block-start',
      'text-delta',
      'block-end',
      'usage',
      'finish',
    ])
  })
})
