import { openDB, type IDBPDatabase } from 'idb'
import type { Chunk, Paper } from './types'

let dbPromise: Promise<IDBPDatabase> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB('antou', 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('papers')) d.createObjectStore('papers', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('chunks')) d.createObjectStore('chunks', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

export async function putPapers(papers: Paper[]) {
  if (!papers.length) return
  const d = await db()
  const tx = d.transaction('papers', 'readwrite')
  await Promise.all([...papers.map((p) => tx.store.put(p)), tx.done])
}

export async function getPapers(): Promise<Paper[]> {
  const d = await db()
  return d.getAll('papers')
}

export async function deletePaper(id: string) {
  const d = await db()
  await d.delete('papers', id)
}

export async function putChunks(chunks: Chunk[]) {
  if (!chunks.length) return
  const d = await db()
  const tx = d.transaction('chunks', 'readwrite')
  await Promise.all([...chunks.map((c) => tx.store.put(c)), tx.done])
}

export async function getChunks(): Promise<Chunk[]> {
  const d = await db()
  return d.getAll('chunks')
}

export async function clearAll() {
  const d = await db()
  await Promise.all([d.clear('papers'), d.clear('chunks')])
}
