import MiniSearch from 'minisearch'
import type { Chunk, Paper, Scope } from './types'

export type IndexedChunk = Chunk & { title: string; year: number; venue: string; tags: string[] }

export type Hit = {
  chunk: Chunk
  paper: Paper
  score: number
  terms: string[]
}

/** 中英混排分词：中文取二元组，英文取词 */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  const re = /[\u4e00-\u9fa5]+|[a-zA-Z][a-zA-Z0-9_-]*|\d+(?:\.\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const s = m[0]
    if (/^[\u4e00-\u9fa5]+$/.test(s)) {
      if (s.length === 1) tokens.push(s)
      else for (let i = 0; i < s.length - 1; i++) tokens.push(s.slice(i, i + 2))
    } else {
      tokens.push(s.toLowerCase())
    }
  }
  return tokens
}

export class Corpus {
  private ms: MiniSearch<IndexedChunk>
  private chunkMap = new Map<string, Chunk>()
  private paperMap = new Map<string, Paper>()

  constructor(papers: Paper[], chunks: Chunk[]) {
    for (const p of papers) this.paperMap.set(p.id, p)
    for (const c of chunks) this.chunkMap.set(c.id, c)
    const docs: IndexedChunk[] = chunks.map((c) => {
      const p = this.paperMap.get(c.paper_id)
      return {
        ...c,
        title: p?.title ?? '',
        year: p?.year ?? 0,
        venue: p?.venue ?? '',
        tags: p?.tags ?? [],
      }
    })
    this.ms = new MiniSearch<IndexedChunk>({
      fields: ['text', 'title'],
      storeFields: ['paper_id', 'page', 'para_index', 'text'],
      idField: 'id',
      tokenize,
      processTerm: (t) => t.toLowerCase(),
    })
    if (docs.length) this.ms.addAll(docs)
  }

  setPapers(papers: Paper[]) {
    for (const p of papers) this.paperMap.set(p.id, p)
  }

  chunkById(id: string): Chunk | undefined {
    return this.chunkMap.get(id)
  }

  paperById(id: string): Paper | undefined {
    return this.paperMap.get(id)
  }

  inScope(paper: Paper, scope: Scope): boolean {
    if (scope.type === 'all') return true
    if (scope.type === 'tag') return paper.tags.includes(scope.value ?? '')
    return (scope.value?.split(',') ?? []).includes(paper.id)
  }

  search(query: string, scope: Scope, limit = 10): Hit[] {
    const terms = tokenize(query)
    if (!terms.length) return []
    const raw = this.ms.search(query, { prefix: true, fuzzy: 0.15, boost: { title: 1.6 } })
    const max = raw.length ? raw[0].score : 1
    const hits: Hit[] = []
    for (const r of raw) {
      const chunk = this.chunkMap.get(String(r.id))
      if (!chunk) continue
      const paper = this.paperMap.get(chunk.paper_id)
      if (!paper) continue
      if (!this.inScope(paper, scope)) continue
      const s = max ? r.score / max : 0
      if (hits.length >= 2 && s < 0.18) break
      hits.push({ chunk, paper, score: s, terms })
      if (hits.length >= limit) break
    }
    return hits
  }
}

export function buildCorpus(papers: Paper[], chunks: Chunk[]): Corpus {
  return new Corpus(papers, chunks)
}
