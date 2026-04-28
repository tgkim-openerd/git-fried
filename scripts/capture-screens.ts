/**
 * git-fried 디자인 캡처 스크립트 (`docs/plan/23` Sprint 23 / Phase 3 옵션 1).
 *
 * Vite dev (`bun run --cwd apps/desktop dev` → http://localhost:1420) 가
 * 떠 있는 상태에서 실행한다. apps/desktop/src/api/devMock.ts 의 fixture 가
 * 화면을 채운다.
 *
 * 사용:
 *   bun run --cwd apps/desktop dev   # 별도 터미널 또는 background
 *   bunx tsx scripts/capture-screens.ts
 *
 * 결과: docs/design-context/screenshots/*.png
 */

import { chromium, Page } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE_URL = process.env.GIT_FRIED_DEV_URL ?? 'http://localhost:1420'
const OUT_DIR = resolve(process.cwd(), 'docs/design-context/screenshots')
const VIEWPORT = { width: 1440, height: 900 }
const SETTLE_MS = 800 // Vue Query loading + Vue 렌더 대기

interface Shot {
  name: string
  path: string
  theme: 'light' | 'dark'
  /** 캡처 직전 page 조작 (예: 단축키 dispatch) */
  setup?: (page: Page) => Promise<void>
  /** 추가 안정화 대기 (ms). 모달처럼 전환이 있는 경우 늘림. */
  settleMs?: number
}

async function activateFirstRepo(page: Page) {
  // Sidebar 첫 repo row 클릭 — 'frontend' 텍스트 첫 매치 (frontend-admin 보다 위)
  const row = page.getByText(/^frontend$/).first()
  if (await row.count().catch(() => 0)) {
    await row.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(900)
  }
}

