import type { Column, Dataset } from './types'
import { uid } from './id'

export type ExperimentCase = {
  id: string
  name: string
  category: string
  capability: string[]
  source: string
  desc: string
  analysis: string[]
  columns: Column[]
  rows: Array<Array<string | number>>
}

const col = (key: string, name: string, type: Column['type'], unit?: string): Column => ({ key, name, type, unit })

/**
 * 实例库：案例结构参照 GraphPad Prism / Origin / JASP 的样例数据，
 * 数值取自公开经典数据集（R 内置 PlantGrowth / sleep / iris、Anscombe 1973 等）。
 */
export const CASES: ExperimentCase[] = [
  {
    id: 'plant-growth',
    name: '植物生长 · 三组对照',
    category: '组间比较',
    capability: ['单因素 ANOVA', '组间对照', '箱线分布'],
    source: '改编自 R 内置 PlantGrowth（Dodge, 1940s）',
    desc: '对照与两种处理下的植株干重，三组各 10 株，适合演示组间差异与方差分析。',
    analysis: ['各组均值 ± 标准差对照', '单因素 ANOVA 看组间差异', 'trt2 与 ctrl 的差值即处理效应'],
    columns: [col('group', '组别', 'text'), col('weight', '干重', 'number', 'g')],
    rows: [
      ['ctrl', 4.17], ['ctrl', 5.58], ['ctrl', 5.18], ['ctrl', 6.11], ['ctrl', 4.5],
      ['ctrl', 4.61], ['ctrl', 5.17], ['ctrl', 4.53], ['ctrl', 5.33], ['ctrl', 5.14],
      ['trt1', 4.81], ['trt1', 4.17], ['trt1', 4.41], ['trt1', 3.59], ['trt1', 5.87],
      ['trt1', 3.83], ['trt1', 6.03], ['trt1', 4.89], ['trt1', 4.32], ['trt1', 4.69],
      ['trt2', 6.31], ['trt2', 5.12], ['trt2', 5.54], ['trt2', 5.37], ['trt2', 5.29],
      ['trt2', 4.92], ['trt2', 6.22], ['trt2', 5.74], ['trt2', 6.96], ['trt2', 6.33],
    ],
  },
  {
    id: 'sleep',
    name: '睡眠药物 · 配对对照',
    category: '配对比较',
    capability: ['配对 t 检验', '差值分布'],
    source: 'R 内置 sleep（Student, 1908）',
    desc: '10 名受试者服两种药物后延长睡眠时长的小时数，经典配对设计：同一受试者两次测量。',
    analysis: ['逐受试者差值 drug2 − drug1', '配对 t 检验判断两药差异', '差值均值约 1.58h'],
    columns: [col('subject', '受试者', 'text'), col('drug1', '药物 1', 'number', 'h'), col('drug2', '药物 2', 'number', 'h')],
    rows: [
      ['S01', 0.7, 1.9], ['S02', -1.6, 0.8], ['S03', -0.2, 1.1], ['S04', -1.2, 0.1], ['S05', -0.1, -0.3],
      ['S06', 3.4, 4.4], ['S07', 3.7, 4.6], ['S08', 0.8, 3.4], ['S09', 0.0, 2.4], ['S10', 2.0, 3.1],
    ],
  },
  {
    id: 'iris',
    name: '鸢尾花 · 形态测量',
    category: '相关与分类',
    capability: ['相关性', '分组对照', '散点分布'],
    source: 'Fisher iris 前 30 行（setosa / versicolor 各 15）',
    desc: '花萼与花瓣的四项长度测量，两品种各 15 株；花瓣尺寸是最强的品种区分变量。',
    analysis: ['花瓣长 vs 花瓣宽的相关', '两品种各指标均值对照', '按 species 分组看分离度'],
    columns: [
      col('sepal_l', '花萼长', 'number', 'cm'),
      col('sepal_w', '花萼宽', 'number', 'cm'),
      col('petal_l', '花瓣长', 'number', 'cm'),
      col('petal_w', '花瓣宽', 'number', 'cm'),
      col('species', '品种', 'text'),
    ],
    rows: [
      [5.1, 3.5, 1.4, 0.2, 'setosa'], [4.9, 3.0, 1.4, 0.2, 'setosa'], [4.7, 3.2, 1.3, 0.2, 'setosa'],
      [4.6, 3.1, 1.5, 0.2, 'setosa'], [5.0, 3.6, 1.4, 0.2, 'setosa'], [5.4, 3.9, 1.7, 0.4, 'setosa'],
      [4.6, 3.4, 1.4, 0.3, 'setosa'], [5.0, 3.4, 1.5, 0.2, 'setosa'], [4.4, 2.9, 1.4, 0.2, 'setosa'],
      [4.9, 3.1, 1.5, 0.1, 'setosa'], [5.4, 3.7, 1.5, 0.2, 'setosa'], [4.8, 3.4, 1.6, 0.2, 'setosa'],
      [4.8, 3.0, 1.4, 0.1, 'setosa'], [4.3, 3.0, 1.1, 0.1, 'setosa'], [5.8, 4.0, 1.2, 0.2, 'setosa'],
      [7.0, 3.2, 4.7, 1.4, 'versicolor'], [6.4, 3.2, 4.5, 1.5, 'versicolor'], [6.9, 3.1, 4.9, 1.5, 'versicolor'],
      [5.5, 2.3, 4.0, 1.3, 'versicolor'], [6.5, 2.8, 4.6, 1.5, 'versicolor'], [5.7, 2.8, 4.5, 1.3, 'versicolor'],
      [6.3, 3.3, 4.7, 1.6, 'versicolor'], [4.9, 2.4, 3.3, 1.0, 'versicolor'], [6.6, 2.9, 4.6, 1.3, 'versicolor'],
      [5.2, 2.7, 3.9, 1.4, 'versicolor'], [5.0, 2.0, 3.5, 1.0, 'versicolor'], [5.9, 3.0, 4.2, 1.5, 'versicolor'],
      [6.0, 2.2, 4.0, 1.0, 'versicolor'], [6.1, 2.9, 4.7, 1.4, 'versicolor'], [5.6, 2.9, 3.6, 1.3, 'versicolor'],
    ],
  },
  {
    id: 'dose-response',
    name: '剂量反应 · 抑制曲线',
    category: '剂量反应',
    capability: ['梯度实验', '曲线拟合', 'IC50 读图'],
    source: '结构参照 GraphPad Prism 样例「Dose-response (inhibition)」',
    desc: '8 个对数等距浓度点的抑制率均值与标准差，S 形曲线，拐点约在 100–1000 nM 之间。',
    analysis: ['浓度对数 vs 抑制率的 S 形趋势', '拐点区间即 IC50 所在', 'SD 列看重复孔离散度'],
    columns: [col('conc', '浓度', 'number', 'nM'), col('resp', '抑制率均值', 'number', '%'), col('sd', '标准差', 'number', '%')],
    rows: [
      [0.1, 2, 1.2], [1, 5, 1.8], [10, 11, 2.4], [100, 32, 3.1],
      [1000, 58, 2.8], [10000, 79, 2.2], [100000, 91, 1.6], [1000000, 95, 1.1],
    ],
  },
  {
    id: 'anscombe',
    name: 'Anscombe 四重奏',
    category: '相关陷阱',
    capability: ['相关性', '可视化校验'],
    source: 'Anscombe (1973) 经典四重奏',
    desc: '四组统计量几乎相同（均值、方差、相关系数）但图形完全不同的数据，用来演示「先看图再下结论」。',
    analysis: ['四组 x/y 的均值与相关系数几乎一致', '但散点形态完全不同', '报表图与统计卡对照阅读'],
    columns: [
      col('x1', 'x1', 'number'), col('y1', 'y1', 'number'),
      col('x2', 'x2', 'number'), col('y2', 'y2', 'number'),
      col('x3', 'x3', 'number'), col('y3', 'y3', 'number'),
      col('x4', 'x4', 'number'), col('y4', 'y4', 'number'),
    ],
    rows: [
      [10, 8.04, 10, 9.14, 10, 7.46, 8, 6.58],
      [8, 6.95, 8, 8.14, 8, 6.77, 8, 5.76],
      [13, 7.58, 13, 8.74, 13, 12.74, 8, 7.71],
      [9, 8.81, 9, 8.77, 9, 7.11, 8, 8.84],
      [11, 8.33, 11, 9.26, 11, 7.81, 8, 8.47],
      [14, 9.96, 14, 8.1, 14, 8.84, 8, 7.04],
      [6, 7.24, 6, 6.13, 6, 6.08, 8, 5.25],
      [4, 4.26, 4, 3.1, 4, 5.39, 19, 12.5],
      [12, 10.84, 12, 9.13, 12, 8.15, 8, 5.56],
      [7, 4.82, 7, 7.26, 7, 6.42, 8, 7.91],
      [5, 5.68, 5, 4.74, 5, 5.73, 8, 6.89],
    ],
  },
  {
    id: 'growth-curve',
    name: '菌体生长曲线 · 时序',
    category: '时间序列',
    capability: ['时序曲线', '双组对照', '拐点读数'],
    source: '结构参照 Origin 时间序列曲线样例',
    desc: '24 小时内处理组与对照组的 OD600 读数，处理组进入对数期更早、平台期更高。',
    analysis: ['两组 OD 随时间的增长曲线', '对数期拐点约在 8–12h', '平台期差值即处理增益'],
    columns: [col('hour', '时间', 'number', 'h'), col('od_treat', '处理组 OD600', 'number'), col('od_ctrl', '对照组 OD600', 'number')],
    rows: [
      [0, 0.05, 0.05], [2, 0.07, 0.06], [4, 0.11, 0.09], [6, 0.19, 0.14],
      [8, 0.35, 0.22], [10, 0.62, 0.35], [12, 0.98, 0.51], [14, 1.35, 0.68],
      [16, 1.62, 0.82], [18, 1.78, 0.93], [20, 1.85, 1.01], [24, 1.9, 1.08],
    ],
  },
  {
    id: 'ab-test',
    name: '落地页 A/B 实验',
    category: 'A/B 转化',
    capability: ['转化率对照', '漏斗读数'],
    source: '互联网 A/B 实验常见口径示例',
    desc: '四个版本落地页的曝光与点击，C 版点击率最高（4.82%），可对照对照组的提升幅度。',
    analysis: ['各版本 CTR 对照', '相对对照组的提升百分比', '曝光量级是否足够'],
    columns: [
      col('variant', '版本', 'text'),
      col('impr', '曝光', 'number'),
      col('clicks', '点击', 'number'),
      col('ctr', '点击率', 'number', '%'),
    ],
    rows: [
      ['control', 12480, 486, 3.89],
      ['A', 12511, 542, 4.33],
      ['B', 12467, 511, 4.1],
      ['C', 12502, 603, 4.82],
    ],
  },
  {
    id: 'factorial',
    name: '2×2 因子设计',
    category: '因子设计',
    capability: ['交互作用', '双因素对照'],
    source: '与内置示例语料同主题的因子设计示例',
    desc: '预处理（无/冲洗）× 增强强度（低/高）两因素各两重复，看主效应与交互：冲洗后高强度增益更大。',
    analysis: ['两因素各自的均值主效应', '交叉对照看交互作用', '每格 2 个重复可看离散'],
    columns: [col('prep', '预处理', 'text'), col('strength', '强度', 'text'), col('acc', '准确率', 'number', '%')],
    rows: [
      ['无', '低', 71], ['无', '低', 74], ['无', '高', 80], ['无', '高', 82],
      ['冲洗', '低', 76], ['冲洗', '低', 78], ['冲洗', '高', 88], ['冲洗', '高', 92],
    ],
  },
]

export const CAPABILITIES = Array.from(new Set(CASES.flatMap((c) => c.capability)))

export function caseToDataset(c: ExperimentCase): Dataset {
  return {
    id: uid('ds-'),
    name: c.name,
    columns: c.columns.map((x) => ({ ...x })),
    rows: c.rows.map((r) => ({
      id: uid('row-'),
      cells: Object.fromEntries(c.columns.map((x, j) => [x.key, r[j]])),
    })),
    source: { type: 'import', ref: c.id, label: '实例库' },
    updated_at: Date.now(),
  }
}
