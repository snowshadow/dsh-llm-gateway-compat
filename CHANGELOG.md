# Changelog

## 0.3.0

First public release. Community plugin, not an official DeepSeek package.

- Sanitize empty streamed tool-call `id` / `name` overwrites on `llm/stream`
- Classify `developer`-role and `max_completion_tokens` 400s; optionally write `llm-pi-ai` compat and retry once
- Optional Chat Completions adapter under `providers` (`system` + `max_tokens`, extraBody, headers, thinking dialects)
