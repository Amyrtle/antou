import { Icon } from '../ui/Icon'
import { Button, Dot, Hairline, Label } from '../ui/kit'
import { Copy, FileText, Hash, Type } from 'lucide-react'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { useData } from '../store/data'
import { columnStats } from '../lib/stats'
import { fmtNum, pct } from '../lib/format'

function citeApa(p: { authors: string[]; year: number; title: string; venue: string }) {
  const names = p.authors.join(', ')
  return `${names} (${p.year}). ${p.title}. ${p.venue}.`
}

function citeGbt(p: { authors: string[]; year: number; title: string; venue: string }) {
  const names = p.authors.map((a) => a[0] ?? a).join(', ')
  return `${names}. ${p.title}[J]. ${p.venue}, ${p.year}.`
}

export function PeekPanel() {
  const target = useUi((s) => s.peekTarget)
  const closePeek = useUi((s) => s.closePeek)
  const papers = useLibrary((s) => s.papers)
  const datasets = useData((s) => s.datasets)

  if (!target) return null

  if (target.type === 'paper') {
    const p = papers.find((x) => x.id === target.id)
    if (!p) return null
    return (
      <aside className="absolute right-3 top-3 z-30 flex h-[calc(100%-24px)] w-[320px] animate-peek-in flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-[var(--shadow-pop)]">
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
          <Icon as={FileText} size={14} className="text-ink-3" />
          <span className="text-[12px] text-ink">文献信息</span>
          <button type="button" onClick={closePeek} className="ml-auto text-[11px] text-ink-3 hover:text-ink">
            收起
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <h3 className="text-[14px] leading-[1.5] text-ink">{p.title}</h3>
          <div className="mono mt-1 text-[10px] text-ink-3">
            {p.authors.join('、')} · {p.year} · {p.venue}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {p.tags.map((t) => (
              <span key={t} className="rounded-[4px] border border-line px-1.5 text-[10px] text-ink-2">
                {t}
              </span>
            ))}
            {p.demo && <span className="rounded-[4px] bg-head px-1.5 text-[10px] text-ink-3">示例文献</span>}
          </div>

          <div className="mt-3">
            <Label>摘要</Label>
            <p className="mt-1 text-[12px] leading-[1.7] text-ink-2">{p.abstract || '（暂无摘要）'}</p>
          </div>

          <div className="mt-3">
            <Label>引用格式</Label>
            <div className="mt-1 rounded-[8px] border border-line bg-surface-2 p-2">
              <div className="mono text-[10px] text-ink-3">APA</div>
              <p className="mt-0.5 text-[11px] leading-[1.6] text-ink-2">{citeApa(p)}</p>
              <Hairline className="my-2" />
              <div className="mono text-[10px] text-ink-3">GB/T 7714</div>
              <p className="mt-0.5 text-[11px] leading-[1.6] text-ink-2">{citeGbt(p)}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-1.5 w-full"
              icon={<Icon as={Copy} size={13} />}
              onClick={() => navigator.clipboard?.writeText(`${citeApa(p)}\n${citeGbt(p)}`)}
            >
              复制两种格式
            </Button>
          </div>

          <div className="mt-3">
            <Label>文件</Label>
            <div className="mono mt-1 flex items-center gap-2 text-[11px] text-ink-2">
              <Dot tone="ok" />
              {p.file_name}
              <span className="ml-auto text-ink-3">{p.page_count} 页</span>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  if (target.type === 'dataset') {
    const d = datasets.find((x) => x.id === target.id)
    if (!d) return null
    return (
      <aside className="absolute right-3 top-3 z-30 flex h-[calc(100%-24px)] w-[320px] animate-peek-in flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-[var(--shadow-pop)]">
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
          <span className="text-[12px] text-ink">数据表属性</span>
          <button type="button" onClick={closePeek} className="ml-auto text-[11px] text-ink-3 hover:text-ink">
            收起
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <h3 className="text-[14px] text-ink">{d.name}</h3>
          <div className="mono mt-1 text-[10px] text-ink-3">
            {d.rows.length} 行 × {d.columns.length} 列 ·{' '}
            {d.source.type === 'qa' ? `来自问答 · ${d.source.label ?? ''}` : d.source.type === 'import' ? '导入' : '手动创建'}
          </div>

          <div className="mt-3">
            <Label>列</Label>
            <div className="mt-1 border-t border-line">
              {d.columns.map((c) => (
                <div key={c.key} className="flex items-center gap-2 border-b border-line py-1.5">
                  <Icon as={c.type === 'number' ? Hash : Type} size={12} className="text-ink-3" />
                  <span className="text-[12px] text-ink">{c.name}</span>
                  {c.unit && <span className="mono text-[10px] text-ink-3">{c.unit}</span>}
                  <span className="mono ml-auto text-[10px] text-ink-3">{c.type}</span>
                </div>
              ))}
            </div>
          </div>

          {target.type === 'dataset' && (
            <div className="mt-3">
              <Label>数值列统计</Label>
              <div className="mt-1 border-t border-line">
                {d.columns
                  .filter((c) => c.type === 'number')
                  .map((c) => {
                    const st = columnStats(d.rows, c)
                    return (
                      <div key={c.key} className="flex items-baseline justify-between border-b border-line py-1.5">
                        <span className="text-[12px] text-ink">{c.name}</span>
                        <span className="mono text-[11px] text-ink-2">
                          均值 {st.mean === null ? '—' : fmtNum(st.mean, 2)} · 缺失 {pct(st.missingRate)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </aside>
    )
  }

  return null
}
