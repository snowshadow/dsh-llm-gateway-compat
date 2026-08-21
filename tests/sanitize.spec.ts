import { describe, expect, it } from 'vitest'
import { CallId, type StreamChunk } from '@deepseek-ai/dsh-llm'
import {
  sanitizeToolCallStream,
  SYNTHESIZED_CALL_ID_PREFIX,
} from '../src/sanitize.js'

async function collect(chunks: StreamChunk[]): Promise<StreamChunk[]> {
  const out: StreamChunk[] = []
  for await (const chunk of sanitizeToolCallStream(chunksToAsync(chunks))) out.push(chunk)
  return out
}

async function* chunksToAsync(chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
  yield* chunks
}

function start(index: number): StreamChunk {
  return { type: 'block-start', index, blockType: 'tool-call' }
}

function delta(
  index: number,
  id: string,
  args: string,
  name?: string,
): StreamChunk {
  return {
    type: 'tool-call-delta',
    index,
    id: CallId(id),
    ...name !== undefined ? { name } : {},
    argumentsDelta: args,
  }
}

function end(index: number, id: string, name: string, args: string): StreamChunk {
  return {
    type: 'block-end',
    index,
    block: { type: 'tool-call', id: CallId(id), name, arguments: args },
  }
}

describe('sanitizeToolCallStream', () => {
  it('keeps a later empty id/name from overwriting a valid first fragment', async () => {
    const chunks = await collect([
      start(0),
      delta(0, 'call_1', '', 'bash'),
      delta(0, '', '{"cmd"', ''),
      delta(0, '', ': "ls"}', ''),
      end(0, '', '', '{"cmd": "ls"}'),
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ])
    expect(chunks[1]).toEqual(delta(0, 'call_1', '', 'bash'))
    expect(chunks[2]).toEqual(delta(0, 'call_1', '{"cmd"', 'bash'))
    expect(chunks[3]).toEqual(delta(0, 'call_1', ': "ls"}', 'bash'))
    expect(chunks[4]).toEqual(end(0, 'call_1', 'bash', '{"cmd": "ls"}'))
    expect(chunks[5]).toEqual({ type: 'finish', reason: { kind: 'tool-calls' } })
  })

  it('synthesizes an id at block-end when no fragment ever carried one', async () => {
    const chunks = await collect([
      start(0),
      delta(0, '', '{}'),
      end(0, '', '', '{}'),
    ])
    expect(chunks[2]).toEqual(end(0, `${SYNTHESIZED_CALL_ID_PREFIX}0`, '', '{}'))
  })

  it('does not invent a tool name when none was ever present', async () => {
    const chunks = await collect([
      start(0),
      delta(0, 'call_x', '{}'),
      end(0, 'call_x', '', '{}'),
    ])
    expect(chunks[2]).toEqual(end(0, 'call_x', '', '{}'))
  })

  it('keeps two parallel tool-calls from sharing identity', async () => {
    const chunks = await collect([
      start(0),
      start(1),
      delta(0, 'call_a', '', 'bash'),
      delta(1, 'call_b', '', 'read'),
      delta(0, '', '{"cmd":"ls"}', ''),
      delta(1, '', '{"path":"a.ts"}', ''),
      end(0, '', '', '{"cmd":"ls"}'),
      end(1, '', '', '{"path":"a.ts"}'),
    ])
    expect(chunks[6]).toEqual(end(0, 'call_a', 'bash', '{"cmd":"ls"}'))
    expect(chunks[7]).toEqual(end(1, 'call_b', 'read', '{"path":"a.ts"}'))
  })

  it('leaves a well-formed DeepSeek-style stream unchanged', async () => {
    const original: StreamChunk[] = [
      start(0),
      delta(0, 'call_00_x', '{"city"', 'get_weather'),
      delta(0, 'call_00_x', ': "Paris"}', 'get_weather'),
      end(0, 'call_00_x', 'get_weather', '{"city": "Paris"}'),
      { type: 'usage', usage: { inputTokens: 10, outputTokens: 2 } },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ]
    expect(await collect(original)).toEqual(original)
  })

  it('restores name on block-end when only the first delta carried it', async () => {
    const chunks = await collect([
      start(0),
      delta(0, 'c', '', 'f'),
      delta(0, 'c', '{}'),
      end(0, 'c', '', '{}'),
    ])
    expect(chunks[3]).toEqual(end(0, 'c', 'f', '{}'))
  })

  it('accepts an id that arrives only on a later fragment', async () => {
    const chunks = await collect([
      start(0),
      delta(0, '', '', 'bash'),
      delta(0, 'late_id', '{}', 'bash'),
      end(0, '', 'bash', '{}'),
    ])
    expect(chunks[2]).toEqual(delta(0, 'late_id', '{}', 'bash'))
    expect(chunks[3]).toEqual(end(0, 'late_id', 'bash', '{}'))
  })

  it('passes text, reasoning, usage, and aborted finish through unchanged', async () => {
    const original: StreamChunk[] = [
      { type: 'block-start', index: 0, blockType: 'reasoning' },
      { type: 'reasoning-delta', index: 0, text: 'think' },
      { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'think' } },
      { type: 'block-start', index: 1, blockType: 'text' },
      { type: 'text-delta', index: 1, text: 'hi' },
      { type: 'block-end', index: 1, block: { type: 'text', text: 'hi' } },
      { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } },
      {
        type: 'finish',
        reason: { kind: 'aborted', failure: { message: 'cancelled', code: 'ABORTED' } },
      },
    ]
    expect(await collect(original)).toEqual(original)
  })

  it('propagates a thrown failure from the inner stream', async () => {
    async function* failing(): AsyncIterable<StreamChunk> {
      yield start(0)
      throw new Error('adapter failed')
    }
    await expect(async () => {
      for await (const _ of sanitizeToolCallStream(failing())) { /* drain */ }
    }).rejects.toThrow('adapter failed')
  })
})
