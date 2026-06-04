// /verify 2026-06-04 Layer 2 — repo_mutation_guard 직렬화 full-stack e2e (실 Tauri IPC via CDP).
//
// 기존 e2e (smoke 등) 는 일반 Chromium + devMock 이라 실 백엔드 미통과. 본 spec 은 실제 Tauri 앱을
// WebView2 CDP 로 잡아 **실 IPC `guard_probe`** 를 동시 발사 → guard 직렬화/동시성을 관찰한다.
//
// 관찰 패턴 (Codex 권고): 순수 timing 이 아니라 enter/leave ordering.
//   - 같은 repo: 두 호출의 critical section([enterMs, leaveMs]) 이 겹치지 않음 (enter2 >= leave1).
//   - 다른 repo: critical section 이 겹침 (enter2 < leave1) — network/UX starvation 회피의 근거.
//
// 실행: bun run test:e2e:tauri   (playwright.tauri.config.ts)
// 전제: scripts/tauri-rustup.mjs 로 tauri dev 빌드 가능 (cargo 툴체인 PATH-fix).

import { test, expect, chromium, type Browser, type Page } from '@playwright/test'
import { launchTauriWithCdp, type TauriCdpHandle } from './helpers/tauri-cdp'

interface ProbeResult {
  token: string
  enterMs: number
  leaveMs: number
}

let handle: TauriCdpHandle
let browser: Browser

test.describe('Tauri guard 직렬화 (실 백엔드 via CDP)', () => {
  test.beforeAll(async () => {
    handle = await launchTauriWithCdp(9222)
    browser = await chromium.connectOverCDP(handle.cdpUrl)
  })

  test.afterAll(async () => {
    await browser?.close().catch(() => {})
    handle?.close()
  })

  async function realPage(): Promise<Page> {
    const ctx = browser.contexts()[0]
    const page = ctx.pages().find((p) => p.url().includes('localhost:1420')) ?? ctx.pages()[0]
    // dev-gated raw invoke 훅 로드 대기.
    await page.waitForFunction(
      () => typeof (window as unknown as { __gitfriedTestInvoke?: unknown }).__gitfriedTestInvoke === 'function',
      undefined,
      { timeout: 20_000 },
    )
    return page
  }

  // 같은 page.evaluate 안에서 두 guard_probe 를 Promise.all 로 동시 발사 → 두 결과 반환.
  async function fireConcurrent(
    page: Page,
    repoA: number,
    repoB: number,
    delayMs: number,
  ): Promise<[ProbeResult, ProbeResult]> {
    return page.evaluate(
      async ({ repoA, repoB, delayMs }) => {
        const invoke = (window as unknown as { __gitfriedTestInvoke: (cmd: string, args: unknown) => Promise<ProbeResult> })
          .__gitfriedTestInvoke
        const [a, b] = await Promise.all([
          invoke('guard_probe', { args: { repoId: repoA, delayMs, token: 'A' } }),
          invoke('guard_probe', { args: { repoId: repoB, delayMs, token: 'B' } }),
        ])
        return [a, b] as [ProbeResult, ProbeResult]
      },
      { repoA, repoB, delayMs },
    )
  }

  test('실 Tauri bridge 도달 (__gitfriedTestInvoke 존재)', async () => {
    const page = await realPage()
    const ok = await page.evaluate(
      () => typeof (window as unknown as { __gitfriedTestInvoke?: unknown }).__gitfriedTestInvoke === 'function',
    )
    expect(ok).toBe(true)
  })

  test('같은 repo: 동시 guard_probe 가 직렬화 (critical section 미겹침)', async () => {
    const page = await realPage()
    const res = await fireConcurrent(page, 999001, 999001, 300)
    const [first, second] = [...res].sort((x, y) => x.enterMs - y.enterMs)
    // 나중에 진입한 쪽은 먼저 끝난 쪽 leave 이후에 critical section 시작 (직렬화).
    // 5ms slack — ms 해상도/스케줄 지터 흡수.
    expect(second.enterMs).toBeGreaterThanOrEqual(first.leaveMs - 5)
  })

  test('다른 repo: 동시 guard_probe 가 동시 실행 (critical section 겹침)', async () => {
    const page = await realPage()
    const res = await fireConcurrent(page, 999101, 999102, 300)
    const [first, second] = [...res].sort((x, y) => x.enterMs - y.enterMs)
    // 직렬화 안 됨 → 나중 enter 가 먼저 leave 전에 시작 (겹침).
    expect(second.enterMs).toBeLessThan(first.leaveMs)
  })
})
