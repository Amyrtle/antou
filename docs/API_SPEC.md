# API 接入规范

> 案头 antou · v0.1　适用范围：自建后端 ↔ 前端 ↔ 模型服务
> 现状：项目目前是**纯前端**（前端直连模型厂商 + EmailJS）。本规范是把它升级为"有后端"时必须遵守的契约。

---

## 0. 三层结构与职责边界

```
浏览器 (React 前端)
   │  只认自家后端，永远不持有模型厂商 key / 邮件服务商 key
   ▼
应用后端 (/api/v1/*)
   │  鉴权 → 限流 → 校验 → 调用上游 → 计量 → 记账
   ├──────────────► 模型服务 (DashScope / OpenAI 兼容 / Claude)
   ├──────────────► 向量库 (pgvector / Qdrant)
   ├──────────────► 邮件服务 (EmailJS / Resend / SMTP)
   └──────────────► 对象存储 (PDF 原件、导出快照)
```

铁律：

1. **模型 key 只存在于后端**。前端拿不到、也不需要知道。
2. **前端不直接调第三方**，所有第三方调用统一从 `/api/v1/*` 出去，第三方错误统一翻译成内部错误码。
3. **同一份契约出 OpenAPI 3.1**，前端类型由契约生成，不手写。

---

## 1. 通用约定

### 1.1 基础

| 项 | 规范 |
|---|---|
| 基址 | `/api/v1` |
| 编码 | UTF-8 |
| 请求体 | `application/json; charset=utf-8`（文件上传用 `multipart/form-data`） |
| 时间 | ISO 8601 带时区，如 `2026-11-02T13:45:00+08:00` |
| 字段命名 | `snake_case`（与前端 TS 类型一一对应） |
| 布尔 | 只用 `true` / `false`，不用 `0/1`、不用字符串 |
| 空值 | 缺失字段就省略，不要用 `null` 占位；数组无内容用 `[]` |

### 1.2 统一响应包络

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": { "...": "业务数据" },
  "request_id": "req_01HZ8K2M7X"
}
```

失败：

```json
{
  "code": 42901,
  "message": "请求过于频繁，请稍后再试",
  "details": { "retry_after_ms": 3200, "scope": "user" },
  "request_id": "req_01HZ8K2M7X"
}
```

约定：

- HTTP 状态码必须与 `code` 语义一致（`code=0` → 2xx；其余 → 4xx/5xx）
- `request_id` 一律返回，前端错误提示里带上，便于排障
- `message` 是**给人看的一句话**，不要塞堆栈；细节进 `details`
- 列表接口 `data` 固定形状：`{ "items": [], "next_cursor": null, "total": 123 }`

### 1.3 错误码表

| code | HTTP | 含义 | 前端应有的行为 |
|---|---|---|---|
| 0 | 200 | 成功 | — |
| 40001 | 400 | 参数校验失败 | 高亮字段，不重试 |
| 40002 | 400 | 请求体过大 | 提示拆分文件 |
| 40100 | 401 | 未登录 / token 无效 | 跳登录 |
| 40101 | 401 | 权限不足 | 提示无权限 |
| 40200 | 402 | 额度不足 | 提示充值 / 切本地模式 |
| 40300 | 403 | 命中内容安全策略 | 提示换个说法 |
| 40400 | 404 | 资源不存在 | 提示已删除 |
| 40900 | 409 | 冲突（如重复发送） | 幂等返回已有结果 |
| 42201 | 422 | 语义错误（PDF 无文本层等） | 展示 details.hint |
| 42901 | 429 | 触发限流 | 按 `retry_after_ms` 提示，可重试 |
| 42902 | 429 | 触发上游限流 | 退避重试 |
| 50000 | 500 | 内部错误 | 提示稍后重试，带 request_id |
| 50010 | 504 | 上游超时 | 可回退本地模式 |
| 50011 | 502 | 上游返回异常 | 可回退本地模式 |
| 50012 | 502 | 上游返回格式不合法 | 记录原始响应，可回退 |
| 50300 | 503 | 服务维护中 | 提示稍后 |

### 1.4 鉴权

```
Authorization: Bearer <access_token>
```

- token 由后端签发，短期有效（建议 2 小时）+ refresh token
- 所有业务接口校验用户态；模型与邮件的服务商 key 只在服务端配置（环境变量或密钥管理服务）
- 前端不缓存 token 到 localStorage（若必须缓存，需 XSS 风险说明）

### 1.5 幂等

有副作用的接口（发信、导出、删除、创建任务）支持 `Idempotency-Key` 请求头：

- 值为客户端生成的 UUID
- 后端在 24 小时内缓存 (key → 响应)
- 重复请求直接回放原响应，`code=0`，并加 `X-Idempotent-Replay: true`

### 1.6 分页

游标分页，不要 offset：

```
GET /api/v1/documents?limit=20&cursor=eyJpZCI6...
→ { "items": [...], "next_cursor": "eyJpZCI6...", "total": 138 }
```

`limit` 上限 100。排序字段白名单化，避免注入。

### 1.7 限流

维度：用户（主）+ IP（辅）+ 全局（保底）。同时限 RPM 与 TPM。

响应头：

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1780000060
```

