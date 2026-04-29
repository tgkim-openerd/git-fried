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

  test('sidebar filter focus path (window.gitFriedFocusRepoFilter)', async ({ page }) => {
    // Playwright press_key (⌘⌥F) 가 Chromium OS 단축키와 충돌, dispatchEvent 도 KeyboardEvent.ctrlKey/altKey synthesis 환경 의존.
    // window helper 가 Sidebar.vue 에서 mount 시 등록되는 SoT (focus path).
    await page.evaluate(() => window.gitFriedFocusRepoFilter?.())
    const filter = page.locator('input[placeholder*="필터"][placeholder*="별칭"]').first()
    await expect(filter).toBeFocused({ timeout: 1_000 })
  })

  test('⌘1~7 단축키 7개 main-nav tab 전환', async ({ page }) => {
    await ensureDetailVisible(page)

    const tabs = ['status', 'branches', 'stash', 'submodule', 'lfs', 'pr', 'worktree'] as const
    for (let i = 0; i < tabs.length; i++) {
      await page.evaluate((n) => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: String(n),
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        )
      }, i + 1)
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      )
      const btn = page.locator(`[data-testid="main-nav-${tabs[i]}"]`)
      await expect(btn).toHaveClass(/font-semibold/)
    }
  })
})
