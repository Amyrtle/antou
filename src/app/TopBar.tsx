import { Search, Settings2 } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { useUi } from '../store/ui'
import { useSettings } from '../store/settings'
import { combo } from '../lib/platform'

const THINK_LABEL = { off: '关', low: '低', medium: '中', high: '高' } as const

export function TopBar() {
  const setCommandOpen = useUi((s) => s.setCommandOpen)
  const openSettings = useUi((s) => s.openSettings)
  const mode = useSettings((s) => s.mode)
  const thinking = useSettings((s) => s.thinking)

  return (
    <header className="topbar flex h-11 shrink-0 items-center gap-3 px-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">案头</span>
        <span className="text-[11px] text-ink-3">读文献 · 写数据 · 发邮件</span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => openSettings('think')}
        title="思考强度，点击调整"
        className="text-[11.5px] text-ink-2 transition-colors hover:text-accent"
      >
        思考 {THINK_LABEL[thinking]}
      </button>

      <button
        type="button"
        onClick={() => openSettings('conn')}
        title="回答引擎，点击配置"
        className="flex items-center gap-1.5 text-[11.5px] text-ink-2 transition-colors hover:text-accent"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${mode === 'online' ? 'bg-ok' : 'bg-ink-3'}`} />
        {mode === 'online' ? '在线模型' : '本地检索'}
      </button>

      <span className="h-3.5 w-px bg-line" aria-hidden />

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex h-6 w-[190px] items-center gap-1.5 rounded-[3px] border border-line bg-surface px-1.5 text-left transition-colors hover:border-accent-line"
      >
        <Icon as={Search} size={12} className="shrink-0 text-ink-3" />
        <span className="flex-1 truncate text-[11.5px] text-ink-3">搜索</span>
        <kbd className="mono shrink-0 text-[10px] text-ink-3">{combo("K")}</kbd>
      </button>

      <button
        type="button"
        onClick={() => openSettings()}
        className="flex h-6 w-6 items-center justify-center rounded-[3px] text-ink-2 transition-colors hover:bg-[rgba(16,24,40,0.06)] hover:text-ink"
        aria-label="设置"
        title="设置与 API"
      >
        <Icon as={Settings2} size={14} />
      </button>
    </header>
  )
}
