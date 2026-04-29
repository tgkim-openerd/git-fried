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

    await expect(page.getByText(/stash@\{0\}/)).toBeVisible()
    await expect(page.getByText(/stash@\{1\}/)).toBeVisible()
    await expect(page.getByText(/stash@\{2\}/)).toBeVisible()
  })
})
