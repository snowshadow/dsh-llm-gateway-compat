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
 * Compat fields to merge into one `llm-pi-ai` provider profile.
 * @param provider - route id.
 * @param fix - dialect correction.
 */
export declare function compatPatch(provider: string, fix: CompatFix): {
    providers: Record<string, {
        compat: Record<string, unknown>;
    }>;
};
/**
 * Merge a compat patch into a raw `llm-pi-ai` entry config without dropping other providers or fields.
 * @param current - the entry's current raw config.
 * @param patch - one provider's compat fields.
 */
export declare function applyCompatPatch(current: Record<string, unknown>, patch: ReturnType<typeof compatPatch>): Record<string, unknown>;
