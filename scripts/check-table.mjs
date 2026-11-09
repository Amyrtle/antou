/**
 * 表格 / 报表回归：v0.3.1 修的六处问题，逐条打一遍。
 *
 *   node scripts/check-table.mjs                      # 默认 http://127.0.0.1:5173/
 *   node scripts/check-table.mjs http://127.0.0.1:8000/
 *
 * 用本机 Edge（channel: msedge），不下载浏览器。
 */
import { chromium } from 'playwright-core'

const base = (process.argv[2] || 'http://127.0.0.1:5173/').replace(/\/$/, '') + '/'
const results = []

const check = (name, cond, detail = '') => {
  results.push([Boolean(cond), name, detail])
  console.log(`${cond ? 'PASS  ' : 'FAIL  '}${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ channel: 'msedge' })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
})
const page = await context.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

const btn = (re) => page.locator('button', { hasText: re }).first()
const readReports = () =>
  page.evaluate(() => {
    const raw = localStorage.getItem('antou.data')
    if (!raw) return []
    return JSON.parse(raw).state.reports ?? []
  })

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// 1. 数值列输非数字
const cell = page.locator('tbody tr').first().locator('td').nth(1)
await cell.dblclick()
await page.keyboard.type('abc')
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
check('数值列输非数字不落 NaN', (await cell.innerText()).trim() === '—', (await cell.innerText()).trim())
check('表底给出提示', (await page.evaluate(() => document.body.innerText)).includes('只收数字'))

// 2. 改数据后报表跟着变
await cell.dblclick()
await page.keyboard.type('12345')
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
await btn(/^报表$/).click()
await page.waitForTimeout(1800)
const hasNewValue = await page.evaluate(() => document.body.innerText.includes('12345'))
check('改完数据切到报表能看到新值', hasNewValue)

// 3. 导出记录不被重新生成清掉
await btn(/导出报表/).click()
await page.waitForTimeout(400)
const downloading = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
await btn(/^导出 XLSX$/).click()
const download = await downloading
await page.waitForTimeout(700)
const exportsBefore = (await readReports()).find((r) => r.exports?.length)?.exports.length ?? 0
await btn(/^表格$/).click()
await page.waitForTimeout(400)
await btn(/^报表$/).click()
await page.waitForTimeout(1400)
const exportsAfter = (await readReports())[0]?.exports?.length ?? 0
check(
  '重新生成不清掉导出记录',
  exportsBefore >= 1 && exportsAfter >= exportsBefore,
  `导出 ${exportsBefore} 条 → ${exportsAfter} 条；文件名 ${download ? download.suggestedFilename() : '无'}`,
)

// 4. 删除选中行
await btn(/^表格$/).click()
await page.waitForTimeout(500)
const rowsBefore = await page.locator('tbody tr').count()
await page.locator('tbody tr').nth(1).locator('td').nth(0).click()
await page.waitForTimeout(200)
await btn(/^编辑$/).click()
await page.waitForTimeout(300)
await page.locator('button', { hasText: '删除选中行' }).click()
await page.waitForTimeout(600)
const rowsAfter = await page.locator('tbody tr').count()
check('删除选中行真的删掉', rowsAfter === rowsBefore - 1, `${rowsBefore} → ${rowsAfter}`)

// 5. 冻结首列
const frozen = () =>
  page.evaluate(() => getComputedStyle(document.querySelectorAll('thead th')[0]).position)
check('首列默认冻结', (await frozen()) === 'sticky', await frozen())
await btn(/^编辑$/).click()
await page.waitForTimeout(250)
await page.locator('button', { hasText: '冻结首列' }).click()
await page.waitForTimeout(450)
check('再点一次取消冻结', (await frozen()) === 'static', await frozen())
await btn(/^编辑$/).click()
await page.waitForTimeout(250)
await page.locator('button', { hasText: '冻结首列' }).click()
await page.waitForTimeout(300)

check('控制台零报错', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()

const failed = results.filter((r) => !r[0])
console.log(`\n通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`)
if (failed.length) process.exit(1)
