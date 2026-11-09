import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://127.0.0.1:5173/'
const out = process.argv[3] ?? 'shots/shell.png'
const width = Number(process.argv[4] ?? 1440)
const height = Number(process.argv[5] ?? 900)

mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: out })
console.log(`saved ${out} @ ${width}x${height}`)
await browser.close()
