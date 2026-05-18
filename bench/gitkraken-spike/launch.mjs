// GitKraken 12.1.1 Playwright Electron spike (2026-05-18, Sprint c95+)
//
// 목적: Claude 가 GitKraken Desktop 의 DOM 에 access 해서 git-fried sidebar 와
// 자동 비교 가능한지 5분 spike 검증.
//
// 검증 항목:
//   1. _electron.launch() 가 정상 spawn 하는지 (라이선스/login screen 차단 여부)
//   2. firstWindow() 가 BrowserWindow 반환하는지 (multi-window 시 어떤 게 첫 번째인지)
//   3. screenshot 캡처 가능 (ASAR + GPU 가속 환경)
//   4. DOM evaluate / locator 동작 (contextIsolation 우회 여부)
//   5. sidebar [data-testid] 또는 class selector 식별 가능 여부
//
// 안전:
//   - 30s timeout (자동화 hang 회피)
//   - 사용자 GitKraken 인스턴스 죽지 않도록 별도 process spawn (--new-window 가능하면)
//   - 본 spike 는 read-only — 어떤 git operation 도 실행 안 함

import { _electron as electron } from 'playwright'
import { setTimeout as sleep } from 'timers/promises'
import { mkdir } from 'fs/promises'
import path from 'path'

const GITKRAKEN_PATH = 'C:\\Users\\tgkim\\AppData\\Local\\gitkraken\\app-12.1.1\\gitkraken.exe'
const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'ux-eval', 'screenshots')
const SPIKE_TIMEOUT_MS = 60_000 // 1 min hard cap

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true })

  const results = {
    launched: false,
    firstWindowFound: false,
    screenshotSaved: null,
    titleAccessible: false,
    title: null,
    urlAccessible: false,
    url: null,
    domEvaluateWorks: false,
    domEvalResult: null,
    sidebarSelectors: {},
    error: null,
  }

  console.log('[1/6] _electron.launch() 시도...')
  const launchStart = Date.now()
  let app
  try {
    app = await electron.launch({
      executablePath: GITKRAKEN_PATH,
      timeout: 30_000,
      // GitKraken 이 별도 인스턴스 단일화하는지 검증 — --new-window 시도
      args: ['--no-sandbox'], // ASAR 보안 우회 시도 (필요 시 추가)
    })
    results.launched = true
    console.log(`  launched in ${Date.now() - launchStart}ms`)
  } catch (e) {
    results.error = `launch failed: ${e.message}`
    console.error('  FAIL:', e.message)
    return results
  }

  console.log('[2/6] firstWindow() 대기...')
  let win
  try {
    win = await Promise.race([
      app.firstWindow(),
      sleep(20_000).then(() => null),
    ])
    if (!win) {
      results.error = 'firstWindow timeout (20s)'
      await app.close()
      return results
    }
    results.firstWindowFound = true
    console.log('  found')
  } catch (e) {
    results.error = `firstWindow failed: ${e.message}`
    await app.close()
    return results
  }

  // sidebar 렌더링 대기 (license screen 일 수도, main UI 일 수도)
  console.log('[3/6] 5초 대기 (UI 렌더링)...')
  await sleep(5_000)

  console.log('[4/6] title / url 확인...')
  try {
    results.title = await win.title()
    results.titleAccessible = true
    console.log('  title:', results.title)
  } catch (e) {
    console.log('  title 접근 실패:', e.message)
  }
  try {
    results.url = win.url()
    results.urlAccessible = true
    console.log('  url:', results.url)
  } catch (e) {
    console.log('  url 접근 실패:', e.message)
  }

  console.log('[5/6] screenshot 캡처...')
  const screenshotPath = path.join(
    SCREENSHOT_DIR,
    `gitkraken-spike-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
  )
  try {
    await win.screenshot({ path: screenshotPath, fullPage: false })
    results.screenshotSaved = screenshotPath
    console.log('  saved:', screenshotPath)
  } catch (e) {
    console.log('  screenshot 실패:', e.message)
  }

  console.log('[6/6] DOM evaluate / sidebar selector 시도...')
  try {
    const docInfo = await win.evaluate(() => ({
      docTitle: document.title,
      bodyClasses: document.body?.className ?? null,
      childCount: document.body?.children?.length ?? 0,
      hasReact: typeof window.React !== 'undefined' || !!document.querySelector('[data-reactroot]'),
    }))
    results.domEvaluateWorks = true
    results.domEvalResult = docInfo
    console.log('  doc info:', JSON.stringify(docInfo))
  } catch (e) {
    console.log('  evaluate 실패 (contextIsolation 가능성):', e.message)
  }

  // sidebar 후보 selector enumerate
  const selectorCandidates = [
    '[data-testid="left-panel"]',
    '[data-test="left-panel"]',
    'aside.left-panel',
    'aside.sidebar',
    '.left-panel',
    '.app-sidebar',
    'nav.sidebar',
    '[class*="LeftPanel"]',
    '[class*="Sidebar"]',
    '[role="navigation"]',
  ]
  for (const sel of selectorCandidates) {
    try {
      const count = await win.locator(sel).count()
      if (count > 0) {
        results.sidebarSelectors[sel] = count
        console.log(`  ✓ ${sel} → ${count}`)
      }
    } catch {
      // ignore
    }
  }

  await app.close()
  return results
}

const result = await Promise.race([
  main(),
  sleep(SPIKE_TIMEOUT_MS).then(() => ({ error: `hard timeout ${SPIKE_TIMEOUT_MS}ms` })),
])

console.log('\n=== Spike 결과 ===')
console.log(JSON.stringify(result, null, 2))
process.exit(result.error ? 1 : 0)
