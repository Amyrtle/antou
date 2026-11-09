import { FileText, Mail, Table2, type LucideIcon } from 'lucide-react'

export type StageKey = 'read' | 'write' | 'send'

export type Stage = {
  key: StageKey
  label: string
  full: string
  desc: string
  icon: LucideIcon
}

export const STAGES: Stage[] = [
  { key: 'read', label: '读', full: '文献问答', desc: '拖进论文，带引用地问', icon: FileText },
  { key: 'write', label: '写', full: '数据表', desc: '把答案里的数值变成表与报表', icon: Table2 },
  { key: 'send', label: '发', full: '邮件', desc: '报表快照直接发给导师', icon: Mail },
]

export const stageOf = (key: StageKey): Stage => STAGES.find((s) => s.key === key) ?? STAGES[0]
