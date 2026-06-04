// UI 깨짐 검증 도구 — 실 Tauri 앱(WebView2 CDP)을 띄워 주요 화면 + 그래프 ref 영역 zoom
// 스크린샷 + 콘솔 에러 캡처. CLAUDE.md § UI Breakage Definition 게이트의 캡처 단계 구현.
// (skill: desktop-app-ui-comparison-automation § UI Breakage Definition & Single-App Check)
//
// 실행: `node scripts/ui-shot.mjs`  또는  `bun run ui:check`
//   ⚠️ node 런타임 필수 — bun 은 Playwright connectOverCDP WS 핸드셰이크 timeout.
//
// 산출물: <TEMP>/gitfried-ui-check/*.png (01~04 route + 05 graph-ref zoom) + console-errors.txt
// 검증자는 각 PNG 를 vision 으로 13범주 taxonomy 대조 (empty/light state·저해상도만으로 판정 금지).
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const PORT = 9222
const OUT = join(tmpdir(), 'gitfried-ui-check')
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function fetchJson(url) {
  try {
    const r = await fetch(url)
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

const proc = spawn('node', ['scripts/tauri-rustup.mjs', 'dev'], {
  cwd: process.cwd(),
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
  stdio: 'ignore',
  shell: process.platform === 'win32',
})

function cleanup() {
  try {
    if (proc.pid) execFileSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { stdio: 'ignore' })
  } catch {}
  try {
    execFileSync('taskkill', ['/F', '/IM', 'git-fried.exe'], { stdio: 'ignore' })
  } catch {}
}

const base = `http://127.0.0.1:${PORT}`
const consoleErrors = []

try {
  // CDP page ready 대기 (빌드 ~70s 포함).
  const start = Date.now()
  let ready = false
  while (Date.now() - start < 200_000) {
    await sleep(2000)
    const list = await fetchJson(`${base}/json/list`)
    if (Array.isArray(list) && list.some((t) => t.type === 'page' && String(t.url).includes('localhost:1420'))) {
      ready = true
      break
    }
  }
  if (!ready) throw new Error('CDP page not ready')
  await sleep(3000) // browser ws 안정화 settle

  let browser
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      browser = await chromium.connectOverCDP(base, { timeout: 20_000 })
      break
    } catch (e) {
      console.error(`connectOverCDP 시도 ${attempt} 실패: ${e.message}`)
      if (attempt === 3) throw e
      await sleep(3000)
    }
  }
  const ctx = browser.contexts()[0]
  let page = ctx.pages().find((p) => p.url().includes('localhost:1420')) ?? ctx.pages()[0]

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[console.error] ${m.text()}`)
  })
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`))

  const routes = [
    ['01-index', 'http://localhost:1420/'],
    ['02-repositories', 'http://localhost:1420/repositories'],
    ['03-settings', 'http://localhost:1420/settings'],
    ['04-launchpad', 'http://localhost:1420/launchpad'],
  ]
  for (const [name, url] of routes) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 })
    } catch {
      await page.goto(url, { timeout: 20_000 }).catch(() => {})
    }
    await sleep(1500) // 렌더 안정화
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false })
    console.log(`shot: ${name} (url=${page.url()})`)
    // index 그래프 ref 컬럼 zoom (BRANCH/TAG 라벨 겹침 확인).
    if (name === '01-index') {
      await page
        .screenshot({ path: join(OUT, '05-graph-refs-zoom.png'), clip: { x: 222, y: 150, width: 460, height: 420 } })
        .catch(() => {})
      console.log('shot: 05-graph-refs-zoom (clip)')
    }
  }

  writeFileSync(join(OUT, 'console-errors.txt'), consoleErrors.join('\n') || '(no console errors)')
  await browser.close().catch(() => {})
  console.log(`OUTDIR=${OUT}`)
  console.log(`CONSOLE_ERRORS=${consoleErrors.length}`)
} catch (e) {
  console.error('FAIL:', e.message)
} finally {
  cleanup()
}
