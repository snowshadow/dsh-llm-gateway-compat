# dsh-llm-gateway-compat

[English](README.md) | 中文

[![dshbase 实测可装](https://dshbase.com/badges/dsh-llm-gateway-compat.svg)](https://dshbase.com/zh/plugins/dsh-llm-gateway-compat/)

兼容 DeepSeek Harness（DSH）**0.2.1-alpha.2 及以后**的社区 bundle。它阻止空串冲掉流式 tool-call 身份，把最常见的两种请求 400 写成官方 `llm-pi-ai` compat 并重试一次，还可以自己挂 Chat Completions 路由（默认 `system` / `max_tokens`）。

这不是 DeepSeek 官方包，也未获 DeepSeek 背书。

0.5.0 跟随 0.2.1 的配置和消息模型，无法在 0.1.x 上加载。

## 做什么

### 流式 tool-call 身份（v0.1）

包装 `llm/stream`，后续 SSE 分片里的空 `id` / `name` 不再覆盖已有非空值。全程没有 id 时合成 `compat_call_<index>`。官方 DeepSeek 流在身份已经稳定时保持原样。

### 请求方言 400（v0.2）

在 `agent/request-error` 上识别 `developer` 角色和 `max_completion_tokens` 拒绝，写入官方 `llm-pi-ai` settings，对同一步重试一次，并注入一条会进日志的插件 notice。泛 400 不重试。

### Chat Completions adapter（v0.3）

可选路由，写在 `llm-gateway-compat.providers`。每条路由直接 `POST {baseURL}/chat/completions`，网关安全默认值：

- 系统提示始终是 `role: system`
- 输出上限始终是 `max_tokens`
- 空 tool-call id/name 不会覆盖（即使关掉了流式消毒）
- `extraBody` 给 harness 词汇表没有的字段（`user`、`prompt_cache_key`）
- 额外 header；`Authorization: Bearer` 或百炼/DashScope 的 `api-key`
- thinking 方言：`reasoning_content`（默认）、`thinking`、`think-tags`、`none`

路由 id 不能和 `llm-deepseek`、`llm-pi-ai` 冲突。请用新 id，例如 `dashscope-compat`。

## 安装

从 GitHub 安装（包内已有构建好的 `lib/`，安装时不必再编译）：

```sh
dsh plugin --profile web add github:snowshadow/dsh-llm-gateway-compat
```

重启 `dsh web`。请 pin 到某个 commit（`github:snowshadow/dsh-llm-gateway-compat#<sha>`），避免后续 push 悄悄改变装上的代码。只添加你信任其源码的包。

从本地 checkout 安装：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-llm-gateway-compat
```

## 配置

插件开关写在 `llm-gateway-compat` 这个 profile entry 上。volatile 字段会更新正在运行的插件；设置表单改的也是这些字段。

| 键 | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | 流式包装和 400 恢复的总开关 |
| `diagnose` | `true` | 识别已知网关 400 并注入 YAML 片段 |
| `autoApplyCompat` | `true` | 把对应 `llm-pi-ai` compat 字段写入 settings 并重试一次 |
| `providers` | `{}` | 本插件拥有的 Chat Completions 路由 |

一条网关路由示例：

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

把 `DASHSCOPE_API_KEY` 写进模型页或 `$DSH_HOME/.credentials.yaml`，或在启动 `dsh` 的环境里导出。网关需要 `/v1` 或 `/compatible-mode/v1` 时写进 `baseURL`。然后在模型选择器里选 `dashscope-compat` / `deepseek-v4-flash`。

路由字段：

| 键 | 默认 | 含义 |
|---|---|---|
| `baseURL` | 必填 | origin 加路径前缀；会再拼 `/chat/completions` |
| `apiKeyEnv` | 必填 | 凭据引用：先读模型页 / `$DSH_HOME/.credentials.yaml`，再读该环境变量 |
| `authHeader` | `bearer` | `bearer` 或 `api-key` |
| `models` | `[]` | 目录；未列出的 id 仍按纯文本模型解析 |
| `extraBody` | — | 先合并，再被 harness 字段覆盖；`max_completion_tokens` 会被去掉 |
| `headers` | — | 额外请求头；`User-Agent` 仍来自 harness attribution |
| `thinkingFormat` | `reasoning_content` | 历史回放和流式 reasoning 的方言 |
| `includeUsage` | `true` | 发送 `stream_options.include_usage` |

## 开发

类型检查和测试需要旁边有一份已构建的 `deepseek-harness` checkout（`../deepseek-harness` 或 `DSH_HARNESS`，0.2.1-alpha.2）。`pnpm test` / `pnpm run build` 会把 `@deepseek-ai/dsh-llm`、`cordis`、`schemastery` 链到那份 checkout。

```sh
pnpm install
pnpm test
pnpm run build
```

## 已知限制

- 网关从未给出的工具名无法恢复。
- 不发送图片（`UNSUPPORTED_CONTENT`）。
- `think-tags` 只作用于回放的 assistant 历史，不解析半截流式标签。
- 没有空闲流 watchdog；调用方的 `AbortSignal` 会传给 fetch。
- 自动写入只通过 profile 配置编辑器改 `llm-pi-ai` 上的 `supportsDeveloperRole: false` 和 `maxTokensField: max_tokens`。
- 不发送 `developer` 消息（工具增减）。请求仍带当前的 `tools` 列表。
- volatile 字段可在设置表单里改。其余配置写在 profile patch 里。

## License

MIT
