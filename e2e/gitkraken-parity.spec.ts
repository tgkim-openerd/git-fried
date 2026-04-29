import { expect, test } from '@playwright/test'
import { selectFrontendRepo, selectFrontendAndBackendRepos } from './helpers'

// Phase 11~13 GitKraken parity 신규 기능 검증.
//
// 비교 항목 (image 1 = git-fried / image 2 = GitKraken):
//   • Phase 11-1: 커밋 선택 시 가운데 diff 65% 자동 (image 6→7)
//   • Phase 11-2: 폰트 가독성 (opsz / line-height) — visual, 기능 검증 X
//   • Phase 11-3: Sidebar workspace compact + 검색 input (Phase 12-2 통합)
//   • Phase 11-4: /repositories 페이지 + 헤더 "레포" 링크
//   • Phase 11-5: File 메뉴 → Repository Management ⌘⇧R (네이티브 메뉴 — Tauri only, X)
//   • Phase 11-6: Sidebar 활성 레포 카테고리 전용 (LOCAL/REMOTE/...)
//   • Phase 11-7: RepoTabBar 2-level (Row 1 프로젝트 / Row 2 활성 프로젝트 레포)
//   • Phase 12-1: 브랜치 hierarchical tree
//   • Phase 12-2: Sidebar 통합 검색 input
//   • Phase 12-3: SUBMODULES + Pull dropdown ▾
//   • Phase 13-1: WipBanner 제거 (vertical 공간)
//   • Phase 13-2: Explain commit ✨ (CommitDetailSidebar 헤더 우상단)
//   • Phase 13-3: 헤더 + 탭 통합 (RepoTabBar trailing slot)
//   • Phase 13-4: 그래프 BRANCH/TAG 별도 컬럼

