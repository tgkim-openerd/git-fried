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

  test('CommitGraph zoom +/- + graphWidth max 480 cap (Sprint c30)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const cssWidth = (() => {
        const c = document.querySelector('canvas')
        return c?.style.width
      })()
      return { cssWidth }
    })
    if (result.cssWidth) {
      const px = parseInt(result.cssWidth, 10)
      // Sprint c30 — cap 320 → 480 (lane 많은 레포에서 graph 잘림 회피).
      expect(px).toBeLessThanOrEqual(480)
    }
    await expect(page.getByRole('button', { name: /그래프 축소/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /그래프 확대/ })).toBeVisible()
  })

  // Sprint c30 / GitKraken UX — commit row click 시 우측 패널 자동 commit detail 전환.
  test('commit row click → 자동 우측 패널 전환 (GitKraken UX)', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    // 초기엔 commit tab 미존재 (selectedSha=null).
    await expect(page.locator('[data-testid="main-nav-commit"]')).toHaveCount(0)

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await expect(row).toBeVisible()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()

    // commit tab 자동 mount + 자동 활성 (Sprint c30 — 사용자 명시 click 불필요).
    const commitTab = page.locator('[data-testid="main-nav-commit"]')
    await expect(commitTab).toBeVisible({ timeout: 2_000 })
    await expect(commitTab).toHaveClass(/font-semibold/)

    // CommitDetailSidebar 즉시 visible.
    const sidebar = page.locator('[data-testid="commit-detail-sidebar"]')
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toContainText('6ef63e0')
  })

  // Sprint c30 / GitKraken UX — ESC 키로 commit 선택 해제 + status 복귀.
  test('ESC 키 → selectedSha=null + status 복귀', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toBeVisible()

    // ESC → selectedSha=null → tab='commit' watch 가 'status' fallback.
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="main-nav-commit"]')).toHaveCount(0, {
      timeout: 2_000,
    })
    await expect(page.locator('[data-testid="main-nav-status"]')).toHaveClass(/font-semibold/)
  })

  // Sprint c30 / GitKraken UX — 같은 commit 재클릭 = toggle (선택 해제).
  test('같은 commit row 재클릭 → 선택 해제 (toggle)', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    const shaCell = row.locator('span', { hasText: /^6ef63e0$/ })

    await shaCell.click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toBeVisible()

    // 같은 sha 재클릭 → 선택 해제.
    await shaCell.click()
    await expect(page.locator('[data-testid="main-nav-commit"]')).toHaveCount(0, {
      timeout: 2_000,
    })
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
