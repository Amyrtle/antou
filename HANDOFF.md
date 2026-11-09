# 案头 antou · 交接文档

> 版本：v0.1（2026-11-02）　仓库：`D:/2026-11-02-20-40-27`
> 面向：接手继续开发 / 部署上线 / 参赛提交的人

---

## 0. 一页速览

| 项目 | 内容 |
|---|---|
| 是什么 | 给研究生用的桌面式研究工作台：**读（文献问答带引用）→ 写（数据表与报表）→ 发（邮件）** 一条线打通 |
| 技术栈 | Vite 5 + React 18 + TypeScript + Tailwind 3 + Zustand；pdf.js、minisearch、SheetJS、ECharts（懒加载） |
| 运行形态 | 纯前端单页应用，无后端。数据全在本机浏览器（IndexedDB + localStorage） |
| 启动 | `npm run dev`（开发）／`npm run build` 后 `python serve.py`（本地预览构建产物）／部署到 Qoder Sites（`dist/` 直接上传） |
| 演示前置 | **零配置**：不申请 key、不发任何请求即可跑完「提问 → 建表 → 导出 → 发信」全链路 |
| 配套文档 | `docs/API_SPEC.md`（API 接入规范）、`docs/MODEL_PARAMS.md`（模型参数与思考强度规范）、`docs/TODO_BACKLOG.md`（未完成清单）、`docs/参赛作品帖.md`（论坛帖草稿） |

---

## 1. 现在能跑通什么（已验收）

| 链路 | 状态 | 自测证据 |
|---|---|---|
| 提问（本地检索、流式输出） | 通过 | `scripts/e2e.mjs` |
| 点角标 → 证据栏滚动高亮、显示页码/相似度 | 通过 | 同上 |
| 回答 → 一键建表（问答窗吸左半、表窗吸右半） | 通过 | 同上 |
| 报表视图（3 指标卡 + 柱线组合图） | 通过 | `shots/final-3-report.png` |
| 导出 CSV / XLSX / PDF | 通过 | xlsx 反读，数值列类型为 `number`，中文不乱码 |
| 导出后邮件抽屉弹出、变量行内编辑、检查清单、发送 | 通过 | `shots/final-7-mail.png` |
| 拖 PDF 入库（pdf.js 本地解析） | 通过 | `scripts/e2e-upload.mjs`，3 篇 → 6 篇 |
| 刷新后窗口位置还原 | 通过 | 刷新前后 `{x:945,y:44,w:495}` 完全一致 |
| 1440 / 1280 / 900 三档可用 | 通过 | `shots/final-8-narrow.png` |
| 控制台零报错 | 通过 | 两个 e2e 脚本均输出 `console errors: none` |

自测命令：

```bash
node scripts/make-pdfs.mjs    # 生成 3 个测试 PDF
npm run verify               # 一键回归：构建 + 自动起 dev server + 两个 e2e（需联网）
node scripts/e2e.mjs          # 全链路回归
node scripts/e2e-cases.mjs    # 实例库回归：筛选/预览/抄入/联网检索/登记（需联网）
node scripts/e2e-upload.mjs   # 上传 + 刷新还原 + 窄屏
node scripts/shot.mjs http://127.0.0.1:8000/ shots/x.png 1440 900
```

---

## 2. 目录与关键文件

```
src/
  app/         外壳：TopBar / StageRail / Canvas / PeekPanel / StatusStrip / CommandPalette
  windows/     WindowFrame（拖拽/吸附/置顶/最小化）+ QaWindow / TableWindow / CasesWindow / MailDrawer
  store/       library（文献+检索索引）/ qa（线程+消息+证据）/ data（表+报表）/ mail / windows / ui / settings / history
  lib/         pdf 解析、retrieve（分词+检索）、llm（本地归纳 + 在线调用）、api（包络/错误码/重试）、
               caseLibrary（实例库案例数据）、caseSearch（DataCite/Crossref 联网检索）、caseImport（抄入动作）、
               extract（数值抽取）、stats、exporters（CSV/XLSX/PDF）、mailer（模板/变量/发送/EML）、db（IndexedDB）、useCountUp
  ui/          Icon / kit（Button Chip Dot Field Floating Empty Note Label）
docs/          API_SPEC.md / MODEL_PARAMS.md / TODO_BACKLOG.md / 参赛作品帖.md
scripts/       shot / e2e / e2e-upload / final-shots / make-pdfs（playwright-core 驱动本机 Edge，不下载浏览器）
serve.py       Python 静态服务（SPA 回退、禁缓存、可自动开浏览器）
```

