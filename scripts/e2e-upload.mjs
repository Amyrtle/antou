import { chromium } from 'playwright-core'

const browser = await chromium.launch({ channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const paperCount = async () =>
  (await page.locator('text=/^\\d+ 篇$/').first().innerText().catch(() => '?')).trim()

console.log('初始文献数:', await paperCount())

// 上传 3 个 PDF
await page.locator('input[type=file]').setInputFiles([
  'fixtures/sample-a.pdf',
  'fixtures/sample-b.pdf',
  'fixtures/sample-c.pdf',
])
await page.waitForTimeout(6000)
console.log('上传后文献数:', await paperCount())
await page.screenshot({ path: 'shots/e2e-upload.png' })

// 用新上传的文献提问
const composer = page.getByPlaceholder('问点具体的：这几篇在预处理上的差异是什么')
await composer.click()
await composer.fill('增强强度与域偏移的拐点在哪里？')
await page.getByRole('button', { name: '提问', exact: true }).click()
await page.waitForTimeout(5000)
const answer = await page.locator('.seg-quote').first().innerText().catch(() => '')
console.log('命中首条原文:', answer.slice(0, 60).replace(/\s+/g, ' '))
await page.screenshot({ path: 'shots/e2e-upload-answer.png' })

// 刷新后窗口位置还原
const before = await page.locator('section[aria-label]').first().evaluate((el) => {
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
const after = await page.locator('section[aria-label]').first().evaluate((el) => {
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }
})
console.log('刷新前窗口:', before, '刷新后:', after)

// 窄屏
await page.setViewportSize({ width: 1280, height: 800 })
await page.waitForTimeout(800)
await page.screenshot({ path: 'shots/e2e-1280.png' })
await page.setViewportSize({ width: 900, height: 760 })
await page.waitForTimeout(800)
await page.screenshot({ path: 'shots/e2e-900.png' })

console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none')
await browser.close()
