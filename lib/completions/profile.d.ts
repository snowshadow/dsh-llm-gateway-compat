/**
 * Resolve configured gateway routes into the adapter's per-request profile.
 */
import type { GatewayProviderProfile, ThinkingFormat } from './types.js';
/** One route in plugin Config / the `llm-gateway-compat` settings section. */
export interface ProviderConfig {
    displayName?: string;
    baseURL: string;
    apiKeyEnv: string;
    authHeader?: 'bearer' | 'api-key';
    models?: ReadonlyArray<{
        id: string;
        name?: string;
        contextWindow?: number;
        maxTokens?: number;
    }>;
    extraBody?: Record<string, unknown>;
    headers?: Record<string, string>;
    thinkingFormat?: ThinkingFormat;
    includeUsage?: boolean;
}
/**
 * Fill adapter defaults for every configured route.
 * @param providers - raw config dict; omitted or empty yields no routes.
 */
export declare function resolveProfiles(providers: Record<string, ProviderConfig> | undefined): Record<string, GatewayProviderProfile>;
