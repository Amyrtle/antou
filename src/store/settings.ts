import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModelMode = 'local' | 'online'

/** 思考强度四档，见 docs/MODEL_PARAMS.md §5.2 */
export type ThinkingTier = 'off' | 'low' | 'medium' | 'high'

export type SettingsState = {
  mode: ModelMode
  apiKey: string
  baseUrl: string
  model: string
  thinking: ThinkingTier
  gateway: { enabled: boolean; baseUrl: string; token: string }
  emailjs: { serviceId: string; templateId: string; publicKey: string }
  setMode: (m: ModelMode) => void
  setApi: (patch: Partial<Pick<SettingsState, 'apiKey' | 'baseUrl' | 'model'>>) => void
  setThinking: (t: ThinkingTier) => void
  setGateway: (patch: Partial<SettingsState['gateway']>) => void
  setEmailjs: (patch: Partial<SettingsState['emailjs']>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'local',
      apiKey: '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      thinking: 'low',
      gateway: { enabled: false, baseUrl: '', token: '' },
      emailjs: { serviceId: '', templateId: '', publicKey: '' },
      setMode: (mode) => set({ mode }),
      setApi: (patch) => set(patch),
      setThinking: (thinking) => set({ thinking }),
      setGateway: (patch) => set((s) => ({ gateway: { ...s.gateway, ...patch } })),
      setEmailjs: (patch) => set((s) => ({ emailjs: { ...s.emailjs, ...patch } })),
    }),
    { name: 'antou.settings', version: 2 },
  ),
)
