/** Payload this plugin reads from `agent/request-error` (structural, not the Agent type). */
export interface GatewayRequestErrorPayload {
    readonly agent: {
        inject(message: unknown): void;
    };
    readonly provider: string;
    readonly failure: {
        message: string;
        code: string;
        status?: number;
    };
}
/** Retry decision this plugin may return instead of calling `next()`. */
export type GatewayRequestErrorAction = {
    readonly kind: 'retry';
} | undefined;
declare module '@deepseek-ai/cordis' {
    interface Events {
        'agent/request-error'(payload: GatewayRequestErrorPayload, next: () => Promise<GatewayRequestErrorAction>): Promise<GatewayRequestErrorAction>;
    }
}
/** Durable and in-process inputs the recovery step needs. */
export interface RecoverInput {
    readonly provider: string;
    readonly failure: {
        message: string;
        code?: string;
        status?: number;
    };
    readonly autoApply: boolean;
}
/** Storage and delivery the plugin supplies; tests replace these. */
export interface RecoverDeps {
    /** Current `llm-pi-ai` section, or `undefined` when that namespace is absent. */
    getPiAiSection: () => unknown | undefined;
    /** Write a merge patch; omit when settings cannot be written. */
    updatePiAi?: (patch: object) => Promise<void>;
    /** Queue a plugin-sourced notice for the next claimed step. */
    inject: (body: string, summary: string) => void;
    /** Process-local keys already retried this run (`provider:kind`). */
    retried: Set<string>;
}
/** Outcome the waterfall maps onto `{ kind: 'retry' }` or `next()`. */
export type RecoverAction = 'retry' | 'delegate';
/**
 * Classify one failed model request and optionally persist the matching
 * `llm-pi-ai` compat switch. Never retries a generic 400.
 * @param input - provider, failure, and auto-apply flag.
 * @param deps - settings and inject hooks.
 */
export declare function recoverGatewayError(input: RecoverInput, deps: RecoverDeps): Promise<RecoverAction>;
