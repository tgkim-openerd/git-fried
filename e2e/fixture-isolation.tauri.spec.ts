// 재사용 e2e — 격리 DB(GIT_FRIED_DB_PATH) + 가짜 저장소(seed_fixture_repo)로 핵심 IPC 를
// 실 백엔드(WebView2 CDP)에 대해 안전하게 검증한다. 실 DB/디스크 레포에 의존하지 않아 포터블.
//
// 안전 규약(Codex 설계 리뷰): OS keyring 은 격리 안 되므로 forge 토큰 IPC(save/delete) 호출 금지.
// AI/네트워크 IPC 도 fixture 로 커버 불가 — 본 스펙은 로컬 git 기반 IPC 만 다룬다.
//
// 실행: bun run test:e2e:tauri (또는 npx playwright test --config playwright.tauri.config.ts)

import { test, expect, chromium, type Browser, type Page } from '@playwright/test'
import { launchTauriWithCdp, type TauriCdpHandle } from './helpers/tauri-cdp'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let handle: TauriCdpHandle
let browser: Browser
let tmpRoot: string
let dbPath: string

/** 실 WebView page 의 raw invoke 훅으로 IPC 호출 (반환은 caller 가 cast). */
async function inv(page: Page, cmd: string, args: unknown): Promise<unknown> {
  return page.evaluate(
    ({ cmd, args }) =>
      (window as unknown as { __gitfriedTestInvoke: (c: string, a: unknown) => Promise<unknown> }).__gitfriedTestInvoke(
        cmd,
        args,
      ),
    { cmd, args },
  )
}

interface SeededRepo {
  repoId: number
  path: string
  defaultBranch: string | null
}

test.describe('fixture 격리 e2e (가짜 저장소 + 격리 DB via CDP)', () => {
  test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gitfried-e2e-'))
    dbPath = join(tmpRoot, 'test-db.sqlite')
    // unique port(9224) + GIT_FRIED_DB_PATH 주입 → 실 DB 미접근.
    handle = await launchTauriWithCdp(9224, 200_000, { GIT_FRIED_DB_PATH: dbPath })
    browser = await chromium.connectOverCDP(handle.cdpUrl)
  })

  test.afterAll(async () => {
    await browser?.close().catch(() => {})
    handle?.close()
    // DEFECT-5 — close() 의 taskkill 후 Windows 가 SQLite WAL/SHM 핸들을 놓을 때까지 짧게
    // 대기 + 재시도 (즉시 rmSync 는 EBUSY 가능). 마지막까지 실패하면 OS temp reaper 의존.
    for (let i = 0; i < 4; i++) {
      try {
        rmSync(tmpRoot, { recursive: true, force: true })
        break
      } catch {
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  })

  async function realPage(): Promise<Page> {
    const ctx = browser.contexts()[0]
    const page = ctx.pages().find((p) => p.url().includes('localhost:1420')) ?? ctx.pages()[0]
    await page.waitForFunction(
      () => typeof (window as unknown as { __gitfriedTestInvoke?: unknown }).__gitfriedTestInvoke === 'function',
      undefined,
      { timeout: 20_000 },
    )
    return page
  }

  test('격리 DB 확인 — 부팅 직후 레포 0 (실 DB 미접근 + startup backfill no-op)', async () => {
    const page = await realPage()
    const repos = (await inv(page, 'list_repos', { workspaceId: null })) as unknown[]
    // GIT_FRIED_DB_PATH 격리가 동작하면 실 사용자의 163개가 아니라 빈 DB.
    // backfill_auto_match / backfill_forge_meta 가 empty DB 에서 graceful no-op 임도 동시 확인.
    expect(repos.length).toBe(0)
  })

  test('fixture seed + 핵심 로컬 git IPC 스모크', async () => {
    const page = await realPage()

    const basic = (await inv(page, 'seed_fixture_repo', {
      args: { scenario: 'basic', root: tmpRoot, name: 'basic1' },
    })) as SeededRepo
    const branches = (await inv(page, 'seed_fixture_repo', {
      args: { scenario: 'branches', root: tmpRoot, name: 'branches1' },
    })) as SeededRepo
    const dirty = (await inv(page, 'seed_fixture_repo', {
      args: { scenario: 'dirty', root: tmpRoot, name: 'dirty1' },
    })) as SeededRepo
    const stash = (await inv(page, 'seed_fixture_repo', {
      args: { scenario: 'stash', root: tmpRoot, name: 'stash1' },
    })) as SeededRepo
    const conflict = (await inv(page, 'seed_fixture_repo', {
      args: { scenario: 'conflict', root: tmpRoot, name: 'conflict1' },
    })) as SeededRepo

    // Codex 검수 조건 — canonical 경로(Windows 는 `\\?\` 가능)가 IPC 를 통과하는지.
    console.log(`[verify] basic fixture path = ${basic.path}`)

    // get_log: basic = 3 commit
    const log = (await inv(page, 'get_log', { args: { repoId: basic.repoId, limit: 50 } })) as unknown[]
    expect(log.length).toBe(3)

    // list_branches: main + feature
    const brs = (await inv(page, 'list_branches', { repoId: branches.repoId })) as { name: string }[]
    const names = brs.map((b) => b.name)
    expect(names).toContain('main')
    expect(names).toContain('feature')

    // get_status: dirty = staged>=1 && unstaged>=1, 깨끗하지 않음
    const st = (await inv(page, 'get_status', { repoId: dirty.repoId })) as {
      staged: unknown[]
      unstaged: unknown[]
      isClean: boolean
    }
    expect(st.isClean).toBe(false)
    expect(st.staged.length).toBeGreaterThanOrEqual(1)
    expect(st.unstaged.length).toBeGreaterThanOrEqual(1)

    // get_status: basic = clean (canonical 경로 통과 + 정상 응답)
    const stClean = (await inv(page, 'get_status', { repoId: basic.repoId })) as { isClean: boolean }
    expect(stClean.isClean).toBe(true)

    // list_stash: stash 시나리오 = 1개
    const stashes = (await inv(page, 'list_stash', { repoId: stash.repoId })) as unknown[]
    expect(stashes.length).toBe(1)

    // get_status: conflict 시나리오 = 충돌 상태(MERGE_HEAD + unmerged) → conflicted 비어있지 않음.
    // (DEFECT-1 회귀 가드 — 분기만 만들고 머지 안 하면 여기서 잡힘.)
    const stConf = (await inv(page, 'get_status', { repoId: conflict.repoId })) as {
      conflicted: unknown[]
    }
    expect(stConf.conflicted.length).toBeGreaterThanOrEqual(1)

    // 격리 재확인 — 등록된 레포는 정확히 seed 한 5개 (실 163개 누출 없음).
    const repos = (await inv(page, 'list_repos', { workspaceId: null })) as unknown[]
    expect(repos.length).toBe(5)
  })
})
