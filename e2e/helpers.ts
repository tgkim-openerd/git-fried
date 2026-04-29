import { Page } from '@playwright/test'

// Sprint c30 / LOW 2 — e2e 공통 fixture.
// 단일 smoke.spec.ts 가 17 시나리오로 비대해져 디버그 격리 어려움.
// 시나리오 그룹별 (commit/status/shortcuts/actions) 분할 후 공통 beforeEach 만 모음.
//
// Phase 11-6 — Sidebar 의 평면 레포 list 가 /repositories 페이지로 이동.
//   `selectFrontendRepo` 는 더이상 sidebar UI 클릭 의존 X — localStorage 직접 bootstrap.
//   devMock 의 frontend = id 1.

const FRONTEND_REPO_ID = 1
const TABS_LOCAL_STORAGE_KEY = 'git-fried.repo-tabs.v1'

/**
 * fresh chromium 의 localStorage 는 비어있어 activeRepoId=null.
 * frontend 레포 (id=1) 강제 활성화 — 모든 시나리오 공통 prerequisite.
 *
 * 1) 먼저 빈 페이지 navigate (localStorage 접근 가능하게)
 * 2) localStorage 에 tabs/active 직접 set
 * 3) `/` reload → store 가 localStorage 부팅 시 읽음
 */
export async function selectFrontendRepo(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ({ key, repoId }) => {
      localStorage.setItem(key, JSON.stringify({ tabs: [repoId], active: repoId }))
    },
    { key: TABS_LOCAL_STORAGE_KEY, repoId: FRONTEND_REPO_ID },
  )
  await page.reload()
  // 활성 repo 가 set 되면 RepoTabBar 의 active 프로젝트 탭이 노출됨.
  await page.locator('[data-testid="repo-tab-bar"]').waitFor({ state: 'visible' })
}

/**
 * commit detail panel + inline diff 모두 켜진 상태로 reload.
 * commit row click / inline-diff-panel 검증 시 prerequisite.
 */
export async function ensureDetailVisible(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ({ tabsKey, repoId }) => {
      localStorage.setItem(tabsKey, JSON.stringify({ tabs: [repoId], active: repoId }))
      localStorage.setItem('git-fried.detail-visible', '1')
    },
    { tabsKey: TABS_LOCAL_STORAGE_KEY, repoId: FRONTEND_REPO_ID },
  )
  await page.reload()
  await page.locator('[data-testid="repo-tab-bar"]').waitFor({ state: 'visible' })
}

/**
 * frontend + backend-api 두 레포 탭 동시 오픈 (active = frontend).
 * "repo 전환 시 selectedSha reset" 같은 시나리오에서 사용 — 사용자가 탭 클릭으로 전환.
 */
export async function selectFrontendAndBackendRepos(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ({ key }) => {
      // frontend(1) + backend-api(3) 둘 다 open, frontend active.
      localStorage.setItem(key, JSON.stringify({ tabs: [1, 3], active: 1 }))
      localStorage.setItem('git-fried.detail-visible', '1')
    },
    { key: TABS_LOCAL_STORAGE_KEY },
  )
  await page.reload()
  await page.locator('[data-testid="repo-tab-bar"]').waitFor({ state: 'visible' })
}
