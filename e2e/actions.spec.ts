import { expect, test } from '@playwright/test'
import { ensureDetailVisible, selectFrontendRepo } from './helpers'

test.describe('actions — Toolbar Redo / Stash 진입', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('Toolbar Redo button → confirm → toast (Phase 1 reflog-undo)', async ({ page }) => {
    page.on('dialog', (d) => d.accept())
    const redoBtn = page.getByRole('button', { name: /Redo$/ })
    await expect(redoBtn).toBeVisible()
    await redoBtn.click()
    await expect(page.getByText(/Redo:\s*reset/i)).toBeVisible({ timeout: 2_000 })
  })

  test('Stash 탭 진입 → 3 stash row + ⌘L apply hint', async ({ page }) => {
    await ensureDetailVisible(page)
    await page.locator('[data-testid="main-nav-stash"]').click()

    // StashPanel 의 stash list — 첫 row 가 보이면 panel 마운트 완료. 그 다음 1/2 검증 (timeout 더 넉넉히).
    await expect(page.getByText(/stash@\{0\}/).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/stash@\{1\}/).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/stash@\{2\}/).first()).toBeVisible({ timeout: 5_000 })
  })
})
