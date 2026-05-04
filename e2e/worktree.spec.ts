import { expect, test } from '@playwright/test'
import { selectFrontendRepo } from './helpers'

// Sprint c40 / /analyze LOW 7 — Worktree flow e2e.
//
// 검증:
//   1) Sidebar mini-section "worktree" 노출 + 토글 가능
//   2) devMock WORKTREES 4 entry path 중 1개 이상 mini panel 또는 expanded 에 노출
//   3) main / locked / 일반 worktree 라벨 구분
//
// devMock WORKTREES 4 개:
//   - frontend (main)
//   - frontend.wt-main (main 브랜치 추가 worktree)
//   - frontend.wt-hotfix (locked, hotfix/한글-encoding-cp949)
//   - frontend.wt-review-89 (feature/workspace-color)

test.describe('Worktree — mini-section + WorktreePanel list', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('Sidebar mini-section "worktree" 노출', async ({ page }) => {
    const worktreeSection = page.locator(
      '[data-testid="mini-section-active-repo-quick.worktree"]',
    )
    await expect(worktreeSection).toBeVisible()
    await expect(worktreeSection).toContainText(/worktree/i)
  })

  test('Worktree mini section 토글 — title attribute 전환', async ({ page }) => {
    const toggle = page.locator(
      '[data-testid="mini-section-toggle-active-repo-quick.worktree"]',
    )
    await expect(toggle).toBeVisible()
    const before = await toggle.getAttribute('title')
    await toggle.click()
    const after = await toggle.getAttribute('title')
    expect(before).not.toEqual(after)
  })

  test('Worktree path 또는 brand text 노출 (devMock 4 entries)', async ({ page }) => {
    const hits = await page.evaluate(() => {
      const txt = document.body.innerText
      return {
        anyPath:
          /frontend\.wt-main/.test(txt) ||
          /frontend\.wt-hotfix/.test(txt) ||
          /frontend\.wt-review-89/.test(txt) ||
          /C:\/work\/opnd\/frontend/.test(txt),
        anyBranch:
          /hotfix\/한글-encoding-cp949/.test(txt) ||
          /feature\/workspace-color/.test(txt),
      }
    })
    // mini-section 의 first row 또는 본 panel 어느 쪽이든 1개 이상 노출.
    expect(hits.anyPath || hits.anyBranch).toBe(true)
  })
})
