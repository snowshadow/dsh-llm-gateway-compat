import { describe, expect, it } from 'vitest'
import { ToolCallId, LlmError, createMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { serializeRequest } from '../src/completions/serialize.js'
import { resolveProfiles } from '../src/completions/profile.js'

const profile = resolveProfiles({
  gw: {
    baseURL: 'https://gateway.example/v1',
    apiKeyEnv: 'GW_KEY',
    extraBody: { user: 'alice', max_completion_tokens: 9, model: 'stolen' },
    thinkingFormat: 'reasoning_content',
  },
})!.gw!

describe('serializeRequest', () => {
  it('sends the system prompt as role system and the cap as max_tokens', () => {
    const body = serializeRequest({
      provider: 'gw',
      model: 'qwen',
      system: 'You are a coding agent.',
      messages: [createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } })],
      maxTokens: 128,
    }, profile)
    expect(body.model).toBe('qwen')
    expect(body.max_tokens).toBe(128)
    expect(body.max_completion_tokens).toBeUndefined()
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'hi' },
    ])
    expect(body.user).toBe('alice')
    expect(body.stream).toBe(true)
  })

  it('does not let extraBody overwrite harness-owned fields', () => {
    const body = serializeRequest({
      provider: 'gw',
      model: 'qwen',
      messages: [],
    }, profile)
    expect(body.model).toBe('qwen')
    expect(body.max_completion_tokens).toBeUndefined()
  })

  it('replays reasoning as reasoning_content, thinking, or think-tags', () => {
    const assistant = createMessage({
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'plan' },
        { type: 'text', text: 'done' },
        { type: 'tool-call', id: ToolCallId('c1'), name: 'bash', arguments: '{}' },
      ],
      source: { kind: 'model', provider: 'gw', model: 'qwen' },
    })
    const request = {
      provider: 'gw',
      model: 'qwen',
      messages: [assistant],
    }
    const asReasoning = serializeRequest(request, { ...profile, thinkingFormat: 'reasoning_content' })
    expect(asReasoning.messages).toEqual([{
      role: 'assistant',
      content: 'done',
      reasoning_content: 'plan',
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'bash', arguments: '{}' } }],
    }])
    const asThinking = serializeRequest(request, { ...profile, thinkingFormat: 'thinking' })
    expect(asThinking.messages).toMatchObject([{ thinking: 'plan', content: 'done' }])
    const asTags = serializeRequest(request, { ...profile, thinkingFormat: 'think-tags' })
    expect(asTags.messages).toMatchObject([{ content: '<think>plan</think>\ndone' }])
    expect(asTags.messages?.[0]).not.toHaveProperty('reasoning_content')
  })

  it('refuses image content', () => {
    expect(() => serializeRequest({
      provider: 'gw',
      model: 'qwen',
      messages: [createUserMessage({
        content: [{ type: 'image', attachment: { id: 'x' } as never }],
        source: { kind: 'user' },
      })],
    }, profile)).toThrow(LlmError)
  })
})
