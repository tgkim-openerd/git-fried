// TST-502 (plan v0.9 Phase 4) — Tauri WebDriver smoke skeleton.
//
// 본 e2e/ 디렉토리의 다른 *.spec.ts 는 Playwright 가 일반 Chromium + devMock 활성으로 실행 —
// 실제 Tauri IPC 통과 안 함 (frontend 단독 smoke). 실 Tauri WebView + IPC 검증은 별도 도구
// `tauri-driver` 필요. Codex consultation (`task-mp554150`) PR-F 권고: bench → coverage →
// webdriver 순서. 플랫폼 의존 큼 (Windows: Edge WebView2 / macOS: WKWebView / Linux: WebKitGTK).
//
// === 실 실행 사용자 절차 (별도 sprint c89+ 진입 시) ===
//
// 1. tauri-driver install (Windows 기준 — Microsoft Edge WebDriver 동기화 필요):
//      cargo install tauri-driver --locked
//      # macOS: Safari WebDriver 사용 (시스템 내장)
//      # Linux: WebKitGTK WebDriver — apt install webkit2gtk-driver
//
// 2. Tauri release build (debug 빌드는 WebDriver 미지원 가능):
//      cd apps/desktop && bun tauri:build
//
// 3. tauri-driver 시작 + 본 spec 실행:
//      tauri-driver --port 4444 &
//      bun playwright test e2e/tauri-webdriver-smoke.spec.ts
//
// === 본 spec 상태 ===
//
// 현재 본 spec 은 **skeleton only** — `test.skip` 으로 default skip. 사용자 환경에서
// 위 절차 완료 후 `process.env.TAURI_WEBDRIVER=1` 설정 시 활성. PR-F (plan/33 Sprint c88+)
// 진입 시 본 skip 제거 + 실 Tauri IPC 검증 (예: invoke('list_repos') 응답 확인) 추가.
//
// 의존성: Playwright + Selenium WebDriver client (별도 dep — `@playwright/test` 만으로
// 부족). 본 sprint 는 dep 추가 안 함 — c89+ 에서 `selenium-webdriver` 또는
// `webdriver` (raw WebDriver client) 추가.

import { test, expect } from '@playwright/test'

const TAURI_WEBDRIVER_ENABLED = process.env.TAURI_WEBDRIVER === '1'

test.describe('Tauri WebDriver smoke (TST-502 plan v0.9)', () => {
  // Default skip — TAURI_WEBDRIVER env 활성 시만 실행.
  test.skip(!TAURI_WEBDRIVER_ENABLED, 'TST-502 skeleton — TAURI_WEBDRIVER=1 환경에서만 실행')

  test('tauri-driver port 4444 응답 확인 (placeholder)', async () => {
    // c89+ 실 구현 시:
    //   - import { Builder, By, until } from 'selenium-webdriver'
    //   - const driver = await new Builder().forBrowser('tauri').usingServer('http://localhost:4444').build()
    //   - await driver.get('tauri://localhost')
    //   - const title = await driver.getTitle()
    //   - expect(title).toBe('git-fried')
    //   - await driver.quit()
    //
    // 현 placeholder: env 활성 시도라도 즉시 skip 되도록 assertion 만.
    expect(TAURI_WEBDRIVER_ENABLED).toBe(true)
  })
})
