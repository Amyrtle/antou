import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

mkdirSync('fixtures', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })

const docs = [
  {
    file: 'fixtures/sample-a.pdf',
    title: '增强预处理对低样本分类的影响（示例文献 A）',
    paras: [
      '本文在统一训练协议下比较了 12.8 万样本规模下三类预处理组合，线性探测准确率分别为 91.3%、89.7% 与 88.9%。',
      '消融实验显示，几何变换放在流程最前端时收益最大，把混合操作前置会损失约 2.3 个百分点。',
      '在标注比例低于 0.5% 的极端设置下，预处理策略带来的差距扩大到 8.7 个百分点，且需要分别调节预训练与微调阶段的增强强度。',
      '所有实验重复三次随机种子并报告均值，CropFlip 配置的标准差为 0.42，说明该方案在低样本场景下更稳定。',
    ],
  },
  {
    file: 'fixtures/sample-b.pdf',
    title: '域偏移下的增强强度拐点研究（示例文献 B）',
    paras: [
      '我们把增强强度参数化为 0 到 1 的连续变量，在偏移量 0.05 到 0.35 之间取 7 个档位做扫描。',
      '当域偏移量低于 0.25 时，增强强度增大持续带来收益；超过 0.25 后几何类增强的鲁棒准确率开始下降，每增加 0.05 偏移量损失 2.2 个百分点。',
      '色彩类增强是唯一在全部档位保持正向收益的类型，在偏移量 0.35 时仍维持 78.6% 的鲁棒准确率。',
      '语义级增强需要约 4.1 倍的标注量才能体现收益，在 500 张标注下只比基线高 1.2 个百分点。',
    ],
  },
  {
    file: 'fixtures/sample-c.pdf',
    title: '少样本分割的增强预算分配（示例文献 C）',
    paras: [
      '在 5-way 1-shot 分割上，我们用 30 组增强组合做了完整规模化实验，标注掩码量为 1200 个。',
      '最优预算分配为尺度 6、色彩 3、混合 1，在该配置下取得 42.7 mIoU，比等量随机组合的 37.4 mIoU 高 5.3 个百分点。',
      '在 5-way 5-shot 下，预算建议调整为 5:4:1，mIoU 达到 48.9，比 1-shot 提升 6.2 个百分点。',
      '尺度操作在 0.6 到 1.4 的区间覆盖了 68% 的有效增强，超过 1.6 的尺度几乎没有贡献。',
    ],
  },
]

for (const d of docs) {
  const page = await browser.newPage()
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:"Microsoft YaHei",sans-serif;padding:48px;line-height:1.9}h1{font-size:22px}p{font-size:15px}</style></head><body><h1>${d.title}</h1>${d.paras.map((p) => `<p>${p}</p>`).join('')}</body></html>`
  await page.setContent(html)
  await page.pdf({ path: d.file, format: 'A4', printBackground: true })
  await page.close()
  console.log('wrote', d.file)
}
await browser.close()
