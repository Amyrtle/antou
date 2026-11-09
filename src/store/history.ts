import { create } from 'zustand'

export type HistoryKind = 'parse' | 'qa' | 'export' | 'send' | 'edit' | 'window'

export type HistoryEvent = {
  id: string
  at: number
  kind: HistoryKind
  title: string
  detail?: string
}

type HistoryState = {
  events: HistoryEvent[]
  log: (e: Omit<HistoryEvent, 'id' | 'at'>) => void
  clear: () => void
}

export const useHistory = create<HistoryState>((set) => ({
  events: [],
  log: (e) =>
    set((s) => ({
      events: [{ ...e, id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now() }, ...s.events].slice(0, 200),
    })),
  clear: () => set({ events: [] }),
}))
