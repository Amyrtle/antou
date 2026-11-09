import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StageKey } from '../app/stages'
import type { Rect } from '../lib/windows-layout'

export type PeekTarget =
  | { type: 'paper'; id: string }
  | { type: 'dataset'; id: string }
  | { type: 'column'; id: string; datasetId: string }
  | null

export type SettingsTab = 'conn' | 'think' | 'mail' | 'log'

export type UiState = {
  stage: StageKey
  railOpen: boolean
  peekOpen: boolean
  peekTarget: PeekTarget
  commandOpen: boolean
  settingsOpen: boolean
  settingsTab: SettingsTab
  preview: Rect | null
  lastAction: string
  lastActionAt: number
  setStage: (s: StageKey) => void
  toggleRail: () => void
  openPeek: (t: NonNullable<PeekTarget>) => void
  closePeek: () => void
  setCommandOpen: (v: boolean) => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setPreview: (r: Rect | null) => void
  noteAction: (text: string) => void
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      stage: 'read',
      railOpen: true,
      peekOpen: false,
      peekTarget: null,
      commandOpen: false,
      settingsOpen: false,
      settingsTab: 'conn',
      preview: null,
      lastAction: '工作区已就绪',
      lastActionAt: Date.now(),
      setStage: (stage) => set({ stage }),
      toggleRail: () => set((s) => ({ railOpen: !s.railOpen })),
      openPeek: (peekTarget) => set({ peekOpen: true, peekTarget }),
      closePeek: () => set({ peekOpen: false }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
      closeSettings: () => set({ settingsOpen: false }),
      setPreview: (preview) => set({ preview }),
      noteAction: (lastAction) => set({ lastAction, lastActionAt: Date.now() }),
    }),
    { name: 'antou.ui', version: 5 },
  ),
)
