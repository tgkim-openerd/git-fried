// 결정론 시각 sweep — 격리 DB + fixture 데이터로 전 main-nav 탭 + settings 카테고리를 순회하며
// DOM geometry smoke(wrap/overflow/offscreen)로 시각 깨짐을 검증한다(로드맵 Step 3+4).
// ui-sweep.mjs(실 DB, 비결정론)와 달리 known fixture 상태라 회귀 가드로 적합.
//
// 실행: npx playwright test --config playwright.tauri.config.ts fixture-visual-sweep

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

test.describe('fixture 시각 sweep e2e (전 surface domSmoke via CDP)', () => {
  test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gitfried-sweep-'))
    handle = await launchTauriWithCdp(9227, 200_000, { GIT_FRIED_DB_PATH: join(tmpRoot, 'test-db.sqlite') })
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

  test('main-nav 전 탭 시각 sweep (dense manybranches fixture)', async () => {
    await seedFixtureAndOpenRepo(page, 'manybranches', tmpRoot, 'sweep-repo', 'graph')

    // pr/lfs 는 forge/network 의존(로컬 fixture 에서 validation 에러 렌더) — 시각 sweep 에서 제외.
    const tabs = ['graph', 'branches', 'stash', 'submodule', 'worktree'] as const
    for (const tab of tabs) {
      await page.locator(`[data-testid="main-nav-${tab}"]`).click({ timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(600)
      const smoke = await domSmoke(page)
      expect(smoke.wrapped, `[${tab}] wrapped chips: ${smoke.wrapped.join(', ')}`).toEqual([])
      expect(smoke.rootOverflow, `[${tab}] root overflow`).toBe(false)
      expect(smoke.offscreen, `[${tab}] offscreen clickable: ${smoke.offscreen.join(', ')}`).toEqual([])
    }
  })

  test('settings 전 카테고리 시각 sweep', async () => {
    await page.goto('http://localhost:1420/settings')
    await page.waitForTimeout(800)
    const cats = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="settings-category-"]')]
        .filter((b) => !b.hasAttribute('disabled') && b.getAttribute('aria-disabled') !== 'true')
        .map((b) => b.getAttribute('data-testid') as string),
    )
    expect(cats.length, 'settings 카테고리 미발견').toBeGreaterThan(0)

    for (const id of cats) {
      await page.click(`[data-testid="${id}"]`, { timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(500)
      const smoke = await domSmoke(page)
      expect(smoke.wrapped, `[${id}] wrapped: ${smoke.wrapped.join(', ')}`).toEqual([])
      expect(smoke.rootOverflow, `[${id}] root overflow`).toBe(false)
    }
  })
})
