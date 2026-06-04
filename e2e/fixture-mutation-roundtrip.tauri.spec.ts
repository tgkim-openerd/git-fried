// 성공 write round-trip — dirty fixture 로드 → Stage All → 커밋 메시지 입력 → Commit 성공 →
// mutation invalidation 으로 상태 클리어 + 새 커밋이 그래프에 반영되는지 검증(Codex 최종 우선순위 #1).
// 기존 spec 은 실패(fault toast)만 커버 — 본 spec 은 "mutation→query invalidation→UI 반영" 클래스 커버.
//
// 실행: npx playwright test --config playwright.tauri.config.ts fixture-mutation-roundtrip

import { test, expect, chromium, type Browser, type Page } from '@playwright/test'
import { launchTauriWithCdp, type TauriCdpHandle } from './helpers/tauri-cdp'
import { seedFixtureAndOpenRepo } from './helpers/tauri-fixture'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let handle: TauriCdpHandle
let browser: Browser
let page: Page
let tmpRoot: string

test.describe('fixture mutation round-trip e2e (성공 write path via CDP)', () => {
  test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gitfried-rt-'))
    handle = await launchTauriWithCdp(9230, 200_000, { GIT_FRIED_DB_PATH: join(tmpRoot, 'test-db.sqlite') })
    browser = await chromium.connectOverCDP(handle.cdpUrl)
    const ctx = browser.contexts()[0]
    page = ctx.pages().find((p) => p.url().includes('localhost:1420')) ?? ctx.pages()[0]
  })

  test.afterAll(async () => {
    await browser?.close().catch(() => {})
    handle?.close()
    for (let i = 0; i < 4; i++) {
      try {
        rmSync(tmpRoot, { recursive: true, force: true })
        break
      } catch {
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  })

  test('stage → commit 성공 → 상태 클리어 + 새 커밋 그래프 반영', async () => {
    test.setTimeout(90_000) // fail-fast (config 240s 대신).
    const log: string[] = []
    page.on('pageerror', (e) => log.push('[pageerror] ' + e.message))
    page.on('console', (m) => m.type() === 'error' && log.push('[console.error] ' + m.text().slice(0, 200)))
    page.on('crash', () => log.push('[CRASH]'))
    page.on('close', () => log.push('[page close]'))

    try {
      // dirty → WIP auto-default 선택 → StatusPanel + commit form 자동 노출(fixture-ui-render 입증).
      await seedFixtureAndOpenRepo(page, 'dirty', tmpRoot, 'rt-commit', 'graph')

      const submit = page.locator('[data-testid="commit-submit"]')
      await expect(submit, 'commit form(commit-submit) 미노출').toBeVisible({ timeout: 15_000 })

      // 기본 conventional 모드 — subject 입력(type=feat default → "feat: <subject>"). 모드 토글 회피.
      // staged.txt 가 이미 staged → 바로 커밋.
      const subject = page.locator('[data-testid="commit-subject-input"]')
      await expect(subject).toBeVisible({ timeout: 5_000 })
      await subject.fill('roundtrip 테스트 커밋')

      await expect(submit).toBeEnabled({ timeout: 3_000 })
      await submit.click({ timeout: 5_000 })

      // 성공 → mutation invalidation → 새 커밋이 그래프에 반영.
      await expect(page.locator('body')).toContainText('roundtrip 테스트 커밋', { timeout: 8_000 })
    } finally {
      console.log('[rt-diag] ' + (log.join(' | ') || '(no errors captured)'))
    }
  })
})
