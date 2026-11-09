import { spawn, spawnSync } from 'node:child_process'

const run = (label, cmd, args) => {
  console.log(`\n=== ${label} ===`)
  const r =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', [cmd, ...args].join(' ')], { stdio: 'inherit' })
      : spawnSync(cmd, args, { stdio: 'inherit' })
  return r.status === 0
}

console.log('=== antou verify ===')

if (!run('1/4 构建（tsc + vite）', 'npm', ['run', 'build'])) {
  console.error('\n✗ 构建失败，终止')
  process.exit(1)
}

const server = spawn('node', ['node_modules/vite/bin/vite.js'], {
  stdio: ['ignore', 'pipe', 'inherit'],
})
server.stdout.on('data', (d) => process.stdout.write(d))

let up = false
for (let i = 0; i < 80 && !up; i++) {
  try {
    const res = await fetch('http://127.0.0.1:5173/')
    up = res.ok
  } catch {
    /* server not ready yet */
  }
  if (!up) await new Promise((r) => setTimeout(r, 250))
}

if (!up) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(server.pid)], { stdio: 'ignore' })
  else server.kill()
  console.error('\n✗ dev server 未能启动')
  process.exit(1)
}

let ok = true
try {
  ok = run('2/4 主流程回归 e2e', 'node', ['scripts/e2e.mjs']) && ok
  ok = run('3/4 实例库回归 e2e-cases', 'node', ['scripts/e2e-cases.mjs']) && ok
} finally {
  if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(server.pid)], { stdio: 'ignore' })
  else server.kill()
}

if (!ok) {
  console.error('\n✗ verify 未通过')
  process.exit(1)
}
console.log('\n✓ verify 全部通过（构建 + 主流程 + 实例库）')
