function asRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    return value;
}
/**
 * The `compat` object stored for one provider, if present.
 * @param section - resolved or raw `llm-pi-ai` section.
 * @param provider - route id.
 */
export function readProviderCompat(section, provider) {
    const providers = asRecord(asRecord(section)?.providers);
    return asRecord(asRecord(providers?.[provider])?.compat);
}
/**
 * Whether the stored section already contains this exact fix.
 * @param section - resolved or raw `llm-pi-ai` section.
 * @param provider - route id.
 * @param fix - dialect correction.
 */
export function compatAlreadyApplied(section, provider, fix) {
    const compat = readProviderCompat(section, provider);
    if (compat === undefined)
        return false;
    if (fix.kind === 'supportsDeveloperRole')
        return compat.supportsDeveloperRole === false;
    return compat.maxTokensField === 'max_tokens';
}
/**
 * Deep-merge patch for `ctx.settings.update('llm-pi-ai', patch)`.
 * @param provider - route id.
 * @param fix - dialect correction.
 */
export function compatPatch(provider, fix) {
    const field = fix.kind === 'supportsDeveloperRole'
        ? { supportsDeveloperRole: false }
        : { maxTokensField: 'max_tokens' };
    return {
        providers: {
            [provider]: { compat: field },
        },
    };
}
