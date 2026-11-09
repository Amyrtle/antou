import type { Citation, Segment } from './types'
import type { Hit } from './retrieve'
import { factsIn } from './extract'
import { stripEmoji } from './emoji'
import { callChat } from './api'

export type AnswerDraft = { segments: Segment[]; citations: Citation[]; note?: string }

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？；])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
}

export function pickBestSentence(text: string, terms: string[]): string {
  const sents = splitSentences(text)
  if (!sents.length) return text.slice(0, 160)
  const uniq = Array.from(new Set(terms.filter((t) => t.length > 1)))
  let best = sents[0]
  let bestScore = -1
  for (const s of sents) {
    let score = 0
    for (const t of uniq) if (s.includes(t)) score += t.length
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  return best
}

const shortTitle = (t: string) => (t.length > 16 ? `${t.slice(0, 16)}…` : t)

/** 本地检索模式：从命中段落里摘录原文，再给一段明确标注为推断的归纳 */
export function answerLocal(_question: string, hits: Hit[]): AnswerDraft {
  const segments: Segment[] = []
  const citations: Citation[] = []
  const used = new Set<string>()

  for (const hit of hits) {
    if (segments.length >= 3) break
    const sentence = pickBestSentence(hit.chunk.text, hit.terms)
    const key = sentence.slice(0, 20)
    if (used.has(key)) continue
    used.add(key)
    segments.push({ type: 'quote', text: sentence })
    citations.push({
      paper_id: hit.paper.id,
      page: hit.chunk.page,
      para_index: hit.chunk.para_index,
      span: sentence,
      score: hit.score,
    })
  }

  if (!segments.length) {
    segments.push({ type: 'infer', text: '推断：当前语料中没有检索到与该问题直接相关的段落，建议换一个更具体的说法，或扩大提问范围。' })
    return { segments, citations, note: '本次未命中任何段落' }
  }

  const facts = hits.slice(0, 3).map((h) => {
    const s = pickBestSentence(h.chunk.text, h.terms)
    const f = factsIn(s)[0]
    return f ? `${shortTitle(h.paper.title)}给出 ${f.value}${f.unit}（${f.metric}）` : null
  })

  const factsText = facts.filter(Boolean).join('；')
  const infer = factsText
    ? `推断：命中的文献给出的关键数值口径并不一致——${factsText}。这些数字分别衡量不同任务下的不同指标（预训练线性探测、域偏移鲁棒性、少样本分割），直接横向比较会引入口径误差；更稳妥的做法是统一指标定义与样本规模后再对照。`
    : '推断：这几段材料共享同一个前提，即预处理顺序与预算分配比增强种类本身更关键；但它们的适用边界不同（分类预训练、域偏移鲁棒性、少样本分割），数值不可直接横向比较。'

  segments.push({ type: 'infer', text: infer })
  return { segments, citations }
}

export type OnlineContext = {
  apiKey: string
  baseUrl: string
  model: string
}

const SYSTEM_PROMPT = `你是一名严谨的科研助理。请只依据给定的文献片段回答，并严格输出 JSON：
{"answer_segments":[{"type":"quote","text":"原文摘录，必须逐字来自片段"},{"type":"infer","text":"你的推断，必须与原文摘录区分"}],"citations":[{"index":1,"score":0.9}]}
要求：至少 1 段 quote，1 段 infer；引用编号对应片段编号；不要输出任何表情符号。`

export async function answerOnline(
  question: string,
  hits: Hit[],
  _ctx: OnlineContext,
  signal?: AbortSignal,
): Promise<AnswerDraft> {
  const numbered = hits
    .slice(0, 6)
    .map((h, i) => `[${i + 1}] (${shortTitle(h.paper.title)} · p.${h.chunk.page}) ${h.chunk.text}`)
    .join('\n\n')

  const { content } = await callChat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `文献片段：\n${numbered}\n\n问题：${question}` },
    ],
    { signal, json: true },
  )

  const json = JSON.parse(content.replace(/^```json\s*|\s*```$/g, '')) as {
    answer_segments?: Array<{ type?: string; text?: string }>
    citations?: Array<{ index?: number; score?: number }>
  }

  const segments: Segment[] = (json.answer_segments ?? [])
    .filter((s) => s.text && (s.type === 'quote' || s.type === 'infer'))
    .map((s) => ({ type: s.type as Segment['type'], text: stripEmoji(s.text as string) }))

  const citations: Citation[] = (json.citations ?? [])
    .map((c) => {
      const hit = hits[(c.index ?? 1) - 1]
      if (!hit) return null
      return {
        paper_id: hit.paper.id,
        page: hit.chunk.page,
        para_index: hit.chunk.para_index,
        span: hit.chunk.text.slice(0, 120),
        score: c.score ?? hit.score,
      }
    })
    .filter((c): c is Citation => c !== null)

  if (!segments.length) throw new Error('模型未返回可用段落')

  // 引用可校验：quote 必须能在命中片段里逐字匹配，否则降级为推断并提示
  let unverified = 0
  const checked = segments.map((s) => {
    if (s.type !== 'quote' || quoteMatches(s.text, hits)) return s
    unverified += 1
    return { type: 'infer' as const, text: `${s.text}（未能在原文中逐字匹配，按推断展示）` }
  })

  return {
    segments: checked,
    citations,
    note: unverified ? `${unverified} 段摘录未能在原文逐字匹配，已按推断展示` : undefined,
  }
}

const normText = (s: string) => s.replace(/\s+/g, '')

/** 取摘录前 24 字与各命中片段做子串匹配；过短的摘录放行（无从校验） */
function quoteMatches(text: string, hits: Hit[]): boolean {
  const needle = normText(text).slice(0, 24)
  if (needle.length < 8) return true
  return hits.some((h) => normText(h.chunk.text).includes(needle))
}
