import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage, LlmError } from '@deepseek-ai/dsh-llm'
import { CompletionsAdapter } from '../src/completions/adapter.js'
import { resolveProfiles } from '../src/completions/profile.js'
import * as plugin from '../src/index.js'

function sseBody(payloads: string[]): ReadableStream<Uint8Array> {
  const text = payloads.map(data => `data: ${data}\n\n`).join('')
  return new Blob([text]).stream()
}

describe('CompletionsAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.GW_KEY
  })

  const profiles = resolveProfiles({
    gw: {
      baseURL: 'https://gateway.example/v1',
      apiKeyEnv: 'GW_KEY',
      displayName: 'Gateway',
      models: [{ id: 'qwen', name: 'Qwen' }],
      extraBody: { user: 'alice' },
      headers: { 'X-Test': '1' },
      authHeader: 'api-key',
    },
  })

  it('sends api-key auth, extraBody, attribution, and max_tokens', async () => {
    process.env.GW_KEY = 'sk-test'
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(_url).toBe('https://gateway.example/v1/chat/completions')
      const headers = new Headers(init?.headers)
      expect(headers.get('api-key')).toBe('sk-test')
      expect(headers.get('X-Test')).toBe('1')
      expect(headers.get('user-agent')).toBeTruthy()
      const body = JSON.parse(String(init?.body)) as { user?: string; max_tokens?: number }
      expect(body.user).toBe('alice')
      expect(body.max_tokens).toBe(32)
      return new Response(sseBody([
        JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
        '[DONE]',
      ]), { status: 200, headers: { 'content-type': 'text/event-stream' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new CompletionsAdapter({ profiles: () => profiles })
    const chunks = []
    for await (const chunk of adapter.stream({
      provider: 'gw',
      model: 'qwen',
      messages: [createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } })],
      maxTokens: 32,
    })) chunks.push(chunk)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('maps a 400 with developer-role wording to INVALID_REQUEST', async () => {
    process.env.GW_KEY = 'sk-test'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'invalid role: developer' } }),
      { status: 400 },
    )))
    const adapter = new CompletionsAdapter({ profiles: () => profiles })
    await expect(adapter.stream({
      provider: 'gw',
      model: 'qwen',
      messages: [],
    }).next()).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      failure: { status: 400, message: 'invalid role: developer' },
    })
  })

  it('fails with MISSING_CREDENTIAL when the env var is absent', async () => {
    const adapter = new CompletionsAdapter({ profiles: () => profiles })
    await expect(adapter.stream({
      provider: 'gw',
      model: 'qwen',
      messages: [],
    }).next()).rejects.toMatchObject({ code: 'MISSING_CREDENTIAL' })
  })

  it('prefers resolveApiKey over the process environment', async () => {
    process.env.GW_KEY = 'sk-env'
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get('api-key')).toBe('sk-stored')
      return new Response(sseBody([
        JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
        '[DONE]',
      ]), { status: 200, headers: { 'content-type': 'text/event-stream' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new CompletionsAdapter({
      profiles: () => profiles,
      resolveApiKey: async () => 'sk-stored',
    })
    await adapter.stream({ provider: 'gw', model: 'qwen', messages: [] }).next()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('registers configured routes on ctx.llm', async () => {
    process.env.GW_KEY = 'sk-test'
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(plugin, {
      providers: {
        gw: {
          baseURL: 'https://gateway.example/v1',
          apiKeyEnv: 'GW_KEY',
          models: [{ id: 'qwen' }],
        },
      },
    })
    const listed = await ctx.llm.listModels('gw')
    expect(listed.map(model => model.id)).toEqual(['qwen'])
    expect(ctx.llm.listConfigurableProviders().some(entry => entry.provider === 'gw')).toBe(true)
  })
})
