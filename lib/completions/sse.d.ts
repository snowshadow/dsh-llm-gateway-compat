/** Terminal payload OpenAI-compatible gateways send after the last chunk. */
export declare const DONE = "[DONE]";
/**
 * Parse SSE bytes into data payloads, yielding `[DONE]` last.
 * @param stream - raw SSE bytes; reads may split anywhere.
 */
export declare function parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string>;