const SHOTS: Shot[] = [
  // 페이지 3개 × light/dark — 메인은 첫 레포 활성화
  {
    name: '01-main-light',
    path: '/',
    theme: 'light',
    setup: activateFirstRepo,
    settleMs: 300,
  },
  {
    name: '01-main-dark',
    path: '/',
    theme: 'dark',
    setup: activateFirstRepo,
    settleMs: 300,
  },
  { name: '02-launchpad-light', path: '/launchpad', theme: 'light' },
  { name: '02-launchpad-dark', path: '/launchpad', theme: 'dark' },
  { name: '03-settings-light', path: '/settings', theme: 'light' },
  { name: '03-settings-dark', path: '/settings', theme: 'dark' },

  // CommandPalette (⌘P)
  {
    name: '04-command-palette-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await page.keyboard.press('Control+p')
      await page.waitForTimeout(400)
    },
    settleMs: 200,
  },

  // Help modal (?)
  {
    name: '05-help-modal-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await page.keyboard.press('?')
      await page.waitForTimeout(400)
    },
    settleMs: 200,
  },

  // Commit diff modal (⌘D) — 첫 레포 활성화 + 첫 commit row 클릭 + ⌘D
  {
    name: '06-commit-diff-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      // CommitGraph 의 commit row — 실제 selector 모르므로 다양한 후보 시도
      const commitText = page.getByText(/feat\(r2a\)/).first()
      if (await commitText.count().catch(() => 0)) {
        await commitText.click({ timeout: 1500 }).catch(() => {})
        await page.waitForTimeout(300)
      }
      await page.keyboard.press('Control+d').catch(() => {})
      await page.waitForTimeout(800)
    },
    settleMs: 400,
  },

  // 추가 — Branch tab (⌘B) 로 BranchPanel 표시
  {
    name: '07-branch-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      await page.keyboard.press('Control+b').catch(() => {})
      await page.waitForTimeout(500)
    },
    settleMs: 200,
  },

  // 추가 — Stash tab (⌘3)
  {
    name: '08-stash-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      await page.keyboard.press('Control+3').catch(() => {})
      await page.waitForTimeout(500)
    },
    settleMs: 200,
  },

  // 추가 — PR tab
  {
    name: '09-pr-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      const prTab = page.getByText('PR', { exact: true }).first()
      if (await prTab.count().catch(() => 0)) {
        await prTab.click({ timeout: 1500 }).catch(() => {})
      }
      await page.waitForTimeout(600)
    },
    settleMs: 200,
  },

  // ─── 우측 메인 탭 nav ─────────────────────────────────────────
  {
    name: '10-submodule-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      const tab = page.getByText('Sub', { exact: true }).first()
      if (await tab.count().catch(() => 0)) await tab.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(500)
    },
    settleMs: 200,
  },
  {
    name: '11-lfs-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      const tab = page.getByText('LFS', { exact: true }).first()
      if (await tab.count().catch(() => 0)) await tab.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(500)
    },
    settleMs: 200,
  },
  {
    name: '12-worktree-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      const tab = page.getByText('WT', { exact: true }).first()
      if (await tab.count().catch(() => 0)) await tab.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(500)
    },
    settleMs: 200,
  },

  // ─── ForgePanel 4 sub-tab (PR 외 Tag/Issue/Release) ─────────
  {
    name: '13-tag-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      const prTab = page.getByText('PR', { exact: true }).first()
      if (await prTab.count().catch(() => 0)) await prTab.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(400)
      const tagTab = page.getByText('Tag', { exact: true }).first()
      if (await tagTab.count().catch(() => 0)) await tagTab.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(500)
    },
    settleMs: 200,
  },
  {
    name: '14-issue-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      const prTab = page.getByText('PR', { exact: true }).first()
      if (await prTab.count().catch(() => 0)) await prTab.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(400)
      // 'Issues' 또는 'Issue' 또는 한글 '이슈'
      for (const t of ['Issues', 'Issue', '이슈']) {
        const tab = page.getByText(t, { exact: true }).first()
        if (await tab.count().catch(() => 0)) {
          await tab.click({ timeout: 1500 }).catch(() => {})
          break
        }
      }
      await page.waitForTimeout(500)
    },
    settleMs: 200,
  },
  {
    name: '15-release-panel-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      const prTab = page.getByText('PR', { exact: true }).first()
      if (await prTab.count().catch(() => 0)) await prTab.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(400)
      for (const t of ['Releases', 'Release', '릴리스', '릴리즈']) {
        const tab = page.getByText(t, { exact: true }).first()
        if (await tab.count().catch(() => 0)) {
          await tab.click({ timeout: 1500 }).catch(() => {})
          break
        }
      }
      await page.waitForTimeout(500)
    },
    settleMs: 200,
  },

  // ─── Settings 카테고리 (light 모드) ──────────────────────────
  ...(['Forge 계정 (PAT)', 'General', 'UI Customization', 'Editor / Terminal', 'Repository-Specific', '유지보수', '마이그레이션', 'About'].map(
    (cat, i) => ({
      name: `16-settings-${String(i).padStart(2, '0')}-${cat.replace(/[^A-Za-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-light`,
      path: '/settings',
      theme: 'light' as const,
      setup: async (page: Page) => {
        const navItem = page.getByText(cat, { exact: true }).first()
        if (await navItem.count().catch(() => 0)) {
          await navItem.click({ timeout: 1500 }).catch(() => {})
        }
        await page.waitForTimeout(500)
      },
      settleMs: 200,
    }),
  )),

  // ─── Modal — 직접 단축키 ────────────────────────────────────
  {
    name: '24-create-pr-modal-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      await page.keyboard.press('Control+n').catch(() => {})
      await page.waitForTimeout(700)
    },
    settleMs: 200,
  },
  {
    name: '25-file-history-modal-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      await page.keyboard.press('Control+Shift+h').catch(() => {})
      await page.waitForTimeout(700)
    },
    settleMs: 200,
  },
  {
    name: '26-repo-switcher-modal-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      await page.keyboard.press('Control+Shift+p').catch(() => {})
      await page.waitForTimeout(700)
    },
    settleMs: 200,
  },

  // ─── Modal — palette 검색 → Enter ──────────────────────────
  ...([
    { name: '27-bisect-modal-dark', search: 'bisect' },
    { name: '28-compare-modal-dark', search: '비교' },
    { name: '29-reflog-modal-dark', search: 'reflog' },
    { name: '30-rebase-modal-dark', search: 'rebase' },
    { name: '31-sync-template-modal-dark', search: 'template' },
  ].map(({ name, search }) => ({
    name,
    path: '/',
    theme: 'dark' as const,
    setup: async (page: Page) => {
      await activateFirstRepo(page)
      await page.keyboard.press('Control+p')
      await page.waitForTimeout(350)
      await page.keyboard.type(search, { delay: 30 })
      await page.waitForTimeout(300)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(900)
    },
    settleMs: 300,
  }))),

  // ─── CommitDiffModal — Split mode 별도 ─────────────────────
  {
    name: '32-commit-diff-split-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      await activateFirstRepo(page)
      const commitText = page.getByText(/feat\(r2a\)/).first()
      if (await commitText.count().catch(() => 0)) {
        await commitText.click({ timeout: 1500 }).catch(() => {})
        await page.waitForTimeout(300)
      }
      await page.keyboard.press('Control+d').catch(() => {})
      await page.waitForTimeout(700)
      // Split 탭 클릭
      const splitTab = page.getByText('Split', { exact: true }).first()
      if (await splitTab.count().catch(() => 0)) await splitTab.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(500)
    },
    settleMs: 300,
  },

  // ─── Sidebar Clone modal — '↓ Clone' substring 매치 ────────
  {
    name: '33-clone-repo-modal-dark',
    path: '/',
    theme: 'dark',
    setup: async (page) => {
      // Sidebar 의 '↓ Clone' 또는 'Clone' substring
      const cloneBtn = page.getByRole('button', { name: /Clone/i }).first()
      const hit = await cloneBtn.count().catch(() => 0)
      if (hit) {
        await cloneBtn.click({ timeout: 1500 }).catch(() => {})
      } else {
        // fallback: text substring 매치
        const txt = page.locator('button', { hasText: /Clone/i }).first()
        if (await txt.count().catch(() => 0)) await txt.click({ timeout: 1500 }).catch(() => {})
      }
      await page.waitForTimeout(800)
    },
    settleMs: 300,
  },
]

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    localStorage.setItem('git-fried.theme', t)
  }, theme)
}

