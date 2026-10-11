/**
 * Serialize harness messages into OpenAI Chat Completions for gateways that
 * reject `developer` and `max_completion_tokens`.
 */
import { contentHasImage, LlmError } from '@deepseek-ai/dsh-llm';
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
]);
function flattenText(blocks) {
    return blocks
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
}
function flattenReasoning(blocks) {
    return blocks
        .filter(block => block.type === 'reasoning')
        .map(block => block.text)
        .join('');
}
function serializeAssistant(message, format) {
    const text = flattenText(message.content);
    const reasoning = flattenReasoning(message.content);
    const toolCalls = message.content
        .filter(block => block.type === 'tool-call')
        .map(block => ({
        id: block.id,
        type: 'function',
        function: { name: block.name, arguments: block.arguments },
    }));
    const wire = {
        role: 'assistant',
        content: format === 'think-tags' && reasoning.length > 0
            ? `<think>${reasoning}</think>\n${text}`
            : text,
    };
    if (format === 'reasoning_content' && reasoning.length > 0) {
        wire.reasoning_content = reasoning;
    }
    if (format === 'thinking' && reasoning.length > 0) {
        wire.thinking = reasoning;
    }
    if (toolCalls.length > 0)
        wire.tool_calls = toolCalls;
    return wire;
}
function serializeMessages(messages, format) {
    const wire = [];
    for (const message of messages) {
        if (message.role === 'developer')
            continue;
        if (contentHasImage(message.content)) {
            throw new LlmError('The OpenAI-compat gateway adapter does not send image content.', 'UNSUPPORTED_CONTENT');
        }
        if (message.role === 'system') {
            wire.push({ role: 'system', content: flattenText(message.content) });
            continue;
        }
        if (message.role === 'assistant') {
            wire.push(serializeAssistant(message, format));
            continue;
        }
        if (message.role === 'tool') {
            wire.push({
                role: 'tool',
                tool_call_id: message.toolCallId,
                content: flattenText(message.content) || '(no output)',
            });
            continue;
        }
        wire.push({ role: 'user', content: flattenText(message.content) });
    }
    return wire;
}
/**
 * Build a Chat Completions body. System prompts always use `role: system`;
 * the output cap is always `max_tokens`. extraBody is applied first, then
 * harness-owned fields overwrite it. `max_completion_tokens` is stripped.
 * @param options - harness request.
 * @param profile - the selected gateway profile.
 */
export function serializeRequest(options, profile) {
    const messages = [];
    if (options.system !== undefined) {
        messages.push({ role: 'system', content: options.system });
    }
    messages.push(...serializeMessages(options.messages, profile.thinkingFormat));
    const extra = { ...profile.extraBody };
    for (const key of PROTECTED_BODY_KEYS)
        delete extra[key];
    const tools = options.tools?.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
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
    };
}
