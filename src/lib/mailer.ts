import type { OutboxItem } from './types'

export type MailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  vars: string[]
}

export const MAIL_TEMPLATES: MailTemplate[] = [
  {
    id: 'weekly',
    name: '周报',
    subject: '本周实验进度 · {{数据集名称}}',
    body: '{{导师姓名}}老师好：\n\n本周的数据表「{{数据集名称}}」已更新，共 {{本周样本数}} 行。\n\n本周结论：{{本周结论}}\n\n附件是本周的报表快照，请查收。\n\n{{日期}}',
    vars: ['导师姓名', '本周样本数', '数据集名称', '本周结论', '日期'],
  },
  {
    id: 'verify',
    name: '数据核对',
    subject: '数据核对 · {{数据集名称}}',
    body: '{{导师姓名}}老师好：\n\n请帮忙核对「{{数据集名称}}」中的关键指标，本次共 {{本周样本数}} 行。\n\n重点：{{本周结论}}\n\n如有出入，回复这封邮件即可。\n\n{{日期}}',
    vars: ['导师姓名', '本周样本数', '数据集名称', '本周结论', '日期'],
  },
  {
    id: 'remind',
    name: '投稿催稿',
    subject: '投稿进度同步 · {{数据集名称}}',
    body: '{{导师姓名}}老师好：\n\n同步一下「{{数据集名称}}」的投稿材料准备情况，目前整理出 {{本周样本数}} 行实验记录。\n\n主要结论：{{本周结论}}\n\n需要您确认的部分见附件。\n\n{{日期}}',
    vars: ['导师姓名', '本周样本数', '数据集名称', '本周结论', '日期'],
  },
]

export const VAR_POOL = ['导师姓名', '本周样本数', '数据集名称', '本周结论', '日期']

export function templateById(id: string): MailTemplate {
  return MAIL_TEMPLATES.find((t) => t.id === id) ?? MAIL_TEMPLATES[0]
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => vars[key.trim()] ?? '')
}

/** 未填写的变量列表 */
export function missingVars(text: string, vars: Record<string, string>): string[] {
  const keys = new Set<string>()
  const re = /\{\{([^}]+)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) keys.add(m[1].trim())
  return Array.from(keys).filter((k) => !vars[k]?.trim())
}

export function buildEml(item: OutboxItem): string {
  const to = item.to.map((t) => `${t.name || ''} <${t.email}>`).join(', ')
  const date = new Date(item.sent_at ?? Date.now()).toUTCString()
  // 正文原样进 .eml：以前每行都被加上 "> "，导出来整封信都是引用块
  const body = item.body.replace(/\r\n/g, '\n')
  return [
    `From: ${item.to[0]?.name || '案头'} <no-reply@antou.local>`,
    `To: ${to}`,
    `Subject: ${item.subject}`,
    `Date: ${date}`,
    `X-Antou-Template: ${item.template}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    '',
    body,
  ].join('\n')
}

export function downloadEml(item: OutboxItem) {
  const blob = new Blob([buildEml(item)], { type: 'message/rfc822;charset=utf-8' })
  triggerDownload(blob, `${item.subject || 'mail'}.eml`)
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function sendViaEmailJs(
  item: OutboxItem,
  cfg: { serviceId: string; templateId: string; publicKey: string },
): Promise<void> {
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.publicKey}` },
    body: JSON.stringify({
      service_id: cfg.serviceId,
      template_id: cfg.templateId,
      template_params: {
        to_email: item.to.map((t) => t.email).join(','),
        to_name: item.to.map((t) => t.name).join('、'),
        subject: item.subject,
        body: item.body,
        attachments_note: item.attachments.map((a) => `${a.name}（${a.rows} 行）`).join('、'),
      },
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`EmailJS 返回 ${res.status} ${t.slice(0, 120)}`)
  }
}
