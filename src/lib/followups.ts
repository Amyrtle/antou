export function followUps(question: string): string[] {
  const pool: string[] = []
  if (/差异|对比|比较|区别|vs/i.test(question)) pool.push('把这些差异整理成一张对比表')
  if (/趋势|变化|增长|下降|走势/i.test(question)) pool.push('预测下一阶段的趋势会怎么走')
  if (/显著|检验|p ?值|假设|效应/i.test(question)) pool.push('这些统计量的判断标准是什么')
  if (/异常|离群|缺失|outlier/i.test(question)) pool.push('离群点可能来自哪些组，怎么处理')
  if (/机制|原因|为什么|原理/i.test(question)) pool.push('把原因按证据强弱排个序')
  pool.push('用三句话总结上面的结论')
  pool.push('如果样本量翻倍，结论会变吗')
  pool.push('换个角度重新分析这批数据')
  return Array.from(new Set(pool)).slice(0, 3)
}
