import { create } from 'zustand'
import type { Citation, Dataset, Message, Scope, Thread } from '../lib/types'
import { DEMO_MESSAGES, DEMO_THREAD } from '../lib/demo'
import { uid } from '../lib/id'
import { answerLocal, answerOnline, type AnswerDraft } from '../lib/llm'
import { ApiError, ERROR_TABLE } from '../lib/api'
import { extractRows } from '../lib/extract'
import { useLibrary } from './library'
import { useSettings } from './settings'
import { useData } from './data'
import { useHistory } from './history'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let abortCtl: AbortController | null = null

type QAState = {
  threads: Thread[]
  messages: Message[]
  activeThreadId: string | null
  scope: Scope
  asking: boolean
  thinking: boolean
  lastQuestion: string
  evidence: { citation: Citation | null; messageId: string | null }
  note: string
  init: () => void
  setScope: (scope: Scope) => void
  setActiveThread: (id: string) => void
  newThread: () => void
  ask: (question: string, retry?: boolean) => Promise<void>
  retryLast: () => Promise<void>
  cancelAsk: () => void
  selectEvidence: (citation: Citation, messageId: string) => void
  clearEvidence: () => void
  buildTable: (messageId: string) => string | null
  threadOf: (id: string) => Thread | undefined
}

export const useQA = create<QAState>((set, get) => ({
  threads: [],
  messages: [],
  activeThreadId: null,
  scope: { type: 'all' },
  asking: false,
  thinking: false,
  lastQuestion: '',
  evidence: { citation: null, messageId: null },
  note: '',

  init: () => {
    if (get().threads.length) return
    set({
      threads: [DEMO_THREAD],
      messages: DEMO_MESSAGES,
      activeThreadId: DEMO_THREAD.id,
    })
  },

  setScope: (scope) => set({ scope }),

  setActiveThread: (activeThreadId) => set({ activeThreadId }),

  newThread: () => {
    const thread: Thread = {
      id: uid('th-'),
      scope: get().scope,
      title: '新提问',
      created_at: Date.now(),
    }
    set((s) => ({ threads: [thread, ...s.threads], activeThreadId: thread.id }))
  },

  ask: async (question, retry = false) => {
    const q = question.trim()
    if (!q || get().asking) return

    let threadId = get().activeThreadId
    if (!threadId) {
      get().newThread()
      threadId = get().activeThreadId!
    }
    const thread = get().threads.find((t) => t.id === threadId)!
    if (!retry) {
      const userMsg: Message = {
        id: uid('m-'),
        thread_id: threadId,
        role: 'user',
        segments: [{ type: 'quote', text: q }],
        citations: [],
        created_at: Date.now(),
      }
      set((s) => ({ messages: [...s.messages, userMsg], asking: true, note: '', lastQuestion: q }))
    } else {
      set({ asking: true, note: '' })
    }

    if (thread.title === '新提问') {
      set((s) => ({
        threads: s.threads.map((t) => (t.id === threadId ? { ...t, title: q.slice(0, 18) } : t)),
      }))
    }

    const library = useLibrary.getState()
    const hits = library.corpus.search(q, get().scope, 8)
    const settings = useSettings.getState()

    let draft: AnswerDraft | undefined
    let note = ''
    if (settings.mode === 'online' && (settings.apiKey.trim() || (settings.gateway.enabled && settings.gateway.token.trim()))) {
      abortCtl = new AbortController()
      set({ thinking: true })
      try {
        draft = await answerOnline(
          q,
          hits,
          { apiKey: settings.apiKey.trim(), baseUrl: settings.baseUrl, model: settings.model },
          abortCtl.signal,
        )
      } catch (e) {
        if (abortCtl?.signal.aborted) {
          set({ asking: false, thinking: false, note: '已取消本次思考，可重新提问或重试。' })
          abortCtl = null
          return
        }
        draft = answerLocal(q, hits)
        const hint =
          e instanceof ApiError
            ? `${ERROR_TABLE[e.code]?.hint ?? e.message}${e.requestId !== '-' ? ` · ${e.requestId}` : ''}`
            : e instanceof Error
              ? e.message
              : '未知错误'
        note = `在线模型调用失败，已回退到本地检索：${hint}`
      } finally {
        set({ thinking: false })
        abortCtl = null
      }
    } else {
      draft = answerLocal(q, hits)
    }

    const msgId = uid('m-')
    const partial: Message['segments'] = []
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: msgId,
          thread_id: threadId,
          role: 'assistant',
          segments: [],
          citations: draft.citations,
          created_at: Date.now(),
          streaming: true,
        },
      ],
    }))

    for (const seg of draft.segments) {
      partial.push({ type: seg.type, text: '' })
      const step = seg.type === 'infer' ? 3 : 2
      for (let i = step; i <= seg.text.length; i += step) {
        partial[partial.length - 1].text = seg.text.slice(0, i)
        const snapshot = partial.map((p) => ({ ...p }))
        set((s) => ({
          messages: s.messages.map((m) => (m.id === msgId ? { ...m, segments: snapshot } : m)),
        }))
        await sleep(12)
      }
      partial[partial.length - 1].text = seg.text
      const snapshot = partial.map((p) => ({ ...p }))
      set((s) => ({
        messages: s.messages.map((m) => (m.id === msgId ? { ...m, segments: snapshot } : m)),
      }))
      await sleep(60)
    }

    set((s) => ({
      asking: false,
      note: note || draft?.note || '',
      messages: s.messages.map((m) => (m.id === msgId ? { ...m, streaming: false } : m)),
    }))

    useHistory.getState().log({
      kind: 'qa',
      title: `提问：${q.slice(0, 20)}`,
      detail: `命中 ${draft.citations.length} 条引用`,
    })
  },

  selectEvidence: (citation, messageId) => set({ evidence: { citation, messageId } }),

  cancelAsk: () => {
    abortCtl?.abort(new DOMException('aborted', 'AbortError'))
  },

  retryLast: () => {
    const q = get().lastQuestion
    if (q) return get().ask(q, true)
    return Promise.resolve()
  },

  clearEvidence: () => set({ evidence: { citation: null, messageId: null } }),

  buildTable: (messageId) => {
    const msg = get().messages.find((m) => m.id === messageId)
    if (!msg) return null
    const paperTitle = (i: number) => {
      const c = msg.citations[i]
      if (!c) return '未知来源'
      const p = useLibrary.getState().paperById(c.paper_id)
      if (!p) return '未知来源'
      return p.title.length > 16 ? `${p.title.slice(0, 16)}…` : p.title
    }
    const rows = extractRows(msg.segments, paperTitle)
    if (!rows.length) return null

    const thread = get().threads.find((t) => t.id === msg.thread_id)
    const ds: Dataset = {
      id: uid('ds-'),
      name: `来自问答 · ${(thread?.title ?? '未命名').slice(0, 12)}`,
      columns: [
        { key: 'metric', name: '指标', type: 'text', frozen: true },
        { key: 'value', name: '数值', type: 'number' },
        { key: 'unit', name: '单位', type: 'text' },
        { key: 'source', name: '来源', type: 'text' },
      ],
      rows: rows.map((r) => ({
        id: uid('row-'),
        cells: { metric: r.metric, value: r.value, unit: r.unit, source: r.source },
      })),
      source: { type: 'qa', ref: messageId, label: thread?.title ?? '问答' },
      updated_at: Date.now(),
    }
    useData.getState().addDataset(ds)
    useHistory.getState().log({ kind: 'edit', title: `建表：${ds.name}`, detail: `${ds.rows.length} 行` })
    return ds.id
  },

  threadOf: (id) => get().threads.find((t) => t.id === id),
}))