超限返回 `42901`，`details.retry_after_ms` 给出建议等待。

### 1.8 超时与重试（后端 → 上游）

| 场景 | 超时 | 重试 |
|---|---|---|
| 模型普通档 | 30s | 429/5xx 退避重试 2 次（1s、3s，带 ±20% 抖动） |
| 模型高思考档 | 120s | 同上 |
| 向量化（批量） | 60s | 3 次 |
| 邮件发送 | 15s | 不重试（用幂等键防重复） |
| PDF 解析 | 120s / 页 | 1 次 |

超时后必须 cancel 上游请求，不能挂着。

### 1.9 幂等与可观测

- 每个请求生成 `request_id`，贯穿：入口日志 → 上游调用 → 计量落库 → 错误返回
- 日志字段：request_id / user_id / 接口 / 上游模型 / 耗时 / token 用量 / 命中片段数 / 是否回退 / 错误码
- **日志不落原文**：只落长度、hash、片段 id
- 指标：按接口维度的 P50/P95/P99 延迟、错误率、token 消耗、每日成本

---

## 2. 模型接口：`POST /api/v1/chat`

后端与前端的对话契约（前端已在 `src/lib/llm.ts` 实现客户端版本）。

### 2.1 请求

```json
{
  "scope": { "type": "all" | "ids" | "tag", "value": "paper_id,paper_id | 标签名" },
  "question": "增强强度和域偏移之间是什么关系？",
  "history": [
    { "role": "user", "content": "上一轮问题" },
    { "role": "assistant", "content": "上一轮回答" }
  ],
  "params": {
    "model": "qwen-plus",
    "reasoning_effort": "off | low | medium | high",
    "temperature": 0.2,
    "top_p": 0.8,
    "max_tokens": 1600,
    "seed": 20261102,
    "repetition_penalty": 1.05
  },
  "response_format": { "type": "json_object" }
}
```

`params` 的取值范围与语义见 `docs/MODEL_PARAMS.md`。

### 2.2 响应

```json
{
  "code": 0,
  "data": {
    "answer_segments": [
      { "type": "quote", "text": "逐字来自片段的原文摘录……", "citation_index": 1 },
      { "type": "infer", "text": "模型自己的归纳……" }
    ],
    "citations": [
      {
        "index": 1,
        "paper_id": "p_xxx",
        "page": 3,
        "para_index": 2,
        "span": "在 12.8 万样本规模下……",
        "score": 0.87
      }
    ],
    "usage": {
      "prompt_tokens": 3120,
      "completion_tokens": 860,
      "reasoning_tokens": 0,
      "total_tokens": 3980
    },
    "model": "qwen-plus",
    "thinking_ms": 1240,
    "degraded": false
  },
  "request_id": "req_01HZ8K2M7X"
}
```

### 2.3 服务端必须做的加工（别把脏活丢给前端）

1. **检索**：按 `scope` 过滤 → 混合检索（BM25 + 向量）→ 融合重排 → 取 topK
2. **片段编号**：把命中的片段编成 `[1] [2] [3]`，编号必须稳定且与返回的 `citations[].index` 对齐
3. **上下文预算切分**：见 `MODEL_PARAMS.md` §5.3
4. **JSON 校验**：模型返回必须过 schema；不合规重试一次，仍不合规则回退本地检索并置 `degraded=true`
5. **引用可校验**：`quote.text` 必须能在对应片段里子串匹配；匹配不上就降级为 `infer` 或标 `verified=false`
6. **emoji 过滤**：对所有 `text` 过一遍 `stripEmoji`
7. **计量**：把 `usage` 原样返回并落库，供成本核算

### 2.4 降级链

```
在线模型 → （超时/报错/格式不合法）→ 本地检索归纳 → 返回 degraded=true
前端：degraded=true 时在回答下方显示黄色提示条，并提供"重试"
```

前端已实现降级（`src/lib/llm.ts` 的 `answerOnline` 抛错 → `answerLocal` 兜底），补齐 `degraded` 字段与"重试"按钮即可。

---

## 3. 检索与向量化

### 3.1 `POST /api/v1/search`

```json
{
  "query": "增强强度 域偏移 拐点",
  "scope": { "type": "all" },
  "top_k": 8,
  "mode": "hybrid",
  "min_score": 0.35
}
```

响应：

```json
{
  "code": 0,
  "data": {
    "items": [
      { "paper_id": "p_1", "page": 1, "para_index": 1, "text": "……", "score": 0.87,
        "lexical_score": 0.71, "vector_score": 0.83 }
    ],
    "mode": "hybrid",
    "took_ms": 42
  }
}
```

