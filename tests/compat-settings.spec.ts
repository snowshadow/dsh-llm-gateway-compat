import { describe, expect, it } from 'vitest'
import { applyCompatPatch, compatAlreadyApplied, compatPatch, readProviderCompat } from '../src/compat-settings.js'

describe('compat-settings', () => {
  const developer = { kind: 'supportsDeveloperRole' as const, value: false as const }
  const maxTokens = { kind: 'maxTokensField' as const, value: 'max_tokens' as const }

  it('builds a nested merge patch that does not replace other providers', () => {
    expect(compatPatch('gw', developer)).toEqual({
      providers: { gw: { compat: { supportsDeveloperRole: false } } },
    })
  })

  it('merges compat into one provider without dropping its other fields', () => {
    const next = applyCompatPatch({
      providers: {
        gw: { apiKeyEnv: 'GW_KEY', compat: { thinkingFormat: 'deepseek' } },
        other: { baseURL: 'https://example.test' },
      },
    }, compatPatch('gw', developer))
    expect(next).toEqual({
      providers: {
        gw: {
          apiKeyEnv: 'GW_KEY',
          compat: { thinkingFormat: 'deepseek', supportsDeveloperRole: false },
        },
        other: { baseURL: 'https://example.test' },
      },
    })
  })

  it('reads stored compat and detects an already-applied fix', () => {
    const section = {
      providers: {
        gw: { compat: { supportsDeveloperRole: false, thinkingFormat: 'deepseek' } },
      },
    }
    expect(readProviderCompat(section, 'gw')?.thinkingFormat).toBe('deepseek')
    expect(compatAlreadyApplied(section, 'gw', developer)).toBe(true)
    expect(compatAlreadyApplied(section, 'gw', maxTokens)).toBe(false)
    expect(compatAlreadyApplied(section, 'other', developer)).toBe(false)
  })

  it('treats missing or malformed sections as not applied', () => {
    expect(compatAlreadyApplied(undefined, 'gw', developer)).toBe(false)
    expect(compatAlreadyApplied({ providers: [] }, 'gw', developer)).toBe(false)
    expect(compatAlreadyApplied({ providers: { gw: 'nope' } }, 'gw', developer)).toBe(false)
  })
})
