import type { SnapZone } from './types'

export type Rect = { x: number; y: number; w: number; h: number }
export type Bounds = { w: number; h: number }

export const GAP = 8
export const GRID = 4

export function layoutFor(snap: SnapZone, bounds: Bounds): Rect {
  const { w: W, h: H } = bounds
  const halfW = (W - GAP) / 2
  const halfH = (H - GAP) / 2
  switch (snap) {
    case 'left':
    case 'thirds-l':
      return { x: 0, y: 0, w: halfW, h: H }
    case 'right':
    case 'thirds-r':
      return { x: (W + GAP) / 2, y: 0, w: halfW, h: H }
    case 'top':
    case 'halves-t':
      return { x: 0, y: 0, w: W, h: halfH }
    case 'bottom':
    case 'halves-b':
      return { x: 0, y: (H + GAP) / 2, w: W, h: halfH }
    case 'tl':
      return { x: 0, y: 0, w: halfW, h: halfH }
    case 'tr':
      return { x: (W + GAP) / 2, y: 0, w: halfW, h: halfH }
    case 'bl':
      return { x: 0, y: (H + GAP) / 2, w: halfW, h: halfH }
    case 'br':
      return { x: (W + GAP) / 2, y: (H + GAP) / 2, w: halfW, h: halfH }
    case 'thirds-c':
      return { x: (W - GAP) / 2, y: 0, w: (W - GAP) / 3, h: H }
    case 'full':
      return { x: 0, y: 0, w: W, h: H }
    default:
      return { x: 0, y: 0, w: W, h: H }
  }
}

/** 拖拽落位判定：靠近边缘/角落时给出吸附区 */
export function detectSnap(px: number, py: number, bounds: Bounds): SnapZone | null {
  const { w: W, h: H } = bounds
  const nearL = px < W * 0.18
  const nearR = px > W * 0.82
  const nearT = py < H * 0.14
  const nearB = py > H * 0.86

  if (nearL && nearT) return 'tl'
  if (nearL && nearB) return 'bl'
  if (nearR && nearT) return 'tr'
  if (nearR && nearB) return 'br'
  if (nearT) return 'top'
  if (nearB) return 'bottom'
  if (px < W * 0.36) return 'left'
  if (px > W * 0.64) return 'right'
  if (px > W * 0.46 && px < W * 0.58) return 'thirds-c'
  return null
}

export function snapToGrid(n: number): number {
  return Math.round(n / GRID) * GRID
}

export function clampRect(rect: Rect, bounds: Bounds): Rect {
  const w = Math.min(rect.w, Math.max(320, bounds.w))
  const h = Math.min(rect.h, Math.max(240, bounds.h))
  return {
    w,
    h,
    x: Math.max(0, Math.min(rect.x, bounds.w - w)),
    y: Math.max(0, Math.min(rect.y, bounds.h - h)),
  }
}