接手时优先看这 6 个文件：`src/lib/llm.ts`（模型调用）、`src/lib/mailer.ts`（邮件）、`src/store/qa.ts`（问答状态机）、`src/windows/WindowFrame.tsx`（窗口管理）、`src/lib/db.ts`（持久化）、`src/lib/exporters.ts`（导出）。

---

## 3. **未完成清单**（最重要的一节）

完整可勾选版本见 `docs/TODO_BACKLOG.md`，这里按严重程度给摘要。

### 3.1 必须补齐才能上生产（当前是演示级）

| # | 事项 | 现状 | 该怎么做 |
|---|---|---|---|
| M1 | **后端 API 网关** | 完全没有。前端直连模型 API，key 存在用户本地 | 按 `docs/API_SPEC.md` 起一层薄后端：鉴权、限流、代理、日志、计量。见 §4 |
| M2 | **真实发信调度** | 「定时发送」只写了 `status='scheduled'`，没有调度器，到点不会发 | 后端加任务队列（APScheduler / Celery / 云函数），到点执行 EmailJS/SMTP，见 §5 |
| M3 | **PDF 扫描件 OCR** | 扫描件无文本层，解析结果为空，列表里标失败 | 接入 tesseract.js（前端）或 PaddleOCR（后端），失败时明确提示"该 PDF 无文本层" |
| M4 | **密钥托管** | key 存 localStorage，共享电脑上有泄露风险 | 生产环境一律走后端代理，前端不接触 key；或至少加 WebCrypto 加密存储 + 过期时间 |
| M5 | **检索质量** | 只有 BM25（minisearch 中文二元分词），长文档召回一般 | 加向量检索（DashScope text-embedding-v3 / bge-m3 + pgvector / Qdrant），BM25 作兜底，见 `docs/API_SPEC.md` §4.3 |
| M6 | **大列表性能** | 文献 > 30 篇、表格 > 200 行没有虚拟滚动 | 表格用虚拟行（react-window 或自研），文献列表按需分页 |

### 3.2 明确没做的功能（不是 bug，是取舍）

- **没有综述草稿导出 DOCX**（P1 里提过，现在完全没有）
- **没有跨窗口共享筛选条件**：并排对照目前只是吸附对齐，两窗的筛选条件各自独立
- **没有语义向量检索**，只有 BM25
- **没有元数据补全**：Crossref / DOI 反查期刊年份作者没接，年份是从正文正则里猜的
- **没有多用户 / 协作 / 云同步**，产品定位就是单机工具
- **没有 OCR、没有视频、没有语音**输入
- **移动端只做到"能看能点"**，没有专门设计（< 900px 时窗口会收窄但表格仍需横向滚动）
- **没有 CI**：目前靠本地脚本手工回归
- **PDF 导出走浏览器打印**（`window.print()`），没有后端截图成 PDF 的链路

### 3.3 已知的行为边界

| 场景 | 现在的行为 | 接手后要不要改 |
|---|---|---|
| 在线模型调用失败 | 自动回退本地检索，并在回答下方显示一行黄色提示 | 保留，但建议加"重试"按钮 |
| 模型返回带 emoji | `stripEmoji()` 过滤 | 保留 |
| 回答里的引用与原文对不上 | 不校验，模型给什么就显示什么 | **建议补**：引用 span 在原文中找不到时降级为"推断"样式 |
| 数值抽取不准 | 指标名靠正则清洗，仍有噪声（如"策略组合取得"） | 建议换成模型抽取，或让用户在表里改 |
| 邮件发送失败 | 保留草稿、显示原因、可重试 | 保留 |
| 数据表删列 | 立即生效，无回收站 | 建议加确认或撤销 |

---

## 4. **API 应该怎么做，怎么规范**

完整规范见 **`docs/API_SPEC.md`**，这里是给接手人的决策摘要。

### 4.1 现在前端是怎么调模型的（`src/lib/llm.ts`）

```
POST {baseUrl}/chat/completions        # DashScope OpenAI 兼容接口
Authorization: Bearer <用户自己填的 key>
{
  model: "qwen-plus",
  temperature: 0.2,
  response_format: { "type": "json_object" },
  messages: [
    { role: "system", content: 严格输出 JSON 的系统提示 },
    { role: "user",   content: "编号文献片段 + 问题" }
  ]
}
```

模型必须返回：

```json
{
  "answer_segments": [
    { "type": "quote", "text": "逐字来自片段的原文" },
    { "type": "infer", "text": "模型自己的归纳" }
  ],
  "citations": [ { "index": 1, "score": 0.87 } ]
}
```

