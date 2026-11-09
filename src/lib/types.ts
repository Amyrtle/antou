export type PaperStatus = 'parsing' | 'ready' | 'failed'

export type Paper = {
  id: string
  title: string
  authors: string[]
  year: number
  venue: string
  tags: string[]
  file_name: string
  page_count: number
  status: PaperStatus
  abstract: string
  demo?: boolean
  error?: string
  created_at: number
}

export type Chunk = {
  id: string
  paper_id: string
  page: number
  para_index: number
  text: string
}

export type Segment = { type: 'quote' | 'infer'; text: string }

export type Citation = {
  paper_id: string
  page: number
  para_index: number
  span: string
  score: number
}

export type Scope = { type: 'all' | 'ids' | 'tag'; value?: string }

export type Thread = {
  id: string
  scope: Scope
  title: string
  created_at: number
}

export type Message = {
  id: string
  thread_id: string
  role: 'user' | 'assistant'
  segments: Segment[]
  citations: Citation[]
  created_at: number
  streaming?: boolean
}

export type ColumnType = 'text' | 'number' | 'date'

export type Column = { key: string; name: string; type: ColumnType; unit?: string; frozen?: boolean }

export type Row = { id: string; cells: Record<string, string | number | null> }

export type DatasetSource = { type: 'manual' | 'qa' | 'import'; ref?: string; label?: string }

export type Dataset = {
  id: string
  name: string
  columns: Column[]
  rows: Row[]
  source: DatasetSource
  updated_at: number
}

export type MetricCard = {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'ok' | 'warn'
}

export type ChartSeries = {
  name: string
  type: 'bar' | 'line'
  column: string
  unit?: string
}

export type Chart =
  | {
      type: 'barline'
      categories: string[]
      series: ChartSeries[]
    }
  | {
      type: 'scatter'
      xLabel: string
      yLabel: string
      points: [number, number][]
    }

export type ExportRecord = { format: 'csv' | 'xlsx' | 'pdf'; name: string; at: number }

export type Report = {
  id: string
  dataset_id: string
  cards: MetricCard[]
  chart: Chart
  generated_at: number
  exports: ExportRecord[]
}

export type Attachment = {
  name: string
  rows: number
  at: number
  dataset_id?: string
  format: 'csv' | 'xlsx' | 'pdf' | 'snapshot'
}

export type MailStatus = 'draft' | 'sent' | 'failed' | 'scheduled'

export type OutboxItem = {
  id: string
  to: { name: string; email: string }[]
  subject: string
  body: string
  template: string
  vars: Record<string, string>
  attachments: Attachment[]
  status: MailStatus
  created_at: number
  sent_at?: number
  scheduled_at?: number
  error?: string
  transport: 'local' | 'emailjs'
}

export type WindowKind = 'qa' | 'table' | 'mail' | 'draft' | 'cases'

export type SnapZone =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'tl'
  | 'tr'
  | 'bl'
  | 'br'
  | 'thirds-l'
  | 'thirds-c'
  | 'thirds-r'
  | 'halves-t'
  | 'halves-b'
  | 'full'

export type Win = {
  id: string
  kind: WindowKind
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  pinned: boolean
  minimized: boolean
  snap?: SnapZone
  payload?: Record<string, unknown>
}
