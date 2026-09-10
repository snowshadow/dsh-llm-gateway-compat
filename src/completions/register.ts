/**
 * Register (and atomically replace) Chat Completions routes from live config.
 */
import type { Context } from '@deepseek-ai/cordis'
import { assertUsableApiKey, LlmError, type AdapterRegistrationHandle, type DirectoryRegistrationHandle } from '@deepseek-ai/dsh-llm'
import { PACKAGE_NAME } from './adapter.js'
import { SETTINGS_NS } from '../namespace.js'
import { CompletionsAdapter } from './adapter.js'
import { resolveProfiles } from './profile.js'
import type { ProviderConfig } from './profile.js'

export interface CompletionsSource {
  providers?: Record<string, ProviderConfig>
}

/** Structural read of `ctx.credentials` so this plugin does not depend on the credentials package. */
interface CredentialLookup {
  resolve(ref: string): Promise<{ value: string } | undefined>
}

async function readApiKey(ctx: Context, apiKeyEnv: string): Promise<string> {
  const credentials = ctx.get('credentials') as CredentialLookup | undefined
  if (credentials !== undefined) {
    const hit = await credentials.resolve(apiKeyEnv)
    if (hit !== undefined) return assertUsableApiKey(hit.value, PACKAGE_NAME, apiKeyEnv)
  }
  const raw = process.env[apiKeyEnv]
  if (raw === undefined) {
    throw new LlmError(
      `${PACKAGE_NAME}: no API key for ${apiKeyEnv}; store it in $DSH_HOME/.credentials.yaml or export it`,
      'MISSING_CREDENTIAL',
    )
  }
  return assertUsableApiKey(raw, PACKAGE_NAME, apiKeyEnv)
}

/**
 * Keep `ctx.llm` adapter routes and the configurable-provider directory in
 * sync with `source().providers`. An empty dict holds zero routes.
 * @param ctx - context that owns `ctx.llm`.
 * @param source - live plugin config.
 * @returns a `sync` function to call after settings changes.
 */
export function registerCompletionsAdapter(ctx: Context, source: () => CompletionsSource): { sync: () => void } {
  const adapter = new CompletionsAdapter({
    profiles: () => resolveProfiles(source().providers),
    resolveApiKey: profile => readApiKey(ctx, profile.apiKeyEnv),
  })
  let registration: AdapterRegistrationHandle | undefined
  let directory: DirectoryRegistrationHandle | undefined

  const sync = (): void => {
    const profiles = resolveProfiles(source().providers)
    const routes = Object.keys(profiles)
    const entries = routes.map(provider => ({
      provider,
      displayName: profiles[provider]?.displayName ?? provider,
      settingsNs: SETTINGS_NS,
      settingsPath: ['providers', provider],
      declared: true as const,
    }))

    if (registration === undefined) {
      if (routes.length > 0) registration = ctx.llm.registerAdapter(routes, adapter)
    } else {
      registration.replace(routes)
    }

    if (directory === undefined) {
      if (entries.length > 0) directory = ctx.llm.registerConfigurableProviders(entries)
    } else {
      directory.replace(entries)
    }
  }

  return { sync }
}
