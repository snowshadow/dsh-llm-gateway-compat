/**
 * Read and patch `llm-pi-ai.providers.<id>.compat` without inventing a
 * parallel settings namespace.
 */
import type { CompatFix } from './diagnose.js'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * The `compat` object stored for one provider, if present.
 * @param section - resolved or raw `llm-pi-ai` section.
 * @param provider - route id.
 */
export function readProviderCompat(section: unknown, provider: string): Record<string, unknown> | undefined {
  const providers = asRecord(asRecord(section)?.providers)
  return asRecord(asRecord(providers?.[provider])?.compat)
}

/**
 * Whether the stored section already contains this exact fix.
 * @param section - resolved or raw `llm-pi-ai` section.
 * @param provider - route id.
 * @param fix - dialect correction.
 */
export function compatAlreadyApplied(section: unknown, provider: string, fix: CompatFix): boolean {
  const compat = readProviderCompat(section, provider)
  if (compat === undefined) return false
  if (fix.kind === 'supportsDeveloperRole') return compat.supportsDeveloperRole === false
  return compat.maxTokensField === 'max_tokens'
}

/**
 * Compat fields to merge into one `llm-pi-ai` provider profile.
 * @param provider - route id.
 * @param fix - dialect correction.
 */
export function compatPatch(provider: string, fix: CompatFix): {
  providers: Record<string, { compat: Record<string, unknown> }>
} {
  const field = fix.kind === 'supportsDeveloperRole'
    ? { supportsDeveloperRole: false }
    : { maxTokensField: 'max_tokens' }
  return {
    providers: {
      [provider]: { compat: field },
    },
  }
}

/**
 * Merge a compat patch into a raw `llm-pi-ai` entry config without dropping other providers or fields.
 * @param current - the entry's current raw config.
 * @param patch - one provider's compat fields.
 */
export function applyCompatPatch(
  current: Record<string, unknown>,
  patch: ReturnType<typeof compatPatch>,
): Record<string, unknown> {
  const providers = { ...(asRecord(current.providers) ?? {}) }
  for (const [provider, body] of Object.entries(patch.providers)) {
    const existing = { ...(asRecord(providers[provider]) ?? {}) }
    providers[provider] = {
      ...existing,
      compat: { ...(asRecord(existing.compat) ?? {}), ...body.compat },
    }
  }
  return { ...current, providers }
}
