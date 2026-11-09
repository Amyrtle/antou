# 模型参数与「思考强度」规范

> 案头 antou · v0.1　适用范围：检索层 / 生成层 / 思考层的全部可调参数
> 现状：前端已实现 temperature / max_tokens / response_format 的最小集；**思考强度（reasoning effort）尚未接入，是明确缺口**。

---

## 1. 三层参数分工

| 层 | 作用 | 谁来定 | 出问题时的表现 |
|---|---|---|---|
| 检索层 | 决定"给模型看什么" | 系统（写死基线，用户只调 topK） | 检索不到 → 回答泛泛而谈 |
| 生成层 | 决定"怎么写" | 系统（低温度）+ 用户可选风格 | 数字乱编、每次回答不一样 |
| 思考层 | 决定"想多久" | **用户可选档位** | 简单问题慢；复杂问题想得不够 |

原则：**能靠检索解决的不用思考，能靠思考解决的不用加检索**。先把 topK 与分块质量做好，再谈思考强度。

---

## 2. 检索层基线

| 参数 | 基线 | 范围 | 说明 |
|---|---|---|---|
| `top_k` | 8 | 4–12 | 送进模型的片段数。超过 10 注意力被稀释，还会挤占上下文 |
| `min_score` | 0.35 | 0.2–0.5 | 低于阈值不送，宁可少送也不要送无关原文 |
| `chunk_size` | 700 字 | 400–900 | 中文按段落切，保留 page / para_index |
| `chunk_overlap` | 120 字 | 80–150 | 跨段引用不丢上下文 |
| `mode` | `hybrid` | `bm25` / `vector` / `hybrid` | 离线用 bm25，在线用 hybrid |
| `rerank` | 开（在线） | — | bge-reranker 之类，把 topK 从 30 收敛到 8 |

中文检索注意：BM25 侧必须用**二元分词**（见 `src/lib/retrieve.ts` 的 `tokenize`），否则整句中文会被当成一个 term，检索直接失效。

---

## 3. 生成层基线

| 参数 | 基线 | 范围 | 理由 |
|---|---|---|---|
| `temperature` | 0.2 | 0.1–0.4 | 抽取型任务要确定性与可复现，不要创造力 |
| `top_p` | 0.8 | 0.7–0.95 | 和 temperature 一起降，只调一个容易踩坑 |
| `max_tokens` | 1600 | 1200–2000 | 3 段摘录 + 1 段推断 + JSON 包裹 |
| `seed` | 固定（当前提问 id） | — | 同问同答，方便复现与截图对比 |
| `repetition_penalty` | 1.05 | 1.0–1.1 | 轻微抑制复读，别超过 1.1（会伤术语） |
| `presence_penalty` | 0 | 0 | 中文场景基本不用 |
| `response_format` | `{type:'json_object'}` | — | 强制 JSON，否则前端解析会炸 |
| `stop` | 不设 | — | JSON 模式不需要 |

### 3.1 输出 JSON 契约（必须严格遵守）

```json
{
  "answer_segments": [
    { "type": "quote", "text": "逐字来自编号片段的原文，不得改写" },
    { "type": "infer", "text": "你自己的归纳与推断" }
  ],
  "citations": [ { "index": 1, "score": 0.87 } ]
}
```

硬性规则：

1. 至少 1 段 `quote`，至少 1 段 `infer`
2. `quote.text` 必须是片段的**连续子串**，不允许改标点、不允许省略中间
3. `citations[].index` 指向提示词里的 `[n]` 片段编号
4. 不输出任何表情符号（前端仍会再过滤一次 `stripEmoji`）
5. 不输出解释性文字，模型只输出 JSON

### 3.2 系统提示词模板

```
你是一名严谨的科研助理。请只依据给定的文献片段回答，并严格输出 JSON：
{"answer_segments":[{"type":"quote","text":"原文摘录，必须逐字来自片段"},{"type":"infer","text":"你的推断，必须与原文摘录区分"}],"citations":[{"index":1,"score":0.9}]}
要求：至少 1 段 quote，1 段 infer；引用编号对应片段编号；不要输出任何表情符号。
```

---

## 4. **思考强度（reasoning / thinking effort）**

### 4.1 四档定义

| 档位 | 内部枚举 | 典型预算 | 建议超时 | 适合的提问 | 体感 |
|---|---|---|---|---|---|
| 关 | `off` | 0（不思考） | 20s | "p.4 讲了什么"、"作者用了几个随机种子" | 秒回 |
| 低 | `low` | ~1k tokens | 30s | 默认档。差异对比、归纳、"这三篇有什么不同" | 1–3 秒 |
| 中 | `medium` | ~4k tokens | 60s | "为什么这两篇结论冲突"、"哪个结论更可信" | 10–30 秒 |
| 高 | `high` | ~16k tokens | 120s | 跨三篇做方法论对齐、找隐含前提、审稿式挑刺 | 30–90 秒 |

### 4.2 跨厂商参数映射

