import { chromium } from 'playwright-core'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const url = 'http://127.0.0.1:5173/'
const outDir = 'shots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

const step = async (name, fn) => {
  await fn()
  await page.screenshot({ path: `${outDir}/e2e-${name}.png` })
  console.log(`[${name}] ok`)
}

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// 1. 提问（体验模式，本地检索）
await step('1-answer', async () => {
  const composer = page.getByPlaceholder('问点具体的：这几篇在预处理上的差异是什么')
  await composer.click()
  await composer.fill('增强强度和域偏移之间是什么关系？')
  await page.getByRole('button', { name: '提问', exact: true }).click()
  await page.waitForTimeout(4500)
})

// 2. 点角标 → 证据栏高亮
await step('2-citation', async () => {
  await page.locator('.cite').first().click()
  await page.waitForTimeout(600)
})

// 3. 带着答案去建表
await step('3-build-table', async () => {
  await page.getByRole('button', { name: '带着答案去建表' }).first().click()
  await page.waitForTimeout(1200)
})

// 4. 切到报表视图
await step('4-report', async () => {
  const reportBtn = page.getByRole('button', { name: '报表' }).last()
  await reportBtn.click()
  await page.waitForTimeout(1500)
})

// 5. 导出报表（选 XLSX + 导出后邮件发送）
let downloaded = null
await step('5-export-dialog', async () => {
  await page.getByRole('button', { name: '导出报表' }).last().click()
  await page.waitForTimeout(400)
})

await step('6-mail-drawer', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByRole('button', { name: /导出 XLSX/ }).click(),
  ])
  downloaded = await download.path()
  await page.waitForTimeout(1200)
})

// 6.5 补齐收件人与变量
await step('6b-vars', async () => {
  const mailInput = page.getByPlaceholder('导师邮箱，回车添加')
  await mailInput.click()
  await mailInput.fill('mentor@university.edu')
  await mailInput.press('Enter')
  await page.waitForTimeout(300)
  const chip = page.getByRole('button', { name: /导师姓名|周老师/ }).first()
  await chip.click()
  await page.waitForTimeout(200)
  const varInput = page.getByPlaceholder('导师姓名')
  await varInput.fill('周老师')
  await varInput.press('Enter')
  await page.waitForTimeout(400)
})

// 7. 发送
await step('7-sent', async () => {
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.waitForTimeout(1800)
})

// 8. 历史与流水线
await step('8-history', async () => {
  await page.getByRole('button', { name: /发/ }).first().click().catch(() => {})
  await page.waitForTimeout(600)
})

console.log('download file:', downloaded)
if (downloaded && existsSync(downloaded)) {
  const wb = XLSX.read(readFileSync(downloaded), { type: 'buffer' })
  const name = wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })
  console.log('sheet:', name, 'rows:', rows.length)
  console.log(JSON.stringify(rows.slice(0, 4)))
  const types = rows.slice(1, 4).map((r) => typeof r[1])
  console.log('value cell types:', types.join(','))
}

console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
