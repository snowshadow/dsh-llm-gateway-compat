/**
 * Decide whether a request-error should write llm-pi-ai compat and retry, or
 * inject a YAML snippet and delegate.
 */
import { diagnoseGatewayFailure } from './diagnose.js';
import { compatAlreadyApplied, compatPatch } from './compat-settings.js';
function retryKey(provider, fix) {
    return `${provider}:${fix.kind}`;
}
function stillFailingBody(provider, diagnosis) {
    return [
        diagnosis.body,
        '',
        `compat.${diagnosis.fix.kind} is already set for "${provider}" and the gateway still refused the request. This 400 is not the known OpenAI-compat dialect mismatch.`,
    ].join('\n');
}
/**
 * Classify one failed model request and optionally persist the matching
 * `llm-pi-ai` compat switch. Never retries a generic 400.
 * @param input - provider, failure, and auto-apply flag.
 * @param deps - settings and inject hooks.
 */
export async function recoverGatewayError(input, deps) {
    const diagnosis = diagnoseGatewayFailure(input.failure, input.provider);
    if (diagnosis === undefined)
        return 'delegate';
    const key = retryKey(input.provider, diagnosis.fix);
    if (deps.retried.has(key)) {
        deps.inject(stillFailingBody(input.provider, diagnosis), diagnosis.summary);
        return 'delegate';
    }
    if (compatAlreadyApplied(deps.getPiAiSection(), input.provider, diagnosis.fix)) {
        deps.inject(stillFailingBody(input.provider, diagnosis), diagnosis.summary);
        return 'delegate';
    }
    if (input.autoApply && deps.updatePiAi !== undefined) {
        try {
            await deps.updatePiAi(compatPatch(input.provider, diagnosis.fix));
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            deps.inject(`${diagnosis.body}\n\nAuto-apply failed (${detail}). Write the snippet by hand.`, diagnosis.summary);
            return 'delegate';
        }
        deps.retried.add(key);
        deps.inject([
            `Wrote \`${diagnosis.fix.kind}\` for provider "${input.provider}" into the \`llm-pi-ai\` entry config and retrying this request.`,
            '',
            diagnosis.body,
        ].join('\n'), diagnosis.summary);
        return 'retry';
    }
    deps.inject(diagnosis.body, diagnosis.summary);
    return 'delegate';
}
