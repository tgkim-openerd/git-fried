// 실 Tauri(CDP) UI e2e 용 fixture 헬퍼 — GAP-2 bridge.
//
// 격리 DB(GIT_FRIED_DB_PATH)에 가짜 저장소를 seed 한 뒤, localStorage 로 그 repo 탭을 활성화하고
// reload 해 **실 백엔드 fixture 데이터가 UI 에 렌더되는 상태**를 만든다. 이후 Playwright 로
// 실 WebView UI 를 구동/단정 + DOM geometry smoke(시각 깨짐 후보)로 검사한다.

import type { Page } from '@playwright/test'

const TABS_KEY = 'git-fried.repo-tabs.v1'
const LOCALE_KEY = 'git-fried.locale.v1'
const DETAIL_KEY = 'git-fried.detail-visible'

export interface SeededRepo {
  repoId: number
  path: string
  defaultBranch: string | null
  scenario: string
}

export interface DomSmoke {
  rootOverflow: boolean
  wrapped: string[]
  clipped: string[]
  offscreen: string[]
}

/** 실 WebView 의 raw invoke 훅으로 IPC 호출 (반환은 caller 가 cast). */
export async function invoke(page: Page, cmd: string, args: unknown): Promise<unknown> {
  return page.evaluate(
    ({ cmd, args }) =>
      (window as unknown as { __gitfriedTestInvoke: (c: string, a: unknown) => Promise<unknown> }).__gitfriedTestInvoke(
        cmd,
        args,
      ),
    { cmd, args },
  )
}

/** 훅 로드 대기 (reload 후 main.ts 가 dev-gated 로 재주입). */
export async function waitForInvokeHook(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as unknown as { __gitfriedTestInvoke?: unknown }).__gitfriedTestInvoke === 'function',
    undefined,
    { timeout: 20_000 },
  )
}

/** 가짜 저장소 seed (격리 DB 전제). repoId 반환. */
export async function seedFixture(page: Page, scenario: string, root: string, name: string): Promise<SeededRepo> {
  return (await invoke(page, 'seed_fixture_repo', { args: { scenario, root, name } })) as SeededRepo
}

/**
 * seed → localStorage 로 그 repo 탭 활성 → reload → repo-tab-bar 대기.
 * 실 백엔드 fixture 데이터가 UI 에 렌더되는 상태를 만든다(GAP-2 bridge).
 * 기존 mock helper(selectFrontendRepo)와 같은 부팅 패턴이되 동적 fixture repoId 사용.
 */
export async function seedFixtureAndOpenRepo(
  page: Page,
  scenario: string,
  root: string,
  name: string,
  openTab?: 'graph' | 'branches' | 'stash' | 'submodule' | 'lfs' | 'pr' | 'worktree',
): Promise<SeededRepo> {
  await waitForInvokeHook(page)
  const seeded = await seedFixture(page, scenario, root, name)
  await page.evaluate(
    ({ tabsKey, localeKey, detailKey, repoId }) => {
      localStorage.setItem(localeKey, 'ko')
      localStorage.setItem(tabsKey, JSON.stringify({ tabs: [repoId], active: repoId }))
      localStorage.setItem(detailKey, '1')
    },
    { tabsKey: TABS_KEY, localeKey: LOCALE_KEY, detailKey: DETAIL_KEY, repoId: seeded.repoId },
  )
  await page.reload()
  await page.locator('[data-testid="repo-tab-bar"]').waitFor({ state: 'visible', timeout: 20_000 })
  // mainView 는 useTabPerProfile 로 persist 되어 직전 run 의 탭(예: PR)이 복원될 수 있다.
  // 결정론을 위해 테스트가 원하는 중앙 탭을 명시 클릭 (PR 탭이면 forge 쿼리가 떠 로컬 fixture 에서
  // validation 에러를 렌더 → 불필요한 잡음).
  if (openTab) {
    await page.locator(`[data-testid="main-nav-${openTab}"]`).click({ timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
  return seeded
}

/**
 * DOM geometry smoke — 단일행 기대 요소 wrap / clip 된 overflow / offscreen clickable / root overflow.
 * ui-sweep.mjs 와 동일 로직 (CLAUDE.md § UI Breakage 의 자동 후보 추출). 최종 판정은 vision/추가 assert.
 */
export async function domSmoke(page: Page): Promise<DomSmoke> {
  return page.evaluate(() => {
    const tol = 2
    const out: { rootOverflow: boolean; wrapped: string[]; clipped: string[]; offscreen: string[] } = {
      rootOverflow: false,
      wrapped: [],
      clipped: [],
      offscreen: [],
    }
    const de = document.documentElement
    out.rootOverflow = de.scrollWidth > de.clientWidth + tol || document.body.scrollWidth > de.clientWidth + tol
    const vis = (el: Element): boolean => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const label = (el: Element): string =>
      (el.tagName.toLowerCase() + '.' + (el.className?.toString().slice(0, 60) || '')).slice(0, 80)
    const single =
      'button,[class*=pill],[class*=chip],[class*=tag],[class*=label],[class*=badge],[role=tab],[role=menuitem],th'
    for (const el of Array.from(document.querySelectorAll(single))) {
      if (!vis(el)) continue
      const cs = getComputedStyle(el)
      if (cs.whiteSpace === 'normal' && el.getClientRects().length > 1 && (el.textContent || '').trim()) {
        out.wrapped.push(label(el))
      }
    }
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (!vis(el)) continue
      const cs = getComputedStyle(el)
      if (
        (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflow === 'clip') &&
        el.scrollWidth > el.clientWidth + tol &&
        (el.textContent || '').trim() &&
        el.children.length <= 3
      ) {
        out.clipped.push(label(el))
      }
    }
    const vw = de.clientWidth
    const vh = de.clientHeight
    for (const el of Array.from(document.querySelectorAll('button,a,[role=button],[role=tab],input,select'))) {
      if (!vis(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right < -tol || r.bottom < -tol || r.left > vw + tol || r.top > vh + tol) {
        out.offscreen.push(label(el))
      }
    }
    const uniq = (a: string[]): string[] => [...new Set(a)]
    return { rootOverflow: out.rootOverflow, wrapped: uniq(out.wrapped), clipped: uniq(out.clipped).slice(0, 25), offscreen: uniq(out.offscreen) }
  })
}
