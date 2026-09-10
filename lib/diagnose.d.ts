/**
 * Classify provider failures that OpenAI-compatible gateways emit when they
 * refuse the official OpenAI request dialect.
 */
/** One wire-compat field this plugin knows how to correct. */
export type CompatFix = {
    readonly kind: 'supportsDeveloperRole';
    readonly value: false;
} | {
    readonly kind: 'maxTokensField';
    readonly value: 'max_tokens';
};
/** A recognized gateway dialect failure and the text to show the user. */
export interface CompatDiagnosis {
    readonly fix: CompatFix;
    /** One-line account for a `notice` summary. */
    readonly summary: string;
    /** Model-facing explanation, including a settings.yaml snippet. */
    readonly body: string;
}
/**
 * Quote a provider id for a YAML mapping key.
 * @param provider - route id from the failed request.
 */
export declare function yamlProviderKey(provider: string): string;
/**
 * Settings.yaml fragment that applies one fix on one route.
 * @param provider - route id from the failed request.
 * @param fix - the dialect correction.
 */
export declare function yamlSnippet(provider: string, fix: CompatFix): string;
/**
 * Return a dialect fix when the failure matches a known gateway refusal.
 * Generic 400s, auth failures, and quota errors are ignored.
 * @param failure - normalized provider facts from `agent/request-error`.
 * @param provider - route id, used only in the generated copy.
 */
export declare function diagnoseGatewayFailure(failure: {
    message: string;
    code?: string;
    status?: number;
}, provider: string): CompatDiagnosis | undefined;
