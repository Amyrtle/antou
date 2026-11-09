import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, FileUp, Loader2, Quote, Sparkles, Table2 } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Button, Dot, TextArea } from '../ui/kit'
import { CanvasCtx, WindowFrame } from './WindowFrame'
import { PipelineCtx, focusDataset } from '../store/pipeline'
import { useQA } from '../store/qa'
import { useLibrary } from '../store/library'
import { useWindows } from '../store/windows'
import { useUi } from '../store/ui'
import { useSettings } from '../store/settings'
import { SAMPLE_QUESTIONS } from '../lib/demo'
import { followUps } from '../lib/followups'
import { TIER_SPEC } from '../lib/api'
import { cn } from '../lib/cn'
import { fmtNum } from '../lib/format'
import type { Citation, Message, Win } from '../lib/types'

function Highlighted({ text, span }: { text: string; span: string }) {
  if (!span) return <>{text}</>
  const i = text.indexOf(span)
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="mark">{span}</mark>
      {text.slice(i + span.length)}
    </>
  )
}

function ScopeBar({ onDone }: { onDone?: () => void }) {
  const scope = useQA((s) => s.scope)
  const setScope = useQA((s) => s.setScope)
  const selected = useLibrary((s) => s.selectedIds)
  const papers = useLibrary((s) => s.papers)
  const [open, setOpen] = useState(false)

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const p of papers) for (const t of p.tags) set.add(t)
    return Array.from(set)
  }, [papers])

  const label =
    scope.type === 'all' ? '全部文献' : scope.type === 'ids' ? `选中 ${selected.length} 篇` : `标签 · ${scope.value}`

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="chip max-w-[116px] border-line bg-surface hover:border-line-strong"
        title="提问范围"
      >
        <span className="truncate text-ink">{label}</span>
        <Icon as={ChevronDown} size={12} className="shrink-0 text-ink-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-40 w-[196px] rounded-[10px] border border-line bg-surface p-1 shadow-[var(--shadow-pop)]">
            {[
              { key: 'all', text: '全部文献', desc: `${papers.length} 篇` },
              { key: 'ids', text: `选中 ${selected.length} 篇`, desc: selected.length ? '仅检索勾选的' : '先在左栏勾选' },
              ...tags.map((t) => ({ key: `tag:${t}`, text: `标签 · ${t}`, desc: '按标签检索' })),
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === 'all') setScope({ type: 'all' })
                  else if (item.key === 'ids') setScope({ type: 'ids', value: selected.join(',') })
                  else setScope({ type: 'tag', value: item.key.slice(4) })
                  setOpen(false)
                  onDone?.()
                }}
                className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink transition-colors hover:bg-head"
              >
                <span>{item.text}</span>
                <span className="mono text-[10px] text-ink-3">{item.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MessageBody({
  msg,
  onCite,
  activeCitation,
}: {
  msg: Message
  onCite: (c: Citation) => void
  activeCitation: Citation | null
}) {
  let quoteIndex = -1
  return (
    <div className="flex flex-col gap-2">
      {msg.segments.map((seg, i) => {
        if (seg.type === 'quote') {
          quoteIndex += 1
          const c = msg.citations[quoteIndex]
          return (
            <div key={i} className="seg-quote text-[13px] leading-[1.75] text-ink">
              {seg.text}
              {c && (
                <span className="cite-wrap">
                  <button
                    type="button"
                    className="cite"
                    data-active={activeCitation?.paper_id === c.paper_id && activeCitation?.para_index === c.para_index}
                    onClick={() => onCite(c)}
                  >
                    {quoteIndex + 1}
                  </button>
                  <span className="cite-pop">
                    <span className="mono block text-[10px] text-ink-3">
                      {c.paper_id} · p.{c.page} · 相似度 {fmtNum(c.score, 2)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-[1.6] text-ink-2">
                      {c.span.length > 110 ? `${c.span.slice(0, 110)}…` : c.span}
                    </span>
                  </span>
                </span>
              )}
            </div>
          )
        }
        return (
          <div key={i} className="seg-infer">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-accent-line bg-surface px-1.5 py-[1px] text-[10px] text-accent">
                <Icon as={Sparkles} size={11} />
                推断
              </span>
              <span className="mono text-[10px] text-ink-3">模型归纳，非原文</span>
            </div>
            <div className="text-[13px] leading-[1.75] text-ink">{seg.text}</div>
          </div>
        )
      })}
    </div>
  )
}

export function QaWindow({
  win,
  mode = 'floating',
  onDetach,
}: {
  win: Win
  mode?: 'track' | 'floating'
  onDetach?: () => void
}) {
  const { bounds } = useContext(CanvasCtx)
  const pipeline = useContext(PipelineCtx)
  const messages = useQA((s) => s.messages)
  const threads = useQA((s) => s.threads)
  const activeThreadId = useQA((s) => s.activeThreadId)
  const ask = useQA((s) => s.ask)
  const asking = useQA((s) => s.asking)
  const thinking = useQA((s) => s.thinking)
  const cancelAsk = useQA((s) => s.cancelAsk)
  const retryLast = useQA((s) => s.retryLast)
  const evidence = useQA((s) => s.evidence)
  const selectEvidence = useQA((s) => s.selectEvidence)
  const buildTable = useQA((s) => s.buildTable)
  const note = useQA((s) => s.note)
  const papers = useLibrary((s) => s.papers)
  const chunks = useLibrary((s) => s.chunks)
  const openWindow = useWindows((s) => s.open)
  const applySnap = useWindows((s) => s.applySnap)
  const setStage = useUi((s) => s.setStage)
  const openPeek = useUi((s) => s.openPeek)
  const thinkingTier = useSettings((s) => s.thinking)
  const [input, setInput] = useState('')
  const [threadOpen, setThreadOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const evidenceRef = useRef<HTMLDivElement>(null)

  const threadMessages = messages.filter((m) => m.thread_id === activeThreadId)
  const lastAssistant = [...threadMessages].reverse().find((m) => m.role === 'assistant')
  const lastUser = [...threadMessages].reverse().find((m) => m.role === 'user')
  const lastUserText = lastUser?.segments[0]?.text ?? ''
  const activeMsg = messages.find((m) => m.id === evidence.messageId) ?? lastAssistant
  const citations = activeMsg?.citations ?? []

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [threadMessages.length, asking])

  useEffect(() => {
    if (!evidence.citation) return
    const el = evidenceRef.current?.querySelector('[data-cite="active"]')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [evidence.citation])

  const chunkOf = (c: Citation) =>
    chunks.find((ch) => ch.paper_id === c.paper_id && ch.page === c.page && ch.para_index === c.para_index)

  const onBuildTable = (msgId: string) => {
    const dsId = buildTable(msgId)
    if (!dsId) return
    if (pipeline.active) {
      // 轨道里：结果直接落到右边的「写」轨道，不开新窗口
      focusDataset(dsId)
      return
    }
    const id = openWindow('table', '数据表', { payload: { datasetId: dsId } })
    setStage('write')
    requestAnimationFrame(() => {
      applySnap(win.id, 'left', bounds)
      applySnap(id, 'right', bounds)
    })
  }

  const threadTitle = threads.find((t) => t.id === activeThreadId)?.title ?? '未选择线程'

  return (
    <WindowFrame
      win={win}
      mode={mode}
      onDetach={onDetach}
      meta={`${papers.length} 篇`}
      headerExtra={
        <div className="mr-1 flex min-w-0 items-center gap-1">
          <label className="flex h-[22px] shrink-0 cursor-pointer items-center gap-1 rounded-[3px] border border-line bg-surface px-1.5 text-[11px] text-ink-2 transition-colors hover:border-accent-line hover:text-accent">
            <Icon as={FileUp} size={12} />
            加文献
            <input
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length) {
                  void useLibrary.getState().uploadFiles(files)
                  useUi.getState().noteAction(`正在解析 ${files.length} 个 PDF`)
                }
                e.target.value = ''
              }}
            />
          </label>
          <ScopeBar />
          <div className="relative">
            <button
              type="button"
              className="chip max-w-[132px] hover:border-line-strong"
              onClick={() => setThreadOpen((v) => !v)}
              title="切换提问线程"
            >
              <span className="truncate">{threadTitle}</span>
              <Icon as={ChevronDown} size={12} className="text-ink-3" />
            </button>
            {threadOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setThreadOpen(false)} />
                <div className="absolute right-0 top-7 z-40 w-[240px] rounded-[10px] border border-line bg-surface p-1 shadow-[var(--shadow-pop)]">
                  {threads.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        useQA.getState().setActiveThread(t.id)
                        setThreadOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-head',
                        t.id === activeThreadId ? 'text-accent' : 'text-ink',
                      )}
                    >
                      <Dot tone={t.id === activeThreadId ? 'accent' : 'neutral'} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="flex h-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {!threadMessages.length && (
              <div className="mx-auto mt-10 max-w-[420px]">
                <div className="t-h2 text-ink">从这几篇开始问</div>
                <p className="t-body mt-1 text-ink-2">
                  拖入 PDF 或直接提问。回答里每条结论都会带角标，点角标可以跳到右侧证据栏的原文段落。
                </p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      className="flex items-center justify-between rounded-[8px] border border-line bg-surface px-3 py-2 text-left text-[12px] text-ink transition-colors hover:border-accent-line hover:bg-accent-soft"
                    >
                      <span>{q}</span>
                      <Icon as={ArrowRight} size={14} className="text-ink-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mx-auto flex max-w-[620px] flex-col gap-4">
              {threadMessages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex flex-col gap-1">
                    <span className="mono text-[10px] text-ink-3">问</span>
                    <div className="text-[13px] leading-[1.7] text-ink">{msg.segments[0]?.text}</div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex flex-col gap-2">
                    <MessageBody
                      msg={msg}
                      activeCitation={evidence.citation}
                      onCite={(c) => {
                        selectEvidence(c, msg.id)
                      }}
                    />
                    {msg.streaming ? (
                      <span className="inline-block h-3 w-[2px] bg-accent animate-caret" />
                    ) : (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Button
                          size="sm"
                          icon={<Icon as={Table2} size={13} />}
                          onClick={() => onBuildTable(msg.id)}
                        >
                          带着答案去建表
                        </Button>
                        <Button size="sm" variant="quiet" onClick={() => navigator.clipboard?.writeText(msg.segments.map((s) => s.text).join('\n\n'))}>
                          复制
                        </Button>
                      </div>
                    )}
                  </div>
                ),
              )}
              {lastAssistant && !lastAssistant.streaming && !asking && lastUserText && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mono text-[10px] text-ink-3">追问建议</span>
                  {followUps(lastUserText).map((fq) => (
                    <button
                      key={fq}
                      type="button"
                      onClick={() => void ask(fq)}
                      className="chip border-line bg-surface text-ink-2 transition-colors hover:border-accent-line hover:text-accent"
                      title="点击直接提问"
                    >
                      {fq}
                    </button>
                  ))}
                </div>
              )}
              {asking && thinking && (
                <div className="flex items-center gap-2 rounded-[8px] border border-accent-line bg-accent-soft px-3 py-2">
                  <Loader2 size={13} className="animate-spin text-accent" />
                  <span className="text-[12px] text-ink">
                    深度思考中（{TIER_SPEC[thinkingTier].label}档 · 约 {Math.round(TIER_SPEC[thinkingTier].timeoutMs / 1000)} 秒内）
                  </span>
                  <Button size="sm" variant="quiet" className="ml-auto" onClick={cancelAsk}>
                    取消
                  </Button>
                </div>
              )}
              {note && (
                <div className="flex items-center gap-2 rounded-[6px] border border-warn px-2 py-1.5 text-[11px] text-warn">
                  <span className="min-w-0 flex-1">{note}</span>
                  <Button size="sm" variant="quiet" className="shrink-0 text-warn hover:bg-head" onClick={() => void retryLast()}>
                    重试
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-surface-2 px-3 py-2.5">
            <div className="mx-auto max-w-[620px]">
              <TextArea
                value={input}
                rows={2}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (input.trim() && !asking) {
                      ask(input)
                      setInput('')
                    }
                  }
                }}
                placeholder="问点具体的：这几篇在预处理上的差异是什么"
              />
              <div className="mt-1.5 flex items-center gap-2">
                <span className="mono text-[10px] text-ink-3">Enter 发送 · Shift+Enter 换行</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" icon={<Icon as={FileUp} size={13} />}>
                    拖入 PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!input.trim() || asking}
                    icon={asking ? <Loader2 size={13} className="animate-spin" /> : undefined}
                    onClick={() => {
                      ask(input)
                      setInput('')
                    }}
                  >
                    提问
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex w-[34%] min-w-[206px] shrink-0 flex-col border-l border-line bg-surface-2">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
            <Icon as={Quote} size={14} className="text-ink-3" />
            <span className="text-[12px] text-ink">证据栏</span>
            <span className="mono text-[10px] text-ink-3">{citations.length} 条命中</span>
          </div>
          <div ref={evidenceRef} className="min-h-0 flex-1 overflow-y-auto p-2">
            {!citations.length && (
              <div className="px-2 py-6 text-center text-[11px] leading-[1.7] text-ink-3">
                回答里的角标点开后会跳到这里，
                <br />
                显示原文段落、页码与相似度。
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {citations.map((c, i) => {
                const chunk = chunkOf(c)
                const paper = papers.find((p) => p.id === c.paper_id)
                const active =
                  evidence.citation?.paper_id === c.paper_id && evidence.citation?.para_index === c.para_index
                return (
                  <button
                    key={i}
                    type="button"
                    data-cite={active ? 'active' : 'idle'}
                    onClick={() => selectEvidence(c, activeMsg?.id ?? '')}
                    onDoubleClick={() => openPeek({ type: 'paper', id: c.paper_id })}
                    className={cn(
                      'rounded-[8px] border px-2.5 py-2 text-left transition-colors',
                      active ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="cite pointer-events-none">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{paper?.title ?? '未知来源'}</span>
                    </div>
                    <div className="mono mt-1 flex items-center gap-2 text-[10px] text-ink-3">
                      <span>p.{c.page}</span>
                      <span>¶{c.para_index}</span>
                      <span className="ml-auto">相似度 {fmtNum(c.score, 2)}</span>
                    </div>
                    <p className="mt-1 line-clamp-4 text-[11px] leading-[1.65] text-ink-2">
                      {chunk ? <Highlighted text={chunk.text} span={c.span} /> : c.span}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>
      </div>
    </WindowFrame>
  )
}
