import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, Database, FileText, Library, Search, Settings2, Table2, Terminal, Zap } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { useData } from '../store/data'
import { useWindows } from '../store/windows'
import { useMail } from '../store/mail'
import { CASES } from '../lib/caseLibrary'
import { importCase, openCasesWindow } from '../lib/caseImport'
import { combo } from '../lib/platform'
import { usePipeline, focusDataset, focusDraft } from '../store/pipeline'
import { cn } from '../lib/cn'

type Result = { id: string; group: string; icon: typeof FileText; text: string; hint?: string; run: () => void }

export function CommandPalette() {
  const open = useUi((s) => s.commandOpen)
  const setOpen = useUi((s) => s.setCommandOpen)
  const setStage = useUi((s) => s.setStage)
  const papers = useLibrary((s) => s.papers)
  const datasets = useData((s) => s.datasets)
  const openWindow = useWindows((s) => s.open)
  const createDraft = useMail((s) => s.createDraft)
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const results = useMemo<Result[]>(() => {
    const list: Result[] = []
    const kw = q.trim().toLowerCase()

    const cmds: Result[] = [
      {
        id: 'c-read',
        group: '命令',
        icon: Zap,
        text: '聚焦读',
        hint: combo("1"),
        run: () => usePipeline.getState().focusTrack('read'),
      },
      {
        id: 'c-write',
        group: '命令',
        icon: Zap,
        text: '聚焦写',
        hint: combo("2"),
        run: () => usePipeline.getState().focusTrack('write'),
      },
      {
        id: 'c-mail',
        group: '命令',
        icon: Zap,
        text: '聚焦发',
        hint: combo("3"),
        run: () => usePipeline.getState().focusTrack('send'),
      },
      {
        id: 'c-new-mail',
        group: '命令',
        icon: Zap,
        text: '新建邮件',
        run: () => {
          const draft = createDraft()
          focusDraft(draft)
          usePipeline.getState().focusTrack('send')
        },
      },
      {
        id: 'c-cases',
        group: '命令',
        icon: Library,
        text: '打开实例库',
        run: () => openCasesWindow(),
      },
      {
        id: 'c-stage-read',
        group: '命令',
        icon: Terminal,
        text: '定位到「读」轨道',
        run: () => usePipeline.getState().focusTrack('read'),
      },
      {
        id: 'c-stage-write',
        group: '命令',
        icon: Terminal,
        text: '定位到「写」轨道',
        run: () => usePipeline.getState().focusTrack('write'),
      },
      {
        id: 'c-stage-send',
        group: '命令',
        icon: Terminal,
        text: '定位到「发」轨道',
        run: () => usePipeline.getState().focusTrack('send'),
      },
      {
        id: 'c-settings',
        group: '命令',
        icon: Settings2,
        text: '打开设置与 API',
        run: () => useUi.getState().openSettings(),
      },
      {
        id: 'c-apilog',
        group: '命令',
        icon: Activity,
        text: '查看 API 调用日志',
        run: () => useUi.getState().openSettings('log'),
      },
    ]

    for (const c of cmds) if (!kw || c.text.toLowerCase().includes(kw)) list.push(c)

    for (const p of papers) {
      if (kw && !`${p.title}${p.authors.join('')}${p.venue}`.toLowerCase().includes(kw)) continue
      list.push({
        id: `p-${p.id}`,
        group: '文献',
        icon: FileText,
        text: p.title,
        hint: `${p.year} · ${p.venue}`,
        run: () => {
          usePipeline.getState().focusTrack('read')
          useUi.getState().openPeek({ type: 'paper', id: p.id })
        },
      })
    }

    for (const d of datasets) {
      if (kw && !d.name.toLowerCase().includes(kw)) continue
      list.push({
        id: `d-${d.id}`,
        group: '数据表',
        icon: Table2,
        text: d.name,
        hint: `${d.rows.length} 行 × ${d.columns.length} 列`,
        run: () => {
          focusDataset(d.id)
          usePipeline.getState().focusTrack('write')
        },
      })
    }

    for (const c of CASES) {
      if (kw && !`${c.name}${c.category}${c.capability.join('')}`.toLowerCase().includes(kw)) continue
      list.push({
        id: `case-${c.id}`,
        group: '实例',
        icon: Database,
        text: c.name,
        hint: `${c.rows.length} 行 · ${c.category}`,
        run: () => importCase(c),
      })
    }

    return list
  }, [q, papers, datasets, openWindow, createDraft, setStage])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const r = results[index]
        if (r) {
          r.run()
          setOpen(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, index, setOpen])

  if (!open) return null

  let lastGroup = ''

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      style={{ backgroundColor: 'rgba(16,23,37,0.10)' }} onMouseDown={() => setOpen(false)}>
      <div
        className="w-[540px] overflow-hidden rounded-[8px] border border-line-strong bg-surface shadow-[var(--shadow-float)] animate-win-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-2.5">
          <Icon as={Search} size={16} className="text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setIndex(0)
            }}
            placeholder="搜文献、数据表，或执行命令"
            className="h-9 flex-1 bg-transparent text-[13px] outline-none focus:outline-none focus-visible:shadow-none placeholder:text-ink-3"
          />
          <kbd className="mono shrink-0 text-[10px] text-ink-3">{combo("K")}</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-ink-3">没有匹配项</div>
          )}
          {results.map((r, i) => {
            const showGroup = r.group !== lastGroup
            lastGroup = r.group
            return (
              <div key={r.id}>
                {showGroup && (
                  <div className="px-3 pb-1 pt-2 text-[10px] text-ink-3">{r.group}</div>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => {
                    r.run()
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-[5px] text-left text-[12px]',
                    i === index ? 'bg-accent-soft text-ink' : 'text-ink-2',
                  )}
                >
                  <Icon as={r.icon} size={14} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate">{r.text}</span>
                  {r.hint && <span className="mono shrink-0 text-[10px] text-ink-3">{r.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="mono flex items-center gap-3 border-t border-line px-3 py-1.5 text-[10px] text-ink-3">
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
          <span className="ml-auto">实例库案例可直接抄入</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
