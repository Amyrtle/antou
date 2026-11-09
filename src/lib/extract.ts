export type NumericFact = { metric: string; value: number; unit: string }

/** 从一句中文里取出「指标 / 数值 / 单位」 */
export function factsIn(text: string): NumericFact[] {
  const out: NumericFact[] = []
  const re = /(-?\d+(?:\.\d+)?)\s*(%|个百分点|万张|万|千|亿|倍|mIoU|MB|GB|KB|K)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const value = Number(m[1])
    if (!Number.isFinite(value)) continue
    const end = m.index + m[0].length
    const after = text.slice(end).replace(/^[的了和与在、\s]*/, '')
    const mAfter = after.match(/^[\u4e00-\u9fa5A-Za-z]{2,12}/)
    const before = text.slice(Math.max(0, m.index - 16), m.index)
    const beforeClean = before.replace(/[，。；：、,.:;][^，。；：、,.:;]*$/, '').trim()
    let metric = mAfter ? mAfter[0] : beforeClean.slice(-8)
    metric = metric
      .replace(/^(在|其中|而|该|其|并且|同时)/, '')
      .replace(/(取得|达到|提升|下降|是|为|了|约|近|超过|低于|高于|用到|用|占|即)$/g, '')
      .replace(/[上下中内里之]$/, '')
      .trim()
    if (!metric || /^[\d%．.\s]+$/.test(metric)) metric = '数值'
    const unit = m[2] ?? ''
    if (out.some((f) => f.metric === metric && f.value === value)) continue
    out.push({ metric, value, unit })
  }
  return out
}

export type FactRow = { metric: string; value: number; unit: string; source: string }

/** 从回答段落里抽出可入表的数值行 */
export function extractRows(
  segments: Array<{ type: string; text: string }>,
  resolveSource: (index: number) => string,
): FactRow[] {
  const rows: FactRow[] = []
  const seen = new Set<string>()
  segments.forEach((seg, idx) => {
    if (seg.type !== 'quote') return
    for (const fact of factsIn(seg.text)) {
      const key = `${fact.metric}|${fact.value}|${fact.unit}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ metric: fact.metric, value: fact.value, unit: fact.unit, source: resolveSource(idx) })
    }
  })
  return rows
}
