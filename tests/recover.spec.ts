import { describe, expect, it, vi } from 'vitest'
import { recoverGatewayError, type RecoverDeps } from '../src/recover.js'

function deps(overrides: Partial<RecoverDeps> = {}): RecoverDeps & {
  inject: ReturnType<typeof vi.fn>
} {
  const inject = vi.fn()
  return {
    getPiAiSection: () => undefined,
    updatePiAi: vi.fn(async () => {}),
    retried: new Set<string>(),
    ...overrides,
    inject: overrides.inject ?? inject,
  }
}

const developerFailure = {
  message: 'invalid role: developer',
  code: 'INVALID_REQUEST',
  status: 400,
}

describe('recoverGatewayError', () => {
  it('delegates unrecognized failures without writing or injecting', async () => {
    const hooks = deps()
    await expect(recoverGatewayError(
      { provider: 'gw', failure: { message: 'insufficient quota', status: 429 }, autoApply: true },
      hooks,
    )).resolves.toBe('delegate')
    expect(hooks.updatePiAi).not.toHaveBeenCalled()
    expect(hooks.inject).not.toHaveBeenCalled()
  })

  it('writes compat and retries when auto-apply is on', async () => {
    const hooks = deps()
    await expect(recoverGatewayError(
      { provider: 'gw', failure: developerFailure, autoApply: true },
      hooks,
    )).resolves.toBe('retry')
    expect(hooks.updatePiAi).toHaveBeenCalledWith({
      providers: { gw: { compat: { supportsDeveloperRole: false } } },
    })
    expect(hooks.inject).toHaveBeenCalledOnce()
    expect(hooks.inject.mock.calls[0]?.[0]).toContain('Wrote')
    expect(hooks.retried.has('gw:supportsDeveloperRole')).toBe(true)
  })

  it('injects YAML and does not retry when auto-apply is off', async () => {
    const hooks = deps()
    await expect(recoverGatewayError(
      { provider: 'gw', failure: developerFailure, autoApply: false },
      hooks,
    )).resolves.toBe('delegate')
    expect(hooks.updatePiAi).not.toHaveBeenCalled()
    expect(hooks.inject.mock.calls[0]?.[0]).toContain('supportsDeveloperRole: false')
  })

  it('does not retry a 400 whose compat is already stored', async () => {
    const hooks = deps({
      getPiAiSection: () => ({ providers: { gw: { compat: { supportsDeveloperRole: false } } } }),
    })
    await expect(recoverGatewayError(
      { provider: 'gw', failure: developerFailure, autoApply: true },
      hooks,
    )).resolves.toBe('delegate')
    expect(hooks.updatePiAi).not.toHaveBeenCalled()
    expect(hooks.inject.mock.calls[0]?.[0]).toContain('already set')
  })

  it('retries only once per provider and fix in this process', async () => {
    const hooks = deps()
    await expect(recoverGatewayError(
      { provider: 'gw', failure: developerFailure, autoApply: true },
      hooks,
    )).resolves.toBe('retry')
    await expect(recoverGatewayError(
      { provider: 'gw', failure: developerFailure, autoApply: true },
      hooks,
    )).resolves.toBe('delegate')
    expect(hooks.updatePiAi).toHaveBeenCalledOnce()
  })

  it('delegates with the YAML snippet when the settings write fails', async () => {
    const hooks = deps({
      updatePiAi: vi.fn(async () => {
        throw new Error('llm-pi-ai is not registered')
      }),
    })
    await expect(recoverGatewayError(
      { provider: 'gw', failure: developerFailure, autoApply: true },
      hooks,
    )).resolves.toBe('delegate')
    expect(hooks.inject.mock.calls[0]?.[0]).toContain('Auto-apply failed')
    expect(hooks.inject.mock.calls[0]?.[0]).toContain('supportsDeveloperRole: false')
  })

  it('injects YAML when settings cannot be written', async () => {
    const hooks = deps({ updatePiAi: undefined })
    await expect(recoverGatewayError(
      { provider: 'gw', failure: developerFailure, autoApply: true },
      hooks,
    )).resolves.toBe('delegate')
    expect(hooks.inject.mock.calls[0]?.[0]).toContain('supportsDeveloperRole: false')
  })
})
