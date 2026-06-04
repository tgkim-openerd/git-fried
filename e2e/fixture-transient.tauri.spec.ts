// 작은 UI/UX transient 상태(loading 잔존 / empty) 를 fault/delay 주입으로 결정론 검증하는 e2e.
// invokeWithTimeout 의 DEV-only fault hook(localStorage 'git-fried.test-fault') 활용.
//
// 실행: npx playwright test --config playwright.tauri.config.ts fixture-transient

import { test, expect, chromium, type Browser, type Page } from '@playwright/test'
import { launchTauriWithCdp, type TauriCdpHandle } from './helpers/tauri-cdp'
import { seedFixtureAndOpenRepo, clearFault } from './helpers/tauri-fixture'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let handle: TauriCdpHandle
let browser: Browser
let page: Page
let tmpRoot: string

test.describe('fixture transient 상태 e2e (loading/empty via fault 주입)', () => {
  test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gitfried-tr-'))
    handle = await launchTauriWithCdp(9226, 200_000, { GIT_FRIED_DB_PATH: join(tmpRoot, 'test-db.sqlite') })
    browser = await chromium.connectOverCDP(handle.cdpUrl)
    const ctx = browser.contexts()[0]
    page = ctx.pages().find((p) => p.url().includes('localhost:1420')) ?? ctx.pages()[0]
    await page.waitForFunction(
      () => typeof (window as unknown as { __gitfriedTestInvoke?: unknown }).__gitfriedTestInvoke === 'function',
      undefined,
      { timeout: 20_000 },
    )
  })

  test.afterAll(async () => {
    await browser?.close().catch(() => {})
    handle?.close()
    for (let i = 0; i < 4; i++) {
      try {
        rmSync(tmpRoot, { recursive: true, force: true })
        break
      } catch {
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  })

  test('loading → content 잔존 검출 (get_graph delay 주입)', async () => {
    // get_graph 3s 지연 주입 → 그래프 skeleton 노출 → resolve 후 skeleton 사라지고 content.
    await seedFixtureAndOpenRepo(page, 'basic', tmpRoot, 'tr-loading', 'graph', { get_graph: { delayMs: 3000 } })

    const skeleton = page.locator('[data-testid="commit-graph-skeleton"]')
    // 지연 동안 skeleton visible (isFetching && rows===0).
    await expect(skeleton).toBeVisible({ timeout: 4_000 })
    // resolve 후 skeleton 사라짐(잔존 없음) + commit content 노출.
    await expect(skeleton).toBeHidden({ timeout: 8_000 })
    await expect(page.locator('body')).toContainText('feat: C', { timeout: 4_000 })

    await clearFault(page)
  })

  test('empty repo → 그래프 empty state 렌더 (skeleton 잔존 없음)', async () => {
    await seedFixtureAndOpenRepo(page, 'empty', tmpRoot, 'tr-empty', 'graph')

    // 커밋 0(unborn HEAD) → get_graph 빈 rows → EmptyState.
    await expect(page.locator('body')).toContainText('커밋이 없습니다', { timeout: 10_000 })
    // 로딩 완료 후 skeleton 잔존 없음.
    await expect(page.locator('[data-testid="commit-graph-skeleton"]')).toBeHidden({ timeout: 4_000 })
  })
})
