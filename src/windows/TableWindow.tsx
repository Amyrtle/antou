import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  BarChart3,
  Columns3,
  Download,
  Hash,
  Mail,
  Plus,
  Rows3,
  Settings2,
  Table2,
  Trash2,
  Type,
  CalendarDays,
  Library,
} from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Button, Dot, Floating, Note } from '../ui/kit'
import { WindowFrame } from './WindowFrame'
import { PipelineCtx, focusDraft, usePipeline } from '../store/pipeline'
import { openCasesWindow } from '../lib/caseImport'
import { useData } from '../store/data'
import { useWindows } from '../store/windows'
import { useUi } from '../store/ui'
import { useHistory } from '../store/history'
import { useMail } from '../store/mail'
import { columnStats } from '../lib/stats'
import { useCountUp } from '../lib/useCountUp'
import { exportCsv, exportPdfViaPrint, exportXlsx } from '../lib/exporters'
import { fmtNum, pct } from '../lib/format'
import { cn } from '../lib/cn'
import type { Column, Dataset, Win } from '../lib/types'


/** 列宽百分比：指标列与来源列占大头，其余均分，总和 100 */
function colWidths(columns: Column[]): string[] {
  const fixed: number[] = columns.map((c) => (c.key === 'metric' ? 24 : c.key === 'source' ? 22 : 0))
  const rest = columns.length - fixed.filter((w) => w > 0).length
  const each = rest > 0 ? (100 - fixed.reduce((a, b) => a + b, 0)) / rest : 0
  return fixed.map((w) => `${w > 0 ? w : each}%`)
}

const TYPE_ICON = { text: Type, number: Hash, date: CalendarDays } as const

function useChart(report: ReturnType<typeof useData.getState>['reports'][number] | undefined, dataset: Dataset | undefined) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host || !report || !dataset) return
    let disposed = false
    let dispose: (() => void) | undefined

    void import('echarts').then((mod) => {
      if (disposed) return
      const chart = mod.init(host)
      const valueAxis = {
        axisLine: { lineStyle: { color: '#e6decd' } },
        splitLine: { lineStyle: { color: '#efe9db' } },
        axisLabel: { fontSize: 10, color: '#9d9482' },
      }
      if (report.chart.type === 'scatter') {
        const { xLabel, yLabel, points } = report.chart
        chart.setOption({
          grid: { left: 52, right: 24, top: 28, bottom: 32 },
          tooltip: {
            trigger: 'item',
            formatter: (p: { value: [number, number] }) => `${xLabel} ${p.value[0]} · ${yLabel} ${p.value[1]}`,
          },
          xAxis: {
            type: 'value',
            name: xLabel,
            nameTextStyle: { fontSize: 10, color: '#838c9b' },
            ...valueAxis,
          },
          yAxis: {
            type: 'value',
            name: yLabel,
            nameTextStyle: { fontSize: 10, color: '#838c9b' },
            ...valueAxis,
          },
          series: [
            { type: 'scatter', data: points, symbolSize: 7, itemStyle: { color: '#0a63c9', opacity: 0.75 } },
          ],
        } as never)
      } else {
        const { categories, series: seriesDef } = report.chart
        const valuesOf = (colKey: string) =>
          dataset.rows.map((r) => {
            const n = Number(r.cells[colKey])
            return Number.isFinite(n) ? n : null
          })
        // 指标名是中文长句时，竖排无论如何都会截成一团：改成横向条形，名字排在左边
        const horizontal = categories.length >= 4 && categories.some((c) => c.length > 7)
        if (horizontal) {
          chart.setOption({
            grid: { left: 96, right: 24, top: 30, bottom: 26 },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: {
              top: 0,
              right: 0,
              itemWidth: 10,
              itemHeight: 10,
              textStyle: { fontSize: 11, color: '#49515f' },
            },
            xAxis: {
              type: 'value',
              splitLine: { lineStyle: { color: '#f0f2f5' } },
              axisLabel: { fontSize: 10, color: '#838c9b' },
            },
            yAxis: {
              type: 'category',
              inverse: true,
              data: categories,
              axisLine: { lineStyle: { color: '#e4e7ec' } },
              axisTick: { show: false },
              axisLabel: { fontSize: 10, color: '#4b5563', width: 90, overflow: 'truncate' },
            },
            series: seriesDef.map((s, i) => ({
              name: s.name,
              type: 'bar',
              data: valuesOf(s.column),
              barMaxWidth: 11,
              itemStyle: { color: i === 0 ? '#0a63c9' : '#b45309', borderRadius: [0, 2, 2, 0] },
            })) as never,
          })
        } else {
          const series = seriesDef.map((s) => ({
            name: s.name,
            type: s.type,
            data: valuesOf(s.column),
            barMaxWidth: 26,
            itemStyle: { color: s.type === 'bar' ? '#0a63c9' : 'transparent', borderRadius: [2, 2, 0, 0] },
            lineStyle: { color: '#b45309', width: 1.5 },
            symbol: 'circle',
            symbolSize: 5,
            smooth: false,
            z: s.type === 'line' ? 3 : 2,
          }))
          chart.setOption({
            grid: { left: 42, right: 16, top: 26, bottom: 58 },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: {
              top: 0,
              right: 0,
              itemWidth: 10,
              itemHeight: 10,
              textStyle: { fontSize: 11, color: '#49515f' },
            },
            xAxis: {
              type: 'category',
              data: categories,
              axisLine: { lineStyle: { color: '#e4e7ec' } },
              axisTick: { show: false },
              axisLabel: {
                fontSize: 10,
                color: '#838c9b',
                interval: 0,
                rotate: 30,
                margin: 8,
                width: 64,
                overflow: 'truncate',
              },
            },
            yAxis: {
              type: 'value',
              splitLine: { lineStyle: { color: '#f0f2f5' } },
              axisLabel: { fontSize: 10, color: '#838c9b' },
            },
            series: series as never,
          })
        }
      }
      const onResize = () => chart.resize()
      window.addEventListener('resize', onResize)
      dispose = () => {
        window.removeEventListener('resize', onResize)
        chart.dispose()
      }
    })

    return () => {
      disposed = true
      dispose?.()
    }
  }, [report, dataset])
  return ref
}

