import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { CallId, LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import * as plugin from '../src/index.js'

class ScriptedAdapter extends LlmAdapter {
  constructor(private script: StreamChunk[]) {
    super()
  }

  async *stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield* this.script
  }
}

async function drain(ctx: Context, provider: string): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of ctx.llm.stream({ provider, model: 'm', messages: [] })) {
    chunks.push(chunk)
  }
  return chunks
}

const overwriteScript: StreamChunk[] = [
  { type: 'block-start', index: 0, blockType: 'tool-call' },
  {
    type: 'tool-call-delta',
    index: 0,
    id: CallId('call_1'),
    name: 'bash',
    argumentsDelta: '',
  },
  {
    type: 'tool-call-delta',
    index: 0,
    id: CallId(''),
    name: '',
    argumentsDelta: '{}',
  },
  {
    type: 'block-end',
    index: 0,
    block: { type: 'tool-call', id: CallId(''), name: '', arguments: '{}' },
  },
  { type: 'finish', reason: { kind: 'tool-calls' } },
]

describe('llm-gateway-compat plugin', () => {
  it('sanitizes adapter output through llm/stream', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['gw'], new ScriptedAdapter(overwriteScript))
    await ctx.plugin(plugin)

    const chunks = await drain(ctx, 'gw')
    expect(chunks[3]).toEqual({
      type: 'block-end',
      index: 0,
      block: { type: 'tool-call', id: CallId('call_1'), name: 'bash', arguments: '{}' },
    })
  })

  it('leaves the adapter stream unchanged when disabled', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['gw'], new ScriptedAdapter(overwriteScript))
    await ctx.plugin(plugin, { enabled: false })

    const chunks = await drain(ctx, 'gw')
    expect(chunks[3]).toEqual(overwriteScript[3])
  })
})
