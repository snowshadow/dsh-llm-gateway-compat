# dsh-llm-gateway-compat

English | [中文](README.zh.md)

A community bundle compatible with DeepSeek Harness (DSH). It stops empty streamed tool-call identity from wiping the call, turns the two most common request 400s into an `llm-pi-ai` compat write plus one retry, and can own Chat Completions routes that default to `system` / `max_tokens`.

This is **not** an official DeepSeek package. It is not endorsed by DeepSeek.

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

From npm (recommended — ships built `lib/`, no install-time build):

```sh
dsh plugin --profile web add dsh-llm-gateway-compat
```

Restart `dsh web`.

From GitHub, pnpm fetches sources and runs `prepare`. pnpm ≥10 refuses that script until the profile allowlists it:

```sh
dsh plugin --profile web add github:snowshadow/dsh-llm-gateway-compat
```

If the first add fails, put this in that profile's `pnpm-workspace.yaml` and re-run `add`:

```yaml
allowBuilds:
  dsh-llm-gateway-compat: true
```

Pin a commit (`github:snowshadow/dsh-llm-gateway-compat#<sha>`) so a later push cannot change what runs. Only allow packages whose source you trust.

## Config

Plugin switches (also live under `$DSH_HOME/settings.yaml` as `llm-gateway-compat:`):

| key | default | meaning |
|---|---|---|
| `enabled` | `true` | master switch for stream wrapping and 400 recovery |
| `diagnose` | `true` | classify known gateway 400s and inject a YAML snippet |
| `autoApplyCompat` | `true` | persist the matching `llm-pi-ai` compat field and retry once |
| `providers` | `{}` | Chat Completions routes this plugin owns |

One gateway route:

```yaml
# $DSH_HOME/settings.yaml
llm-gateway-compat:
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

Export `DASHSCOPE_API_KEY` in the environment that launches `dsh`. Include `/v1` (or `/compatible-mode/v1`) in `baseURL` when the gateway requires it. Then select the `dashscope-compat` / `deepseek-v4-flash` route in the model picker.

Provider fields:

| key | default | meaning |
|---|---|---|
| `baseURL` | required | origin plus path prefix; `/chat/completions` is appended |
| `apiKeyEnv` | required | environment variable holding the raw key |
| `authHeader` | `bearer` | `bearer` or `api-key` |
| `models` | `[]` | advisory catalog; unlisted ids still resolve as text-only |
| `extraBody` | — | merged under harness-owned fields; `max_completion_tokens` is stripped |
| `headers` | — | extra request headers; `User-Agent` still comes from harness attribution |
| `thinkingFormat` | `reasoning_content` | history + stream reasoning dialect |
| `includeUsage` | `true` | send `stream_options.include_usage` |

## Develop

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
- Auto-apply only writes `supportsDeveloperRole: false` and `maxTokensField: max_tokens` on `llm-pi-ai` routes.
- There is no Web settings card; edit `settings.yaml` or the profile patch.

## License

MIT
