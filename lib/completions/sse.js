/**
 * Decode an SSE byte stream into `data` payloads. An event dispatches only
 * on its blank-line terminator; EOF without `[DONE]` is truncation.
 */
import { LlmError } from '@deepseek-ai/dsh-llm';
/** Terminal payload OpenAI-compatible gateways send after the last chunk. */
export const DONE = '[DONE]';
function eventData(rawEvent) {
    const lines = rawEvent.split('\n');
    const dataLines = [];
    for (const line of lines) {
        if (line.startsWith(':'))
            continue;
        if (line.startsWith('data:'))
            dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (dataLines.length === 0)
        return undefined;
    return dataLines.join('\n');
}
/**
 * Parse SSE bytes into data payloads, yielding `[DONE]` last.
 * @param stream - raw SSE bytes; reads may split anywhere.
 */
export async function* parseSse(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            let split = buffer.indexOf('\n\n');
            while (split !== -1) {
                const data = eventData(buffer.slice(0, split));
                buffer = buffer.slice(split + 2);
                if (data !== undefined) {
                    yield data;
                    if (data === DONE)
                        return;
                }
                split = buffer.indexOf('\n\n');
            }
        }
    }
    finally {
        reader.releaseLock();
    }
    throw new LlmError('SSE stream ended without [DONE]', 'STREAM_CLOSED');
}
