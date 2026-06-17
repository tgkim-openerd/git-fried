// 전수 UI 깨짐 sweep — 실 Tauri 앱(WebView2 CDP)을 띄워 모든 surface(라우트 + settings 전
// 서브탭 + 그래프 전 탭)를 순회하며 (1) DOM geometry smoke 자동검출 (2) 전체 스크린샷 +
// (3) 콘솔 에러 수집. CLAUDE.md § UI Breakage Definition 게이트의 "자동 smoke + 캡처" 단계.
//
// 실행: `node scripts/ui-sweep.mjs`  (node 런타임 필수 — bun connectOverCDP WS timeout)
// 산출물: <TEMP>/gitfried-ui-sweep/*.png + report.json (surface 별 smoke 결과)
//
// DOM smoke 는 "의심 후보 추출"용 — 최종 판정은 PNG vision 으로 13범주 대조. graph/canvas/SVG
// 내부는 DOM box 로 못 잡으니 vision 보완 필수.

import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const PORT = 9222
const RENDER_SETTLE_MS = 900 // QUAL-010: surface 캡처 전 렌더 안정화 대기 (named const)
const OUT = join(tmpdir(), 'gitfried-ui-sweep')
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

// ── DOM geometry smoke (page context) — overflow/wrap/offscreen 후보 ──
const DOM_SMOKE = () => {
  const tol = 2
  const out = { rootOverflow: false, wrapped: [], clipped: [], offscreen: [], nestedInteractive: [] }
  const de = document.documentElement
  out.rootOverflow =
    de.scrollWidth > de.clientWidth + tol || document.body.scrollWidth > de.clientWidth + tol
  const vis = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const label = (el) =>
    (el.tagName.toLowerCase() + '.' + (el.className?.toString().slice(0, 60) || '')).slice(0, 80)
  // 단일행 기대 요소 wrap
  const single = 'button,[class*=pill],[class*=chip],[class*=tag],[class*=label],[class*=badge],[role=tab],[role=menuitem],th'
  for (const el of document.querySelectorAll(single)) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (cs.whiteSpace === 'normal' && el.getClientRects().length > 1 && (el.textContent || '').trim()) {
      out.wrapped.push(label(el))
    }
  }
  // overflow(clip 된 텍스트성)
  for (const el of document.querySelectorAll('*')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (
      (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflow === 'clip') &&
      el.scrollWidth > el.clientWidth + tol &&
      (el.textContent || '').trim() &&
      el.children.length <= 3
    ) {
      out.clipped.push(label(el))
    }
  }
  // viewport 밖 clickable
  const vw = de.clientWidth,
    vh = de.clientHeight
  for (const el of document.querySelectorAll('button,a,[role=button],[role=tab],input,select')) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right < -tol || r.bottom < -tol || r.left > vw + tol || r.top > vh + tol) {
      out.offscreen.push(label(el))
    }
  }
  // nested-interactive (ARIA 부적절 + 키보드 트랩 위험): 상호작용 요소 안의 상호작용 요소.
  // 예: `<li role="button" tabindex="0">` 안의 `<button>` (행 클릭 + 내부 액션 버튼 패턴).
  // CDX-003: native form controls(input/select/textarea) + summary + contenteditable 도 상호작용 — 검출 대상 포함.
  const INTER =
    'button,a[href],input,select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=link],[contenteditable]:not([contenteditable="false"])'
  const INTER_ANC = INTER + ',[tabindex="0"]'
  for (const el of document.querySelectorAll(INTER)) {
    if (!vis(el)) continue
    const anc = el.parentElement && el.parentElement.closest(INTER_ANC)
    if (anc) out.nestedInteractive.push(label(el) + ' ⊂ ' + label(anc))
  }
  const uniq = (a) => [...new Set(a)]
  out.wrapped = uniq(out.wrapped)
  out.clipped = uniq(out.clipped).slice(0, 25)
  out.offscreen = uniq(out.offscreen)
  out.nestedInteractive = uniq(out.nestedInteractive).slice(0, 25)
  return out
}

const report = []
const consoleErrors = []

