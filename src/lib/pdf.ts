import type { Chunk, Paper } from './types'
import { uid } from './id'

export type ParsedPdf = {
  title: string
  author: string
  year: number | null
  pageCount: number
  abstract: string
  chunks: Chunk[]
}

const CJK = /[\u4e00-\u9fa5]/

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

function joinItems(items: unknown[]): string {
  let out = ''
  for (const raw of items) {
    const item = raw as { str?: string; hasEOL?: boolean }
    const s = item.str ?? ''
    if (!s) continue
    if (out) {
      const last = out[out.length - 1]
      const first = s[0]
      if (/[A-Za-z0-9]/.test(last) && /[A-Za-z0-9]/.test(first)) out += ' '
    }
    out += s
    if (item.hasEOL) out += '\n'
  }
  return out
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{1,}/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter((p) => p.length > 24)
}

function guessYear(full: string): number | null {
  const m = full.match(/((19|20)\d{2})/)
  return m ? Number(m[1]) : null
}

/** 用 pdf.js 解析 PDF：抽正文、页码、切段。失败抛错由调用方处理。 */
export async function parsePdf(file: File): Promise<ParsedPdf> {
  const pdfjs = await loadPdfjs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(joinItems(content.items as unknown[]))
  }

  const meta = (await doc.getMetadata().catch(() => null))?.info as
    | { Title?: string; Author?: string; Subject?: string }
    | undefined

  const full = pages.join('\n')
  const firstBlock = splitParagraphs(pages[0] ?? '')[0] ?? ''
  const metaTitle = (meta?.Title ?? '').trim()
  const junk = /^(about:blank|untitled|无标题|document|print|未命名|microsoft word|.*\.(docx?|pdf|pptx?))$/i
  const usableMeta = metaTitle.length > 4 && metaTitle.length < 120 && !junk.test(metaTitle)
  const title = (usableMeta ? metaTitle : firstBlock || metaTitle || '未命名文献').slice(0, 120)

  const chunks: Chunk[] = []
  let paraIndex = 0
  pages.forEach((pageText, pi) => {
    for (const para of splitParagraphs(pageText)) {
      chunks.push({
        id: uid('c-'),
        paper_id: '',
        page: pi + 1,
        para_index: paraIndex++,
        text: para,
      })
    }
  })

  const abstract =
    splitParagraphs(pages[0] ?? '').find((p) => /摘要|abstract/i.test(p))?.replace(/^摘\s*要[:：]?\s*/i, '') ??
    splitParagraphs(pages[0] ?? '')[1] ??
    ''

  return {
    title,
    author: meta?.Author?.trim() ?? '',
    year: guessYear(full),
    pageCount: doc.numPages,
    abstract: abstract.slice(0, 400),
    chunks,
  }
}

export function paperFromParsed(parsed: ParsedPdf, file: File, paperId: string): Paper {
  return {
    id: paperId,
    title: parsed.title,
    authors: parsed.author ? parsed.author.split(/[,;，、]/).map((s) => s.trim()).filter(Boolean) : ['未标注作者'],
    year: parsed.year ?? new Date().getFullYear(),
    venue: '本地文件',
    tags: ['本地导入'],
    file_name: file.name,
    page_count: parsed.pageCount,
    status: 'ready',
    abstract: parsed.abstract,
    created_at: Date.now(),
  }
}

export const isCjk = (s: string) => CJK.test(s)
