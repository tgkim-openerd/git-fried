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

  test('app shell + 8 fake repos + GitKraken toolbar 노출', async ({ page }) => {
    await expect(page).toHaveTitle('git-fried')

    const repoList = page.locator('[data-testid="sidebar-repo-list"]')
    await expect(repoList).toBeVisible()
    await expect(repoList.locator('[data-testid="sidebar-repo-frontend"]')).toBeVisible()
    await expect(repoList.locator('[data-testid="sidebar-repo-backend-api"]')).toBeVisible()
    await expect(repoList.locator('[data-testid="sidebar-repo-git-fried"]')).toBeVisible()

    // GitKrakenToolbar — 8 button (Sprint c25-1). Sidebar quick action 에도 Stash/Branch 등장 → first()
    await expect(page.getByRole('button', { name: /Undo$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Redo$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Pull$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Push$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Branch$/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Stash$/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Pop \d+$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Terminal$/ })).toBeVisible()
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
