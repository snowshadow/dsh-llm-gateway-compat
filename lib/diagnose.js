/**
 * Classify provider failures that OpenAI-compatible gateways emit when they
 * refuse the official OpenAI request dialect.
 */
const BARE_YAML_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;
/**
 * Quote a provider id for a YAML mapping key.
 * @param provider - route id from the failed request.
 */
export function yamlProviderKey(provider) {
    return BARE_YAML_KEY.test(provider) ? provider : JSON.stringify(provider);
}
/**
 * Settings.yaml fragment that applies one fix on one route.
 * @param provider - route id from the failed request.
 * @param fix - the dialect correction.
 */
export function yamlSnippet(provider, fix) {
    const field = fix.kind === 'supportsDeveloperRole'
        ? 'supportsDeveloperRole: false'
        : 'maxTokensField: max_tokens';
    return [
        '# llm-pi-ai entry config',
        'providers:',
        `  ${yamlProviderKey(provider)}:`,
        '    compat:',
        `      ${field}`,
    ].join('\n');
}
function haystack(failure) {
    return `${failure.code ?? ''} ${failure.message}`;
}
function isDeveloperRoleFailure(text) {
    return /\bdeveloper\b/i.test(text) && /\brole\b/i.test(text);
}
function isMaxCompletionTokensFailure(text) {
    return /max_completion_tokens/i.test(text);
}
/**
 * Return a dialect fix when the failure matches a known gateway refusal.
 * Generic 400s, auth failures, and quota errors are ignored.
 * @param failure - normalized provider facts from `agent/request-error`.
 * @param provider - route id, used only in the generated copy.
 */
export function diagnoseGatewayFailure(failure, provider) {
    const text = haystack(failure);
    if (isDeveloperRoleFailure(text)) {
        const fix = { kind: 'supportsDeveloperRole', value: false };
        return {
            fix,
            summary: `Gateway rejected developer role on ${provider}`,
            body: [
                `The gateway for provider "${provider}" rejected the OpenAI \`developer\` role (HTTP 400).`,
                'Put this on the `llm-pi-ai` entry config and retry, or leave autoApplyCompat enabled:',
                '',
                '```yaml',
                yamlSnippet(provider, fix),
                '```',
            ].join('\n'),
        };
    }
    if (isMaxCompletionTokensFailure(text)) {
        const fix = { kind: 'maxTokensField', value: 'max_tokens' };
        return {
            fix,
            summary: `Gateway rejected max_completion_tokens on ${provider}`,
            body: [
                `The gateway for provider "${provider}" rejected \`max_completion_tokens\`.`,
                'Put this on the `llm-pi-ai` entry config and retry, or leave autoApplyCompat enabled:',
                '',
                '```yaml',
                yamlSnippet(provider, fix),
                '```',
            ].join('\n'),
        };
    }
    return undefined;
}
