/**
 * Read and patch `llm-pi-ai.providers.<id>.compat` without inventing a
 * parallel settings namespace.
 */
import type { CompatFix } from './diagnose.js';
/**
 * The `compat` object stored for one provider, if present.
 * @param section - resolved or raw `llm-pi-ai` section.
 * @param provider - route id.
 */
export declare function readProviderCompat(section: unknown, provider: string): Record<string, unknown> | undefined;
/**
 * Whether the stored section already contains this exact fix.
 * @param section - resolved or raw `llm-pi-ai` section.
 * @param provider - route id.
 * @param fix - dialect correction.
 */
export declare function compatAlreadyApplied(section: unknown, provider: string, fix: CompatFix): boolean;
/**
 * Deep-merge patch for `ctx.settings.update('llm-pi-ai', patch)`.
 * @param provider - route id.
 * @param fix - dialect correction.
 */
export declare function compatPatch(provider: string, fix: CompatFix): {
    providers: Record<string, {
        compat: Record<string, unknown>;
    }>;
};