function MetricCardView({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'ok' | 'warn'
}) {
  const numeric = Number(value)
  const animated = useCountUp(Number.isFinite(numeric) ? numeric : 0)
  const shown = Number.isFinite(numeric) ? String(Math.round(animated * 100) / 100) : value
  return (
    <div className="card-hover min-w-0 rounded-[5px] border border-line bg-surface-2 px-2.5 py-2">
      <div className="truncate text-[11px] text-ink-3">{label}</div>
      <div
        className={cn(
          'mono mt-0.5 truncate text-[20px] font-semibold leading-tight tracking-[-0.02em]',
          tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink',
        )}
      >
        {shown}
      </div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-ink-3">{sub}</div>}
    </div>
  )
}

function StatsPopover({
  column,
  rows,
  onClose,
}: {
  column: Column
  rows: Dataset['rows']
  onClose: () => void
}) {
  const st = columnStats(rows, column)
  const max = Math.max(1, ...st.histogram)
  return (
    <div className="w-[240px]">
      <div className="flex items-center justify-between">
        <span className="t-h2">{column.name}</span>
        <span className="mono text-[10px] text-ink-3">列统计</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-2">
        {[
          ['均值', st.mean === null ? '—' : fmtNum(st.mean, 3)],
          ['中位数', st.median === null ? '—' : fmtNum(st.median, 3)],
          ['最小', st.min === null ? '—' : fmtNum(st.min, 3)],
          ['最大', st.max === null ? '—' : fmtNum(st.max, 3)],
          ['有效值', String(st.count)],
          ['缺失率', pct(st.missingRate)],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between">
            <span className="text-[11px] text-ink-3">{k}</span>
            <span className="mono text-[11px] text-ink">{v}</span>
          </div>
        ))}
      </div>
      {st.histogram.length > 0 && (
        <div className="mt-2 flex h-10 items-end gap-[2px] border-t border-line pt-2">
          {st.histogram.map((h, i) => (
            <div
              key={i}
              title={String(h)}
              className="flex-1 rounded-t-[2px]"
              style={{
                height: `${Math.max(6, (h / max) * 32)}px`,
                backgroundColor: 'rgba(10,99,201,0.75)',
              }}
            />
          ))}
        </div>
      )}
      <button type="button" className="mt-2 w-full text-[11px] text-ink-3 hover:text-ink" onClick={onClose}>
        关闭
      </button>
    </div>
  )
}

