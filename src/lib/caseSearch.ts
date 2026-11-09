export type SearchEngine = 'datacite' | 'crossref'

export type SearchHit = {
  id: string
  engine: SearchEngine
  kind: '数据集' | '文献'
  title: string
  authors: string[]
  year: number
  venue: string
  doi: string
}

export const ENGINES: { key: SearchEngine; label: string; hint: string }[] = [
  {
    key: 'datacite',
    label: 'DataCite 数据集',
    hint: '公开实验数据集与表格数据 · api.datacite.org',
  },
  {
    key: 'crossref',
    label: 'Crossref 文献',
    hint: '期刊论文元数据（含 DOI）· api.crossref.org',
  },
]

export const SAMPLE_QUERIES: Record<SearchEngine, string[]> = {
  datacite: ['soil moisture', 'RNA-seq drought', 'water quality'],
  crossref: ['dose response', 'CRISPR editing', 'factorial design'],
}

type Raw = Record<string, unknown>

const rec = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(str(v)) || 0)

function fromDatacite(json: unknown): SearchHit[] {
  return arr(rec(json).data)
    .map((item, i): SearchHit | null => {
      const attrs = rec(rec(item).attributes)
      const doi = str(attrs.doi) || str(rec(item).id)
      const titles = arr(attrs.titles)
      const title = str(rec(titles[0]).title)
      if (!title && !doi) return null
      return {
        id: `dc-${doi || i}`,
        engine: 'datacite',
        kind: '数据集',
        title: title || '（无标题）',
        authors: arr(attrs.creators).map((c) => str(rec(c).name)).filter(Boolean),
        year: num(attrs.publicationYear),
        venue: str(attrs.publisher),
        doi,
      }
    })
    .filter((x): x is SearchHit => x !== null)
}

function fromCrossref(json: unknown): SearchHit[] {
  return arr(rec(rec(json).message).items)
    .map((item, i): SearchHit | null => {
      const it = rec(item)
      const doi = str(it.DOI)
      const title = str(arr(it.title)[0])
      if (!title && !doi) return null
      const parts = arr(rec(it.issued)['date-parts'])
      return {
        id: `cr-${doi || i}`,
        engine: 'crossref',
        kind: '文献',
        title: title || '（无标题）',
        authors: arr(it.author)
          .map((a) => {
            const r = rec(a)
            return [str(r.given), str(r.family)].filter(Boolean).join(' ') || str(r.name)
          })
          .filter(Boolean),
        year: num(arr(parts[0])[0]),
        venue: str(it.publisher) || str(arr(it['container-title'])[0]),
        doi,
      }
    })
    .filter((x): x is SearchHit => x !== null)
}

export async function searchOnline(
  engine: SearchEngine,
  query: string,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const kw = query.trim()
  if (!kw) return []
  const url =
    engine === 'datacite'
      ? `https://api.datacite.org/dois?query=${encodeURIComponent(kw)}&resource-type-id=dataset&page%5Bsize%5D=12`
      : `https://api.crossref.org/works?query=${encodeURIComponent(kw)}&rows=12&select=title,author,issued,DOI,publisher,container-title`

  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`检索服务返回 ${res.status}`)
  const json: unknown = await res.json()
  return engine === 'datacite' ? fromDatacite(json) : fromCrossref(json)
}
