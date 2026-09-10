/**
 * Fill adapter defaults for every configured route.
 * @param providers - raw config dict; omitted or empty yields no routes.
 */
export function resolveProfiles(providers) {
    const resolved = {};
    for (const [id, raw] of Object.entries(providers ?? {})) {
        resolved[id] = {
            ...raw.displayName === undefined ? {} : { displayName: raw.displayName },
            baseURL: raw.baseURL,
            apiKeyEnv: raw.apiKeyEnv,
            authHeader: raw.authHeader ?? 'bearer',
            models: raw.models ?? [],
            ...raw.extraBody === undefined ? {} : { extraBody: raw.extraBody },
            ...raw.headers === undefined ? {} : { headers: raw.headers },
            thinkingFormat: raw.thinkingFormat ?? 'reasoning_content',
            includeUsage: raw.includeUsage ?? true,
        };
    }
    return resolved;
}
