import { createContext } from 'react'
import { create } from 'zustand'
import { useWindows } from './windows'

export type TrackKey = 'read' | 'write' | 'send'

type PipelineState = {
  /** 写轨道当前的数据表 */
  datasetId: string | null
  /** 发轨道当前的草稿 */
  draftId: string | null
  /** 被拖出的轨道：trackKey -> 浮动窗口 id */
  detached: Record<TrackKey, string | null>
  /** 当前聚焦的轨道（快捷键 1/2/3 切换） */
  focused: TrackKey | null
  /** 当前是流水线布局还是独立窗口布局，由 Pipeline 挂载时置位 */
  layout: 'pipeline' | 'window'
  setDataset: (id: string | null) => void
  setDraft: (id: string | null) => void
  detach: (track: TrackKey, windowId: string) => void
  attach: (track: TrackKey) => void
  focusTrack: (track: TrackKey | null) => void
}

export const usePipeline = create<PipelineState>((set) => ({
  datasetId: null,
  draftId: null,
  detached: { read: null, write: null, send: null },
  focused: 'read',
  layout: 'window',
  setDataset: (datasetId) => set({ datasetId }),
  setDraft: (draftId) => set({ draftId }),
  detach: (track, windowId) => set((s) => ({ detached: { ...s.detached, [track]: windowId } })),
  attach: (track) => set((s) => ({ detached: { ...s.detached, [track]: null } })),
  focusTrack: (focused) => set({ focused }),
}))

/**
 * 轨道间联动：建表 → 写轨道切到新表；导出 → 发轨道切到新草稿。
 * 如果那条轨道被拖成了浮动窗口，同步改窗口的 payload。
 */
export function focusDataset(id: string) {
  usePipeline.getState().setDataset(id)
  const winId = usePipeline.getState().detached.write
  if (winId) useWindows.getState().setPayload(winId, { datasetId: id })
}

export function focusDraft(id: string) {
  usePipeline.getState().setDraft(id)
  const winId = usePipeline.getState().detached.send
  if (winId) useWindows.getState().setPayload(winId, { draftId: id })
}

/** 工作面用它判断自己是在轨道里（联动走轨道）还是浮动窗口里（联动走开窗） */
export const PipelineCtx = createContext<{ active: boolean }>({ active: false })
