// a11y smoke — 가시 상호작용 요소(button/link/role=button/input 등)가 accessible name 을 갖는지
// 검증 (screen-reader 핵심). axe 없이 경량 DOM 스캔. CLAUDE.md UI 깨짐 cat 7(접근성 회귀) 일부.
//
// 실행: npx playwright test --config playwright.tauri.config.ts fixture-a11y

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

/** 가시 상호작용 요소 중 accessible name 없는 것 추출. */
async function unnamedInteractive(p: Page): Promise<string[]> {
  return p.evaluate(() => {
    const out: string[] = []
    const sel = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], input, select, textarea'
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const labelledby = el.getAttribute('aria-labelledby')
      const labelledText = labelledby
        ? labelledby
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() || '')
            .join(' ')
        : ''
      const name = (
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        (el.textContent || '').trim() ||
        labelledText ||
        (el.tagName === 'INPUT' ? el.getAttribute('placeholder') || '' : '')
      ).trim()
      if (!name) out.push((el.tagName.toLowerCase() + '.' + (el.className?.toString().slice(0, 50) || '')).slice(0, 70))
    }
    return [...new Set(out)]
  })
}

test.describe('fixture a11y smoke (accessible name via CDP)', () => {
  test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gitfried-a11y-'))
    handle = await launchTauriWithCdp(9229, 200_000, { GIT_FRIED_DB_PATH: join(tmpRoot, 'test-db.sqlite') })
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

  test('그래프 화면 — 가시 상호작용 요소 accessible name 보유', async () => {
    await seedFixtureAndOpenRepo(page, 'basic', tmpRoot, 'a11y-repo', 'graph')
    await page.waitForTimeout(800)
    const unnamed = await unnamedInteractive(page)
    console.log(`[a11y] graph unnamed (${unnamed.length}): ${unnamed.join(' | ')}`)
    expect(unnamed, `accessible name 없는 요소(graph): ${unnamed.join(', ')}`).toEqual([])
  })

  test('settings 화면 — 폼 컨트롤 accessible name 보유', async () => {
    await page.goto('http://localhost:1420/settings')
    await page.waitForTimeout(800)
    const unnamed = await unnamedInteractive(page)
    console.log(`[a11y] settings unnamed (${unnamed.length}): ${unnamed.join(' | ')}`)
    expect(unnamed, `accessible name 없는 요소(settings): ${unnamed.join(', ')}`).toEqual([])
  })
})
