/**
 * Decide whether a request-error should write llm-pi-ai compat and retry, or
 * inject a YAML snippet and delegate.
 */
import { diagnoseGatewayFailure, type CompatDiagnosis, type CompatFix } from './diagnose.js'
import { compatAlreadyApplied, compatPatch } from './compat-settings.js'

/** Payload this plugin reads from `agent/request-error` (structural, not the Agent type). */
export interface GatewayRequestErrorPayload {
  readonly agent: { inject(message: unknown): void }
  readonly provider: string
  readonly failure: { message: string; code: string; status?: number }
}

/** Retry decision this plugin may return instead of calling `next()`. */
export type GatewayRequestErrorAction = { readonly kind: 'retry' } | undefined

declare module '@deepseek-ai/cordis' {
  interface Events {
    'agent/request-error'(
      payload: GatewayRequestErrorPayload,
      next: () => Promise<GatewayRequestErrorAction>,
    ): Promise<GatewayRequestErrorAction>
  }
}

/** Durable and in-process inputs the recovery step needs. */
export interface RecoverInput {
  readonly provider: string
  readonly failure: { message: string; code?: string; status?: number }
  readonly autoApply: boolean
}

/** Storage and delivery the plugin supplies; tests replace these. */
export interface RecoverDeps {
  /** Current `llm-pi-ai` section, or `undefined` when that namespace is absent. */
  getPiAiSection: () => unknown | undefined
  /** Write a merge patch; omit when settings cannot be written. */
  updatePiAi?: (patch: object) => Promise<void>
  /** Queue a plugin-sourced notice for the next claimed step. */
  inject: (body: string, summary: string) => void
  /** Process-local keys already retried this run (`provider:kind`). */
  retried: Set<string>
}

/** Outcome the waterfall maps onto `{ kind: 'retry' }` or `next()`. */
export type RecoverAction = 'retry' | 'delegate'

function retryKey(provider: string, fix: CompatFix): string {
  return `${provider}:${fix.kind}`
}

function stillFailingBody(provider: string, diagnosis: CompatDiagnosis): string {
  return [
    diagnosis.body,
    '',
    `compat.${diagnosis.fix.kind} is already set for "${provider}" and the gateway still refused the request. This 400 is not the known OpenAI-compat dialect mismatch.`,
  ].join('\n')
}

/**
 * Classify one failed model request and optionally persist the matching
 * `llm-pi-ai` compat switch. Never retries a generic 400.
 * @param input - provider, failure, and auto-apply flag.
 * @param deps - settings and inject hooks.
 */
export async function recoverGatewayError(input: RecoverInput, deps: RecoverDeps): Promise<RecoverAction> {
  const diagnosis = diagnoseGatewayFailure(input.failure, input.provider)
  if (diagnosis === undefined) return 'delegate'

  const key = retryKey(input.provider, diagnosis.fix)
  if (deps.retried.has(key)) {
    deps.inject(stillFailingBody(input.provider, diagnosis), diagnosis.summary)
    return 'delegate'
  }

  if (compatAlreadyApplied(deps.getPiAiSection(), input.provider, diagnosis.fix)) {
    deps.inject(stillFailingBody(input.provider, diagnosis), diagnosis.summary)
    return 'delegate'
  }

  if (input.autoApply && deps.updatePiAi !== undefined) {
    try {
      await deps.updatePiAi(compatPatch(input.provider, diagnosis.fix))
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error)
      deps.inject(
        `${diagnosis.body}\n\nAuto-apply failed (${detail}). Write the snippet by hand.`,
        diagnosis.summary,
      )
      return 'delegate'
    }
    deps.retried.add(key)
    deps.inject(
      [
        `Wrote \`${diagnosis.fix.kind}\` for provider "${input.provider}" into the \`llm-pi-ai\` settings section and retrying this request.`,
        '',
        diagnosis.body,
      ].join('\n'),
      diagnosis.summary,
    )
    return 'retry'
  }

  deps.inject(diagnosis.body, diagnosis.summary)
  return 'delegate'
}