`index` 对应提示词里 `[1]` `[2]` 的片段序号，前端据此生成角标与证据栏。

### 4.2 上生产必须补的六件事（按优先级）

1. **不要让前端持有 key**。前端调 `/api/v1/chat` 自家后端，后端再调模型厂商，前端永远拿不到厂商 key。
2. **统一响应包络**：成功 `{ code:0, data, request_id }`，失败 `{ code, message, details, request_id }`；HTTP 状态码同时给对。
3. **统一错误码表**（`40001 参数错 / 40100 未鉴权 / 42901 限流 / 50010 上游超时 / 50011 上游报错`），前端按 code 决定是提示、还是回退本地、还是弹设置。
4. **限流与预算**：按用户 + 按 key 双维度限流（RPM / TPM），返回 `X-RateLimit-*` 头；超限直接 429，前端展示"稍后再试"。
5. **超时 + 指数退避重试**：只对 429/5xx 重试，最多 2 次，退避 1s / 3s 带抖动；总超时 30s（长思考档位单独放宽到 90s）。
6. **可观测**：每次调用带 `request_id` 贯穿日志，落地耗时、token 用量、命中片段数、是否回退。

### 4.3 建议的后端接口清单

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/v1/chat` | 对话式问答（当前核心） |
| POST | `/api/v1/embed` | 文本向量化（批量，入库时调） |
| POST | `/api/v1/documents/parse` | 服务端解析 PDF / OCR，异步任务 + 轮询 |
| GET | `/api/v1/documents` | 文献列表（分页、筛选、排序） |
| POST | `/api/v1/search` | 混合检索（BM25 + 向量，带融合与重排） |
| POST | `/api/v1/mail/send` | 真实发信 |
| POST | `/api/v1/mail/schedule` | 定时发信 |
| GET | `/api/v1/usage` | token / 成本 / 调用量 |

### 4.4 规范细节清单

- 版本化：`/api/v1`，破坏性变更走 `/api/v2`，字段只增不改语义
- 鉴权：`Authorization: Bearer <token>`，服务端校验用户态；模型 key 永不出服务端
- 幂等：发信、导出等有副作用的接口支持 `Idempotency-Key` 头
- 分页：游标分页（`cursor` / `limit`），不要 offset
- 校验：入参用 schema 校验，错误要带字段名，例如 `{ field: "messages[0].content", reason: "too long" }`
- CORS：只允许自家站点域名
- 契约：接口出 OpenAPI 3.1 文档，前端从文档生成类型，避免手写漂移
- 安全：PDF 解析在沙箱里跑，限制大小与页数，超时强杀；日志不落原文

---

## 5. **模型参数与「思考强度」规范**

完整规范见 **`docs/MODEL_PARAMS.md`**。要点：

### 5.1 参数分层（不要一个档打天下）

| 层 | 参数 | 取值 | 说明 |
|---|---|---|---|
| 检索层 | topK | 6–10 | 送进模型的片段数，超了会稀释注意力 |
| 检索层 | score 阈值 | ≥ 0.35 | 低于阈值不送，避免拿无关原文编答案 |
| 生成层 | temperature | 0.1–0.2 | 抽取型任务要低温度，保证可复现 |
| 生成层 | top_p | 0.8 | 与 temperature 一起降，别只调一个 |
| 生成层 | max_tokens | 1200–2000 | 留够 3 段摘录 + 1 段推断 |
| 生成层 | seed | 固定 | 同问同答，便于复现与截图 |
| 生成层 | repetition_penalty | 1.05 | 轻微抑制复读 |
| **思考层** | **reasoning_effort** | **off / low / medium / high** | 见下 |

### 5.2 思考强度（thinking / reasoning effort）四档

这是最需要规范化的一块——现在前端**没有暴露这个参数**，是缺口。

| 档位 | 等价参数 | token 预算 | 超时建议 | 适用场景 |
|---|---|---|---|---|
| `off` | `enable_thinking: false` | 0 | 20s | 事实型提问（"p.4 讲了什么"），追求秒回 |
| `low` | `thinking_budget: 1024` | ~1k | 30s | 默认档。差异对比、归纳类问题够用 |
| `medium` | `thinking_budget: 4096` | ~4k | 60s | 需要多步推理的"为什么两者矛盾" |
| `high` | `thinking_budget: 16384` | ~16k | 120s | 跨三篇论文做方法论对齐、找矛盾 |

跨厂商映射：

- 通义千问 Qwen3：`enable_thinking: true/false` + `thinking_budget: <tokens>`
- OpenAI o 系列 / GPT-5：`reasoning_effort: "low" | "medium" | "high"`
- Anthropic Claude：`thinking: { type: "enabled", budget_tokens: N }`
- 国产其他（DeepSeek / 豆包等）：多数只暴露开关，落到 `low` 行为

前端要做的（**当前缺失**）：

1. 设置面板加"思考强度"分段控件（关 / 低 / 中 / 高），存 localStorage
2. 档位变化时同步调整：请求超时、max_tokens、是否显示"正在思考"流式状态
3. 高档位要有**明确的耗时预期**：按钮进入 loading、状态条显示"深度思考中（约 30–60 秒）"，可取消
4. 思考内容不要直接吐给用户（除非厂商支持分离返回），只展示最终 `answer_segments`
5. 计费上高档位贵（思考 token 也计费），UI 要提示"高 = 更准也更慢更贵"

### 5.3 上下文预算切分

给模型的总上下文要按比例切，不然长文会被截：

```
总窗口 = 模型上下文 - max_tokens - 系统提示 - 安全余量
可用于文献片段的预算 = 总窗口 × 0.6
再按 topK 均分，每片超长则按段落边界裁切（保留 page / para_index，引用跳转靠它）
```

### 5.4 幻觉控制三件套

1. **强制两类段落**：回答至少 1 段 `quote`（逐字原文）+ 1 段 `infer`（推断），UI 上必须样式可分
2. **引用可校验**：模型给的 `text` 必须在对应片段里做子串匹配，匹配不上就降级成 `infer` 或标"未验证"
3. **不确定就降级**：检索无命中时不允许自由发挥，直接回"当前语料没有相关内容"，而不是硬凑

---

## 6. 部署交接

### 6.1 Qoder Sites（参赛硬要求：必须部署到 Qoder Sites 并公开可访问）

1. 本地 `npm run build`，产物在 `dist/`（纯静态，无需 Node 运行时）
2. 在 Qoder 里创建站点项目，构建命令 `npm run build`，发布目录 `dist`
3. 需要 SPA 回退：把未匹配路径回退到 `index.html`（Qoder Sites 的静态托管一般支持配置；不行就在 `dist` 里加 `404.html` 复制一份 `index.html`）
4. 本地验证用 `python serve.py`（已内置 SPA 回退 + 禁缓存）
5. 部署完成后：把公开链接填进 `docs/参赛作品帖.md` 的"链接"位置，再发赛题页论坛

### 6.2 上线前检查

- [ ] 公开链接在新标签、无痕窗口能打开（不依赖 localStorage 里的旧数据）
- [ ] 首屏 3 秒内能看到内容（内置示例数据）
- [ ] 全程无控制台报错
- [ ] 导出的 XLSX 用 Excel 打开不乱码、数字列是数值格式
- [ ] 邮件发送失败有明确提示且草稿不丢
- [ ] 全站搜不到 emoji
- [ ] 窄屏（1280 / 1024）不塌
- [ ] 若启用后端：API 错误码与前端降级逻辑对齐

### 6.3 静态资源与缓存

- `dist/assets/*.[hash].js|css` 由 Vite 带 hash，可长缓存
- `index.html` 不缓存（当前 `serve.py` 已全禁缓存，方便开发；生产建议只对 index.html 禁缓存）

---

## 7. 数据与隐私

| 数据 | 位置 | 说明 |
|---|---|---|
| 论文正文与分块 | IndexedDB（库名 `antou`，表 `papers` / `chunks`） | 浏览器本地，不上传 |
| 窗口位置、数据表、邮件草稿、设置 | localStorage（前缀 `antou.`） | 同上 |
| 模型调用 | 在线模式下会把命中片段发给出用户配置的模型服务 | UI 明示当前是"在线模型"还是"体验模式 · 本地检索" |

后续接后端后，文献正文要不要上云需要产品决策：当前是"本机为主"，一旦上云就要补删除与导出接口。

---

## 8. 接手后建议的三个 Sprint

**Sprint A（上线必需，1–2 天）**
后端薄网关（`/api/v1/chat` 代理 + 限流 + 错误码）、真实发信定时调度、密钥改由后端托管。

**Sprint B（质量，2–3 天）**
向量检索接入与混合重排、引用可校验（子串匹配 + 降级）、数值抽取改成模型抽取、表格虚拟滚动。

**Sprint C（体验，1–2 天）**
思考强度控件与流式"思考中"状态、综述草稿（多问答串成带引用段落 → 导出 DOCX）、跨窗口共享筛选、邮件定时真调度、OCR。

---

## 9. 交接清单（接手人逐条确认）

- [ ] 本地 `npm install && npm run dev` 能跑起来
- [ ] `python serve.py` 能托管 `dist/` 并正常打开
- [ ] `node scripts/e2e.mjs` 全绿（说明基础功能没被我改坏）
- [ ] 通读 `src/lib/llm.ts`、`src/store/qa.ts`、`src/lib/mailer.ts`
- [ ] 通读 `docs/API_SPEC.md` 与 `docs/MODEL_PARAMS.md`
- [ ] 明确后端由谁做、用什么语言、部署在哪（当前未定）
- [ ] 明确模型厂商与 key 来源（当前是用户自填，未统一）
- [ ] 明确是否要上云存储（当前是纯本地）
- [ ] 把 `docs/TODO_BACKLOG.md` 里的条目认领到人

---

## 10. v0.2 增量：API 功能层与实例库

### 10.1 实例库（`src/windows/CasesWindow.tsx`）

入口三处：写阶段左栏底部「实例库」按钮、命令面板「打开实例库」、空画布引导卡。窗口分两个页签：

| 页签 | 内容 | 数据从哪来 |
|---|---|---|
| 内置案例 | 8 个经典实验案例卡片：能力标签筛选、前 6 行表格预览、分析要点、「抄入表格」一键生成数据表 + 报表并切到写阶段 | `src/lib/caseLibrary.ts`，数值取自公开经典数据集（R 内置 PlantGrowth / sleep / iris、Anscombe 1973），结构参照 Prism / Origin / JASP 样例 |
| 联网检索 | DataCite（公开实验数据集）与 Crossref（文献元数据）两个检索源，命中可「登记为文献」进左栏语料，或开 DOI 页 | 免密钥直连 `api.datacite.org/dois?resource-type-id=dataset` 与 `api.crossref.org/works`（两者 CORS 全开）；`src/lib/caseSearch.ts` |

抄入动作集中在 `src/lib/caseImport.ts`（命令面板搜案例名也能直接抄入）。登记走 `useLibrary.addReference`，标签「联网参考」，`file_name` 存 `doi:` 前缀；删除文献现在会同步删 IndexedDB（`db.deletePaper`）。

### 10.2 两个容易改坏的点

- **Canvas 的 floating 列表必须保持插入顺序**（不要按 z 排序再渲染）：focus 会改 z，重排 DOM 会打断进行中的点击（表现为"点了没反应"）。层叠靠 inline `zIndex` 就够。
- 联网检索依赖外网；离线时 `searchOnline` 抛错，UI 显示红色 Note + 重试，不影响内置案例页签。

### 10.3 API 功能层（v0.2 前半段）

`src/lib/api.ts` 统一包络 `{code,data,request_id}` / 错误码表 40001–50300 / 仅对 429 与 5xx 指数退避重试（1s、3s，最多 2 次）/ 分档超时；设置抽屉四页（连接、思考强度、邮件、调用日志），思考四档映射 Qwen `enable_thinking+thinking_budget` 与 OpenAI `reasoning_effort`。规范原文见 `docs/API_SPEC.md`、`docs/MODEL_PARAMS.md`。

## 11. v0.2 增量（第二轮打磨）

| 改动 | 位置 | 说明 |
|---|---|---|
| 定时发送真实调度 | `src/store/mail.ts` `tick()` + `src/App.tsx` 每秒 interval | 到点的 `scheduled` 草稿自动 `send`；`send` 开头同步改状态，天然防重复触发；失败仍落 `failed` 可重试 |
| 引用角标悬停预览 | `src/windows/QaWindow.tsx` `.cite-wrap/.cite-pop` + `src/index.css` | hover 角标浮出原文片段（截 110 字）+ 页码 + 相似度，纯 CSS `:hover`，不依赖 JS |
| 散点图自适应 | `src/lib/types.ts` `Chart` 判别联合 + `src/store/data.ts` + `src/windows/TableWindow.tsx` | 无文本列且 ≥2 数值列的数据集（anscombe、dose-response、growth-curve）报表自动画散点；有文本列仍走柱线 |
| 追问建议 | `src/lib/followups.ts` + `src/windows/QaWindow.tsx` | 每个回答结束后按问题关键词给 2-3 个可点追问 chip，点击直接提问 |
| 一键回归 | `scripts/verify.mjs` + `package.json` `verify` | 构建 → 起 dev server（等待端口就绪）→ 两个 e2e → 收尾杀进程（win 用 taskkill /T） |
