import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Attachment, OutboxItem } from '../lib/types'
import { uid } from '../lib/id'
import { MAIL_TEMPLATES, missingVars, renderTemplate, sendViaEmailJs, templateById } from '../lib/mailer'
import { useSettings } from './settings'
import { useHistory } from './history'

type MailState = {
  items: OutboxItem[]
  init: () => void
  createDraft: (seed?: Partial<OutboxItem>) => string
  updateDraft: (id: string, patch: Partial<OutboxItem>) => void
  addRecipient: (id: string, email: string, name?: string) => boolean
  removeRecipient: (id: string, index: number) => void
  applyTemplate: (id: string, templateId: string) => void
  setVar: (id: string, key: string, value: string) => void
  attach: (id: string, att: Attachment) => void
  detach: (id: string, name: string) => void
  send: (id: string) => Promise<void>
  schedule: (id: string, at: number) => void
  tick: () => void
  remove: (id: string) => void
  byId: (id: string) => OutboxItem | undefined
  checklist: (id: string) => { recipient: boolean; vars: boolean; attachment: boolean; ready: boolean; missing: string[] }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const useMail = create<MailState>()(
  persist(
    (set, get) => ({
      items: [],

      init: () => {},

      createDraft: (seed) => {
        const tpl = templateById(seed?.template ?? 'weekly')
        const item: OutboxItem = {
          id: uid('mail-'),
          to: [],
          subject: tpl.subject,
          body: tpl.body,
          template: tpl.id,
          vars: {},
          attachments: [],
          status: 'draft',
          created_at: Date.now(),
          transport: 'local',
          ...seed,
        }
        set((s) => ({ items: [item, ...s.items] }))
        return item.id
      },

      updateDraft: (id, patch) =>
        set((s) => ({ items: s.items.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

      addRecipient: (id, email, name) => {
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        if (!ok) return false
        set((s) => ({
          items: s.items.map((m) =>
            m.id === id && !m.to.some((t) => t.email === email.trim())
              ? { ...m, to: [...m.to, { name: name ?? '', email: email.trim() }] }
              : m,
          ),
        }))
        return true
      },

      removeRecipient: (id, index) =>
        set((s) => ({
          items: s.items.map((m) => (m.id === id ? { ...m, to: m.to.filter((_, i) => i !== index) } : m)),
        })),

      applyTemplate: (id, templateId) => {
        const tpl = templateById(templateId)
        set((s) => ({
          items: s.items.map((m) =>
            m.id === id ? { ...m, template: tpl.id, subject: tpl.subject, body: tpl.body } : m,
          ),
        }))
      },

      setVar: (id, key, value) =>
        set((s) => ({
          items: s.items.map((m) => (m.id === id ? { ...m, vars: { ...m.vars, [key]: value } } : m)),
        })),

      attach: (id, att) =>
        set((s) => ({
          items: s.items.map((m) =>
            m.id === id && !m.attachments.some((a) => a.name === att.name)
              ? { ...m, attachments: [...m.attachments, att] }
              : m,
          ),
        })),

      detach: (id, name) =>
        set((s) => ({
          items: s.items.map((m) =>
            m.id === id ? { ...m, attachments: m.attachments.filter((a) => a.name !== name) } : m,
          ),
        })),

      send: async (id) => {
        const item = get().items.find((m) => m.id === id)
        if (!item) return
        const cfg = useSettings.getState().emailjs
        const useEmailJs = Boolean(cfg.publicKey && cfg.serviceId && cfg.templateId)
        set((s) => ({
          items: s.items.map((m) => (m.id === id ? { ...m, status: 'draft', error: undefined } : m)),
        }))
        try {
          if (useEmailJs) {
            await sendViaEmailJs(item, cfg)
          } else {
            await sleep(700)
          }
          set((s) => ({
            items: s.items.map((m) =>
              m.id === id
                ? {
                    ...m,
                    status: 'sent',
                    sent_at: Date.now(),
                    transport: useEmailJs ? 'emailjs' : 'local',
                    subject: renderTemplate(m.subject, m.vars),
                    body: renderTemplate(m.body, m.vars),
                  }
                : m,
            ),
          }))
          useHistory.getState().log({
            kind: 'send',
            title: `已发送：${renderTemplate(item.subject, item.vars)}`,
            detail: `${item.to.map((t) => t.email).join(', ')} · ${useEmailJs ? 'EmailJS' : '本地模拟'}`,
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : '发送失败'
          set((s) => ({
            items: s.items.map((m) => (m.id === id ? { ...m, status: 'failed', error: msg } : m)),
          }))
          useHistory.getState().log({ kind: 'send', title: '发送失败', detail: msg })
        }
      },

      schedule: (id, at) =>
        set((s) => ({
          items: s.items.map((m) => (m.id === id ? { ...m, status: 'scheduled', scheduled_at: at } : m)),
        })),

      tick: () => {
        const now = Date.now()
        const due = get().items.filter(
          (m) => m.status === 'scheduled' && m.scheduled_at !== undefined && m.scheduled_at <= now,
        )
        for (const m of due) void get().send(m.id)
      },

      remove: (id) => set((s) => ({ items: s.items.filter((m) => m.id !== id) })),

      byId: (id) => get().items.find((m) => m.id === id),

      checklist: (id) => {
        const item = get().items.find((m) => m.id === id)
        if (!item) return { recipient: false, vars: false, attachment: false, ready: false, missing: [] }
        const text = `${item.subject}\n${item.body}`
        const missing = missingVars(text, item.vars)
        const recipient = item.to.length > 0
        const vars = missing.length === 0
        const attachment = item.attachments.length > 0
        return { recipient, vars, attachment, ready: recipient && vars && attachment, missing }
      },
    }),
    { name: 'antou.mail', version: 1 },
  ),
)

export const MAIL_TEMPLATE_IDS = MAIL_TEMPLATES.map((t) => t.id)
