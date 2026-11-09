import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { ExternalLink, Maximize2, Minus, Pin, PinOff, X } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { useWindows } from '../store/windows'
import { useUi } from '../store/ui'
import { detectSnap, layoutFor, type Bounds } from '../lib/windows-layout'
import { cn } from '../lib/cn'
import type { Win } from '../lib/types'

export type CanvasEnv = {
  bounds: Bounds
  getRect: () => DOMRect | null
}

export const CanvasCtx = createContext<CanvasEnv>({ bounds: { w: 1200, h: 700 }, getRect: () => null })

function IconBtn({
  label,
  onClick,
  active,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-[3px] transition-colors',
        danger
          ? 'text-ink-3 hover:bg-[#c42b1c] hover:text-white'
          : active
            ? 'bg-accent-soft text-accent'
            : 'text-ink-3 hover:bg-[rgba(16,24,40,0.07)] hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export function WindowFrame({
  win,
  meta,
  headerExtra,
  mode = 'floating',
  onDetach,
  children,
}: {
  win: Win
  meta?: string
  headerExtra?: ReactNode
  /** track = 嵌在流水线轨道里，不拖动、不吸附；floating = 独立浮动窗口 */
  mode?: 'track' | 'floating'
  /** track 模式下点「拖出」 */
  onDetach?: () => void
  children: ReactNode
}) {
  const { bounds, getRect } = useContext(CanvasCtx)
  const focus = useWindows((s) => s.focus)
  const moveTo = useWindows((s) => s.moveTo)
  const resizeTo = useWindows((s) => s.resizeTo)
  const applySnap = useWindows((s) => s.applySnap)
  const minimize = useWindows((s) => s.minimize)
  const togglePin = useWindows((s) => s.togglePin)
  const close = useWindows((s) => s.close)
  const setPreview = useUi((s) => s.setPreview)
  const activeId = useWindows((s) => s.activeId)
  const focused = activeId === win.id
  const [maximized, setMaximized] = useState(false)
  const [dragging, setDragging] = useState(false)
  const prevRect = useRef({ x: win.x, y: win.y, w: win.w, h: win.h })

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    const rect = getRect()
    if (!rect) return
    focus(win.id)
    const startX = e.clientX
    const startY = e.clientY
    const origX = win.x
    const origY = win.y

    setDragging(true)
    const onMove = (ev: PointerEvent) => {
      moveTo(win.id, origX + (ev.clientX - startX), origY + (ev.clientY - startY))
      const px = ev.clientX - rect.left
      const py = ev.clientY - rect.top
      const snap = detectSnap(px, py, bounds)
      setPreview(snap ? layoutFor(snap, bounds) : null)
    }
    const onUp = (ev: PointerEvent) => {
      const px = ev.clientX - rect.left
      const py = ev.clientY - rect.top
      const snap = detectSnap(px, py, bounds)
      if (snap) {
        applySnap(win.id, snap, bounds)
        setMaximized(snap === 'full')
      }
      setPreview(null)
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const toggleMax = () => {
    if (maximized) {
      const r = prevRect.current
      moveTo(win.id, r.x, r.y)
      resizeTo(win.id, r.w, r.h)
      setMaximized(false)
    } else {
      prevRect.current = { x: win.x, y: win.y, w: win.w, h: win.h }
      applySnap(win.id, 'full', bounds)
      setMaximized(true)
    }
  }

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const w = win.w
    const h = win.h
    const onMove = (ev: PointerEvent) => resizeTo(win.id, w + ev.clientX - startX, h + ev.clientY - startY)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 轨道模式：工具条只放操作件，阶段名由外层轨道头负责，这里不再重复窗口标题
  if (mode === 'track') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-surface" aria-label={win.title}>
        <header className="track-bar flex h-[34px] shrink-0 items-center gap-1.5 px-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">{headerExtra}</div>
          {onDetach && (
            <button
              type="button"
              onClick={onDetach}
              title="拖出为独立窗口"
              className="flex h-6 shrink-0 items-center gap-1 rounded-[3px] px-1.5 text-[11px] text-ink-3 transition-colors hover:bg-[rgba(16,24,40,0.06)] hover:text-ink"
            >
              <Icon as={ExternalLink} size={12} />
              拖出
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    )
  }

  return (
    <section
      onPointerDown={() => focus(win.id)}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      className={cn(
        'win absolute flex animate-win-in flex-col overflow-hidden rounded-[8px] border bg-surface',
        dragging && 'dragging',
        focused
          ? 'border-line-strong shadow-[var(--shadow-win-focus)]'
          : 'border-[#d8dde5] shadow-[var(--shadow-win)]',
      )}
      aria-label={win.title}
    >
      <header
        onPointerDown={startDrag}
        onDoubleClick={toggleMax}
        className="titlebar flex h-[30px] shrink-0 cursor-default items-center gap-1.5 px-2.5 select-none active:cursor-grabbing"
      >
        <h2
          className={cn(
            'truncate text-[12px] font-semibold',
            focused ? 'text-ink' : 'text-ink-2',
          )}
        >
          {win.title}
        </h2>
        {meta && <span className="mono shrink-0 text-[10px] text-ink-3">{meta}</span>}
        <div className="win-ctls ml-auto flex items-center gap-0.5">
          {headerExtra}
          <IconBtn label={win.pinned ? '取消置顶' : '置顶'} onClick={() => togglePin(win.id)} active={win.pinned}>
            <Icon as={win.pinned ? PinOff : Pin} size={13} />
          </IconBtn>
          <IconBtn label="最小化到底部" onClick={() => minimize(win.id)}>
            <Icon as={Minus} size={13} />
          </IconBtn>
          <IconBtn label={maximized ? '还原' : '铺满'} onClick={toggleMax}>
            <Icon as={Maximize2} size={12} />
          </IconBtn>
          <IconBtn label="关闭窗口" onClick={() => close(win.id)} danger>
            <Icon as={X} size={13} />
          </IconBtn>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      <div
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        aria-hidden
      >
        <span className="absolute bottom-[2px] right-[2px] h-[7px] w-[7px] border-b border-r border-line-strong opacity-60" />
      </div>
    </section>
  )
}
