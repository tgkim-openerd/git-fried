import { expect, test } from '@playwright/test'
import { selectFrontendRepo } from './helpers'

test.describe('commit / graph — row click / inline-diff / 8번째 tab / fallback / zoom', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('commit row click → inline-diff-panel visible', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('git-fried.detail-visible', '1')
      localStorage.setItem('git-fried.inline-diff.visible', '1')
    })
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await expect(row).toBeVisible()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()

    await expect(page.locator('[data-testid="inline-diff-panel"]')).toBeVisible({
      timeout: 2_000,
    })
  })

  test('CommitGraph zoom +/- + graphWidth max 320 cap', async ({ page }) => {
    const result = await page.evaluate(() => {
      const cssWidth = (() => {
        const c = document.querySelector('canvas')
        return c?.style.width
      })()
      return { cssWidth }
    })
    if (result.cssWidth) {
      const px = parseInt(result.cssWidth, 10)
      expect(px).toBeLessThanOrEqual(320)
    }
    await expect(page.getByRole('button', { name: /그래프 축소/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /그래프 확대/ })).toBeVisible()
  })

  test('commit row click → 8번째 commit tab mount + sidebar visible', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    await expect(page.locator('[data-testid="main-nav-commit"]')).toHaveCount(0)

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await expect(row).toBeVisible()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()

    const commitTab = page.locator('[data-testid="main-nav-commit"]')
    await expect(commitTab).toBeVisible({ timeout: 2_000 })
    await commitTab.click()

    const sidebar = page.locator('[data-testid="commit-detail-sidebar"]')
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toContainText('6ef63e0')
  })

  test('commit tab fallback — selectedSha=null 시 status 복귀', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()
    await page.locator('[data-testid="main-nav-commit"]').click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toBeVisible()

    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="sidebar-repo-backend-api"]')
      ;(el as HTMLElement | null)?.click()
    })
    await expect(page.locator('[data-testid="main-nav-commit"]')).toHaveCount(0, {
      timeout: 2_000,
    })
  })
})
