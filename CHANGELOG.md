# Changelog

## 0.5.0

Requires DeepSeek Harness 0.2.1-alpha.2 or later.

- Read live config from volatile entry fields and `loader/volatile-update`, not `settings.yaml` namespaces
- Persist `llm-pi-ai` dialect fixes through `ctx.configEditor` onto that entry's `providers.<id>.compat`
- Declare a `llm-gateway-compat` message source for gateway notices
- Serialize `role: tool` results and drop `developer` tool-update messages

## 0.4.0

Requires DeepSeek Harness 0.1.5-rc.1 or later. Not compatible with published npm `0.0.1-rc.1` APIs.

- Track `ToolCallId` (replaces `CallId`) on streamed tool-call identity
- Register settings through `ctx.settings.installSection` instead of the removed `settingsNamespace` / `installSettingsSection` helpers
- Resolve Chat Completions API keys from `ctx.credentials` first (`$DSH_HOME/.credentials.yaml` / Models page), then the process environment
- Ship built `lib/` so `dsh plugin add github:snowshadow/dsh-llm-gateway-compat` does not need an install-time TypeScript build

## 0.3.0

First public release. Community plugin, not an official DeepSeek package.

- Sanitize empty streamed tool-call `id` / `name` overwrites on `llm/stream`
- Classify `developer`-role and `max_completion_tokens` 400s; optionally write `llm-pi-ai` compat and retry once
- Optional Chat Completions adapter under `providers` (`system` + `max_tokens`, extraBody, headers, thinking dialects)
