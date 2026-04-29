import { expect, test } from '@playwright/test'
import { selectFrontendRepo, selectFrontendAndBackendRepos } from './helpers'

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
    // Phase 9-1 — aria-label "그래프 column 축소/확대 (현재 width: Npx)".
    await expect(page.getByRole('button', { name: /그래프.*축소/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /그래프.*확대/ })).toBeVisible()
  })

  // Sprint c30 / GitKraken UX (Phase 5) — commit row click 시 우측 sidebar 자동 commit detail.
  test('commit row click → 우측 sidebar = commit detail (Phase 5)', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await expect(row).toBeVisible()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()

    const sidebar = page.locator('[data-testid="commit-detail-sidebar"]')
    await expect(sidebar).toBeVisible({ timeout: 2_000 })
    await expect(sidebar).toContainText('6ef63e0')
  })

  // Sprint c30 / GitKraken UX (Phase 5) — ESC 키로 selectedSha=null → 우측 placeholder.
  test('ESC 키 → selectedSha=null → 우측 placeholder', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toHaveCount(0, {
      timeout: 2_000,
    })
  })

  // Sprint c30 / GitKraken UX (Phase 5) — 같은 commit 재클릭 = toggle (선택 해제).
  test('같은 commit row 재클릭 → 선택 해제 (toggle)', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()

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
  // Phase 11-7: RepoTabBar 의 Row 2 (repo tab) 클릭으로 repo 전환.
  test('repo 변경 → selectedSha reset → 우측 placeholder', async ({ page }) => {
    // 두 레포 탭 동시 오픈 (frontend active, backend-api 탭에서 클릭으로 전환).
    await selectFrontendAndBackendRepos(page)

    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()
    await expect(page.locator('[data-testid="commit-detail-sidebar"]')).toBeVisible()

    // RepoTabBar Row 2 (활성 프로젝트 'opnd' 의 repo 탭) — backend-api (id=3) 탭 클릭.
    await page.locator('[data-tab-id="3"]').click()

    // 6ef63e0 는 frontend repo 의 commit — backend-api 활성화 후 사라져야.
    const sidebarText = await page
      .locator('[data-testid="commit-detail-sidebar"]')
      .textContent({ timeout: 2_000 })
      .catch(() => null)
    if (sidebarText) {
      expect(sidebarText).not.toContain('6ef63e0')
    }
  })
})
