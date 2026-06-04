// /verify 2026-06-04 Layer 1 — Tauri 실 백엔드 e2e 핸들 (Playwright + WebView2 CDP).
//
// 기존 e2e (smoke/commit/...) 는 일반 Chromium + devMock(가짜 IPC). 본 헬퍼는 **실제 Tauri 앱**을
// `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port` 으로 띄워 CDP 를 열고,
// Playwright `connectOverCDP` 로 실 WebView2 페이지를 잡는다 → page.evaluate 로 **실 IPC** 호출.
//
// `tauri dev` 를 사용하는 이유: vite(devUrl) + dev 모드 바이너리(devUrl 로드)를 한 번에 띄워주고,
// 환경변수가 spawn 되는 WebView2 자식에 상속되어 CDP 포트가 열린다. (tauri:build 는 dist 임베드라
// devUrl 미사용 → vite 와 분리됨. dev 경로가 가장 단순.)

import { spawn, execFileSync, type ChildProcess } from 'node:child_process'

export interface TauriCdpHandle {
  cdpUrl: string
  pageUrl: string
  close: () => void
}

interface CdpTarget {
  type?: string
  url?: string
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * 실 Tauri 앱을 CDP 활성으로 띄우고 page 가 준비될 때까지 대기.
 * @param port  WebView2 remote debugging 포트
 * @param timeoutMs  빌드+launch+page ready 총 대기 (cold build ~70s+)
 */
export async function launchTauriWithCdp(port = 9222, timeoutMs = 200_000): Promise<TauriCdpHandle> {
  const cdpBase = `http://127.0.0.1:${port}`
  // tauri-rustup.mjs = cargo 툴체인 PATH-fix wrapper (chocolatey 1.60 함정 회피). repo root 기준.
  const proc: ChildProcess = spawn('node', ['scripts/tauri-rustup.mjs', 'dev'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    },
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })

  const close = (): void => {
    try {
      if (process.platform === 'win32' && proc.pid) {
        execFileSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { stdio: 'ignore' })
      } else {
        proc.kill('SIGTERM')
      }
    } catch {
      /* 이미 종료됨 */
    }
    // WebView2 앱은 별도 프로세스 트리일 수 있어 image 명으로도 정리.
    try {
      execFileSync('taskkill', ['/F', '/IM', 'git-fried.exe'], { stdio: 'ignore' })
    } catch {
      /* 없으면 무시 */
    }
  }

  const start = Date.now()
  let pageUrl = ''
  while (Date.now() - start < timeoutMs) {
    await sleep(2000)
    const list = await fetchJson(`${cdpBase}/json/list`)
    if (Array.isArray(list)) {
      const page = (list as CdpTarget[]).find(
        (t) => t.type === 'page' && typeof t.url === 'string' && t.url.includes('localhost:1420'),
      )
      if (page?.url) {
        pageUrl = page.url
        break
      }
    }
  }

  if (!pageUrl) {
    close()
    throw new Error(
      `[tauri-cdp] CDP page (localhost:1420) ${cdpBase} 에서 ${timeoutMs}ms 내 준비 안 됨. ` +
        `debug 빌드/툴체인(scripts/tauri-rustup.mjs) 확인.`,
    )
  }

  return { cdpUrl: cdpBase, pageUrl, close }
}
