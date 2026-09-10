/**
 * Register (and atomically replace) Chat Completions routes from live config.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ProviderConfig } from './profile.js';
export interface CompletionsSource {
    providers?: Record<string, ProviderConfig>;
}
/**
 * Keep `ctx.llm` adapter routes and the configurable-provider directory in
 * sync with `source().providers`. An empty dict holds zero routes.
 * @param ctx - context that owns `ctx.llm`.
 * @param source - live plugin config.
 * @returns a `sync` function to call after settings changes.
 */
export declare function registerCompletionsAdapter(ctx: Context, source: () => CompletionsSource): {
    sync: () => void;
};
