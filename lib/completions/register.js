import { assertUsableApiKey, LlmError } from '@deepseek-ai/dsh-llm';
import { PACKAGE_NAME } from './adapter.js';
import { SETTINGS_NS } from '../namespace.js';
import { CompletionsAdapter } from './adapter.js';
import { resolveProfiles } from './profile.js';
async function readApiKey(ctx, apiKeyEnv) {
    const credentials = ctx.get('credentials');
    if (credentials !== undefined) {
        const hit = await credentials.resolve(apiKeyEnv);
        if (hit !== undefined)
            return assertUsableApiKey(hit.value, PACKAGE_NAME, apiKeyEnv);
    }
    const raw = process.env[apiKeyEnv];
    if (raw === undefined) {
        throw new LlmError(`${PACKAGE_NAME}: no API key for ${apiKeyEnv}; store it in $DSH_HOME/.credentials.yaml or export it`, 'MISSING_CREDENTIAL');
    }
    return assertUsableApiKey(raw, PACKAGE_NAME, apiKeyEnv);
}
/**
 * Keep `ctx.llm` adapter routes and the configurable-provider directory in
 * sync with `source().providers`. An empty dict holds zero routes.
 * @param ctx - context that owns `ctx.llm`.
 * @param source - live plugin config.
 * @returns a `sync` function to call after settings changes.
 */
export function registerCompletionsAdapter(ctx, source) {
    const adapter = new CompletionsAdapter({
        profiles: () => resolveProfiles(source().providers),
        resolveApiKey: profile => readApiKey(ctx, profile.apiKeyEnv),
    });
    let registration;
    let directory;
    const sync = () => {
        const profiles = resolveProfiles(source().providers);
        const routes = Object.keys(profiles);
        const entries = routes.map(provider => ({
            provider,
            displayName: profiles[provider]?.displayName ?? provider,
            settingsNs: SETTINGS_NS,
            settingsPath: ['providers', provider],
            declared: true,
        }));
        if (registration === undefined) {
            if (routes.length > 0)
                registration = ctx.llm.registerAdapter(routes, adapter);
        }
        else {
            registration.replace(routes);
        }
        if (directory === undefined) {
            if (entries.length > 0)
                directory = ctx.llm.registerConfigurableProviders(entries);
        }
        else {
            directory.replace(entries);
        }
    };
    return { sync };
}
