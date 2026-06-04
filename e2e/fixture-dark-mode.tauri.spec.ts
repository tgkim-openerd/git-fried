// 다크모드 시각 회귀 — fixture 를 dark 테마로 열어 전 main-nav 탭 domSmoke (CLAUDE.md UI 깨짐 cat 7
// "테마 부분 적용/대비"). git-fried.theme='dark' localStorage 토글 → root .dark 클래스 → 재렌더.
//
// 실행: npx playwright test --config playwright.tauri.config.ts fixture-dark-mode

import { test, expect, chromium, type Browser, type Page } from '@playwright/test'
import { launchTauriWithCdp, type TauriCdpHandle } from './helpers/tauri-cdp'
import { seedFixtureAndOpenRepo, domSmoke } from './helpers/tauri-fixture'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let handle: TauriCdpHandle
let browser: Browser
let page: Page
let tmpRoot: string

test.describe('fixture 다크모드 시각 sweep (CDP)', () => {
  test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gitfried-dark-'))
    handle = await launchTauriWithCdp(9228, 200_000, { GIT_FRIED_DB_PATH: join(tmpRoot, 'test-db.sqlite') })
    browser = await chromium.connectOverCDP(handle.cdpUrl)
    const ctx = browser.contexts()[0]
    page = ctx.pages().find((p) => p.url().includes('localhost:1420')) ?? ctx.pages()[0]
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

  test('dark 테마 전 main-nav 탭 시각 sweep (wrap/overflow 0)', async () => {
    // theme 설정 → seedFixtureAndOpenRepo 의 reload 가 dark 로 부팅 (helper 는 theme 키 미변경).
    await page.evaluate(() => localStorage.setItem('git-fried.theme', 'dark'))
    await seedFixtureAndOpenRepo(page, 'manybranches', tmpRoot, 'dark-repo', 'graph')

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark, 'dark 클래스 미적용 — 테마 토글 실패').toBe(true)

    const tabs = ['graph', 'branches', 'stash', 'worktree'] as const
    for (const tab of tabs) {
      await page.locator(`[data-testid="main-nav-${tab}"]`).click({ timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(500)
      const smoke = await domSmoke(page)
      expect(smoke.wrapped, `[dark/${tab}] wrapped: ${smoke.wrapped.join(', ')}`).toEqual([])
      expect(smoke.rootOverflow, `[dark/${tab}] root overflow`).toBe(false)
    }

    // 원복 (다른 spec 영향 회피).
    await page.evaluate(() => localStorage.setItem('git-fried.theme', 'light'))
  })
})
