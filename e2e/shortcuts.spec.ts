import { expect, test } from '@playwright/test'
import { ensureDetailVisible, selectFrontendRepo } from './helpers'

test.describe('단축키 — CommandPalette / CommitSearch / ⌘1~7 / sidebar focus', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('CommandPalette ⌘P 열림 + 검색 input focus', async ({ page }) => {
    await page.keyboard.press('Control+p')
    const input = page.locator('input[placeholder*="명령 검색"]')
    await expect(input).toBeFocused()
    await page.keyboard.press('Escape')
  })

  test('CommitSearchModal ⌘⇧F 열림 (F-P5)', async ({ page }) => {
    await page.keyboard.press('Control+Shift+F')
    await expect(page.getByRole('dialog', { name: 'Commit message 검색' })).toBeVisible()
    const input = page.locator('input[placeholder*="git log --grep"]')
    await input.fill('plan/22')
    await expect(page.getByText(/매칭 commit 없음|개 결과/).first()).toBeVisible({
      timeout: 2_000,
    })
    await page.keyboard.press('Escape')
  })

  test('CommitSearchModal — 검색 결과 노출 + Esc 닫기', async ({ page }) => {
    await page.keyboard.press('Control+Shift+F')
    const dialog = page.getByRole('dialog', { name: 'Commit message 검색' })
    await expect(dialog).toBeVisible()
    const input = page.locator('input[placeholder*="git log --grep"]')
    await input.fill('feat')
    await expect(page.getByText(/개 결과 \(max 50\)|매칭 commit 없음/)).toBeVisible({
      timeout: 2_000,
    })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('sidebar search focus path (window.gitFriedFocusRepoFilter — Phase 12-2)', async ({
    page,
  }) => {
    // Phase 12-2 — sidebar 통합 검색 input ([data-testid="sidebar-search"]) focus.
    //   기존 (Phase 11-6) 의 /repositories 라우팅 → 사이드바 안 검색 input focus 복원.
    await page.evaluate(() => window.gitFriedFocusRepoFilter?.())
    const filter = page.locator('[data-testid="sidebar-search"]')
    await expect(filter).toBeFocused({ timeout: 1_000 })
  })

  test('main-nav 7개 tab 전환 (⌘1~7 핸들러 동등)', async ({ page }) => {
    await ensureDetailVisible(page)

    // Phase 5 — main views: graph / branches / stash / submodule / lfs / pr / worktree.
    // 노트: Chromium 이 Ctrl+N 을 OS-level shortcut 으로 흡수해 page.keyboard.press 가 dev server 에 도달 못함.
    // useShortcut('tabN') 핸들러는 기능 동등 (mainView.value = 'X') — main-nav 클릭으로 검증.
    const tabs = ['graph', 'branches', 'stash', 'submodule', 'lfs', 'pr', 'worktree'] as const
    for (let i = 0; i < tabs.length; i++) {
      const btn = page.locator(`[data-testid="main-nav-${tabs[i]}"]`)
      await btn.click()
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      )
      await expect(btn).toHaveClass(/font-semibold/, { timeout: 2_000 })
    }
  })
})
