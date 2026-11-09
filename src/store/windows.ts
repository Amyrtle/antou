import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SnapZone, Win, WindowKind } from '../lib/types'
import { uid } from '../lib/id'
import { clampRect, layoutFor, snapToGrid, type Bounds } from '../lib/windows-layout'

export const DEFAULT_SIZE: Record<WindowKind, { w: number; h: number }> = {
  qa: { w: 720, h: 560 },
  table: { w: 900, h: 620 },
  mail: { w: 420, h: 720 },
  draft: { w: 680, h: 600 },
  cases: { w: 900, h: 640 },
}

type WindowsState = {
  windows: Win[]
  zTop: number
  activeId: string | null
  add: (kind: WindowKind, title: string, opts?: Partial<Win>) => string
  /** 打开某个工作面：已有同类型窗口就复用（必要时还原、聚焦、换 payload），没有才新建 */
  open: (kind: WindowKind, title: string, opts?: Partial<Win>) => string
  close: (id: string) => void
  focus: (id: string) => void
  moveTo: (id: string, x: number, y: number) => void
  resizeTo: (id: string, w: number, h: number) => void
  applySnap: (id: string, snap: SnapZone, bounds: Bounds) => void
  minimize: (id: string) => void
  restore: (id: string) => void
  togglePin: (id: string) => void
  setPayload: (id: string, payload: Record<string, unknown>) => void
  setTitle: (id: string, title: string) => void
  byId: (id: string) => Win | undefined
  floating: () => Win[]
  dock: () => Win[]
}

export const useWindows = create<WindowsState>()(
  persist(
    (set, get) => ({
      windows: [],
      zTop: 10,
      activeId: null,

      add: (kind, title, opts) => {
        const id = uid('w-')
        const size = DEFAULT_SIZE[kind]
        const offset = (get().windows.length % 7) * 28
        const win: Win = {
          id,
          kind,
          title,
          x: opts?.x ?? 40 + offset,
          y: opts?.y ?? 40 + offset,
          w: opts?.w ?? size.w,
          h: opts?.h ?? size.h,
          z: get().zTop + 1,
          pinned: opts?.pinned ?? false,
          minimized: opts?.minimized ?? false,
          snap: opts?.snap,
          payload: opts?.payload,
        }
        set((s) => ({ windows: [...s.windows, win], zTop: win.z, activeId: id }))
        return id
      },

      open: (kind, title, opts) => {
        // 只复用「没被关掉」的同类型窗口：mail 是抽屉，table/qa 是一对一的工作面
        const existing = get().windows.find((w) => w.kind === kind)
        if (!existing) return get().add(kind, title, opts)
        const id = existing.id
        set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: false } : w)) }))
        if (opts?.payload) get().setPayload(id, opts.payload)
        if (opts?.title) get().setTitle(id, opts.title)
        get().focus(id)
        return id
      },

      close: (id) =>
        set((s) => ({
          windows: s.windows.filter((w) => w.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),

      focus: (id) =>
        set((s) => {
          const target = s.windows.find((w) => w.id === id)
          if (!target) return s
          const z = s.zTop + 1
          return {
            windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)),
            zTop: z,
            activeId: id,
          }
        }),

      moveTo: (id, x, y) =>
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === id ? { ...w, x: snapToGrid(x), y: snapToGrid(y), snap: undefined } : w,
          ),
        })),

      resizeTo: (id, nextW, nextH) =>
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === id
              ? { ...w, w: Math.max(360, Math.round(nextW)), h: Math.max(280, Math.round(nextH)) }
              : w,
          ),
        })),

      applySnap: (id, snap, bounds) =>
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, ...layoutFor(snap, bounds), snap } : w)),
        })),

      minimize: (id) =>
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
          activeId: s.activeId === id ? null : s.activeId,
        })),

      restore: (id) =>
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: false } : w)),
          activeId: id,
        })),

      togglePin: (id) =>
        set((s) => {
          const z = s.zTop + 1
          return {
            windows: s.windows.map((w) =>
              w.id === id ? { ...w, pinned: !w.pinned, z: !w.pinned ? z : w.z } : w,
            ),
            zTop: z,
          }
        }),

      setPayload: (id, payload) =>
        set((s) => ({
          windows: s.windows.map((w) => (w.id === id ? { ...w, payload: { ...w.payload, ...payload } } : w)),
        })),

      setTitle: (id, title) =>
        set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, title } : w)) })),

      byId: (id) => get().windows.find((w) => w.id === id),

      floating: () =>
        get()
          .windows.filter((w) => !w.minimized && w.kind !== 'mail')
          .sort((a, b) => a.z - b.z),

      dock: () => get().windows.filter((w) => w.minimized),
    }),
    { name: 'antou.windows', version: 1 },
  ),
)

export function clampWindows(windows: Win[], bounds: Bounds) {
  return windows.map((w) => {
    const r = clampRect({ x: w.x, y: w.y, w: w.w, h: w.h }, bounds)
    return { ...w, ...r }
  })
}
