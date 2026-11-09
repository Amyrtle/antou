import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, Brain, KeyRound, Mail, Trash2, X } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Button, Dot, Field, Label, Note } from '../ui/kit'
import { useUi, type SettingsTab } from '../store/ui'
import { useSettings, type ThinkingTier } from '../store/settings'
import { useApiLog } from '../store/api'
import { testConnection, TIER_SPEC } from '../lib/api'
import { cn } from '../lib/cn'

const TABS: Array<{ key: SettingsTab; label: string; icon: typeof Brain }> = [
  { key: 'conn', label: '连接', icon: KeyRound },
  { key: 'think', label: '思考', icon: Brain },
  { key: 'mail', label: '邮件', icon: Mail },
  { key: 'log', label: '日志', icon: Activity },
]

const TIERS: ThinkingTier[] = ['off', 'low', 'medium', 'high']

function ConnTab() {
  const mode = useSettings((s) => s.mode)
  const setMode = useSettings((s) => s.setMode)
  const apiKey = useSettings((s) => s.apiKey)
  const baseUrl = useSettings((s) => s.baseUrl)
  const model = useSettings((s) => s.model)
  const gateway = useSettings((s) => s.gateway)
  const setApi = useSettings((s) => s.setApi)
  const setGateway = useSettings((s) => s.setGateway)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const runTest = async () => {
    setTesting(true)
    setResult(null)
    try {
      setResult({ ok: true, text: await testConnection() })
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : '连接失败' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label className="mb-1.5">回答引擎</Label>
        <div className="seg">
          <button type="button" data-on={mode === 'local'} onClick={() => setMode('local')}>
            体验模式 · 本地检索
          </button>
          <button type="button" data-on={mode === 'online'} onClick={() => setMode('online')}>
            在线模型
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-[1.7] text-ink-3">
          {mode === 'local'
            ? '零配置：不发任何外部请求，用本机 BM25 检索原文作答。'
            : '把命中片段送给你配置的模型服务；失败会自动回退本地检索。'}
        </p>
      </div>

      {mode !== 'online' && (
        <p className="text-[11px] leading-[1.6] text-ink-3">
          下面是在线模型的配置项，切到「在线模型」后才会生效。现在用体验模式不用管。
        </p>
      )}

      <div className={cn('flex flex-col gap-3', mode !== 'online' && 'pointer-events-none opacity-45')}>
        <>
          <label className="flex cursor-pointer items-center gap-2 rounded-[5px] border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={gateway.enabled}
              onChange={(e) => setGateway({ enabled: e.target.checked })}
            />
            走自建 API 网关
            <span className="mono ml-auto text-[10px] text-ink-3">/api/v1</span>
          </label>

          {gateway.enabled ? (
            <>
              <div>
                <Label className="mb-1">网关地址</Label>
                <Field
                  value={gateway.baseUrl}
                  onChange={(e) => setGateway({ baseUrl: e.target.value })}
                  placeholder="https://antou-api.example.com"
                />
              </div>
              <div>
                <Label className="mb-1">访问令牌</Label>
                <Field
                  type="password"
                  value={gateway.token}
                  onChange={(e) => setGateway({ token: e.target.value })}
                  placeholder="Bearer token，模型 key 由网关保管"
                />
              </div>
              <Note tone="ok">
                网关模式下前端不持有模型 key，鉴权 / 限流 / 计量都在服务端。
              </Note>
              <Note tone="warn">
                只填你自己后端的根地址（前端会自己拼 <span className="mono">/api/v1/usage</span>、<span className="mono">/api/v1/chat/completions</span>），
                不要填模型厂商的 base url——那样请求会打到 <span className="mono">/v1/api/v1/…</span> 上，必然是 404。
                只想直连模型：关掉这个开关，用上面的「在线模型」。
              </Note>
            </>
          ) : (
            <>
              <div>
                <Label className="mb-1">模型服务地址</Label>
                <Field value={baseUrl} onChange={(e) => setApi({ baseUrl: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1">API Key</Label>
                <Field
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApi({ apiKey: e.target.value })}
                  placeholder="sk-…  仅存本机浏览器"
                />
              </div>
              <div>
                <Label className="mb-1">模型</Label>
                <Field value={model} onChange={(e) => setApi({ model: e.target.value })} />
              </div>
              <Note tone="warn">直连模式 key 存于本机 localStorage，共享电脑请改用网关。</Note>
            </>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" disabled={testing} onClick={() => void runTest()}>
              {testing ? '测试中…' : '测试连接'}
            </Button>
            {result && (
              <span className={cn('text-[11px]', result.ok ? 'text-ok' : 'text-danger')}>{result.text}</span>
            )}
          </div>
        </>
      </div>
    </div>
  )
}

function ThinkTab() {
  const thinking = useSettings((s) => s.thinking)
  const setThinking = useSettings((s) => s.setThinking)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label className="mb-1.5">思考强度</Label>
        <div className="seg">
          {TIERS.map((t) => (
            <button key={t} type="button" data-on={thinking === t} onClick={() => setThinking(t)}>
              {TIER_SPEC[t].label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {TIERS.map((t) => {
          const spec = TIER_SPEC[t]
          const on = thinking === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setThinking(t)}
              className={cn(
                'rounded-[8px] border px-2.5 py-2 text-left transition-colors',
                on ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <div className="flex items-center gap-1.5">
                <Dot tone={on ? 'accent' : 'neutral'} />
                <span className="text-[12px] text-ink">{spec.label}</span>
                <span className="mono ml-auto text-[10px] text-ink-3">
                  {spec.budget ? `~${(spec.budget / 1024).toFixed(0)}k token · ` : ''}
                  {spec.timeoutMs / 1000}s 超时
                </span>
              </div>
              <div className="mt-0.5 text-[11px] leading-[1.6] text-ink-3">
                {spec.scene} · {spec.cost}
              </div>
            </button>
          )
        })}
      </div>
      <Note>高档位会同步放宽超时与 max_tokens；思考内容不直接展示，只呈现最终摘录与推断。</Note>
    </div>
  )
}

function MailTab() {
  const emailjs = useSettings((s) => s.emailjs)
  const setEmailjs = useSettings((s) => s.setEmailjs)
  return (
    <div className="flex flex-col gap-3">
      {(
        [
          ['serviceId', 'Service ID'],
          ['templateId', 'Template ID'],
          ['publicKey', 'Public Key'],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <Label className="mb-1">{label}</Label>
          <Field value={emailjs[key]} onChange={(e) => setEmailjs({ [key]: e.target.value })} placeholder="留空则发送只记草稿" />
        </div>
      ))}
      <Note>未配置时「发送」会把邮件标记为已发送的本地演示；配置后走 EmailJS 真实发信。</Note>
    </div>
  )
}

function LogTab() {
  const entries = useApiLog((s) => s.entries)
  const totals = useApiLog((s) => s.totals)
  const clear = useApiLog((s) => s.clear)
  const avg = totals.calls ? Math.round(totals.msSum / totals.calls) : 0
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        {[
          ['调用', String(totals.calls)],
          ['成功', String(totals.ok)],
          ['token', String(totals.tokens)],
          ['均耗', `${avg}ms`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[8px] border border-line bg-surface-2 px-2 py-1.5 text-center">
            <div className="mono text-[13px] text-ink">{v}</div>
            <div className="text-[10px] text-ink-3">{k}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Label>最近调用</Label>
        <Button size="sm" variant="quiet" icon={<Icon as={Trash2} size={12} />} onClick={clear}>
          清空
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {!entries.length && <div className="py-6 text-center text-[11px] text-ink-3">还没有在线调用记录。</div>}
        <div className="flex flex-col gap-1">
          {entries.map((e) => (
            <div key={e.id} className="rounded-[8px] border border-line bg-surface px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <Dot tone={e.ok ? 'ok' : e.message === '已取消' ? 'neutral' : 'danger'} />
                <span className="mono text-[10px] text-ink-2">{e.path}</span>
                <span className="mono ml-auto text-[10px] text-ink-3">{e.ms}ms</span>
              </div>
              <div className="mono mt-0.5 flex items-center gap-2 text-[10px] text-ink-3">
                <span>{new Date(e.at).toLocaleTimeString('zh-CN')}</span>
                <span>{e.mode === 'gateway' ? '网关' : '直连'}</span>
                <span>思考 {TIER_SPEC[e.tier as ThinkingTier]?.label ?? e.tier}</span>
                {e.code !== 0 && <span className="text-danger">code {e.code}</span>}
                {e.rate && <span>配额 {e.rate}</span>}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-ink-3" title={`${e.message} · ${e.request_id}`}>
                {e.message} · {e.request_id}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsPanel() {
  const open = useUi((s) => s.settingsOpen)
  const tab = useUi((s) => s.settingsTab)
  const close = useUi((s) => s.closeSettings)
  const setTab = (t: SettingsTab) => useUi.setState({ settingsTab: t })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(16,23,37,0.14)' }}
        onClick={close}
      />
      <div
        role="dialog"
        aria-label="设置与 API"
        className="animate-win-in fixed left-1/2 top-1/2 z-50 flex h-[540px] w-[720px] max-w-[92vw] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[8px] border border-line-strong bg-surface shadow-[var(--shadow-float)]"
      >
        <header className="titlebar flex h-[30px] shrink-0 items-center gap-2 px-2.5">
          <span className="text-[12px] font-semibold text-ink">设置与 API</span>
          <span className="text-[10px] text-ink-3">模型连接 · 思考强度 · 调用日志</span>
          <button
            type="button"
            aria-label="关闭设置"
            onClick={close}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-[3px] text-ink-3 hover:bg-[#c42b1c] hover:text-white"
          >
            <Icon as={X} size={13} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-[128px] shrink-0 flex-col gap-0.5 border-r border-line bg-surface-2 p-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-[3px] px-2 text-left text-[12px] transition-colors',
                  tab === t.key ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-[rgba(16,24,40,0.05)]',
                )}
              >
                <Icon as={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
            {tab === 'conn' && <ConnTab />}
            {tab === 'think' && <ThinkTab />}
            {tab === 'mail' && <MailTab />}
            {tab === 'log' && <LogTab />}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
