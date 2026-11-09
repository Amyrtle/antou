# 案头 antou

给做实验、写综述的研究生用的桌面式工作台：论文拖进来直接问，答案带原文引用；答案里的数值一键变成数据表和报表；报表快照直接发成邮件。

一句话链路：**读 → 写 → 发**，中间不用切网页。

## 在线访问与 GitHub Pages

在线地址：<https://amyrtle.github.io/antou/>。

仓库包含 GitHub Pages 发布工作流。仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions** 后，每次推送到 `main` 都会安装依赖、检查 TypeScript、构建并发布 `dist/`。也可在 Actions 中手动运行 **Deploy to GitHub Pages**。

在线版默认使用本地检索和模拟发送，PDF 解析、数据表、报表与文件导出均在浏览器内运行。在线模型、自建 API 网关、真实 EmailJS 发信仍需在设置中配置相应服务；GitHub Pages 只提供静态网站，不提供这些后端服务。HTTPS 页面连接的外部服务也需支持 HTTPS 和浏览器跨域请求。

不要将 API 密钥或网关令牌写入源码或构建变量。用户在设置中输入的配置会保存在当前浏览器的 localStorage 中。

## 跑起来

原始发布压缩包自带 `dist/`，可直接双击 **`启动.bat`**（Windows）。从 GitHub 克隆或下载的源码不包含构建产物，需要先安装 Node.js 22，并在项目目录执行：

```bash
npm ci
npm run build
```

构建完成后再双击 **`启动.bat`**。它会自己找 Python、检查 `dist/`、起服务，然后用应用窗口打开——不是浏览器标签页，没有地址栏和标签栏。

macOS / Linux / Git Bash 用 `./start.sh`，或者手动：

```bash
python serve.py --port 8000 --open    # 有 dist/ 就够，不需要 Node
```

`serve.py` 做三件事：SPA 回退、禁缓存、端口占用时自动避开（8000 上已经跑着案头就直接复用，是别的程序就换端口并告诉你换到哪）。其他参数：`--host`（默认 127.0.0.1）、`--dir`（默认 dist）。停止按 Ctrl+C。

要改代码才需要 Node：

```bash
npm install      # 国内建议先换源：npm config set registry https://registry.npmmirror.com
npm run dev      # http://127.0.0.1:5173
npm run build    # 产物在 dist/，纯静态
```

注意：**直接双击 `dist/index.html` 是打不开的**。ES module 在 `file://` 下会被浏览器拦。请使用上面的启动脚本或在线地址。构建产物使用相对资源路径，可部署在 GitHub Pages 的 `/antou/` 子路径下。

首次打开就有内容：内置 3 篇示例论文（带页码与段落坐标）、1 张示例数据表、1 个示例问答线程、一封已填好变量的草稿。**不需要申请任何 key、不发任何请求也能完整演示一遍。**

## 界面：三轨道流水线

屏幕被切成三条纵向轨道，**「读 → 写 → 发」这条链路就是版式本身**，不是三个 tab：

```
┌──────────────────────────────────────────────┐
│ 案头  读文献·写数据·发邮件        搜索   设置 │
├───────────────┬───────────────┬──────────────┤
│ 读  3 篇文献  →│ 写  1 张表    →│ 发  1 封     │
│ 文献问答      │ 数据表        │ 邮件         │
│ （带角标引用）│ （可编辑）    │ （模板变量） │
│ 证据栏        │ 报表          │ 发送前检查   │
└───────────────┴───────────────┴──────────────┘
   45%            29%            26%
```

轨道之间那道分界线上骑着一个圆形箭头徽标，读起来就是流水线的「下一步」。

三块内容

| 轨道 | 能做什么 |
|---|---|
| 读 | 提问范围可选全部 / 勾选的 N 篇 / 标签；回答把「原文摘录」和「模型推断」分成两种样式；角标点开右侧证据栏，滚动并高亮原文段落，显示页码与相似度；「加文献」直接上传 PDF |
| 写 | 单元格可编辑、增删行列、列类型、首列冻结、列头右侧小三角出统计浮层；表格 / 报表双视图，报表给 3 张指标卡 + 柱线组合图（指标名过长时自动换成横向条形）；导出 CSV / XLSX / PDF（多表可合成多 sheet）；「实例库」一键抄一张现成的表 |
| 发 | 收件人 chip、模板（周报 / 数据核对 / 投稿催稿）、变量 chip 未填标橙、报表快照附件卡、发送前三项检查清单、发送记录与历史 |

