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

  // Sprint c30 / GitKraken UX (Phase 5) — commit row click 시 우측 sidebar 자동 commit detail.
  // Phase 5 — main-nav-commit 제거. 우측 sidebar 가 selectedSha 기반 분기.
  test('commit row click → 우측 sidebar = commit detail (Phase 5)', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await expect(row).toBeVisible()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()

    // CommitDetailSidebar 즉시 visible (자동 우측 sidebar 분기).
    const sidebar = page.locator('[data-testid="commit-detail-sidebar"]')
    await expect(sidebar).toBeVisible({ timeout: 2_000 })
    await expect(sidebar).toContainText('6ef63e0')
  })

  // Sprint c30 / GitKraken UX (Phase 5) — ESC 키로 selectedSha=null → 우측 placeholder.
  test('ESC 키 → selectedSha=null → 우측 placeholder', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toBeVisible()

    await page.keyboard.press('Escape')
    // CommitDetailSidebar 사라지고 placeholder ("graph 에서 commit 또는 WIP 행을 선택") 표시.
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toHaveCount(0, {
      timeout: 2_000,
    })
  })

  // Sprint c30 / GitKraken UX (Phase 5) — 같은 commit 재클릭 = toggle (선택 해제).
  test('같은 commit row 재클릭 → 선택 해제 (toggle)', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    const shaCell = row.locator('span', { hasText: /^6ef63e0$/ })

    await shaCell.click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toBeVisible()

    await shaCell.click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toHaveCount(0, {
      timeout: 2_000,
    })
  })

  // Sprint c30 / GitKraken UX (Phase 5) — repo 변경 시 selectedSha reset → 우측 placeholder.
  test('repo 변경 → selectedSha reset → 우측 placeholder', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toBeVisible()

    // 다른 repo click → selectedSha reset → auto-default 다시 적용 (graph latest 또는 WIP)
    await page.locator('[data-testid="sidebar-repo-backend-api"]').click()
    // backend-api 의 첫 sha 가 6ef63e0 가 아닐 수 있으니 commit-detail-sidebar 가 mount 되었을 수 있고
    // (auto-default 적용) 또는 placeholder. 둘 다 valid — 기존 6ef63e0 는 사라져야.
    const sidebarText = await page
      .locator('[data-testid="commit-detail-sidebar"]')
      .textContent({ timeout: 2_000 })
      .catch(() => null)
    if (sidebarText) {
      // auto-default 가 적용된 경우 — 텍스트가 6ef63e0 와 다른지만 검증.
      expect(sidebarText).not.toContain('6ef63e0')
    }
  })
})
