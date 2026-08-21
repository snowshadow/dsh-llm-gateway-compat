import { describe, expect, it } from 'vitest'
import { diagnoseGatewayFailure, yamlSnippet } from '../src/diagnose.js'

describe('diagnoseGatewayFailure', () => {
  it('matches a developer-role 400', () => {
    const diagnosis = diagnoseGatewayFailure(
      { message: 'invalid role: developer', code: 'INVALID_REQUEST', status: 400 },
      'bailian',
    )
    expect(diagnosis?.fix).toEqual({ kind: 'supportsDeveloperRole', value: false })
    expect(diagnosis?.body).toContain('supportsDeveloperRole: false')
    expect(diagnosis?.body).toContain('bailian')
  })

  it('matches quoted developer role errors from DashScope', () => {
    expect(diagnoseGatewayFailure(
      { message: 'The parameter `messages.0.role` with value `"developer"` is invalid.' },
      'gw',
    )?.fix.kind).toBe('supportsDeveloperRole')
  })

  it('matches max_completion_tokens refusals', () => {
    const diagnosis = diagnoseGatewayFailure(
      { message: 'Unsupported parameter: max_completion_tokens', code: 'INVALID_REQUEST' },
      'vllm',
    )
    expect(diagnosis?.fix).toEqual({ kind: 'maxTokensField', value: 'max_tokens' })
    expect(yamlSnippet('vllm', diagnosis!.fix)).toContain('maxTokensField: max_tokens')
  })

  it('quotes provider ids that are not bare YAML keys', () => {
    expect(yamlSnippet('my gateway', { kind: 'supportsDeveloperRole', value: false }))
      .toContain('"my gateway"')
  })

  it('ignores auth, quota, and generic 400s', () => {
    expect(diagnoseGatewayFailure({ message: 'invalid api key', status: 401 }, 'gw')).toBeUndefined()
    expect(diagnoseGatewayFailure({ message: 'insufficient quota', status: 429 }, 'gw')).toBeUndefined()
    expect(diagnoseGatewayFailure({ message: 'bad request', code: 'INVALID_REQUEST', status: 400 }, 'gw')).toBeUndefined()
    expect(diagnoseGatewayFailure({ message: 'developer preview is enabled' }, 'gw')).toBeUndefined()
  })
})
