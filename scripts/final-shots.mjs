import { chromium } from 'playwright-core'

const browser = await chromium.launch({ channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await context.newPage()
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)

await page.screenshot({ path: 'shots/final-1-overview.png' })

await page.keyboard.press('Control+k')
await page.waitForTimeout(400)
await page.keyboard.type('增强')
await page.waitForTimeout(600)
await page.screenshot({ path: 'shots/final-2-command.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

await page.getByRole('button', { name: '报表视图' }).last().click()
await page.waitForTimeout(2200)
await page.screenshot({ path: 'shots/final-3-report.png' })
await page.getByRole('button', { name: '表格视图' }).last().click()
await page.waitForTimeout(600)

const composer = page.getByPlaceholder('问点具体的：这几篇在预处理上的差异是什么')
await composer.click()
await composer.fill('增强强度和域偏移之间是什么关系？')
await page.getByRole('button', { name: '提问', exact: true }).click()
await page.waitForTimeout(5000)
await page.locator('.cite').last().click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'shots/final-4-answer.png' })

await page.getByRole('button', { name: '带着答案去建表' }).first().click()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shots/final-5-build-table.png' })

await page.getByRole('button', { name: '导出报表' }).last().click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'shots/final-6-export.png' })
await page.getByRole('button', { name: /导出 XLSX/ }).click()
await page.waitForTimeout(1800)
await page.screenshot({ path: 'shots/final-7-mail.png' })

await page.setViewportSize({ width: 900, height: 760 })
await page.waitForTimeout(900)
await page.screenshot({ path: 'shots/final-8-narrow.png' })

console.log('final shots done')
await browser.close()
