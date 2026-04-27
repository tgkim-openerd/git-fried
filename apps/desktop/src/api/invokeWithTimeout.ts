// IPC invoke timeout wrapper (`docs/plan/22 §2 C4`).
//
// Tauri 의 `invoke` 는 timeout 미지원 — Rust 가 hang 되거나 git CLI 가 느리면
// frontend 가 무한 대기. 이를 wrapping 해서:
//   - 일반 명령: 30s timeout
//   - long-running (bulk_* / clone_repo / fetch_all / push / pull / ai_*): 5min
//   - 명시 비활성 (timeoutMs: 0): timeout 안 함
// timeout 시 reject 되어 useToast 의 onError 가 자동 표시.

import { invoke as nativeInvoke } from '@tauri-apps/api/core'

const DEFAULT_TIMEOUT_MS = 30_000
const LONG_TIMEOUT_MS = 5 * 60_000

const LONG_RUNNING_PREFIXES = [
  'bulk_',
  'clone_',
  'fetch_',
  'pull',
  'push',
  'ai_',
  'maintenance_', // gc / fsck (큰 레포 5분+)
  'import_gitkraken_apply',
]

function isLongRunning(cmd: string): boolean {
  return LONG_RUNNING_PREFIXES.some((p) => cmd.startsWith(p))
}

export interface InvokeOptions {
  /** 0 = no timeout (사용자 명시 long-running). undefined = 자동 (30s 또는 5min) */
  timeoutMs?: number
}

export function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  opts?: InvokeOptions,
): Promise<T> {
  const t =
    opts?.timeoutMs ?? (isLongRunning(cmd) ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)

  // timeout 0 = 비활성
  if (t === 0) {
    return nativeInvoke<T>(cmd, args)
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(
        new Error(
          `IPC timeout: '${cmd}' 가 ${(t / 1000).toFixed(0)}초 안에 응답하지 않았습니다. ` +
            `(작업이 정말 오래 걸린다면 Settings 에서 timeout 늘리거나 git CLI 가 응답 중인지 확인)`,
        ),
      )
    }, t)
    nativeInvoke<T>(cmd, args)
      .then((v) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(e)
      })
  })
}
