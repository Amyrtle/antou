import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const url = 'http://127.0.0.1:5173/'
const outDir = 'shots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

const step = async (name, fn) => {
  await fn()
  await page.screenshot({ path: `${outDir}/cases-${name}.png` })
  console.log(`[${name}] ok`)
}

const stageBtn = (i) => page.locator('aside button[aria-pressed]').nth(i)

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// 1. 写阶段 → 打开实例库
await step('1-open', async () => {
  await stageBtn(1).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '实例库' }).click()
  await page.waitForTimeout(700)
  await page.getByText('内置案例', { exact: true }).waitFor({ timeout: 4000 })
})

// 2. 能力筛选
await step('2-filter', async () => {
  await page.getByRole('button', { name: '相关性', exact: true }).click()
  await page.waitForTimeout(300)
  const cards = await page.locator('article').count()
  console.log(`  筛选「相关性」后案例数：${cards}`)
  if (cards !== 2) throw new Error(`期望 2 个案例，实际 ${cards}`)
  await page.getByRole('button', { name: '全部', exact: true }).click()
  await page.waitForTimeout(300)
})

// 3. 数据预览（含表格数据）
await step('3-preview', async () => {
  await page.getByRole('button', { name: '数据预览' }).first().click()
  await page.waitForTimeout(400)
  await page.getByRole('cell', { name: '4.17', exact: true }).first().waitFor({ timeout: 3000 })
})

// 4. 抄入表格 → 生成数据表 + 报表
await step('4-import', async () => {
  await page.getByRole('button', { name: '抄入表格' }).first().click()
  await page.waitForTimeout(1400)
  await page.getByText('植物生长 · 三组对照').first().waitFor({ timeout: 4000 })
  await page.getByRole('columnheader', { name: /干重/ }).first().waitFor({ timeout: 4000 })
  const rows = await page.getByRole('row').count()
  console.log(`  数据表窗口行数（含表头）：${rows}`)
})

// 5. 联网检索（DataCite 数据集）
await step('5-online', async () => {
  await page.getByRole('button', { name: '联网检索' }).click()
  await page.waitForTimeout(300)
  await page.getByLabel('联网检索关键词').fill('soil moisture')
  await page.getByRole('button', { name: '检索', exact: true }).click()
  await page
    .waitForSelector('text=/doi:|检索服务返回|网络受限/', { timeout: 25000 })
    .catch(() => console.log('  联网检索未返回结果'))
  await page.waitForTimeout(600)
  const hits = await page.getByRole('button', { name: /登记为文献|已登记/ }).count()
  console.log(`  命中条数：${hits}`)
})

// 6. 登记为文献
await step('6-register', async () => {
  const btn = page.getByRole('button', { name: '登记为文献' }).first()
  if (await btn.count()) {
    await btn.click()
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: '已登记' }).first().waitFor({ timeout: 3000 })
  } else {
    console.log('  无可登记结果，跳过')
  }
})

// 7. 回到读阶段：登记的条目进文献库
await step('7-library', async () => {
  await stageBtn(0).click()
  await page.waitForTimeout(600)
  const tag = await page.getByText('联网参考').count()
  console.log(`  文献库中「联网参考」标签数：${tag}`)
})

// 8. 命令面板直达案例
await step('8-palette', async () => {
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(400)
  await page.keyboard.type('因子')
  await page.waitForTimeout(500)
  await page.getByText('2×2 因子设计').first().waitFor({ timeout: 3000 })
  await page.screenshot({ path: `${outDir}/cases-8-palette-open.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
