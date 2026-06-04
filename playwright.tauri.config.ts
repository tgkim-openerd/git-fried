import { defineConfig } from '@playwright/test'

// /verify 2026-06-04 Layer 2 — 실 Tauri(WebView2 CDP) e2e 전용 config.
//
// 기존 playwright.config.ts 는 일반 Chromium + vite webServer + devMock(가짜 IPC).
// 본 config 는 tauri-guard.spec.ts 만 실행 — spec 의 beforeAll 이 실제 Tauri 앱을 CDP 로 띄우고
// connectOverCDP 로 잡는다. webServer/browser project 불필요 (tauri dev 가 vite 도 띄움).
//
// 실행: bun run test:e2e:tauri

export default defineConfig({
  testDir: './e2e',
  // 실 Tauri(CDP) 전용 스펙: 레거시 tauri-guard + `.tauri.spec.ts` 컨벤션(신규).
  testMatch: /(tauri-guard\.spec|\.tauri\.spec)\.ts$/,
  // 단일 앱 인스턴스 — serial.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // beforeAll 의 cold build(~70s) + launch + page ready 를 흡수.
  timeout: 240_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
})