async function capture(page: Page, shot: Shot) {
  const url = BASE_URL + shot.path
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  // 테마 set + reload (apply 가 onMounted 에서)
  await setTheme(page, shot.theme)
  await page.reload({ waitUntil: 'networkidle', timeout: 30_000 })
  // Vue Query 의 loading state 가 fixture 응답 받고 settle
  await page.waitForTimeout(SETTLE_MS)
  if (shot.setup) {
    await shot.setup(page).catch((e) => {
      console.warn(`  [warn] setup 실패 (${shot.name}):`, (e as Error).message)
    })
  }
  if (shot.settleMs) await page.waitForTimeout(shot.settleMs)

  const file = resolve(OUT_DIR, `${shot.name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`  ✓ ${shot.name}.png`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log(`[capture] Vite dev: ${BASE_URL}`)
  console.log(`[capture] Out dir : ${OUT_DIR}`)
  console.log(`[capture] Viewport: ${VIEWPORT.width}×${VIEWPORT.height}`)
  console.log(`[capture] ${SHOTS.length} shots\n`)

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  })
  const page = await context.newPage()

  page.on('pageerror', (err) => {
    console.warn(`  [pageerror] ${err.message}`)
  })

  let ok = 0
  let fail = 0
  for (const shot of SHOTS) {
    try {
      await capture(page, shot)
      ok++
    } catch (e) {
      console.error(`  ✗ ${shot.name}: ${(e as Error).message}`)
      fail++
    }
  }

  await browser.close()
  console.log(`\n[capture] done: ${ok} ok, ${fail} failed → ${OUT_DIR}`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
