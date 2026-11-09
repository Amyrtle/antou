import { chromium } from 'playwright-core'

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)

const crumb = async () => (await page.locator('nav[aria-label="面包屑"]').innerText()).replace(/\s+/g, ' ')
console.log('crumb@library:', await crumb())

for (const [key, expect] of [
  ['2', '数据表'],
  ['4', '邮件'],
  ['5', '历史'],
]) {
  await page.keyboard.press(`Alt+${key}`)
  await page.waitForTimeout(120)
  const text = await crumb()
  console.log(`Alt+${key} ->`, text, text.includes(expect) ? 'OK' : 'FAIL')
}

await page.screenshot({ path: 'shots/step2-section-history.png' })

// 检查器收起/展开
const toggle = page.locator('button[aria-label="收起检查器"], button[aria-label="展开检查器"]').first()
await toggle.click()
await page.waitForTimeout(150)
console.log('inspector visible after toggle:', await page.locator('aside:has-text("工作区")').count() > 0)

// 无障碍：所有图标按钮都有可读名称
const unnamed = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).filter((b) => !b.textContent?.trim() && !b.getAttribute('aria-label')).length,
)
console.log('buttons without name:', unnamed)
console.log('console errors:', errors.length ? errors : 'none')

await browser.close()
