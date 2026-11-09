import type { Column, Row } from './types'

export type ColumnStats = {
  count: number
  missing: number
  missingRate: number
  mean: number | null
  median: number | null
  min: number | null
  max: number | null
  sum: number | null
  histogram: number[]
}

export function numericValues(rows: Row[], col: Column): number[] {
  const out: number[] = []
  for (const r of rows) {
    const v = r.cells[col.key]
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

export function columnStats(rows: Row[], col: Column): ColumnStats {
  const values = numericValues(rows, col)
  const missing = rows.length - values.length
  if (!values.length) {
    return {
      count: 0,
      missing,
      missingRate: rows.length ? missing / rows.length : 0,
      mean: null,
      median: null,
      min: null,
      max: null,
      sum: null,
      histogram: [],
    }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((a, b) => a + b, 0)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const bins = 8
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const span = max - min || 1
  const histogram = new Array(bins).fill(0) as number[]
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor(((v - min) / span) * bins))
    histogram[idx] += 1
  }
  return {
    count: values.length,
    missing,
    missingRate: rows.length ? missing / rows.length : 0,
    mean: sum / values.length,
    median,
    min,
    max,
    sum,
    histogram,
  }
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
