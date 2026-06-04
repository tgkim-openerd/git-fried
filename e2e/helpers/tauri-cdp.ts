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
 * @param port  WebView2 remote debugging 포트 (spec 별 unique — 충돌 회피)
 * @param timeoutMs  빌드+launch+page ready 총 대기 (cold build ~70s+)
 * @param envExtra  자식 프로세스에 추가 주입할 env (예: GIT_FRIED_DB_PATH 로 격리 DB)
 */
export async function launchTauriWithCdp(
  port = 9222,
  timeoutMs = 200_000,
  envExtra: Record<string, string> = {},
): Promise<TauriCdpHandle> {
  const cdpBase = `http://127.0.0.1:${port}`

  // DEFECT-4 — stale WebView2 가 같은 포트를 점유하면 격리 env(GIT_FRIED_DB_PATH) 우회로
  // 잘못된(실) DB 에 붙을 수 있다. spawn 전 선점검: 포트가 응답하면 lingering git-fried 정리 후
  // 재확인, 그래도 살아있으면 fail-fast (silent 잘못된-DB attach 방지).
  if (Array.isArray(await fetchJson(`${cdpBase}/json/list`))) {
    try {
      execFileSync('taskkill', ['/F', '/IM', 'git-fried.exe'], { stdio: 'ignore' })
    } catch {
      /* 없으면 무시 */
    }
    await sleep(1500)
    if (Array.isArray(await fetchJson(`${cdpBase}/json/list`))) {
      throw new Error(
        `[tauri-cdp] 포트 ${port} 가 stale 인스턴스에 점유됨 — git-fried.exe 수동 종료 후 재시도.`,
      )
    }
  }

  // tauri-rustup.mjs = cargo 툴체인 PATH-fix wrapper (chocolatey 1.60 함정 회피). repo root 기준.
  let procExited = false
  const proc: ChildProcess = spawn('node', ['scripts/tauri-rustup.mjs', 'dev'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
      ...envExtra,
    },
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  proc.on('exit', () => {
    procExited = true
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
    // 빌드/툴체인 실패로 tauri dev 가 조기 종료되면 full timeout 대기 대신 즉시 fail.
    if (procExited) {
      close()
      throw new Error('[tauri-cdp] tauri dev 프로세스가 조기 종료됨 (빌드/툴체인 실패 가능).')
    }
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
