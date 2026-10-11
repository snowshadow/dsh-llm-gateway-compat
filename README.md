# dsh-llm-gateway-compat

English | [中文](README.zh.md)

[![dshbase install-tested](https://dshbase.com/badges/dsh-llm-gateway-compat.svg)](https://dshbase.com/plugins/dsh-llm-gateway-compat/)

A community bundle compatible with DeepSeek Harness (DSH) **0.2.1-alpha.2 or later**. It stops empty streamed tool-call identity from wiping the call, turns the two most common request 400s into an `llm-pi-ai` compat write plus one retry, and can own Chat Completions routes that default to `system` / `max_tokens`.

This is **not** an official DeepSeek package. It is not endorsed by DeepSeek.

0.5.0 follows the 0.2.1 configuration and message model. It will not load on 0.1.x.

## What it does

### Streamed tool-call identity (v0.1)

Wraps `llm/stream` so later SSE fragments with empty `id` / `name` cannot overwrite a nonempty value. Synthesizes `compat_call_<index>` when no id ever arrives. Official DeepSeek streams stay unchanged when identity is already stable.

### Request dialect 400s (v0.2)

On `agent/request-error`, classifies `developer`-role and `max_completion_tokens` refusals, writes the matching field into official `llm-pi-ai` settings, retries the same step once, and injects a logged plugin notice. Generic 400s are not retried.

### Chat Completions adapter (v0.3)

Optional routes under `llm-gateway-compat.providers`. Each route is a direct `POST {baseURL}/chat/completions` adapter with gateway-safe defaults:

- system prompt is always `role: system`
- output cap is always `max_tokens`
- empty tool-call id/name never overwrite, even if stream sanitizing is off
- `extraBody` for fields the harness vocabulary does not own (`user`, `prompt_cache_key`)
- extra headers, `Authorization: Bearer` or DashScope `api-key`
- thinking dialect: `reasoning_content` (default), `thinking`, `think-tags`, or `none`

Route ids must not collide with `llm-deepseek` or `llm-pi-ai`. Pick a new id such as `dashscope-compat`.

## Install

From GitHub (ships built `lib/`, no install-time TypeScript build):

```sh
dsh plugin --profile web add github:snowshadow/dsh-llm-gateway-compat
```

Restart `dsh web`. Pin a commit (`github:snowshadow/dsh-llm-gateway-compat#<sha>`) so a later push cannot change what runs. Only add packages whose source you trust.

From a local checkout:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-llm-gateway-compat
```

## Config

Plugin switches live on the `llm-gateway-compat` profile entry. Volatile fields update the running plugin; the settings forms edit those same fields.

| key | default | meaning |
|---|---|---|
| `enabled` | `true` | master switch for stream wrapping and 400 recovery |
| `diagnose` | `true` | classify known gateway 400s and inject a YAML snippet |
| `autoApplyCompat` | `true` | persist the matching `llm-pi-ai` compat field and retry once |
| `providers` | `{}` | Chat Completions routes this plugin owns |

One gateway route:

```yaml
# llm-gateway-compat entry config
providers:
  dashscope-compat:
    displayName: DashScope
    baseURL: https://dashscope.aliyuncs.com/compatible-mode/v1
    apiKeyEnv: DASHSCOPE_API_KEY
    authHeader: bearer
    thinkingFormat: reasoning_content
    extraBody:
      user: harness
    models:
      - id: deepseek-v4-flash
        name: DeepSeek V4 Flash
```

Store `DASHSCOPE_API_KEY` on the Models page or in `$DSH_HOME/.credentials.yaml`, or export it in the environment that launches `dsh`. Include `/v1` (or `/compatible-mode/v1`) in `baseURL` when the gateway requires it. Then select the `dashscope-compat` / `deepseek-v4-flash` route in the model picker.

Provider fields:

| key | default | meaning |
|---|---|---|
| `baseURL` | required | origin plus path prefix; `/chat/completions` is appended |
| `apiKeyEnv` | required | credential reference: Models page / `$DSH_HOME/.credentials.yaml`, then that environment variable |
| `authHeader` | `bearer` | `bearer` or `api-key` |
| `models` | `[]` | advisory catalog; unlisted ids still resolve as text-only |
| `extraBody` | — | merged under harness-owned fields; `max_completion_tokens` is stripped |
| `headers` | — | extra request headers; `User-Agent` still comes from harness attribution |
| `thinkingFormat` | `reasoning_content` | history + stream reasoning dialect |
| `includeUsage` | `true` | send `stream_options.include_usage` |

## Develop

Typecheck and tests expect a sibling `deepseek-harness` checkout at `../deepseek-harness`, or `DSH_HARNESS`, at 0.2.1-alpha.2. `pnpm test` / `pnpm run build` link `@deepseek-ai/dsh-llm`, `cordis`, and `schemastery` to that checkout. The checkout must already be built (`lib/` present).

```sh
pnpm install
pnpm test
pnpm run build
```

## Known limitations

- Cannot recover a tool name the gateway never emitted.
- Image input is refused (`UNSUPPORTED_CONTENT`).
- `think-tags` is applied on replayed assistant history, not on partial streamed tags.
- No idle-stream watchdog; caller `AbortSignal` is honored.
- Auto-apply only writes `supportsDeveloperRole: false` and `maxTokensField: max_tokens` on `llm-pi-ai` routes, through the profile configuration editor.
- `developer` messages (tool additions and removals) are not sent. The request still carries the current `tools` list.
- Volatile fields are editable from the settings forms. Other edits belong in the profile patch.

## License

MIT