规则：

- `min_score` 低于阈值的片段直接丢弃，不进模型
- 中文检索：BM25 侧用二元分词；向量侧用 bge-m3 / text-embedding-v3
- 融合：RRF（reciprocal rank fusion）或加权归一化；重排可选 bge-reranker

### 3.2 `POST /api/v1/embed`

批量向量化，入库时调用：

```json
{ "texts": ["段落1", "段落2"], "model": "bge-m3" }
```

响应：`{ "code": 0, "data": { "vectors": [[...]], "dim": 1024, "usage": {...} } }`

- 单次最多 32 条
- 同一 `chunk_id` 重复提交应幂等（同 id 覆盖）

### 3.3 `POST /api/v1/documents/parse`

服务端解析 PDF（含 OCR），异步任务：

```json
{ "filename": "a.pdf", "content_base64": "...", "options": { "ocr": true, "max_pages": 60 } }
```

响应：`{ "code": 0, "data": { "task_id": "task_xxx", "status": "queued" } }`

轮询 `GET /api/v1/tasks/{task_id}`：

```json
{ "code": 0, "data": { "status": "done", "result": { "title": "...", "year": 2024, "pages": 12, "chunks": 86 } } }
```

`status` 枚举：`queued | running | done | failed`。失败时 `code=42201`，`details.hint` 写清原因（例如"该 PDF 无文本层且未启用 OCR"）。

服务端解析要做的：大小限制（≤ 50MB）、页数限制、超时强杀、sandbox 执行、**日志不落原文**。

---

## 4. 邮件接口

### 4.1 `POST /api/v1/mail/send`

```json
{
  "to": [ { "name": "周老师", "email": "mentor@university.edu" } ],
  "subject": "本周实验进度 · 增强策略关键指标对照",
  "body": "……（已渲染变量的正文）",
  "template": "weekly",
  "vars": { "导师姓名": "周老师", "本周样本数": "6" },
  "attachments": [
    { "name": "增强策略关键指标对照.xlsx", "storage_key": "snap_xxx", "rows": 6, "format": "xlsx" }
  ],
  "idempotency_key": "mail_20261102_0001"
}
```

响应：

```json
{
  "code": 0,
  "data": { "status": "sent", "provider": "emailjs", "provider_message_id": "abc123", "sent_at": "2026-11-02T21:43:11+08:00" }
}
```

约束：

- 收件人邮箱格式校验，失败 `40001`
- 附件只允许 `storage_key`，不允许前端直传二进制（防止超大文件）
- 变量未填齐时后端也要校验（前端已做，这里做二次保险）
- 发送失败 → `50011`，并把草稿保留（草稿由前端本地管理，不回滚）

### 4.2 `POST /api/v1/mail/schedule`

```json
{ "draft_id": "...", "send_at": "2026-11-03T09:00:00+08:00", "timezone": "Asia/Shanghai" }
```

响应：`{ "code": 0, "data": { "task_id": "task_xxx", "status": "scheduled" } }`

后端调度器负责到点执行（APScheduler / Celery beat / 云函数定时触发）。这是当前实现最大的缺口：前端只把状态标成 `scheduled`，没有真正的定时器。

---

## 5. 前端接入后端时的改造点

| 现在 | 改造后 |
|---|---|
| `src/lib/llm.ts` 直接 fetch DashScope | 改为 fetch `${API_BASE}/api/v1/chat`，`src/lib/api.ts` 统一封装 fetch + 包络解析 + 错误码映射 + 超时 + 重试 + `request_id` 透传 |
| key 存 localStorage | 删除；后端托管 |
| `src/lib/mailer.ts` 直接调 EmailJS | 改为调 `/api/v1/mail/send`；EmailJS 只在后端 |
| 邮件草稿存 localStorage | 短期可保留（离线可用），同步一份到后端做定时与历史 |
| 检索在浏览器内（minisearch） | 双轨：本地 BM25 保留做离线兜底，在线优先走后端混合检索 |
| 文献正文存 IndexedDB | 可保留；若上云则双写并提供删除接口 |

新增建议文件：

```
src/lib/api.ts          // fetch 封装、包络、错误码 → 用户可读文案、超时重试
src/lib/apiClient.ts    // typed endpoints（chat/search/embed/parse/mail）
src/store/settings.ts   // 增加 apiBaseUrl、reasoningEffort、requestId 透传
```

---

## 6. 契约与测试

1. **OpenAPI 3.1**：后端输出 `/openapi.json`，前端用 `openapi-typescript` 生成类型
2. **契约测试**：后端每个接口配一组 fixture（正常 + 边界 + 错误），CI 里跑
3. **前端 mock**：把 OpenAPI 喂给 `msw`，前端可以离线开发与写交互测试
4. **回归脚本**：现有 `scripts/e2e.mjs` 在后端上线后补一条"真实链路"用例（带 `apiBaseUrl` 环境变量）