test.describe('Phase 11~13 GitKraken parity', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('Phase 11-7 — RepoTabBar 2-level (Row 1 프로젝트 / Row 2 활성 레포)', async ({ page }) => {
    // 두 레포 동시 오픈 (frontend / backend-api 둘 다 'opnd' 부모디렉토리 그룹).
    await selectFrontendAndBackendRepos(page)

    // Row 1 — 프로젝트 그룹 탭 ('opnd' 폴더, 2 레포 → 📦 opnd (2)).
    const projectTab = page.locator('[data-testid^="project-tab-"]').first()
    await expect(projectTab).toBeVisible()
    await expect(projectTab).toContainText(/opnd/)

    // Row 2 — 활성 프로젝트 의 레포 탭. data-tab-id="1" (frontend) + data-tab-id="3" (backend-api).
    const activeProjectRow = page.locator('[data-testid="active-project-repo-row"]')
    await expect(activeProjectRow).toBeVisible()
    await expect(activeProjectRow.locator('[data-tab-id="1"]')).toBeVisible()
    await expect(activeProjectRow.locator('[data-tab-id="3"]')).toBeVisible()
  })

  test('Phase 11-4 — /repositories 페이지 헤더 "레포" 링크 동작', async ({ page }) => {
    const link = page.locator('[data-testid="sidebar-repo-management-link"]')
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/repositories/)
    await expect(page.getByText('Repository Management')).toBeVisible()
  })

  test('Phase 11-6 — Sidebar = 활성 레포 카테고리 (LOCAL/REMOTE/STASHES/...)', async ({ page }) => {
    // ActiveRepoQuickActions 가 sidebar body 의 dominant 영역.
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.branches"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="mini-section-active-repo-quick.stash"]'),
    ).toBeVisible()
    // Phase 11-6 에서 추가된 REMOTE / TAGS / Phase 12-3 SUBMODULES.
    await expect(
      page.locator('[data-testid="mini-section-active-repo-quick.remote"]'),
    ).toBeVisible()
  })

  test('Phase 12-2 — Sidebar 통합 검색 input 노출 + ⌘⌥F focus path', async ({ page }) => {
    const search = page.locator('[data-testid="sidebar-search"]')
    await expect(search).toBeVisible()

    // window.gitFriedFocusRepoFilter 트리거 → input focus.
    await page.evaluate(() => window.gitFriedFocusRepoFilter?.())
    await expect(search).toBeFocused({ timeout: 1_000 })
  })

  test('Phase 12-2 — 검색 input 입력 시 트리 폴더 자동 expand (auto-expand)', async ({ page }) => {
    const search = page.locator('[data-testid="sidebar-search"]')
    await search.click()
    await search.fill('main')
    // 검색 활성 → BranchTreeView 가 auto-expand → leaf 'main' 노출.
    // mini-section LOCAL 내에 main 텍스트 노출.
    const localSection = page.locator('[data-testid="mini-section-active-repo-quick.branches"]')
    await expect(localSection).toContainText(/main/, { timeout: 2_000 })
  })

  test('Phase 12-3 — Pull dropdown ▾ split button (4 strategy)', async ({ page }) => {
    // 본체 Pull 버튼 + ▾ 버튼 둘 다 존재. (accessible name = "⇩ Pull" — 끝이 'Pull')
    await expect(page.getByRole('button', { name: /Pull$/ })).toBeVisible()
    const dropdownToggle = page
      .locator('button[aria-haspopup="menu"]', { hasText: '▾' })
      .first()
    await expect(dropdownToggle).toBeVisible()

    // ▾ 클릭 → popover 4 strategy 항목 (default merge / --rebase / --ff-only / --no-rebase).
    await dropdownToggle.click()
    await expect(page.getByRole('menuitem', { name: /merge/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /--rebase/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /--ff-only/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /--no-rebase/ })).toBeVisible()
  })

  test('Phase 13-3 — 헤더 row 통합 (RepoTabBar trailing slot 의 nav 링크 노출)', async ({
    page,
  }) => {
    // 옛 헤더 row 제거 (별도 row 없음). RepoTabBar 의 trailing slot 안에 nav 가 inject.
    const tabBar = page.locator('[data-testid="repo-tab-bar"]')
    await expect(tabBar).toBeVisible()

    // trailing slot 안의 nav 링크 — 홈/레포/Launchpad/설정.
    await expect(tabBar.getByRole('link', { name: '홈' })).toBeVisible()
    await expect(tabBar.getByRole('link', { name: '레포' })).toBeVisible()
    await expect(tabBar.getByRole('link', { name: '설정' })).toBeVisible()
  })

  test('Phase 13-1 — WipBanner 제거 (mount 안 됨)', async ({ page }) => {
    // 이전 (Phase 11 이전) 에는 toolbar 바로 아래 "// WIP (작업 중인 내용..." banner.
    // Phase 13-1 에서 제거 — body 에 그 placeholder 텍스트 없음.
    const text = await page.locator('body').textContent()
    expect(text).not.toContain('stash push 시 메시지로 자동 사용')
  })

  test('Phase 13-2 — CommitDetailSidebar 헤더 우상단 [✨ Explain] 버튼', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.detail-visible', '1'))
    await page.reload()

    // commit row 클릭 → CommitDetailSidebar 노출.
    const row = page.locator('[data-testid="commit-row-6ef63e0"]').first()
    await expect(row).toBeVisible()
    await row.locator('span', { hasText: /^6ef63e0$/ }).click()

    const sidebar = page.locator('[data-testid="commit-detail-sidebar"]')
    await expect(sidebar).toBeVisible()

    // 헤더 안 [✨ Explain] 버튼 존재 — disabled 일 수 있음 (AI CLI 미설치 환경) but 노출은 보장.
    const explainBtn = sidebar.getByRole('button', { name: /Explain commit \(AI\)/i })
    await expect(explainBtn).toBeVisible()
  })

  test('Phase 13-4 — 그래프 BRANCH/TAG 별도 컬럼 (헤더 라벨 노출)', async ({ page }) => {
    // 컬럼 헤더 row 의 BRANCH/TAG 라벨 (col label) 노출. 옛: message 안 inline pill, 신: 별도 컬럼.
    const branchTagHeader = page.getByText(/BRANCH\/TAG/i).first()
    await expect(branchTagHeader).toBeVisible({ timeout: 5_000 })
  })
})