轨道之间是真的通的：在「读」里点「带着答案去建表」，右边的「写」轨道立刻切到那张新表；在「写」里导出并勾「导出后邮件发送」，「发」轨道立刻切到那封新草稿。不用开新窗口，不会互相遮挡。

## 交互

- 拖拽 PDF 到页面任意位置即可解析（pdf.js 本地解析，不上传）
- 每条轨道右上角的「拖出」可以把它变成独立浮动窗口，可拖动、吸附分屏、双击铺满；轨道位置留「收回轨道」入口
- `Ctrl/⌘ + K` 命令面板：搜文献、搜数据表、执行命令
- `Ctrl/⌘ + 1/2/3` 定位到读 / 写 / 发轨道（当前轨道左侧有一道实边标记）

## 可选配置

| 能力 | 位置 | 说明 |
|---|---|---|
| 在线模型 | 设置 | 填 DashScope 的 API key（OpenAI 兼容接口），检索命中片段交给 qwen-plus 按 JSON 返回「摘录 / 推断」两类段落；填了就用，没填就走本地检索，界面会明确标注当前是哪种模式 |
| 真实发信 | 设置 | 填 EmailJS 的 service id / template id / public key；不填则是本地模拟发送（写 outbox、可导出 .eml），界面如实标注「本地模拟发送，不经过外部服务」 |

不配 key 不会阻断任何一步，这是硬要求。

## 数据存在哪

- 论文正文与分块：IndexedDB（`antou` 库，`papers` / `chunks` 两张表）
- 数据表、邮件草稿、设置：localStorage
- 全部留在本机浏览器，不上传服务器

## 交接文档

| 文档 | 内容 |
|---|---|
| `HANDOFF.md` | 交接总览：现状、已验收项、**未完成清单**、API 与模型参数规范摘要、部署与验收清单、三个 Sprint 建议 |
| `docs/API_SPEC.md` | API 接入规范：三层结构、响应包络、错误码表、鉴权/幂等/分页/限流/超时重试、chat/search/embed/parse/mail 接口契约、前端改造点 |
| `docs/MODEL_PARAMS.md` | 模型参数规范：检索层/生成层/思考层参数表、**思考强度四档（off/low/medium/high）与跨厂商映射**、上下文预算切分、幻觉控制三件套、成本计量 |
| `docs/TODO_BACKLOG.md` | 可勾选的未完成清单（P0/P1/P2 分级 + 已知坑 + 已完成项） |
| `docs/启动问题诊断.md` | v0.2 启动问题排查记录：为什么白屏 / 为什么叠窗口，以及改了什么 |
| `docs/参赛作品帖.md` | 赛题页论坛帖草稿（五段式） |

## 目录

```
src/app        外壳：TopBar / Pipeline（三轨道）/ PeekPanel / CommandPalette / SettingsPanel
src/windows    WindowFrame（轨道内嵌 + 独立浮动两种形态）与三个工作面：QaWindow / TableWindow / MailDrawer / CasesWindow
src/store      状态：library / qa / data / mail / windows / ui / settings / history / pipeline
src/lib        pdf 解析、分块检索、数值抽取、统计、导出、邮件模板与发送
src/ui         Button / Chip / Dot / Field / Floating / Empty / Note 等基础件
scripts        自测脚本（截图、端到端、生成测试 PDF）
```

## 自测

```bash
node scripts/make-pdfs.mjs      # 生成 3 个测试 PDF
node scripts/e2e.mjs            # 提问→引用→建表→报表→导出 XLSX→发信 全链路
node scripts/e2e-upload.mjs     # 上传 3 个 PDF + 刷新还原 + 窄屏
node scripts/check-table.mjs http://127.0.0.1:5173/   # 表格与报表回归（8 项）
node scripts/shot.mjs <url> <out.png> 1440 900
```

脚本用 playwright-core 驱动本机 Edge（`channel: 'msedge'`），不下载浏览器。

## 已知限制

- PDF 走 pdf.js 文本层，扫描件没有 OCR，加进来会解析不出段落（列表里会标成失败并给出原因）
- PDF 导出走浏览器打印，中文不乱码，但需要用户在打印对话框里另存为 PDF
- 邮件默认本地模拟，不经过外部服务；真实发信需自备 EmailJS 配置
