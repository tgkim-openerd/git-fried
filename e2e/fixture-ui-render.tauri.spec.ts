// 실 백엔드 fixture 데이터를 UI 로 렌더·구동하고, 작은 UI/UX(파일 렌더 / 그래프 ref 라벨 시각)를
// 검증하는 재사용 e2e. GAP-2 bridge(seedFixtureAndOpenRepo) + DOM geometry smoke 활용.
//
// 기존 mock UI e2e(devMock) 와 달리 실 백엔드 + 격리 DB + 가짜 저장소 → 실데이터 렌더 버그까지 포착.
// 실행: npx playwright test --config playwright.tauri.config.ts fixture-ui-render

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
const consoleErrors: string[] = []

test.describe('fixture UI 렌더 e2e (실 백엔드 → UI 구동/시각 via CDP)', () => {
  test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gitfried-ui-'))
    const dbPath = join(tmpRoot, 'test-db.sqlite')
    handle = await launchTauriWithCdp(9225, 200_000, { GIT_FRIED_DB_PATH: dbPath })
    browser = await chromium.connectOverCDP(handle.cdpUrl)
    const ctx = browser.contexts()[0]
    page = ctx.pages().find((p) => p.url().includes('localhost:1420')) ?? ctx.pages()[0]
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
    page.on('pageerror', (e) => consoleErrors.push('[pageerror] ' + e.message))
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

  test('dirty fixture → 상태 패널에 실 파일(staged.txt/README.md) 렌더 + 시각 정상', async () => {
    consoleErrors.length = 0
    await seedFixtureAndOpenRepo(page, 'dirty', tmpRoot, 'ui-dirty', 'graph')

    // 그래프가 base 커밋 렌더 + ChangeCountBadge(헤더) dirty 상태 노출.
    await expect(page.locator('body')).toContainText('feat: base', { timeout: 10_000 })
    await expect(page.locator('[data-testid="change-count-badge"]').first()).toBeVisible({ timeout: 10_000 })

    // dirty → WIP auto-default 선택 → StatusPanel 자동 노출. timing 보강: wip-row 있으면 클릭.
    const wipRow = page.locator('[data-testid="wip-row"]').first()
    for (let i = 0; i < 8; i++) {
      const shown = await page
        .locator('body')
        .evaluate((el) => /staged\.txt/.test(el.innerText))
        .catch(() => false)
      if (shown) break
      if (await wipRow.isVisible().catch(() => false)) await wipRow.click().catch(() => {})
      await page.waitForTimeout(500)
    }

    // 실 fixture 파일명이 StatusPanel 에 렌더 (i18n 무관 — 파일명 stable). staged.txt=Staged, README.md=Modified.
    await expect(page.locator('body')).toContainText('staged.txt', { timeout: 5_000 })
    await expect(page.locator('body')).toContainText('README.md')

    // 시각 smoke — wrap/overflow/console error 0.
    const smoke = await domSmoke(page)
    expect(smoke.rootOverflow, 'root overflow').toBe(false)
    expect(smoke.wrapped, `wrapped: ${smoke.wrapped.join(', ')}`).toEqual([])
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([])
  })

  test('manybranches fixture → 그래프 ref 라벨 시각 스트레스 (chip wrap/overflow 회귀 가드)', async () => {
    consoleErrors.length = 0
    await seedFixtureAndOpenRepo(page, 'manybranches', tmpRoot, 'ui-manybranches', 'graph')

    // base 커밋(다수 ref 라벨 부착)이 그래프에 렌더됐는지 — 커밋 메시지로 확인(stable).
    await expect(page.locator('body')).toContainText('feat: base', { timeout: 10_000 })
    await page.waitForTimeout(1000) // ref pill 렌더 안정화

    // 긴 하이픈 브랜치명 다수가 단일행 chip/label 로 렌더 → wrap=0 (commit 480bbb4 nowrap+truncate+"+N" 가드).
    const smoke = await domSmoke(page)
    expect(smoke.wrapped, `wrapped chips: ${smoke.wrapped.join(', ')}`).toEqual([])
    expect(smoke.rootOverflow, 'root overflow').toBe(false)
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([])
  })
})
