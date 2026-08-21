import { describe, expect, it } from 'vitest'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { DONE, parseSse } from '../src/completions/sse.js'

function bytes(text: string): ReadableStream<Uint8Array> {
  return new Blob([text]).stream()
}

async function collect(text: string): Promise<string[]> {
  const out: string[] = []
  for await (const payload of parseSse(bytes(text))) out.push(payload)
  return out
}

describe('parseSse', () => {
  it('yields data payloads and stops at [DONE]', async () => {
    expect(await collect('data: {"a":1}\n\ndata: [DONE]\n\n')).toEqual([
      '{"a":1}',
      DONE,
    ])
  })

  it('skips comments and joins multi-data events', async () => {
    expect(await collect(': keep-alive\n\ndata: foo\ndata: bar\n\ndata: [DONE]\n\n')).toEqual([
      'foo\nbar',
      DONE,
    ])
  })

  it('throws STREAM_CLOSED when [DONE] is missing', async () => {
    await expect(collect('data: {"a":1}\n\n')).rejects.toMatchObject({
      code: 'STREAM_CLOSED',
    })
    await expect(collect('data: {"a":1}\n\n')).rejects.toBeInstanceOf(LlmError)
  })
})
