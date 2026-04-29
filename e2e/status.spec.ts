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

  // Sprint c30 / GitKraken UX (Phase 2a) — graph 위 sticky WIP pseudo-row.
  test('WipRow 표시 + 클릭 → status tab + selection highlight', async ({ page }) => {
    // devMock 의 default fake repo 는 dirty (file changes 12). WipRow 가 보여야.
    const wipRow = page.locator('[data-testid="wip-row"]')
    await expect(wipRow).toBeVisible()
    await expect(wipRow).toContainText('// WIP')
    await expect(wipRow).toContainText(/12/) // change count badge

    // 클릭 → selection 활성 (bg-accent + ring-1)
    await wipRow.click()
    await expect(wipRow).toHaveClass(/bg-accent/)
    // status tab 강제 활성
    await expect(page.locator('[data-testid="main-nav-status"]')).toHaveClass(/font-semibold/)
  })

  test('WipRow 재클릭 → 선택 해제 (toggle)', async ({ page }) => {
    const wipRow = page.locator('[data-testid="wip-row"]')
    await wipRow.click()
    await expect(wipRow).toHaveClass(/bg-accent/)
    await wipRow.click()
    await expect(wipRow).not.toHaveClass(/bg-accent/)
  })

  // Sprint c30 / GitKraken UX (Phase 3) — 파일 row 더블클릭 → fullscreen diff
  test('Status 파일 row 더블클릭 → fullscreen diff + ESC 닫기', async ({ page }) => {
    await page.locator('[data-testid="main-nav-status"]').click()

    // Modified 섹션의 첫 unstaged 파일 더블클릭 (devMock 의 fake unstaged file 5개).
    // 정확한 file path 모르니 첫 .truncate.font-mono 의 unstaged li 를 더블클릭.
    const firstUnstaged = page
      .locator('[data-testid="main-nav-status"]')
      .locator('..')
      .locator('..')
      .locator('li[draggable="true"]')
      .first()
    await expect(firstUnstaged).toBeVisible({ timeout: 2_000 })
    await firstUnstaged.dblclick()

    // fullscreen diff mount
    const fs = page.locator('[data-testid="fullscreen-diff"]')
    await expect(fs).toBeVisible({ timeout: 2_000 })

    // ESC → close
    await page.keyboard.press('Escape')
    await expect(fs).toHaveCount(0, { timeout: 2_000 })
  })

  test('fullscreen diff ✕ 버튼 → close', async ({ page }) => {
    await page.locator('[data-testid="main-nav-status"]').click()
    const firstUnstaged = page
      .locator('[data-testid="main-nav-status"]')
      .locator('..')
      .locator('..')
      .locator('li[draggable="true"]')
      .first()
    await firstUnstaged.dblclick()
    await expect(page.locator('[data-testid="fullscreen-diff"]')).toBeVisible({ timeout: 2_000 })

    await page.locator('[data-testid="fullscreen-diff-close"]').click()
    await expect(page.locator('[data-testid="fullscreen-diff"]')).toHaveCount(0)
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
