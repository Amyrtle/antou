import { create } from 'zustand'

export type ApiLogEntry = {
  id: string
  request_id: string
  path: string
  mode: 'gateway' | 'direct' | 'local'
  tier: string
  ok: boolean
  status: number
  code: number
  ms: number
  tokens: number | null
  rate: string | null
  message: string
  at: number
}

type ApiState = {
  entries: ApiLogEntry[]
  totals: { calls: number; ok: number; fail: number; tokens: number; msSum: number }
  push: (e: Omit<ApiLogEntry, 'id' | 'at'> & { at?: number }) => void
  clear: () => void
}

export const useApiLog = create<ApiState>((set) => ({
  entries: [],
  totals: { calls: 0, ok: 0, fail: 0, tokens: 0, msSum: 0 },
  push: (e) =>
    set((s) => ({
      entries: [{ ...e, id: `${e.at ?? Date.now()}-${s.entries.length}`, at: e.at ?? Date.now() }, ...s.entries].slice(0, 60),
      totals: {
        calls: s.totals.calls + 1,
        ok: s.totals.ok + (e.ok ? 1 : 0),
        fail: s.totals.fail + (e.ok ? 0 : 1),
        tokens: s.totals.tokens + (e.tokens ?? 0),
        msSum: s.totals.msSum + e.ms,
      },
    })),
  clear: () => set({ entries: [], totals: { calls: 0, ok: 0, fail: 0, tokens: 0, msSum: 0 } }),
}))
