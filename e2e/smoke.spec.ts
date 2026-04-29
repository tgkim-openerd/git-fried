import { expect, test } from '@playwright/test'
import { selectFrontendRepo } from './helpers'

// Sprint c30 / LOW 2 — e2e 분할:
//   smoke.spec.ts  → app shell / 콘솔 에러 / GitKraken 8 button (가장 critical 한 골격)
//   shortcuts.spec.ts → CommandPalette / CommitSearch / ⌘1~7 / sidebar focus
//   status.spec.ts → ChangeCountBadge / Path-Tree / sticky 4 섹션 / Sidebar mini
//   commit.spec.ts → commit row click / 8번째 tab / inline-diff / graph zoom / fallback
//   actions.spec.ts → Toolbar Redo / Stash list

test.describe('smoke — 앱 shell & 콘솔 health', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('app shell + GitKraken toolbar 노출 (Phase 11~13 layout)', async ({ page }) => {
    await expect(page).toHaveTitle('git-fried')

    // Phase 11-6 — Sidebar 의 평면 레포 list 는 /repositories 로 이전.
    // sidebar 는 활성 레포 카테고리 (LOCAL/REMOTE/...) 만 노출.
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
    await expect(page.locator('[data-testid="sidebar-search"]')).toBeVisible()
    await expect(page.locator('[data-testid="sidebar-repo-management-link"]')).toBeVisible()

    // Phase 11-7 — RepoTabBar (Row 1 프로젝트 + Row 2 활성 프로젝트 레포).
    await expect(page.locator('[data-testid="repo-tab-bar"]')).toBeVisible()

    // GitKrakenToolbar — 8 button (Sprint c25-1). Sidebar quick action 에도 Stash/Branch 등장 → first()
    // Phase 12-3 — Pull dropdown ▾ split (본체 = Pull, ▾ = strategy menu).
    await expect(page.getByRole('button', { name: /Undo$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Redo$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Pull$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Push$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Branch$/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Stash$/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Pop \d+$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Terminal$/ })).toBeVisible()
  })

  // Phase 11-4 — /repositories 페이지에서 fake 레포 8개 노출.
  test('/repositories 페이지 — fake 레포 8개 + 프로젝트 그룹', async ({ page }) => {
    await page.goto('/repositories')
    await expect(page.getByText('Repository Management')).toBeVisible()

    // devMock 의 8 레포 모두 항목으로 노출 (검색/그룹 모드 무관 — 'All repositories' 섹션 안).
    await expect(page.locator('[data-testid="repositories-repo-frontend"]')).toBeVisible()
    await expect(page.locator('[data-testid="repositories-repo-backend-api"]')).toBeVisible()
    await expect(page.locator('[data-testid="repositories-repo-git-fried"]')).toBeVisible()
    await expect(page.locator('[data-testid="repositories-repo-tauri"]')).toBeVisible()
  })

  test('console.error 0건', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([])
  })
})
