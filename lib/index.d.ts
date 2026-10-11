/**
 * Host plugin: sanitize streamed tool-call identity, recover known gateway
 * 400s onto `llm-pi-ai` compat, and optionally own Chat Completions routes.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { type ContextFormed } from '@deepseek-ai/dsh-llm';
import type { ProviderConfig } from './completions/profile.js';
import { type Live } from './live.js';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'llm-gateway-compat': {
            kind: 'llm-gateway-compat';
        } & ContextFormed;
    }
}
declare module '@deepseek-ai/cordis' {
    interface Events {
        /** Volatile config was committed into this fiber. Dispatched by Loader to the owning fiber only. */
        'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
    }
}
export type { ProviderConfig } from './completions/profile.js';
export { sanitizeToolCallChunk, sanitizeToolCallStream, SYNTHESIZED_CALL_ID_PREFIX } from './sanitize.js';
export { diagnoseGatewayFailure, yamlSnippet } from './diagnose.js';
export { applyCompatPatch, compatAlreadyApplied, compatPatch } from './compat-settings.js';
export { recoverGatewayError } from './recover.js';
export { SETTINGS_NS, PI_AI_NS } from './namespace.js';
export { CompletionsAdapter } from './completions/adapter.js';
export { serializeRequest } from './completions/serialize.js';
export { translate } from './completions/translate.js';
/** Cordis plugin name used by Loader diagnostics. */
export declare const name = "llm-gateway-compat";
/** Wait until the LLM service exists so `llm/stream` is dispatched. */
export declare const inject: string[];
export interface Config {
    /** Master switch for stream sanitizing and 400 recovery. */
    enabled: Live<boolean>;
    /** Classify known gateway 400s and inject a YAML snippet. */
    diagnose: Live<boolean>;
    /** Persist the matching `llm-pi-ai` compat field and retry the request once. */
    autoApplyCompat: Live<boolean>;
    /**
     * Chat Completions routes this plugin owns. Empty by default so older
     * users keep using `llm-pi-ai` custom providers. Route ids must not collide
     * with `llm-deepseek` or `llm-pi-ai`.
     */
    providers: Live<Record<string, ProviderConfig>>;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    enabled: Schema<boolean, boolean, "volatile-defined">;
    diagnose: Schema<boolean, boolean, "volatile-defined">;
    autoApplyCompat: Schema<boolean, boolean, "volatile-defined">;
    providers: Schema<NoInfer<import("@deepseek-ai/cosmokit").Dict<{
        displayName?: string | null | undefined;
        baseURL?: string | null | undefined;
        apiKeyEnv?: string | null | undefined;
        authHeader?: "bearer" | "api-key" | null | undefined;
        models?: ({
            id?: string | null | undefined;
            name?: string | null | undefined;
            contextWindow?: number | null | undefined;
            maxTokens?: number | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[] | null | undefined;
        extraBody?: import("@deepseek-ai/cosmokit").Dict<any, string> | null | undefined;
        headers?: import("@deepseek-ai/cosmokit").Dict<string, string> | null | undefined;
        thinkingFormat?: "none" | "reasoning_content" | "thinking" | "think-tags" | null | undefined;
        includeUsage?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<Schemastery.ObjectT<NoInfer<{
        displayName: Schema<string, string, "plain">;
        baseURL: Schema<string, string, "defined">;
        apiKeyEnv: Schema<string, string, "defined">;
        authHeader: Schema<"bearer" | "api-key", "bearer" | "api-key", "defined">;
        models: Schema<({
            id?: string | null | undefined;
            name?: string | null | undefined;
            contextWindow?: number | null | undefined;
            maxTokens?: number | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            id: Schema<string, string, "defined">;
            name: Schema<string, string, "plain">;
            contextWindow: Schema<number, number, "plain">;
            maxTokens: Schema<number, number, "plain">;
        }>>[], "defined">;
        extraBody: Schema<import("@deepseek-ai/cosmokit").Dict<any, string>, import("@deepseek-ai/cosmokit").Dict<any, string>, "plain">;
        headers: Schema<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>, "plain">;
        thinkingFormat: Schema<"none" | "reasoning_content" | "thinking" | "think-tags", "none" | "reasoning_content" | "thinking" | "think-tags", "defined">;
        includeUsage: Schema<boolean, boolean, "defined">;
    }>>, string>>, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "volatile-defined">;
    diagnose: Schema<boolean, boolean, "volatile-defined">;
    autoApplyCompat: Schema<boolean, boolean, "volatile-defined">;
    providers: Schema<NoInfer<import("@deepseek-ai/cosmokit").Dict<{
        displayName?: string | null | undefined;
        baseURL?: string | null | undefined;
        apiKeyEnv?: string | null | undefined;
        authHeader?: "bearer" | "api-key" | null | undefined;
        models?: ({
            id?: string | null | undefined;
            name?: string | null | undefined;
            contextWindow?: number | null | undefined;
            maxTokens?: number | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[] | null | undefined;
        extraBody?: import("@deepseek-ai/cosmokit").Dict<any, string> | null | undefined;
        headers?: import("@deepseek-ai/cosmokit").Dict<string, string> | null | undefined;
        thinkingFormat?: "none" | "reasoning_content" | "thinking" | "think-tags" | null | undefined;
        includeUsage?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<Schemastery.ObjectT<NoInfer<{
        displayName: Schema<string, string, "plain">;
        baseURL: Schema<string, string, "defined">;
        apiKeyEnv: Schema<string, string, "defined">;
        authHeader: Schema<"bearer" | "api-key", "bearer" | "api-key", "defined">;
        models: Schema<({
            id?: string | null | undefined;
            name?: string | null | undefined;
            contextWindow?: number | null | undefined;
            maxTokens?: number | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            id: Schema<string, string, "defined">;
            name: Schema<string, string, "plain">;
            contextWindow: Schema<number, number, "plain">;
            maxTokens: Schema<number, number, "plain">;
        }>>[], "defined">;
        extraBody: Schema<import("@deepseek-ai/cosmokit").Dict<any, string>, import("@deepseek-ai/cosmokit").Dict<any, string>, "plain">;
        headers: Schema<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>, "plain">;
        thinkingFormat: Schema<"none" | "reasoning_content" | "thinking" | "think-tags", "none" | "reasoning_content" | "thinking" | "think-tags", "defined">;
        includeUsage: Schema<boolean, boolean, "defined">;
    }>>, string>>, "volatile-defined">;
}>>, "plain">;
/**
 * Register stream sanitizing, optional Chat Completions routes, and, when
 * agents are present, gateway 400 recovery.
 * @param ctx - Cordis context that owns `llm/stream`.
 * @param config - composition entry config. Volatile fields update in place.
 */
export declare function apply(ctx: Context, config: Config): void;
