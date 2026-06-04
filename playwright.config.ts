import { defineConfig, devices } from '@playwright/test'

// Playwright E2E config — local-only smoke (CI 합류는 follow-up).
//
// 실행:
//   bun run test:e2e           # smoke 전체 (vite dev 자동 부팅 + reuse)
//   bun playwright test --ui   # UI 모드 (debug)
//
// 주의: Tauri webview 가 아닌 일반 Chromium 에서 동작 (devMock 활성).
// 실 Tauri E2E 는 별도 — webdriver 또는 manual 검증 필요.

export default defineConfig({
  testDir: './e2e',
  // 실 Tauri(CDP) 전용 스펙(tauri-guard + `.tauri.spec.ts`) 은 playwright.tauri.config.ts 로만 실행.
  // 기본(mock Chromium) config 에서는 제외 (실 앱 launch 가 mock 컨텍스트와 충돌).
  testIgnore: /(tauri-guard\.spec|\.tauri\.spec)\.ts$/,
  // PERF-305 (Codex R1 + Build agent agreed) — 병렬 e2e. CI 는 보수적 (2 worker), local 4.
  // dev server 1 instance reuse (webServer.reuseExistingServer=true) 로 race 회피.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'bun run --cwd apps/desktop dev',
    url: 'http://localhost:1420',
    timeout: 60_000,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
