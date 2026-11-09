import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Chart, Column, Dataset, Report, Row } from '../lib/types'
import { DEMO_DATASET } from '../lib/demo'
import { uid } from '../lib/id'
import { columnStats } from '../lib/stats'
import { fmtNum } from '../lib/format'

type DataState = {
  datasets: Dataset[]
  reports: Report[]
  activeDatasetId: string | null
  init: () => void
  addDataset: (ds: Dataset) => string
  updateDataset: (id: string, patch: Partial<Dataset>) => void
  removeDataset: (id: string) => void
  setActive: (id: string | null) => void
  updateCell: (datasetId: string, rowId: string, colKey: string, value: string | number | null) => void
  addRow: (datasetId: string) => void
  removeRow: (datasetId: string, rowId: string) => void
  addColumn: (datasetId: string, col: Column) => void
  removeColumn: (datasetId: string, key: string) => void
  updateColumn: (datasetId: string, key: string, patch: Partial<Column>) => void
  generateReport: (datasetId: string) => Report | null
  recordExport: (datasetId: string, format: 'csv' | 'xlsx' | 'pdf', name: string) => void
  datasetById: (id: string) => Dataset | undefined
  reportByDataset: (datasetId: string) => Report | undefined
}

const touch = (ds: Dataset): Dataset => ({ ...ds, updated_at: Date.now() })

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      datasets: [],
      reports: [],
      activeDatasetId: null,

      init: () => {
        const state = get()
        if (!state.datasets.length) {
          set({
            datasets: [DEMO_DATASET],
            activeDatasetId: DEMO_DATASET.id,
          })
        } else if (!state.activeDatasetId) {
          set({ activeDatasetId: state.datasets[0].id })
        }
      },

      addDataset: (ds) => {
        set((s) => ({ datasets: [ds, ...s.datasets], activeDatasetId: ds.id }))
        return ds.id
      },

      updateDataset: (id, patch) =>
        set((s) => ({
          datasets: s.datasets.map((d) => (d.id === id ? touch({ ...d, ...patch }) : d)),
        })),

      removeDataset: (id) =>
        set((s) => ({
          datasets: s.datasets.filter((d) => d.id !== id),
          reports: s.reports.filter((r) => r.dataset_id !== id),
          activeDatasetId: s.activeDatasetId === id ? null : s.activeDatasetId,
        })),

      setActive: (id) => set({ activeDatasetId: id }),

      updateCell: (datasetId, rowId, colKey, value) =>
        set((s) => ({
          datasets: s.datasets.map((d) =>
            d.id !== datasetId
              ? d
              : touch({
                  ...d,
                  rows: d.rows.map((r) =>
                    r.id === rowId ? { ...r, cells: { ...r.cells, [colKey]: value } } : r,
                  ),
                }),
          ),
        })),

      addRow: (datasetId) =>
        set((s) => ({
          datasets: s.datasets.map((d) => {
            if (d.id !== datasetId) return d
            const row: Row = {
              id: uid('row-'),
              cells: Object.fromEntries(d.columns.map((c) => [c.key, c.type === 'number' ? null : ''])),
            }
            return touch({ ...d, rows: [...d.rows, row] })
          }),
        })),

      removeRow: (datasetId, rowId) =>
        set((s) => ({
          datasets: s.datasets.map((d) =>
            d.id !== datasetId ? d : touch({ ...d, rows: d.rows.filter((r) => r.id !== rowId) }),
          ),
        })),

      addColumn: (datasetId, col) =>
        set((s) => ({
          datasets: s.datasets.map((d) =>
            d.id !== datasetId
              ? d
              : touch({
                  ...d,
                  columns: [...d.columns, col],
                  rows: d.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.key]: null } })),
                }),
          ),
        })),

      removeColumn: (datasetId, key) =>
        set((s) => ({
          datasets: s.datasets.map((d) => {
            if (d.id !== datasetId) return d
            const columns = d.columns.filter((c) => c.key !== key)
            const rows = d.rows.map((r) => {
              const cells = { ...r.cells }
              delete cells[key]
              return { ...r, cells }
            })
            return touch({ ...d, columns, rows })
          }),
        })),

      updateColumn: (datasetId, key, patch) =>
        set((s) => ({
          datasets: s.datasets.map((d) =>
            d.id !== datasetId
              ? d
              : touch({ ...d, columns: d.columns.map((c) => (c.key === key ? { ...c, ...patch } : c)) }),
          ),
        })),

      generateReport: (datasetId) => {
        const ds = get().datasetById(datasetId)
        if (!ds) return null
        const numericCols = ds.columns.filter((c) => c.type === 'number')
        const cards: Report['cards'] = []
        cards.push({ label: '样本数', value: String(ds.rows.length), sub: `${ds.columns.length} 列` })

        let spread: number | null = null
        let spreadCol = ''
        for (const c of numericCols) {
          const st = columnStats(ds.rows, c)
          if (st.mean === null || st.max === null || st.min === null) continue
          const r = st.max - st.min
          if (spread === null || r > spread) {
            spread = r
            spreadCol = c.name
          }
        }
        cards.push({
          label: '组间差异',
          value: spread === null ? '—' : fmtNum(spread, 2),
          sub: spreadCol ? `${spreadCol} 极差` : '需要数值列',
          tone: spread !== null && spread > 0 ? 'warn' : 'default',
        })

        const best = numericCols
          .map((c) => ({ c, st: columnStats(ds.rows, c) }))
          .filter((x) => x.st.mean !== null)
          .sort((a, b) => (b.st.mean ?? 0) - (a.st.mean ?? 0))[0]
        cards.push({
          label: '显著列',
          value: best ? best.c.name : '—',
          sub: best && best.st.mean !== null ? `均值 ${fmtNum(best.st.mean, 2)}` : '需要数值列',
          tone: best ? 'ok' : 'default',
        })

        const labelCol = ds.columns.find((c) => c.type === 'text')
        let chart: Chart
        if (!labelCol && numericCols.length >= 2) {
          const [cx, cy] = numericCols
          const points: [number, number][] = []
          for (const r of ds.rows) {
            const rx = r.cells[cx.key]
            const ry = r.cells[cy.key]
            if (rx === null || rx === '' || ry === null || ry === '') continue
            const x = Number(rx)
            const y = Number(ry)
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue
            points.push([x, y])
          }
          chart = {
            type: 'scatter',
            xLabel: cx.name + (cx.unit ? `（${cx.unit}）` : ''),
            yLabel: cy.name + (cy.unit ? `（${cy.unit}）` : ''),
            points,
          }
        } else {
          // 存完整类目名，截断只在渲染时做（否则两个 "5-way x-shot" 会被截成同一个标签）
          const categories = ds.rows.map((r, i) => {
            const v = labelCol ? r.cells[labelCol.key] : undefined
            return v === undefined || v === null || v === '' ? `行 ${i + 1}` : String(v)
          })
          const series = numericCols.slice(0, 2).map((c, i) => ({
            name: c.name + (c.unit ? `（${c.unit}）` : ''),
            type: i === 0 ? ('bar' as const) : ('line' as const),
            column: c.key,
            unit: c.unit,
          }))
          chart = { type: 'barline', categories, series }
        }

        const previous = get().reports.find((r) => r.dataset_id === datasetId)
        const report: Report = {
          id: uid('rep-'),
          dataset_id: datasetId,
          cards,
          chart,
          generated_at: Date.now(),
          // 重新生成只是换数据，导出记录是历史，不能跟着一起清掉
          exports: previous?.exports ?? [],
        }
        set((s) => ({ reports: [report, ...s.reports.filter((r) => r.dataset_id !== datasetId)] }))
        return report
      },

      recordExport: (datasetId, format, name) =>
        set((s) => ({
          reports: s.reports.map((r) =>
            r.dataset_id === datasetId
              ? { ...r, exports: [...r.exports, { format, name, at: Date.now() }] }
              : r,
          ),
        })),

      datasetById: (id) => get().datasets.find((d) => d.id === id),
      reportByDataset: (datasetId) => get().reports.find((r) => r.dataset_id === datasetId),
    }),
    { name: 'antou.data', version: 1 },
  ),
)