async function capture(page, name) {
  await sleep(RENDER_SETTLE_MS) // 렌더 안정화
  const smoke = await page.evaluate(DOM_SMOKE).catch((e) => ({ error: String(e) }))
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file }).catch(() => {})
  const flagged =
    (smoke.rootOverflow ? 1 : 0) +
    (smoke.wrapped?.length || 0) +
    (smoke.clipped?.length || 0) +
    (smoke.offscreen?.length || 0)
  const nested = smoke.nestedInteractive?.length || 0
  report.push({ name, url: page.url(), smoke, flagged, nested })
  // CDX-002: nested-interactive 만 있는 surface 도 ✓ 가 아니라 ⚠ 로 표시 (silently ✓ 방지).
  console.log(
    `  ${flagged || nested ? '⚠' : '✓'} ${name} (rootOverflow=${smoke.rootOverflow} wrap=${smoke.wrapped?.length || 0} clip=${smoke.clipped?.length || 0} off=${smoke.offscreen?.length || 0}${nested ? ` nested-interactive=${nested}` : ''})`,
  )
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

try {
  const base = `http://127.0.0.1:${PORT}`
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
  await sleep(3000)
  let browser
  for (let a = 1; a <= 3; a++) {
    try {
      browser = await chromium.connectOverCDP(base, { timeout: 20_000 })
      break
    } catch (e) {
      if (a === 3) throw e
      await sleep(3000)
    }
  }
  const ctx = browser.contexts()[0]
  const page = ctx.pages().find((p) => p.url().includes('localhost:1420')) ?? ctx.pages()[0]
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  page.on('pageerror', (e) => consoleErrors.push('[pageerror] ' + e.message))

  const goto = async (url) => {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 })
    } catch {
      await page.goto(url, { timeout: 20_000 }).catch(() => {})
    }
  }

  // ── 1. 라우트 ──
  console.log('[routes]')
  await goto('http://localhost:1420/')
  await capture(page, 'route-01-index')
  await goto('http://localhost:1420/repositories')
  await capture(page, 'route-02-repositories')
  await goto('http://localhost:1420/launchpad')
  await capture(page, 'route-03-launchpad')

  // ── 2. settings 전 서브탭 ──
  console.log('[settings sub-tabs]')
  await goto('http://localhost:1420/settings')
  await capture(page, 'route-04-settings')
  const catIds = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="settings-category-"]')].map((b) => ({
      id: b.getAttribute('data-testid'),
      disabled: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
      text: (b.textContent || '').trim().slice(0, 20),
    })),
  )
  console.log(`  settings categories: ${catIds.length}`)
  for (const [i, c] of catIds.entries()) {
    if (c.disabled) {
      console.log(`  - skip(disabled) ${c.text}`)
      continue
    }
    await page.click(`[data-testid="${c.id}"]`).catch(() => {})
    await capture(page, `settings-${String(i).padStart(2, '0')}-${c.id.replace('settings-category-', '')}`)
  }

  // ── 3. 그래프 우측 탭 (index) ──
  console.log('[index main-nav tabs]')
  await goto('http://localhost:1420/')
  const tabIds = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="main-nav-"]')].map((b) => b.getAttribute('data-testid')),
  )
  console.log(`  main-nav tabs: ${tabIds.length}`)
  for (const [i, id] of tabIds.entries()) {
    await page.click(`[data-testid="${id}"]`).catch(() => {})
    await capture(page, `maintab-${String(i).padStart(2, '0')}-${id.replace('main-nav-', '')}`)
  }

  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ report, consoleErrors }, null, 2))
  await browser.close().catch(() => {})
  const flaggedSurfaces = report.filter((r) => r.flagged > 0)
  // CDX-002: nested-interactive surface 를 별도 라인으로 surface (visual flagged 와 분리 유지하되 가시화).
  const nestedSurfaces = report.filter((r) => (r.nested || 0) > 0)
  console.log(`\nOUTDIR=${OUT}`)
  console.log(
    `SURFACES=${report.length} FLAGGED=${flaggedSurfaces.length} NESTED_INTERACTIVE=${nestedSurfaces.length} CONSOLE_ERRORS=${consoleErrors.length}`,
  )
  console.log('FLAGGED:', flaggedSurfaces.map((r) => r.name).join(', ') || '(none)')
  console.log('NESTED-INTERACTIVE:', nestedSurfaces.map((r) => `${r.name}(${r.nested})`).join(', ') || '(none)')
} catch (e) {
  console.error('FAIL:', e.message)
} finally {
  cleanup()
}
