/**
 * Direct-fetch Chat Completions adapter for OpenAI-compatible gateways.
 */
import { LlmAdapter, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type { GatewayProviderProfile } from './types.js';
export declare const DEFAULT_CONTEXT_WINDOW = 128000;
export declare const PACKAGE_NAME = "dsh-llm-gateway-compat";
export interface CompletionsAdapterOptions {
    /** Current provider profiles keyed by route id. */
    profiles: () => Readonly<Record<string, GatewayProviderProfile>>;
    /**
     * Resolve the API key for one profile. Defaults to `process.env[apiKeyEnv]`.
     * The registering plugin should consult `ctx.credentials` first so keys
     * stored by the Models page / `.credentials.yaml` work.
     */
    resolveApiKey?: (profile: GatewayProviderProfile) => Promise<string>;
}
/**
 * One adapter instance serves every gateway route the plugin currently owns.
 * Connection facts are re-read per stream so a settings change reaches the
 * next request without re-registration.
 */
export declare class CompletionsAdapter extends LlmAdapter {
    private readonly config;
    constructor(config: CompletionsAdapterOptions);
    private profileOf;
    providerInfo(provider: string): LlmProviderInfo;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
