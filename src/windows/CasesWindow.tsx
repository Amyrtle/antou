import { useEffect, useMemo, useRef, useState } from 'react'
import { BookmarkPlus, Database, ExternalLink, Globe, Plus, Search } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Button, Chip, Field, Note, Skeleton } from '../ui/kit'
import { WindowFrame } from './WindowFrame'
import { CAPABILITIES, CASES, type ExperimentCase } from '../lib/caseLibrary'
import { importCase } from '../lib/caseImport'
import { ENGINES, SAMPLE_QUERIES, searchOnline, type SearchEngine, type SearchHit } from '../lib/caseSearch'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { useHistory } from '../store/history'
import { uid } from '../lib/id'
import { cn } from '../lib/cn'
import type { Paper, Win } from '../lib/types'

const TABS = [
  { key: 'builtin' as const, label: '内置案例', icon: Database },
  { key: 'online' as const, label: '联网检索', icon: Globe },
]

const PREVIEW_ROWS = 6

function PreviewTable({ c }: { c: ExperimentCase }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-line">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-head">
            <th className="mono w-7 px-1.5 py-1 text-left text-[10px] font-normal text-ink-3">#</th>
            {c.columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-1.5 py-1 text-[10px] font-normal text-ink-2',
                  col.type === 'number' ? 'text-right' : 'text-left',
                )}
              >
                {col.name}
                {col.unit ? <span className="mono text-ink-3"> {col.unit}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
            <tr key={i} className="border-t border-line">
              <td className="mono px-1.5 py-[3px] text-ink-3">{i + 1}</td>
              {r.map((v, j) => (
                <td
                  key={j}
                  className={cn(
                    'px-1.5 py-[3px]',
                    typeof v === 'number' ? 'mono text-right text-ink' : 'text-ink-2',
                  )}
                >
                  {String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mono flex items-center gap-2 border-t border-line px-1.5 py-1 text-[10px] text-ink-3">
        <span>
          前 {Math.min(PREVIEW_ROWS, c.rows.length)} / {c.rows.length} 行
        </span>
        <span className="ml-auto truncate">{c.analysis[0]}</span>
      </div>
    </div>
  )
}

function CaseCard({
  c,
  open,
  onToggle,
  onImport,
}: {
  c: ExperimentCase
  open: boolean
  onToggle: () => void
  onImport: () => void
}) {
  return (
    <article className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-surface p-2.5 transition-colors hover:border-accent-line">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] text-ink">{c.name}</h3>
          <div className="mono mt-0.5 truncate text-[10px] text-ink-3">
            {c.category} · {c.rows.length} 行 × {c.columns.length} 列
          </div>
        </div>
        <Button
          size="sm"
          variant="primary"
          icon={<Icon as={Plus} size={12} />}
          onClick={onImport}
          title="复制到工作区并打开数据表"
        >
          抄入表格
        </Button>
      </div>

      <p className="text-[11px] leading-[1.6] text-ink-2">{c.desc}</p>

      <div className="flex flex-wrap gap-1">
        {c.capability.map((x) => (
          <span key={x} className="rounded-[4px] border border-line px-1 text-[10px] text-ink-3">
            {x}
          </span>
        ))}
      </div>

      <div className="mono truncate text-[10px] text-ink-3">来源：{c.source}</div>

      <div className="flex items-center gap-1.5 border-t border-line pt-1.5">
        <Button size="sm" variant="quiet" onClick={onToggle}>
          {open ? '收起预览' : '数据预览'}
        </Button>
        <span className="mono ml-auto text-[10px] text-ink-3">{c.analysis.length} 个分析要点</span>
      </div>

      {open && (
        <div className="flex flex-col gap-1.5">
          <PreviewTable c={c} />
          <ul className="flex flex-col gap-0.5">
            {c.analysis.map((a) => (
              <li key={a} className="text-[11px] leading-[1.55] text-ink-2">
                <span className="mono mr-1 text-ink-3">·</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

export function CasesWindow({ win }: { win: Win }) {
  const [tab, setTab] = useState<'builtin' | 'online'>('builtin')
  const [cap, setCap] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [engine, setEngine] = useState<SearchEngine>('datacite')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [registered, setRegistered] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const noteAction = useUi((s) => s.noteAction)

  useEffect(() => () => abortRef.current?.abort(), [])

  const shown = useMemo(
    () => (cap ? CASES.filter((c) => c.capability.includes(cap)) : CASES),
    [cap],
  )

  const run = async (keyword?: string) => {
    const kw = (keyword ?? q).trim()
    if (!kw) return
    if (keyword) setQ(kw)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const list = await searchOnline(engine, kw, ctrl.signal)
      if (ctrl.signal.aborted) return
      setHits(list)
      setSearched(true)
      noteAction(`联网检索「${kw}」：${list.length} 条结果`)
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError(e instanceof Error ? e.message : '检索失败，可能是网络受限')
      setSearched(true)
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }

  const register = (h: SearchHit) => {
    const paper: Paper = {
      id: uid('p-'),
      title: h.title,
      authors: h.authors.length ? h.authors : ['（未署名）'],
      year: h.year || new Date().getFullYear(),
      venue: h.venue || (h.engine === 'datacite' ? 'DataCite' : 'Crossref'),
      tags: ['联网参考'],
      file_name: h.doi ? `doi:${h.doi}` : '联网检索',
      page_count: 0,
      status: 'ready',
      abstract: '',
      created_at: Date.now(),
    }
    void useLibrary.getState().addReference(paper)
    setRegistered((s) => (s.includes(h.id) ? s : [...s, h.id]))
    noteAction(`已登记文献：${h.title.slice(0, 28)}`)
    useHistory.getState().log({
      kind: 'parse',
      title: `联网登记：${h.title.slice(0, 32)}`,
      detail: `${h.engine === 'datacite' ? 'DataCite' : 'Crossref'} · ${h.doi || '无 DOI'}`,
    })
  }

  const engineMeta = ENGINES.find((e) => e.key === engine)!

  return (
    <WindowFrame win={win} meta={`${CASES.length} 个内置案例 · 可联网检索`}>
      <div className="flex h-full flex-col">
        <div className="flex h-[32px] shrink-0 items-center gap-1 border-b border-line px-2">
          {TABS.map((t) => {
            const active = t.key === tab
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className={cn(
                  'flex h-[24px] items-center gap-1.5 rounded-[6px] px-2 text-[12px] transition-colors',
                  active ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-head hover:text-ink',
                )}
              >
                <Icon as={t.icon} size={13} />
                {t.label}
              </button>
            )
          })}
          <span className="mono ml-auto truncate text-[10px] text-ink-3">
            {tab === 'builtin' ? `${shown.length}/${CASES.length} 个案例` : engineMeta.hint}
          </span>
        </div>

        {tab === 'builtin' && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-line bg-surface px-2.5 py-1.5">
              <span className="mr-1 text-[10px] text-ink-3">实验能力</span>
              <Chip tone={cap === null ? 'accent' : 'default'} onClick={() => setCap(null)}>
                全部
              </Chip>
              {CAPABILITIES.map((c) => (
                <Chip key={c} tone={cap === c ? 'accent' : 'default'} onClick={() => setCap(cap === c ? null : c)}>
                  {c}
                </Chip>
              ))}
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-2 p-2.5">
              {shown.map((c) => (
                <CaseCard
                  key={c.id}
                  c={c}
                  open={preview === c.id}
                  onToggle={() => setPreview(preview === c.id ? null : c.id)}
                  onImport={() => importCase(c)}
                />
              ))}
            </div>

            {!shown.length && (
              <div className="px-3 py-8 text-center text-[11px] text-ink-3">该能力下没有案例，换个筛选试试。</div>
            )}
          </div>
        )}

        {tab === 'online' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line px-2.5 py-2">
              {ENGINES.map((e) => (
                <Chip key={e.key} tone={engine === e.key ? 'accent' : 'default'} onClick={() => setEngine(e.key)}>
                  {e.label}
                </Chip>
              ))}
              <div className="relative min-w-[180px] flex-1">
                <Icon
                  as={Search}
                  size={14}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-3"
                />
                <Field
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void run()
                  }}
                  placeholder={engine === 'datacite' ? '搜公开数据集，如 soil moisture' : '搜文献，如 dose response'}
                  className="pl-7"
                  aria-label="联网检索关键词"
                />
              </div>
              <Button size="sm" variant="primary" disabled={loading || !q.trim()} onClick={() => void run()}>
                {loading ? '检索中' : '检索'}
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!searched && !loading && (
                <div className="flex flex-col gap-2 p-3">
                  <Note>
                    直连第三方公开检索接口（无需密钥）：DataCite 找实验数据集，Crossref 找文献元数据。
                    命中的结果可登记进左栏文献库，或直接打开 DOI 页面。
                  </Note>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] text-ink-3">试试</span>
                    {SAMPLE_QUERIES[engine].map((s) => (
                      <Chip key={s} onClick={() => void run(s)}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex flex-col gap-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-2.5 w-1/3" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && error && (
                <div className="p-3">
                  <Note tone="danger">
                    <span className="mr-2">{error}</span>
                    <button
                      type="button"
                      onClick={() => void run()}
                      className="underline underline-offset-2 hover:opacity-80"
                    >
                      重试
                    </button>
                  </Note>
                </div>
              )}

              {!loading && !error && searched && !hits.length && (
                <div className="px-3 py-8 text-center text-[11px] text-ink-3">没有命中的结果，换个关键词或切换检索源。</div>
              )}

              {!loading &&
                hits.map((h) => {
                  const done = registered.includes(h.id)
                  return (
                    <div key={h.id} className="flex items-start gap-2 border-b border-line px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[13px] leading-[1.45] text-ink">{h.title}</div>
                        <div className="mono mt-0.5 truncate text-[10px] text-ink-3">
                          {h.year || '年份未知'} · {h.venue || '（无来源）'}
                          {h.authors.length ? ` · ${h.authors.slice(0, 3).join(', ')}` : ''}
                        </div>
                        {h.doi && <div className="mono mt-0.5 truncate text-[10px] text-accent">doi:{h.doi}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          icon={<Icon as={BookmarkPlus} size={12} />}
                          disabled={done}
                          onClick={() => register(h)}
                        >
                          {done ? '已登记' : '登记为文献'}
                        </Button>
                        {h.doi && (
                          <Button
                            size="sm"
                            variant="quiet"
                            icon={<Icon as={ExternalLink} size={12} />}
                            title="在新标签打开 DOI"
                            onClick={() => window.open(`https://doi.org/${h.doi}`, '_blank', 'noopener')}
                          >
                            DOI
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </WindowFrame>
  )
}
