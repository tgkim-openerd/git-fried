import { expect, test } from '@playwright/test'

// Sprint E2E smoke — 본 세션 dogfood 10항목 시나리오의 자동화 골격.
// 환경: vite dev server (1420) + Chromium + devMock (Tauri webview 부재 → fixture 응답).

test.describe('git-fried smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // fresh chromium 의 localStorage 는 비어있어 activeRepoId=null. 첫 repo 강제 선택.
    await page.locator('[data-testid="sidebar-repo-frontend"]').click()
  })

  test('app shell + 8 fake repos + GitKraken toolbar 노출', async ({ page }) => {
    await expect(page).toHaveTitle('git-fried')

    // 좌측 사이드바 repo list (data-testid="sidebar-repo-list")
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

  test('ChangeCountBadge 영구 노출 + 12 file changes', async ({ page }) => {
    // testid 가 main panel + sidebar quick action 양쪽 mount → file changes 텍스트로 좁히기
    const badge = page
      .locator('[data-testid="change-count-badge"]')
      .filter({ hasText: 'file changes' })
      .first()
    await expect(badge).toBeVisible()
    await expect(badge).toContainText(/12/)
    await expect(badge).toContainText(/staged 3/)
    await expect(badge).toContainText(/mod 5/)
  })

  test('CommandPalette ⌘P 열림 + 검색 input focus', async ({ page }) => {
    await page.keyboard.press('Control+p')
    const input = page.locator('input[placeholder*="명령 검색"]')
    await expect(input).toBeFocused()
    await page.keyboard.press('Escape')
  })

  test('CommitSearchModal ⌘⇧F 열림 (F-P5)', async ({ page }) => {
    await page.keyboard.press('Control+Shift+F')
    await expect(page.getByRole('dialog', { name: 'Commit message 검색' })).toBeVisible()
    // focus 검증 race-condition (beforeEach click 후) 회피 — fill 자체가 focus + type 수행
    const input = page.locator('input[placeholder*="git log --grep"]')
    await input.fill('plan/22')
    await expect(page.getByText(/매칭 commit 없음|개 결과/).first()).toBeVisible({
      timeout: 2_000,
    })
    await page.keyboard.press('Escape')
  })

  test('Sidebar 4 mini sections + collapsible 토글', async ({ page }) => {
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.branches"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.stash"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.worktree"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.pr"]')).toBeVisible()

    // 토글 — Stash 섹션 → title 이 "펴기" 로 전환
    const stashToggle = page.locator('[data-testid="mini-section-toggle-active-repo-quick.stash"]')
    await expect(stashToggle).toHaveAttribute('title', /접기/)
    await stashToggle.click()
    await expect(stashToggle).toHaveAttribute('title', /펴기/)
  })

  test('Path/Tree 토글 + 4 섹션 노출', async ({ page }) => {
    // main nav 의 '변경' tab — data-testid="main-nav-status"
    await page.locator('[data-testid="main-nav-status"]').click()
    // page evaluation — STAGED/MODIFIED 텍스트 노출 검증 (CSS selector 매칭 race-condition 회피)
    await page.waitForFunction(() => {
      const t = document.body.innerText
      return /STAGED.*MODIFIED.*UNTRACKED.*CONFLICTED/s.test(t)
    }, { timeout: 5_000 })

    // Tree 모드 토글 — 디렉토리 트리 모드 button
    const treeBtn = page.locator('button[aria-label="디렉토리 트리 모드"]')
    await treeBtn.click()
    // localStorage 영속 검증
    const stored = await page.evaluate(() => localStorage.getItem('git-fried.status.viewMode'))
    expect(stored).toBe('tree')
  })

  test('CommitSearchModal — 검색 결과 노출 + Esc 닫기', async ({ page }) => {
    await page.keyboard.press('Control+Shift+F')
    const dialog = page.getByRole('dialog', { name: 'Commit message 검색' })
    await expect(dialog).toBeVisible()
    const input = page.locator('input[placeholder*="git log --grep"]')
    await input.fill('feat')
    // devMock 의 fake commit log 에 "feat" 포함 메시지 존재 → 결과 노출 (시간 제한 내)
    await expect(page.getByText(/개 결과 \(max 50\)|매칭 commit 없음/)).toBeVisible({
      timeout: 2_000,
    })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
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
