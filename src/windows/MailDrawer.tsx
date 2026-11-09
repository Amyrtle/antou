import { useContext, useEffect, useMemo, useState } from 'react'
import { Check, Clock, FileText, Loader2, Paperclip, Plus, Send, X } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Button, Dot, Note } from '../ui/kit'
import { useMail } from '../store/mail'
import { useWindows } from '../store/windows'
import { PipelineCtx, focusDraft, usePipeline } from '../store/pipeline'
import { ExternalLink } from 'lucide-react'
import { MAIL_TEMPLATES, downloadEml, missingVars, renderTemplate } from '../lib/mailer'
import { fmtDate } from '../lib/format'
import { cn } from '../lib/cn'
import type { Win } from '../lib/types'

export function MailDrawer({
  win,
  mode = 'floating',
  onDetach,
}: {
  win: Win
  mode?: 'track' | 'floating'
  onDetach?: () => void
}) {
  const pipeline = useContext(PipelineCtx)
  const items = useMail((s) => s.items)
  const updateDraft = useMail((s) => s.updateDraft)
  const addRecipient = useMail((s) => s.addRecipient)
  const removeRecipient = useMail((s) => s.removeRecipient)
  const applyTemplate = useMail((s) => s.applyTemplate)
  const setVar = useMail((s) => s.setVar)
  const detach = useMail((s) => s.detach)
  const send = useMail((s) => s.send)
  const schedule = useMail((s) => s.schedule)
  const checklist = useMail((s) => s.checklist)
  const addWindow = useWindows((s) => s.add)

  const pipelineDraftId = usePipeline((s) => s.draftId)
  const setPipelineDraft = usePipeline((s) => s.setDraft)
  const draftId =
    (pipeline.active ? pipelineDraftId : null) ?? (win.payload?.draftId as string | undefined) ?? ''
  const item = items.find((m) => m.id === draftId) ?? items.find((m) => m.status === 'draft') ?? items[0]
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [flash, setFlash] = useState(false)
  const [preview, setPreview] = useState(false)
  const [editingVar, setEditingVar] = useState<string | null>(null)
  const [varDraft, setVarDraft] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [schedAt, setSchedAt] = useState('')


  const check = item ? checklist(item.id) : { recipient: false, vars: false, attachment: false, ready: false, missing: [] }
  const template = MAIL_TEMPLATES.find((t) => t.id === item?.template) ?? MAIL_TEMPLATES[0]
  const vars = item?.vars ?? {}
  const body = item?.body ?? ''
  const subject = item?.subject ?? ''

  const pending = useMemo(() => (item ? missingVars(`${subject}\n${body}`, vars) : []), [item, subject, body, vars])

  useEffect(() => {
    if (item?.status === 'sent') {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1500)
      return () => clearTimeout(t)
    }
  }, [item?.status])

  if (!item) {
    return (
      <aside className={cn("flex h-full flex-col bg-surface", mode === "track" ? "w-full" : "w-[420px] border-l border-line")}>
        <div className="flex h-10 items-center justify-between border-b border-line px-3">
          <span className="t-h2">新邮件</span>
        </div>
        <div className="flex flex-1 items-center justify-center text-[12px] text-ink-3">还没有草稿。</div>
      </aside>
    )
  }

  const onSend = async () => {
    setSending(true)
    setError('')
    await send(item.id)
    setSending(false)
  }

  return (
    <aside className={cn("flex h-full flex-col bg-surface", mode === "track" ? "w-full" : "w-[420px] border-l border-line shadow-[var(--shadow-win-focus)]")}>
      <div className="relative h-[2px] shrink-0 bg-transparent">
        {flash && (
          <span
            className="absolute inset-0 origin-left bg-ok"
            style={{ animation: 'sweep 1.5s cubic-bezier(.2,.7,.3,1) forwards, skPulse 1.5s ease-out forwards' }}
          />
        )}
      </div>

      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="t-h2">新邮件</span>
        <span className="mono text-[10px] text-ink-3">
          {item.status === 'sent' ? `已发送 ${item.sent_at ? fmtDate(item.sent_at) : ''}` : item.status === 'failed' ? '发送失败' : '草稿'}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {pipeline.active && items.length > 1 && (
            <select
              aria-label="切换草稿"
              value={item.id}
              onChange={(e) => setPipelineDraft(e.target.value)}
              className="h-[22px] max-w-[120px] rounded-[3px] border border-line bg-surface px-1 text-[11px] text-ink-2"
            >
              {items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.to[0]?.name || m.to[0]?.email || '未填收件人'}
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            variant="quiet"
            icon={<Icon as={Plus} size={13} />}
            onClick={() => {
              const draft = useMail.getState().createDraft()
              if (pipeline.active) {
                focusDraft(draft)
              } else {
                const id = addWindow('mail', '新邮件', { payload: { draftId: '' } })
                useWindows.getState().setPayload(id, { draftId: draft })
              }
            }}
            title="新建草稿"
          >
            新建
          </Button>
          {mode === 'track' && onDetach ? (
            <button
              type="button"
              onClick={onDetach}
              title="拖出为独立窗口"
              className="flex h-6 items-center gap-1 rounded-[3px] px-1.5 text-[11px] text-ink-3 transition-colors hover:bg-[rgba(16,24,40,0.06)] hover:text-ink"
            >
              <Icon as={ExternalLink} size={12} />
              拖出
            </button>
          ) : (
            <Button
              size="sm"
              variant="quiet"
              aria-label="关闭邮件抽屉"
              onClick={() => useWindows.getState().close(win.id)}
            >
              <Icon as={X} size={14} />
            </Button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.to.map((t, i) => (
            <span key={t.email} className="chip border-accent-line bg-accent-soft text-ink">
              <span className="max-w-[120px] truncate">{t.name || t.email}</span>
              <button type="button" aria-label={`移除 ${t.email}`} onClick={() => removeRecipient(item.id, i)}>
                <Icon as={X} size={11} />
              </button>
            </span>
          ))}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const ok = addRecipient(item.id, email)
                if (!ok) setError('邮箱格式不对')
                else {
                  setEmail('')
                  setError('')
                }
              }
            }}
            placeholder="导师邮箱，回车添加"
            aria-label="收件人邮箱"
            className="h-[22px] min-w-[150px] flex-1 rounded-[5px] border border-line bg-surface px-2 text-[12px] placeholder:text-ink-3 focus:border-accent focus:shadow-[var(--focus-ring)]"
          />
        </div>
        {error && <div className="mt-1 text-[11px] text-danger">{error}</div>}

        <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
          <span className="w-[38px] shrink-0 text-[11px] text-ink-3">主题</span>
          <input
            value={subject}
            onChange={(e) => updateDraft(item.id, { subject: e.target.value })}
            className="h-7 flex-1 rounded-[6px] border border-line bg-surface px-2 text-[12px] focus:border-accent focus:shadow-[var(--focus-ring)]"
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-[38px] shrink-0 text-[11px] text-ink-3">模板</span>
          <select
            value={item.template}
            onChange={(e) => applyTemplate(item.id, e.target.value)}
            className="h-7 rounded-[6px] border border-line bg-surface px-2 text-[12px] focus:border-accent"
          >
            {MAIL_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="ml-auto text-[11px] text-ink-3 hover:text-ink"
          >
            {preview ? '继续编辑' : '预览'}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
          <span className="text-[11px] text-ink-3">变量</span>
          {template.vars.map((v) => {
            const filled = Boolean(vars[v]?.trim())
            if (editingVar === v) {
              return (
                <input
                  key={v}
                  autoFocus
                  value={varDraft}
                  onChange={(e) => setVarDraft(e.target.value)}
                  onBlur={() => {
                    setVar(item.id, v, varDraft)
                    setEditingVar(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setVar(item.id, v, varDraft)
                      setEditingVar(null)
                    }
                    if (e.key === 'Escape') setEditingVar(null)
                  }}
                  placeholder={v}
                  aria-label={`填写变量 ${v}`}
                  className="mono h-[22px] w-[104px] rounded-[5px] border border-accent bg-surface px-1.5 text-[10px] focus:shadow-[var(--focus-ring)]"
                />
              )
            }
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setEditingVar(v)
                  setVarDraft(vars[v] ?? '')
                }}
                className={cn(
                  'mono max-w-[124px] truncate rounded-[5px] border px-1.5 py-[2px] text-[10px] transition-colors',
                  filled ? 'border-accent-line bg-accent-soft text-accent' : 'border-warn text-warn',
                )}
                title={filled ? `${v} = ${vars[v]}，点击修改` : `${v} 未填写，点击输入`}
              >
                {filled ? vars[v] : `{{${v}}}`}
              </button>
            )
          })}
        </div>

        <div className="mt-2 border-t border-line pt-2">
          {preview ? (
            <pre className="whitespace-pre-wrap rounded-[6px] border border-line bg-surface-2 p-2 text-[12px] leading-[1.7] text-ink">
              {renderTemplate(body, vars)}
            </pre>
          ) : (
            <textarea
              value={body}
              onChange={(e) => updateDraft(item.id, { body: e.target.value })}
              rows={9}
              className="w-full resize-y rounded-[6px] border border-line bg-surface p-2 text-[12px] leading-[1.7] focus:border-accent focus:shadow-[var(--focus-ring)]"
            />
          )}
        </div>

        <div className="mt-3 border-t border-line pt-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Icon as={Paperclip} size={13} className="text-ink-3" />
            <span className="text-[11px] text-ink-3">附件</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {item.attachments.map((a) => (
              <div key={a.name} className="flex items-center gap-2 rounded-[8px] border border-line bg-surface-2 px-2.5 py-1.5">
                <Icon as={FileText} size={14} className="text-ink-3" />
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-ink">{a.name}</div>
                  <div className="mono text-[10px] text-ink-3">
                    {a.rows} 行 · {fmtDate(a.at)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`移除附件 ${a.name}`}
                  onClick={() => detach(item.id, a.name)}
                  className="ml-auto text-ink-3 hover:text-ink"
                >
                  <Icon as={X} size={13} />
                </button>
              </div>
            ))}
            {!item.attachments.length && (
              <div className="rounded-[8px] border border-dashed border-line px-2.5 py-2 text-[11px] text-ink-3">
                还没有附件。在数据表里点「导出报表」并勾选「导出后邮件发送」，报表快照会自动挂到这里。
              </div>
            )}
            <label className="flex items-center gap-2 text-[11px] text-ink-2">
              <input
                type="checkbox"
                checked={Boolean(vars['附加CSV'])}
                onChange={(e) => setVar(item.id, '附加CSV', e.target.checked ? '是' : '')}
              />
              同时附 CSV 原文件
            </label>
          </div>
        </div>

        <div className="mt-3 border-t border-line pt-2">
          <div className="mb-1.5 text-[11px] text-ink-3">发送前检查</div>
          <div className="flex flex-col gap-1">
            {[
              ['收件人已确认', check.recipient],
              ['变量已填', check.vars],
              ['附件已生成', check.attachment],
            ].map(([label, ok]) => (
              <div key={String(label)} className="flex items-center gap-2 text-[12px]">
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full border',
                    ok ? 'border-ok bg-ok text-white' : 'border-line-strong text-transparent',
                  )}
                >
                  <Icon as={Check} size={11} />
                </span>
                <span className={ok ? 'text-ink' : 'text-ink-3'}>{String(label)}</span>
              </div>
            ))}
          </div>
          {pending.length > 0 && (
            <div className="mt-2">
              <Note tone="warn">还差 {pending.map((p) => `{{${p}}}`).join('、')}</Note>
            </div>
          )}
          {item.status === 'failed' && (
            <div className="mt-2">
              <Note tone="danger">发送失败：{item.error ?? '未知原因'}。草稿已保留，可修正后重发。</Note>
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface-2 px-3 py-2">
        {sending && <div className="mb-2 h-[2px] w-full overflow-hidden rounded-full bg-line"><div className="h-full w-1/3 bg-accent" /></div>}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className="flex-1"
            disabled={!check.ready || sending || item.status === 'sent'}
            icon={sending ? <Loader2 size={14} className="animate-spin" /> : <Icon as={Send} size={14} />}
            onClick={onSend}
          >
            {item.status === 'sent' ? '已发送' : '发送'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon as={Clock} size={13} />}
            title="定时发送"
            onClick={() => setScheduleOpen((v) => !v)}
          >
            定时
          </Button>
          <Button variant="ghost" size="sm" onClick={() => downloadEml(item)}>
            .eml
          </Button>
        </div>
        {scheduleOpen && (
          <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-2">
            <input
              type="datetime-local"
              value={schedAt}
              onChange={(e) => setSchedAt(e.target.value)}
              aria-label="定时发送时间"
              className="h-7 rounded-[6px] border border-line bg-surface px-2 text-[11px] focus:border-accent"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!schedAt) return
                schedule(item.id, new Date(schedAt).getTime())
                setScheduleOpen(false)
              }}
            >
              确认定时
            </Button>
          </div>
        )}
        {item.status === 'scheduled' && item.scheduled_at && (
          <div className="mono mt-1.5 text-[10px] text-accent">已定时 · {fmtDate(item.scheduled_at)}</div>
        )}
        <div className="mono mt-1.5 flex items-center gap-1.5 text-[10px] text-ink-3">
          <Dot tone={item.transport === 'emailjs' ? 'ok' : 'neutral'} />
          {item.transport === 'emailjs' ? '通过 EmailJS 真实发送' : '本地模拟发送，不经过外部服务'}
        </div>
      </footer>
    </aside>
  )
}