| 厂商 / 模型 | 开关方式 | 预算参数 | 备注 |
|---|---|---|---|
| 通义千问 Qwen3 / Qwen3-Max | `enable_thinking: true/false` | `thinking_budget: <tokens>` | `false` 等价 `off` |
| Qwen-Plus（非 thinking 版） | 无 | 无 | 只支持 `off` / `low` 两档，UI 要按模型能力收敛 |
| OpenAI o 系列 / GPT-5 | `reasoning_effort: "low"\|"medium"\|"high"` | 不可配 | `off` 需换非推理模型 |
| Anthropic Claude | `thinking: {type:'enabled', budget_tokens:N}` | `budget_tokens` | 必须大于 1024，且不能关 temperature |
| DeepSeek / 豆包 / 智谱等 | 多为布尔开关 | 无 | 统一落到 `off` / `low` 行为 |

**结论：UI 上是四档，落到具体厂商请求时按上表映射；模型不支持的档位要置灰并说明原因，不能静默降级。**

### 4.3 思考强度的产品规则

1. **默认 `low`**。对研究生日常提问够用，延迟可接受
2. **高档位必须有耗时预期**：点击后按钮进入 loading，状态条显示"深度思考中（约 30–60 秒）"，并给"取消"按钮
3. **思考内容不直接展示**：除非厂商能把 reasoning 与最终答案分开返回；只展示 `answer_segments`
4. **高档位提示成本**：设置里写明"高档位会消耗更多 token，费用约为低档的 3–8 倍"
5. **降级可见**：高档位超时 → 自动回退低档重试一次，再失败回退本地检索，并显示提示
6. **可复现**：高档位也要固定 seed，方便截图与复查

### 4.4 前端接入清单（当前全部未做）

- [ ] `src/store/settings.ts` 增加 `reasoningEffort: 'off'|'low'|'medium'|'high'`，默认 `low`
- [ ] 设置面板加分段控件；按当前模型能力置灰不支持的档位
- [ ] `src/lib/llm.ts` 增加厂商映射函数 `toVendorParams(model, effort, baseParams)`
- [ ] `src/store/qa.ts` 提问时带上 effort，并按档位设置超时（AbortController）
- [ ] 流式状态区新增"深度思考中"提示 + 取消按钮
- [ ] 展示 `usage.reasoning_tokens`，统计条里能看出高档位的额外开销
- [ ] 高档位超时自动降级到 `low` 重试一次（最多一次）

### 4.5 服务端配合

- 后端 `POST /api/v1/chat` 的 `params` 已预留 `reasoning_effort` 字段（见 `docs/API_SPEC.md` §2.1）
- 后端负责映射厂商参数、设置上游超时、按档位限流（高档位消耗快，建议单独限流）
- 后端返回 `usage.reasoning_tokens` 与 `thinking_ms`，供前端展示与计费

---

## 5. 上下文预算切分

模型上下文是有限资源，按比例切：

```
模型上下文窗口           = C（例如 128k）
- 系统提示              = S（约 400 token）
- max_tokens（输出预留） = O（1600）
- 安全余量              = M（10%）
可用于文献片段的预算      = C - S - O - M
再乘 0.6 作为片段占用上限  →  L
每片平均上限              = L / top_k
```

片段超长时**按段落边界裁切**，必须保留 `page` 与 `para_index`，否则引用跳转会错位。

片段编号与顺序：编号必须**稳定**（同一次提问内不变），因为答案里的角标 `[1]` 依赖它；重排后要同步更新编号映射。

---

## 6. 幻觉控制三件套

1. **强制两类段落**：回答至少一段原文摘录 + 一段推断，UI 样式必须可分（本项目已实现，见 `.seg-quote` / `.seg-infer`）
2. **引用可校验**：服务端校验 `quote.text` 在对应片段里的子串匹配；匹配不上 → 降级为 `infer` 或标 `verified=false`，前端提示"该段引用未通过原文校验"
3. **不确定就降级**：检索无命中（`min_score` 全被过滤）时，**不允许模型自由发挥**，直接返回"当前语料中没有与该问题直接相关的内容"，前端给出换问法或扩大范围的建议

补一条：数值必须能从原文里定位到同一段。做数值抽取时记录来源 span，UI 上数值要能点回原文。

---

## 7. 成本与计量

| 项 | 口径 |
|---|---|
| 计费口径 | 上游返回的 `usage` 原样记账，含 `reasoning_tokens` |
| 每日预算 | 按用户设 token 上限，超出后切本地模式而不是报错 |
| 成本看板 | 按用户 / 按天 / 按模型三个维度统计，界面里能看到"今天用了多少" |
| 缓存 | 同一问题 + 同一语料版本 → 缓存 10 分钟（seed + prompt hash 作 key），省 token 也保证一致性 |

---

## 8. 参数速查（可直接抄进代码）

```ts
export const BASELINE = {
  retrieval: { top_k: 8, min_score: 0.35, chunk_size: 700, chunk_overlap: 120, mode: 'hybrid' },
  generation: {
    temperature: 0.2,
    top_p: 0.8,
    max_tokens: 1600,
    seed: 20261102,
    repetition_penalty: 1.05,
    response_format: { type: 'json_object' },
  },
  thinking: {
    off:    { effort: 'off',    budget: 0,     timeout_ms: 20_000,  max_tokens: 1200 },
    low:    { effort: 'low',    budget: 1024,  timeout_ms: 30_000,  max_tokens: 1600 },
    medium: { effort: 'medium', budget: 4096,  timeout_ms: 60_000,  max_tokens: 2000 },
    high:   { effort: 'high',   budget: 16384, timeout_ms: 120_000, max_tokens: 2600 },
  },
}
```
