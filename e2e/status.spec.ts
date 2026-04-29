import { expect, test } from '@playwright/test'
import { ensureDetailVisible, selectFrontendRepo } from './helpers'

test.describe('상태 패널 — Sidebar mini / ChangeCountBadge / Path-Tree / sticky', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('ChangeCountBadge 영구 노출 + 12 file changes', async ({ page }) => {
    const badge = page
      .locator('[data-testid="change-count-badge"]')
      .filter({ hasText: 'file changes' })
      .first()
    await expect(badge).toBeVisible()
    await expect(badge).toContainText(/12/)
    await expect(badge).toContainText(/staged 3/)
    await expect(badge).toContainText(/mod 5/)
  })

  test('Sidebar 4 mini sections + collapsible 토글', async ({ page }) => {
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.branches"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.stash"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.worktree"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.pr"]')).toBeVisible()

    const stashToggle = page.locator('[data-testid="mini-section-toggle-active-repo-quick.stash"]')
    await expect(stashToggle).toHaveAttribute('title', /접기/)
    await stashToggle.click()
    await expect(stashToggle).toHaveAttribute('title', /펴기/)
  })

  test('Path/Tree 토글 + 4 섹션 노출', async ({ page }) => {
    await page.locator('[data-testid="main-nav-status"]').click()
    await page.waitForFunction(
      () => {
        const t = document.body.innerText
        return /STAGED.*MODIFIED.*UNTRACKED.*CONFLICTED/s.test(t)
      },
      { timeout: 5_000 },
    )

    const treeBtn = page.locator('button[aria-label="디렉토리 트리 모드"]')
    await treeBtn.click()
    const stored = await page.evaluate(() => localStorage.getItem('git-fried.status.viewMode'))
    expect(stored).toBe('tree')
  })

  test('Status 4 section sticky + STAGED bulk-unstage button', async ({ page }) => {
    await ensureDetailVisible(page)
    await page.locator('[data-testid="main-nav-status"]').click()

    const sticky = await page.evaluate(() => {
      const txts = ['Staged', 'Modified', 'Untracked', 'Conflicted']
      return txts.map((t) => {
        const span = Array.from(document.querySelectorAll('span, div')).find(
          (el) =>
            el.children.length === 0 &&
            new RegExp(`[▶▼]\\s*${t}\\s*\\(`).test(el.textContent ?? ''),
        )
        const header = span?.closest('div.sticky')
        return { name: t, sticky: !!header }
      })
    })
    expect(sticky.every((s) => s.sticky)).toBe(true)

    const unstageAllBtn = page.locator('button[title*="모두 unstage"]')
    await expect(unstageAllBtn).toBeVisible()
  })
})
