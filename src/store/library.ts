import { create } from 'zustand'
import type { Chunk, Paper } from '../lib/types'
import { buildCorpus, type Corpus } from '../lib/retrieve'
import { deletePaper, getChunks, getPapers, putChunks, putPapers } from '../lib/db'
import { parsePdf, paperFromParsed } from '../lib/pdf'
import { uid } from '../lib/id'
import { DEMO_CHUNKS, DEMO_PAPERS } from '../lib/demo'

export type UploadItem = {
  id: string
  name: string
  status: 'parsing' | 'ready' | 'failed'
  note?: string
}

type LibraryState = {
  papers: Paper[]
  chunks: Chunk[]
  corpus: Corpus
  ready: boolean
  query: string
  tagFilter: string
  sort: 'newest' | 'year' | 'title'
  selectedIds: string[]
  uploads: UploadItem[]
  init: () => Promise<void>
  rebuild: () => void
  setQuery: (q: string) => void
  setTagFilter: (t: string) => void
  setSort: (s: LibraryState['sort']) => void
  toggleSelect: (id: string) => void
  setSelected: (ids: string[]) => void
  uploadFiles: (files: File[]) => Promise<void>
  removePaper: (id: string) => Promise<void>
  addReference: (p: Paper) => Promise<void>
  tags: () => string[]
  visible: () => Paper[]
  paperById: (id: string) => Paper | undefined
}

export const useLibrary = create<LibraryState>((set, get) => ({
  papers: [],
  chunks: [],
  corpus: buildCorpus([], []),
  ready: false,
  query: '',
  tagFilter: '全部',
  sort: 'newest',
  selectedIds: [],
  uploads: [],

  init: async () => {
    let papers = await getPapers().catch(() => [] as Paper[])
    let chunks = await getChunks().catch(() => [] as Chunk[])
    if (!papers.length) {
      papers = DEMO_PAPERS.map((p) => ({ ...p }))
      chunks = DEMO_CHUNKS.map((c) => ({ ...c }))
      await putPapers(papers)
      await putChunks(chunks)
    }
    set({ papers, chunks, corpus: buildCorpus(papers, chunks), ready: true })
  },

  rebuild: () => {
    const { papers, chunks } = get()
    set({ corpus: buildCorpus(papers, chunks) })
  },

  setQuery: (query) => set({ query }),
  setTagFilter: (tagFilter) => set({ tagFilter }),
  setSort: (sort) => set({ sort }),

  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),

  setSelected: (selectedIds) => set({ selectedIds }),

  uploadFiles: async (files) => {
    for (const file of files) {
      if (!/\.pdf$/i.test(file.name)) continue
      const uploadId = uid('up-')
      const paperId = uid('p-')
      set((s) => ({
        uploads: [...s.uploads, { id: uploadId, name: file.name, status: 'parsing' }],
        papers: [
          ...s.papers,
          {
            id: paperId,
            title: file.name.replace(/\.pdf$/i, ''),
            authors: ['解析中'],
            year: new Date().getFullYear(),
            venue: '本地文件',
            tags: ['本地导入'],
            file_name: file.name,
            page_count: 0,
            status: 'parsing',
            abstract: '',
            created_at: Date.now(),
          },
        ],
      }))

      try {
        const parsed = await parsePdf(file)
        const paper = paperFromParsed(parsed, file, paperId)
        const chunks = parsed.chunks.map((c) => ({ ...c, paper_id: paperId }))
        set((s) => ({
          papers: s.papers.map((p) => (p.id === paperId ? paper : p)),
          chunks: [...s.chunks, ...chunks],
          uploads: s.uploads.map((u) =>
            u.id === uploadId
              ? { ...u, status: 'ready', note: `${paper.page_count} 页 · ${chunks.length} 段` }
              : u,
          ),
        }))
        await putPapers([paper])
        await putChunks(chunks)
        get().rebuild()
      } catch (e) {
        const msg = e instanceof Error ? e.message : '解析失败'
        set((s) => ({
          papers: s.papers.map((p) => (p.id === paperId ? { ...p, status: 'failed', error: msg } : p)),
          uploads: s.uploads.map((u) => (u.id === uploadId ? { ...u, status: 'failed', note: msg } : u)),
        }))
      }
    }
  },

  removePaper: async (id) => {
    const paper = get().papers.find((p) => p.id === id)
    if (!paper || paper.demo) return
    set((s) => ({
      papers: s.papers.filter((p) => p.id !== id),
      chunks: s.chunks.filter((c) => c.paper_id !== id),
      selectedIds: s.selectedIds.filter((x) => x !== id),
    }))
    await deletePaper(id).catch(() => undefined)
    get().rebuild()
  },

  addReference: async (p) => {
    set((s) => ({ papers: [p, ...s.papers] }))
    await putPapers([p]).catch(() => undefined)
    get().rebuild()
  },

  tags: () => {
    const set = new Set<string>()
    for (const p of get().papers) for (const t of p.tags) set.add(t)
    return Array.from(set)
  },

  visible: () => {
    const { papers, query, tagFilter, sort } = get()
    const q = query.trim().toLowerCase()
    let list = papers.filter((p) => {
      if (tagFilter !== '全部' && !p.tags.includes(tagFilter)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.authors.join(' ').toLowerCase().includes(q) ||
        p.abstract.toLowerCase().includes(q) ||
        p.venue.toLowerCase().includes(q)
      )
    })
    list = [...list].sort((a, b) => {
      if (sort === 'year') return b.year - a.year
      if (sort === 'title') return a.title.localeCompare(b.title, 'zh-Hans-CN')
      return b.created_at - a.created_at
    })
    return list
  },

  paperById: (id) => get().papers.find((p) => p.id === id),
}))
