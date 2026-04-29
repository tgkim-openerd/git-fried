import { Page } from '@playwright/test'

// Sprint c30 / LOW 2 — e2e 공통 fixture.
// 단일 smoke.spec.ts 가 17 시나리오로 비대해져 디버그 격리 어려움.
// 시나리오 그룹별 (commit/status/shortcuts/actions) 분할 후 공통 beforeEach 만 모음.

/**
 * fresh chromium 의 localStorage 는 비어있어 activeRepoId=null.
 * 첫 repo 강제 선택 — 모든 시나리오의 공통 prerequisite.
 */
export async function selectFrontendRepo(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator('[data-testid="sidebar-repo-frontend"]').click()
}

/**
 * commit detail panel + inline diff 모두 켜진 상태로 reload.
 * commit row click / inline-diff-panel 검증 시 prerequisite.
 */
export async function ensureDetailVisible(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
  await page.reload()
  await page.locator('[data-testid="sidebar-repo-frontend"]').click()
}
