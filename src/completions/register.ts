/**
 * Register (and atomically replace) Chat Completions routes from live config.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { AdapterRegistrationHandle, DirectoryRegistrationHandle } from '@deepseek-ai/dsh-llm'
import { SETTINGS_NS } from '../namespace.js'
import { CompletionsAdapter } from './adapter.js'
import { resolveProfiles } from './profile.js'
import type { ProviderConfig } from './profile.js'

export interface CompletionsSource {
  providers?: Record<string, ProviderConfig>
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
