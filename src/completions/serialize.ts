/**
 * Serialize harness messages into OpenAI Chat Completions for gateways that
 * reject `developer` and `max_completion_tokens`.
 */
import { contentHasImage, LlmError, type ContentBlock, type GenerateOptions, type Message } from '@deepseek-ai/dsh-llm'
import type { GatewayProviderProfile, ThinkingFormat } from './types.js'

const PROTECTED_BODY_KEYS = new Set([
  'model',
  'messages',
  'stream',
  'stream_options',
  'tools',
  'temperature',
  'max_tokens',
  'max_completion_tokens',
  'stop',
])

function flattenText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

function flattenReasoning(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(block => block.type === 'reasoning')
    .map(block => block.text)
    .join('')
}

function serializeAssistant(message: Message, format: ThinkingFormat): Record<string, unknown> {
  const text = flattenText(message.content)
  const reasoning = flattenReasoning(message.content)
  const toolCalls = message.content
    .filter(block => block.type === 'tool-call')
    .map(block => ({
      id: block.id,
      type: 'function' as const,
      function: { name: block.name, arguments: block.arguments },
    }))

  const wire: Record<string, unknown> = {
    role: 'assistant',
    content: format === 'think-tags' && reasoning.length > 0
      ? `<think>${reasoning}</think>\n${text}`
      : text,
  }
  if (format === 'reasoning_content' && reasoning.length > 0) {
    wire.reasoning_content = reasoning
  }
  if (format === 'thinking' && reasoning.length > 0) {
    wire.thinking = reasoning
  }
  if (toolCalls.length > 0) wire.tool_calls = toolCalls
  return wire
}

function serializeMessages(messages: readonly Message[], format: ThinkingFormat): Record<string, unknown>[] {
  const wire: Record<string, unknown>[] = []
  for (const message of messages) {
    if (contentHasImage(message.content)) {
      throw new LlmError(
        'The OpenAI-compat gateway adapter does not send image content.',
        'UNSUPPORTED_CONTENT',
      )
    }
    if (message.role === 'system') {
      wire.push({ role: 'system', content: flattenText(message.content) })
      continue
    }
    if (message.role === 'assistant') {
      wire.push(serializeAssistant(message, format))
      continue
    }
    const toolResults = message.content.filter(block => block.type === 'tool-result')
    const text = flattenText(message.content)
    if (text.length > 0 || toolResults.length === 0) {
      wire.push({ role: 'user', content: text })
    }
    for (const result of toolResults) {
      wire.push({
        role: 'tool',
        tool_call_id: result.toolCallId,
        content: flattenText(result.content) || '(no output)',
      })
    }
  }
  return wire
}

/**
 * Build a Chat Completions body. System prompts always use `role: system`;
 * the output cap is always `max_tokens`. extraBody is applied first, then
 * harness-owned fields overwrite it. `max_completion_tokens` is stripped.
 * @param options - harness request.
 * @param profile - the selected gateway profile.
 */
export function serializeRequest(
  options: GenerateOptions,
  profile: GatewayProviderProfile,
): Record<string, unknown> {
  const messages: Record<string, unknown>[] = []
  if (options.system !== undefined) {
    messages.push({ role: 'system', content: options.system })
  }
  messages.push(...serializeMessages(options.messages, profile.thinkingFormat))

  const extra: Record<string, unknown> = { ...profile.extraBody }
  for (const key of PROTECTED_BODY_KEYS) delete extra[key]

  const tools = options.tools?.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))

  return {
    ...extra,
    model: options.model,
    messages,
    stream: true,
    ...profile.includeUsage ? { stream_options: { include_usage: true } } : {},
    ...tools !== undefined && tools.length > 0 ? { tools } : {},
    ...options.temperature !== undefined ? { temperature: options.temperature } : {},
    ...options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens },
    ...options.stop !== undefined ? { stop: options.stop } : {},
  }
}
