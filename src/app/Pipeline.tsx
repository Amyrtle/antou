import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Minimize2 } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { usePipeline, PipelineCtx, type TrackKey } from '../store/pipeline'
import { useWindows, clampWindows } from '../store/windows'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { useData } from '../store/data'
import { useMail } from '../store/mail'
import { CanvasCtx } from '../windows/WindowFrame'
import { QaWindow } from '../windows/QaWindow'
import { TableWindow } from '../windows/TableWindow'
import { MailDrawer } from '../windows/MailDrawer'
import { CasesWindow } from '../windows/CasesWindow'
import type { Win, WindowKind } from '../lib/types'

const TRACK_META: Record<TrackKey, { kind: WindowKind; title: string; label: string }> = {
  read: { kind: 'qa', title: '文献问答', label: '读' },
  write: { kind: 'table', title: '数据表', label: '写' },
  send: { kind: 'mail', title: '新邮件', label: '发' },
}

/** 轨道里的工作面需要一个 win 形参，这里造一个不参与窗口管理的虚拟对象 */
function trackWin(track: TrackKey): Win {
  const m = TRACK_META[track]
  return {
    id: `track-${track}`,
    kind: m.kind,
    title: m.title,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    z: 0,
    pinned: false,
    minimized: false,
  }
}

function Track({
  track,
  count,
  flow,
  onDetach,
  register,
  children,
}: {
  track: TrackKey
  count: string
  flow: boolean
  onDetach: () => void
  register: (track: TrackKey, el: HTMLElement | null) => void
  children: (onDetach: () => void) => React.ReactNode
}) {
  const detached = usePipeline((s) => s.detached[track])
  const attach = usePipeline((s) => s.attach)
  const focused = usePipeline((s) => s.focused === track)
  const focusTrack = usePipeline((s) => s.focusTrack)
  const close = useWindows((s) => s.close)
  const meta = TRACK_META[track]

  return (
    <section
      ref={(el) => register(track, el)}
      className="track"
      data-focused={focused}
      onPointerDown={() => focusTrack(track)}
      aria-label={`${meta.label}阶段`}
    >
      <header className="track-head">
        <span className="track-label">{meta.label}</span>
        <span className="track-count">{count}</span>
        {detached && (
          <span className="ml-2 flex items-center gap-1.5 text-[11px] text-ink-3">
            <span>已拖出</span>
            <button
              type="button"
              onClick={() => {
                close(detached)
                attach(track)
              }}
              className="flex h-6 items-center gap-1 rounded-[3px] border border-line bg-surface px-1.5 text-[11px] text-ink-2 transition-colors hover:border-accent-line hover:text-accent"
            >
              <Icon as={Minimize2} size={12} />
              收回
            </button>
          </span>
        )}
        {flow && (
          <span className="track-flow" aria-hidden>
            <Icon as={ArrowRight} size={14} />
          </span>
        )}
      </header>

      <div className="track-body">
        {detached ? (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-3">
            这段内容现在是独立窗口，可拖动、吸附、双击铺满
          </div>
        ) : (
          children(onDetach)
        )}
      </div>
    </section>
  )
}

