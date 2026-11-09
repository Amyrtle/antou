import { useEffect, useRef, useState } from 'react'
import { TopBar } from './app/TopBar'
import { Pipeline } from './app/Pipeline'
import { CommandPalette } from './app/CommandPalette'
import { SettingsPanel } from './app/SettingsPanel'
import { useUi } from './store/ui'
import { useLibrary } from './store/library'
import { useQA } from './store/qa'
import { useData } from './store/data'
import { useMail } from './store/mail'
import { usePipeline } from './store/pipeline'
import { isMac } from './lib/platform'
import { FileUp } from 'lucide-react'
import { Icon } from './ui/Icon'

export default function App() {
  const setCommandOpen = useUi((s) => s.setCommandOpen)
  const seededMail = useRef(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    void useLibrary.getState().init()
    useQA.getState().init()
    useData.getState().init()
  }, [])

  // 示例工作区：给「发」阶段准备一封已填好变量、已挂附件的草稿
  useEffect(() => {
    if (seededMail.current) return
    const timer = setInterval(() => {
      const ds = useData.getState().datasets[0]
      if (!ds || useMail.getState().items.length) {
        seededMail.current = true
        clearInterval(timer)
        return
      }
      useMail.getState().createDraft({
        to: [{ name: '周老师', email: 'mentor@university.edu' }],
        subject: '本周实验进度 · 增强策略关键指标对照',
        template: 'weekly',
        vars: {
          导师姓名: '周老师',
          本周样本数: String(ds.rows.length),
          数据集名称: ds.name,
          本周结论: '预处理顺序在分类预训练里最关键，域偏移场景下强度拐点更重要，少样本分割转向预算分配。',
          日期: new Date().toLocaleDateString('zh-CN'),
        },
        attachments: [
          {
            name: `${ds.name}.xlsx`,
            rows: ds.rows.length,
            at: Date.now(),
            dataset_id: ds.id,
            format: 'xlsx',
          },
        ],
      })
      seededMail.current = true
      clearInterval(timer)
    }, 120)
    return () => clearInterval(timer)
  }, [])

  // 定时发送：每秒检查到点的定时草稿并发出
  useEffect(() => {
    useMail.getState().tick()
    const timer = setInterval(() => useMail.getState().tick(), 1000)
    return () => clearInterval(timer)
  }, [])

  // 拖入 PDF：整页可投放，松开即解析
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragOver(true)
    }
    const onLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) {
        void useLibrary.getState().uploadFiles(files)
        usePipeline.getState().focusTrack('read')
        useUi.getState().noteAction(`正在解析 ${files.length} 个 PDF`)
      }
    }
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(!useUi.getState().commandOpen)
        return
      }
      if (mod && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault()
        usePipeline.getState().focusTrack(e.key === '1' ? 'read' : e.key === '2' ? 'write' : 'send')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandOpen])

  return (
    <div className="flex h-full flex-col bg-bg">
      <TopBar />
      <Pipeline />
      <CommandPalette />
      <SettingsPanel />

      {dragOver && (
        <div
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(16,23,37,0.06)' }}
        >
          <div className="drop-hint flex flex-col items-center gap-2 rounded-[14px] border-2 border-dashed border-accent bg-surface px-10 py-8 shadow-[var(--shadow-pop)]">
            <Icon as={FileUp} size={20} className="text-accent" />
            <div className="t-h2 text-ink">松开即可解析 PDF</div>
            <div className="mono text-[11px] text-ink-3">本地解析 · 不上传服务器 · 支持多选</div>
          </div>
        </div>
      )}
    </div>
  )
}
