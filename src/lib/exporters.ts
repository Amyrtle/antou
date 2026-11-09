import type { Dataset } from './types'
import { triggerDownload } from './mailer'

export function datasetToAoa(ds: Dataset): Array<string | number>[] {
  const head = ds.columns.map((c) => (c.unit ? `${c.name}（${c.unit}）` : c.name))
  const body = ds.rows.map((r) =>
    ds.columns.map((c) => {
      const v = r.cells[c.key]
      if (v === null || v === undefined) return ''
      if (c.type === 'number') {
        const n = Number(v)
        return Number.isFinite(n) ? n : String(v)
      }
      return String(v)
    }),
  )
  return [head, ...body]
}

function csvCell(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCsv(ds: Dataset) {
  const lines = datasetToAoa(ds).map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${lines}`], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `${ds.name}.csv`)
}

function safeSheetName(name: string, fallback: string) {
  const clean = name.replace(/[[\]:*?/\\]/g, '').slice(0, 28)
  return clean || fallback
}

/** 导出 XLSX：数值列保持数值类型，多表可合成多 sheet。xlsx 按需加载，不进首屏包 */
export async function exportXlsx(datasets: Dataset[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  datasets.forEach((ds, i) => {
    const aoa = datasetToAoa(ds)
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = ds.columns.map((c) => ({ wch: Math.max(10, c.name.length * 2 + 4) }))
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(ds.name, `表${i + 1}`))
  })
  const name = datasets.length === 1 ? `${datasets[0].name}.xlsx` : `报表合集_${datasets.length}张表.xlsx`
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  triggerDownload(new Blob([out], { type: 'application/octet-stream' }), name)
}

/** PDF 走浏览器打印，中文不会出现乱码（jsPDF 内置字体不含中文字形） */
export function exportPdfViaPrint() {
  window.print()
}