/** 被拖出的窗口在这一层浮动，可拖动、吸附、关闭；关闭即收回轨道 */
function FloatingLayer() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ w: 0, h: 0 })
  const windows = useWindows((s) => s.windows)
  const preview = useUi((s) => s.preview)
  const detached = usePipeline((s) => s.detached)

  const detachedIds = Object.values(detached).filter(Boolean) as string[]
  const floating = useMemo(
    // 拖出来的窗口 + 实例库这种额外开的窗口
    () => windows.filter((w) => !w.minimized && (detachedIds.includes(w.id) || w.kind === 'cases')),
    [windows, detachedIds.join(',')], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      if (r.width < 100 || r.height < 100) return
      setBounds({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 画布尺寸变化时收拢窗口
  useEffect(() => {
    if (!floating.length || bounds.w < 200) return
    const clamped = clampWindows(floating, bounds)
    for (const w of clamped) {
      const o = floating.find((x) => x.id === w.id)
      if (!o) continue
      if (o.w !== w.w || o.h !== w.h) useWindows.getState().resizeTo(w.id, w.w, w.h)
      if (o.x !== w.x || o.y !== w.y) useWindows.getState().moveTo(w.id, w.x, w.y)
    }
  }, [bounds]) // eslint-disable-line react-hooks/exhaustive-deps

  const getRect = () => hostRef.current?.getBoundingClientRect() ?? null

  if (!floating.length) return null

  return (
    <CanvasCtx.Provider value={{ bounds, getRect }}>
      <div ref={hostRef} className="pointer-events-none absolute inset-0 z-30">
        {preview && (
          <div
            className="absolute rounded-[8px] border border-accent"
            style={{
              left: preview.x,
              top: preview.y,
              width: preview.w,
              height: preview.h,
              backgroundColor: 'rgba(10,99,201,0.08)',
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-0">
          {floating.map((w) => (
            <div key={w.id} className="pointer-events-auto">
              {w.kind === 'qa' && <QaWindow win={w} />}
              {w.kind === 'table' && <TableWindow win={w} />}
              {w.kind === 'mail' && <MailDrawer win={w} />}
              {w.kind === 'cases' && <CasesWindow win={w} />}
            </div>
          ))}
        </div>
      </div>
    </CanvasCtx.Provider>
  )
}

// 预览状态从 ui store 读，单独抽出来避免 FloatingLayer 订阅整个 ui

export function Pipeline() {
  const trackEls = useRef<Partial<Record<TrackKey, HTMLElement | null>>>({})
  const register = useCallback((track: TrackKey, el: HTMLElement | null) => {
    trackEls.current[track] = el
  }, [])
  const papers = useLibrary((s) => s.papers)
  const datasets = useData((s) => s.datasets)
  const mailItems = useMail((s) => s.items)
  const windows = useWindows((s) => s.windows)
  const detached = usePipeline((s) => s.detached)
  const setDataset = usePipeline((s) => s.setDataset)
  const setDraft = usePipeline((s) => s.setDraft)
  const detach = usePipeline((s) => s.detach)
  const attach = usePipeline((s) => s.attach)

  // 新布局不恢复上次的浮动窗口，回到三轨道
  useEffect(() => {
    usePipeline.setState({ layout: 'pipeline' })
    if (useWindows.getState().windows.length) {
      useWindows.setState({ windows: [], zTop: 10, activeId: null })
    }
  }, [])

  // 初始化当前对象
  useEffect(() => {
    if (datasets.length && !usePipeline.getState().datasetId) setDataset(datasets[0].id)
  }, [datasets, setDataset])
  useEffect(() => {
    const drafts = mailItems.filter((m) => m.status === 'draft')
    if (mailItems.length && !usePipeline.getState().draftId) setDraft((drafts[0] ?? mailItems[0]).id)
  }, [mailItems, setDraft])

  // 浮动窗口被关闭（X 或收回）时，把对应轨道标记为已收回
  useEffect(() => {
    for (const track of ['read', 'write', 'send'] as const) {
      const winId = detached[track]
      if (winId && !windows.find((w) => w.id === winId)) attach(track)
    }
  }, [windows, detached, attach])

  const handleDetach = (track: TrackKey) => {
    const meta = TRACK_META[track]
    const state = usePipeline.getState()
    const payload =
      track === 'write' ? { datasetId: state.datasetId } : track === 'send' ? { draftId: state.draftId } : undefined

    // 落在自己那条轨道上方：读起来就是「这段内容被拿出来了」，而不是凭空出现在别处
    const el = trackEls.current[track]
    const rect = el?.getBoundingClientRect()
    const host = el?.parentElement?.getBoundingClientRect()
    const left = rect && host ? rect.left - host.left : 0
    const top = rect && host ? rect.top - host.top : 0
    const width = rect?.width ?? 620
    const winW = Math.max(440, Math.min(width - 24, track === 'send' ? 460 : 640))
    const winH = track === 'read' ? 620 : 560

    const winId = useWindows.getState().add(meta.kind, meta.title, {
      x: Math.max(0, left + (width - winW) / 2),
      y: top + 56,
      w: winW,
      h: winH,
      payload,
    })
    detach(track, winId)
  }

  const counts = {
    read: `${papers.length} 篇文献`,
    write: `${datasets.length} 张表`,
    send: `${mailItems.length} 封`,
  }

  return (
    <PipelineCtx.Provider value={{ active: true }}>
      <div className="pipeline relative flex min-h-0 flex-1">
        <Track track="read" count={counts.read} flow onDetach={() => handleDetach('read')} register={register}>
          {(onDetach) => <QaWindow win={trackWin('read')} mode="track" onDetach={onDetach} />}
        </Track>
        <Track track="write" count={counts.write} flow onDetach={() => handleDetach('write')} register={register}>
          {(onDetach) => <TableWindow win={trackWin('write')} mode="track" onDetach={onDetach} />}
        </Track>
        <Track track="send" count={counts.send} flow={false} onDetach={() => handleDetach('send')} register={register}>
          {(onDetach) => <MailDrawer win={trackWin('send')} mode="track" onDetach={onDetach} />}
        </Track>

        <FloatingLayer />
      </div>
    </PipelineCtx.Provider>
  )
}