export function TableWindow({
  win,
  mode = 'floating',
  onDetach,
}: {
  win: Win
  mode?: 'track' | 'floating'
  onDetach?: () => void
}) {
  const pipeline = useContext(PipelineCtx)
  const datasets = useData((s) => s.datasets)
  const reports = useData((s) => s.reports)
  const updateCell = useData((s) => s.updateCell)
  const addRow = useData((s) => s.addRow)
  const removeRow = useData((s) => s.removeRow)
  const addColumn = useData((s) => s.addColumn)
  const updateColumn = useData((s) => s.updateColumn)
  const generateReport = useData((s) => s.generateReport)
  const recordExport = useData((s) => s.recordExport)
  const addWindow = useWindows((s) => s.add)
  const setStage = useUi((s) => s.setStage)
  const openPeek = useUi((s) => s.openPeek)
  const log = useHistory((s) => s.log)
  const createDraft = useMail((s) => s.createDraft)
  const setVar = useMail((s) => s.setVar)
  const attach = useMail((s) => s.attach)

  const pipelineDatasetId = usePipeline((s) => s.datasetId)
  const setPipelineDataset = usePipeline((s) => s.setDataset)
  const payloadId =
    (pipeline.active ? pipelineDatasetId : null) ?? (win.payload?.datasetId as string | undefined) ?? null
  const dataset = datasets.find((d) => d.id === payloadId) ?? datasets[0]
  const report = reports.find((r) => r.dataset_id === dataset?.id)

  const [view, setView] = useState<'grid' | 'report'>('grid')
  const [editing, setEditing] = useState<{ row: string; col: string } | null>(null)
  const [cell, setCell] = useState<string>('')
  const [cursor, setCursor] = useState<string>('—')
  const [selRow, setSelRow] = useState<string | null>(null)
  const [hint, setHint] = useState<string>('')
  const hintTimer = useRef<number | null>(null)
  const [statsCol, setStatsCol] = useState<string | null>(null)
  const [statsAnchor, setStatsAnchor] = useState<HTMLElement | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editAnchor, setEditAnchor] = useState<HTMLElement | null>(null)
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx')
  const [sendAfter, setSendAfter] = useState(true)
  const [allSheets, setAllSheets] = useState(false)
  const chartRef = useChart(view === 'report' ? report : undefined, dataset)

  const numericCols = useMemo(() => dataset?.columns.filter((c) => c.type === 'number') ?? [], [dataset])
  const widths = useMemo(() => colWidths(dataset?.columns ?? []), [dataset])
  const frozenFirst = Boolean(dataset?.columns[0]?.frozen)

  /** 表底一行短提示，4 秒后自己消失 */
  const flashHint = (text: string) => {
    setHint(text)
    if (hintTimer.current) window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(''), 4200)
  }
  useEffect(() => () => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current)
  }, [])

  if (!dataset) {
    return (
      <WindowFrame win={win} meta="空">
        <div className="flex h-full items-center justify-center">
          <div className="text-[12px] text-ink-3">还没有数据表。在问答里点「带着答案去建表」，或从左栏新建一张。</div>
        </div>
      </WindowFrame>
    )
  }

  const doExport = () => {
    const stamp = Date.now()
    if (format === 'csv') exportCsv(dataset)
    else if (format === 'xlsx') void exportXlsx(allSheets ? datasets : [dataset])
    else exportPdfViaPrint()
    const name = `${dataset.name}.${format}`
    recordExport(dataset.id, format, name)
    log({ kind: 'export', title: `导出 ${name}`, detail: `${dataset.rows.length} 行 · ${dataset.columns.length} 列` })
    setExportOpen(false)
    if (sendAfter) {
      const draftId = createDraft({ subject: `本周实验进度 · ${dataset.name}` })
      setVar(draftId, '本周样本数', String(dataset.rows.length))
      setVar(draftId, '数据集名称', dataset.name)
      setVar(draftId, '日期', new Date().toLocaleDateString('zh-CN'))
      const first = dataset.rows[0]
      const firstMetric = first && dataset.columns[0] ? String(first.cells[dataset.columns[0].key] ?? '') : ''
      const firstValue = first && dataset.columns[1] ? String(first.cells[dataset.columns[1].key] ?? '') : ''
      setVar(
        draftId,
        '本周结论',
        firstMetric ? `${firstMetric} ${firstValue}${dataset.columns[1]?.unit ?? ''}，其余指标见附件` : '见附件报表',
      )
      attach(draftId, {
        name: `${dataset.name}.${format}`,
        rows: dataset.rows.length,
        at: stamp,
        dataset_id: dataset.id,
        format,
      })
      if (pipeline.active) focusDraft(draftId)
      else {
        addWindow('mail', '新邮件', { payload: { draftId } })
        setStage('send')
      }
    }
  }

  /** 提交单元格：数值列只收数字，输错了就清空并说一声，不往数据里写 NaN */
  const commitCell = (rowId: string, colKey: string, raw: string, numeric: boolean) => {
    if (!numeric) {
      updateCell(dataset.id, rowId, colKey, raw)
      return
    }
    const text = raw.trim().replace(/[,，\s]/g, '')
    if (text === '') {
      updateCell(dataset.id, rowId, colKey, null)
      return
    }
    const n = Number(text)
    if (!Number.isFinite(n)) {
      updateCell(dataset.id, rowId, colKey, null)
      const colName = dataset.columns.find((c) => c.key === colKey)?.name ?? '这一列'
      flashHint(`「${colName}」是数值列，只收数字，刚才那格已清空`)
      return
    }
    updateCell(dataset.id, rowId, colKey, n)
  }

  const numStat = numericCols[0] ? columnStats(dataset.rows, numericCols[0]) : null

  // 类目多的时候图要跟着长高，否则 19 行挤在 240px 里，标签全叠在一起
  const chartHeight =
    report?.chart.type === 'barline'
      ? Math.min(520, Math.max(240, report.chart.categories.length * 30 + 40))
      : 240

  return (
    <WindowFrame
      win={win}
      mode={mode}
      onDetach={onDetach}
      meta={`${dataset.rows.length} 行 × ${dataset.columns.length} 列${numStat?.mean !== null && numStat ? ` · 均值 ${fmtNum(numStat.mean, 2)}` : ''}`}
      headerExtra={
        <div className="mr-1 flex items-center gap-1">
          {pipeline.active && (
            <>
              {datasets.length > 1 && (
                <select
                  aria-label="切换数据表"
                  value={dataset.id}
                  onChange={(e) => setPipelineDataset(e.target.value)}
                  className="h-[22px] max-w-[140px] rounded-[3px] border border-line bg-surface px-1 text-[11px] text-ink-2"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => {
                  const id = useData.getState().addDataset({
                    id: `ds-${Date.now()}`,
                    name: '新建数据表',
                    columns: [
                      { key: 'metric', name: '指标', type: 'text', frozen: true },
                      { key: 'value', name: '数值', type: 'number' },
                    ],
                    rows: [],
                    source: { type: 'manual' },
                    updated_at: Date.now(),
                  })
                  setPipelineDataset(id)
                }}
                title="新建一张空表"
                className="flex h-[22px] shrink-0 items-center gap-1 rounded-[3px] border border-line bg-surface px-1.5 text-[11px] text-ink-2 transition-colors hover:border-accent-line hover:text-accent"
              >
                <Icon as={Plus} size={12} />
                新建
              </button>
              <button
                type="button"
                onClick={openCasesWindow}
                title="从实例库抄一张现成的表"
                className="flex h-[22px] shrink-0 items-center gap-1 rounded-[3px] border border-line bg-surface px-1.5 text-[11px] text-ink-2 transition-colors hover:border-accent-line hover:text-accent"
              >
                <Icon as={Library} size={12} />
                实例库
              </button>
            </>
          )}
          <div className="flex overflow-hidden rounded-[6px] border border-line">
            {(['grid', 'report'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-label={v === 'grid' ? '表格视图' : '报表视图'}
                onClick={() => {
                  setView(v)
                  if (v === 'report') {
                    // 数据改过就重新生成，否则报表会一直停在上一次的数字上
                    const rep = useData.getState().reportByDataset(dataset.id)
                    if (!rep || dataset.updated_at > rep.generated_at) generateReport(dataset.id)
                  }
                }}
                className={cn(
                  'flex h-[22px] items-center gap-1 px-2 text-[11px] transition-colors',
                  view === v ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:text-ink',
                )}
              >
                <Icon as={v === 'grid' ? Table2 : BarChart3} size={12} />
                {v === 'grid' ? '表格' : '报表'}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        {view === 'grid' ? (
          <>
            <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface-2 px-2">
              <Button
                size="sm"
                variant="quiet"
                icon={<Icon as={Settings2} size={12} />}
                onClick={(e) => {
                  setEditAnchor(e.currentTarget)
                  setEditOpen(true)
                }}
              >
                编辑
              </Button>
              <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                <Button
                  size="sm"
                  variant="quiet"
                  className="shrink-0"
                  icon={<Icon as={ArrowDownUp} size={12} />}
                  onClick={() => {
                    generateReport(dataset.id)
                    setView('report')
                  }}
                >
                  生成报表
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="shrink-0"
                  icon={<Icon as={Download} size={13} />}
                  onClick={(e) => {
                    setExportAnchor(e.currentTarget)
                    setExportOpen(true)
                  }}
                >
                  导出报表
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[520px] table-fixed border-collapse text-[12px]">
                <colgroup>
                  {dataset.columns.map((c, i) => (
                    <col key={c.key} style={{ width: widths[i] }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr>
                    {dataset.columns.map((c, ci) => {
                      const T = TYPE_ICON[c.type]
                      return (
                        <th
                          key={c.key}
                          style={{
                            width: widths[ci],
                            boxShadow: ci === 0 && frozenFirst ? 'inset -1px 0 0 var(--line)' : undefined,
                          }}
                          className={cn(
                            'border-b border-line bg-head px-2 py-1.5 text-left font-normal',
                            ci === 0 && frozenFirst && 'sticky left-0 z-20',
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <Icon as={T} size={10} className="shrink-0 text-ink-3" />
                            <span className="truncate text-[11px] text-ink">{c.name}</span>
                            {c.unit && <span className="mono text-[10px] text-ink-3">{c.unit}</span>}
                            <button
                              type="button"
                              aria-label={`${c.name} 统计`}
                              onClick={(e) => {
                                setStatsCol(c.key)
                                setStatsAnchor(e.currentTarget)
                              }}
                              className="ml-auto h-2.5 w-2.5 shrink-0 border-b border-r border-line-strong hover:border-accent"
                            />
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dataset.rows.map((r, ri) => (
                    <tr key={r.id} className={cn(ri % 2 ? 'bg-zebra' : 'bg-surface')}>
                      {dataset.columns.map((c, ci) => {
                        const isEditing = editing?.row === r.id && editing?.col === c.key
                        const raw = r.cells[c.key]
                        const numeric = c.type === 'number'
                        const blank =
                          raw === null ||
                          raw === undefined ||
                          raw === '' ||
                          (numeric && !Number.isFinite(Number(raw)))
                        const pinned = ci === 0 && frozenFirst
                        return (
                          <td
                            key={c.key}
                            style={{
                              maxWidth: '100%',
                              boxShadow: pinned ? 'inset -1px 0 0 var(--line)' : undefined,
                            }}
                            onClick={() => {
                              setCursor(`行 ${r.id.slice(-4)} · ${c.name}`)
                              setSelRow(r.id)
                              if (numeric) openPeek({ type: 'column', id: c.key, datasetId: dataset.id })
                            }}
                            onDoubleClick={() => {
                              setEditing({ row: r.id, col: c.key })
                              setCell(raw === null || raw === undefined ? '' : String(raw))
                            }}
                            className={cn(
                              'border-b border-line px-2.5 py-1.5 align-middle',
                              numeric ? 'text-right' : 'text-left',
                              pinned && 'sticky left-0 z-[1]',
                              pinned && (ri % 2 ? 'bg-zebra' : 'bg-surface'),
                            )}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                value={cell}
                                onChange={(e) => setCell(e.target.value)}
                                onBlur={() => {
                                  commitCell(r.id, c.key, cell, numeric)
                                  setEditing(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                  if (e.key === 'Escape') setEditing(null)
                                }}
                                className="w-full rounded-[4px] border border-accent bg-surface px-1 py-0.5 text-[12px] focus:shadow-[var(--focus-ring)]"
                              />
                            ) : (
                              <span className={cn('block truncate', numeric && 'mono')}>
                                {blank ? <span className="text-ink-3">—</span> : raw}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex h-7 shrink-0 items-center gap-3 border-t border-line bg-surface-2 px-2.5">
              <span className="mono text-[10px] text-ink-3">{cursor}</span>
              {hint ? (
                <span className="truncate text-[10px] font-medium text-warn">{hint}</span>
              ) : (
                <span className="mono hidden text-[10px] text-ink-3 md:inline">
                  双击单元格可编辑 · 列头右侧三角查看统计
                </span>
              )}
              <span className="mono ml-auto text-[10px] text-ink-3">
                来源 · {dataset.source.type === 'qa' ? '问答提取' : dataset.source.type === 'import' ? '导入' : '手动'}
              </span>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="grid grid-cols-3 gap-2.5">
              {(report?.cards ?? []).map((c) => (
                <MetricCardView key={c.label} label={c.label} value={c.value} sub={c.sub} tone={c.tone} />
              ))}
              {!report && (
                <div className="col-span-3">
                  <Note>还没有生成报表，点右上角「生成报表」。</Note>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-[10px] border border-line bg-surface-2 p-2">
              <div ref={chartRef} className="w-full" style={{ height: chartHeight }} />
            </div>

            <div className="mt-3">
              <div className="mb-1 text-[11px] text-ink-3">数据摘要</div>
              <div className="overflow-x-auto rounded-[5px] border border-line">
                <table className="w-full table-fixed border-collapse text-[12px]">
                  <colgroup>
                    {dataset.columns.map((c, i) => (
                      <col
                        key={c.key}
                        style={{
                          width:
                            dataset.columns.length <= 2
                              ? i === 0 ? '58%' : '42%'
                              : i === 0
                                ? '30%'
                                : i === dataset.columns.length - 1
                                  ? '26%'
                                  : `${44 / Math.max(1, dataset.columns.length - 2)}%`,
                        }}
                      />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {dataset.columns.map((c) => (
                        <th
                          key={c.key}
                          className="whitespace-nowrap border-b border-line bg-surface-2 px-2 py-1 text-left text-[11px] font-medium text-ink-2"
                        >
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.rows.slice(0, 6).map((row, i) => (
                      <tr key={row.id ?? i} className={cn(i % 2 ? 'bg-zebra' : 'bg-surface')}>
                        {dataset.columns.map((c) => {
                          const raw = row.cells[c.key]
                          const text = raw === undefined || raw === null || raw === '' ? '—' : String(raw)
                          return (
                            <td
                              key={c.key}
                              className={cn(
                                'border-b border-line px-2 py-1 align-middle',
                                c.type === 'number' ? 'mono whitespace-nowrap text-right' : 'text-left text-ink',
                              )}
                            >
                              <span className="block truncate" title={text}>
                                {text}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Icon as={Download} size={13} />}
                onClick={(e) => {
                  setExportAnchor(e.currentTarget)
                  setExportOpen(true)
                }}
              >
                导出报表
              </Button>
              <span className="mono text-[10px] text-ink-3">
                {report ? `生成于 ${new Date(report.generated_at).toLocaleString('zh-CN')}` : '尚未生成'}
              </span>
            </div>
          </div>
        )}
      </div>

      <Floating anchor={editAnchor} open={editOpen} onClose={() => setEditOpen(false)} width={188} align="left">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              addRow(dataset.id)
              setEditOpen(false)
            }}
          >
            <Icon as={Plus} size={13} />
            加一行
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              addColumn(dataset.id, { key: `col-${Date.now()}`, name: '新列', type: 'text' })
              setEditOpen(false)
            }}
          >
            <Icon as={Plus} size={13} />
            加一列
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              // 冻的是「首列」，不是第一个数值列
              const col = dataset.columns[0]
              if (col) updateColumn(dataset.id, col.key, { frozen: !col.frozen })
              setEditOpen(false)
            }}
          >
            <Icon as={Rows3} size={13} />
            冻结首列
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              const col = numericCols[0]
              if (col) updateColumn(dataset.id, col.key, { type: col.type === 'number' ? 'text' : 'number' })
              setEditOpen(false)
            }}
          >
            <Icon as={Columns3} size={13} />
            列类型切换
          </button>
          <button
            type="button"
            className="menu-item text-danger"
            disabled={!selRow}
            onClick={() => {
              if (selRow) {
                removeRow(dataset.id, selRow)
                setSelRow(null)
                setCursor('—')
              }
              setEditOpen(false)
            }}
          >
            <Icon as={Trash2} size={13} />
            删除选中行
          </button>
        </div>
      </Floating>

      <Floating anchor={statsAnchor} open={Boolean(statsCol)} onClose={() => setStatsCol(null)} width={260}>
        {statsCol && (
          <StatsPopover
            column={dataset.columns.find((c) => c.key === statsCol)!}
            rows={dataset.rows}
            onClose={() => setStatsCol(null)}
          />
        )}
      </Floating>

      <Floating anchor={exportAnchor} open={exportOpen} onClose={() => setExportOpen(false)} width={268}>
        <div className="t-h2">导出报表</div>
        <div className="mt-2 flex flex-col gap-1">
          {([
            ['xlsx', 'XLSX', 'Excel 可直接打开，数值列保持数值格式'],
            ['csv', 'CSV', '带 BOM，Excel 打开不乱码'],
            ['pdf', 'PDF', '调用浏览器打印，中文不会乱码'],
          ] as const).map(([f, name, desc]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={cn(
                'flex items-start gap-2 rounded-[6px] border px-2 py-1.5 text-left transition-colors',
                format === f ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
              )}
            >
              <Dot tone={format === f ? 'accent' : 'neutral'} className="mt-1.5" />
              <span>
                <span className="block text-[12px] text-ink">{name}</span>
                <span className="block text-[11px] text-ink-3">{desc}</span>
              </span>
            </button>
          ))}
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 border-t border-line pt-2 text-[12px] text-ink-2">
          <input type="checkbox" checked={sendAfter} onChange={(e) => setSendAfter(e.target.checked)} />
          导出后邮件发送
        </label>
        {format === 'xlsx' && datasets.length > 1 && (
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
            <input type="checkbox" checked={allSheets} onChange={(e) => setAllSheets(e.target.checked)} />
            合并全部 {datasets.length} 张表为多 sheet
          </label>
        )}
        <Button size="sm" variant="primary" className="mt-2 w-full" icon={<Icon as={Mail} size={13} />} onClick={doExport}>
          导出 {format.toUpperCase()}
        </Button>
      </Floating>
    </WindowFrame>
  )
}
