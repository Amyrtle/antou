export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

/** 修饰键显示文案：Windows 用 Ctrl，macOS 用 ⌘ */
export const MOD = isMac ? '⌘' : 'Ctrl'
export const ALT = isMac ? '⌥' : 'Alt'

/** 组合键文案：macOS 是 ⌘K，Windows 是 Ctrl+K */
export const combo = (key: string) => (isMac ? `⌘${key}` : `Ctrl+${key}`)
