// IPC invoke timeout wrapper (`docs/plan/22 §2 C4`).
//
// Tauri 의 `invoke` 는 timeout 미지원 — Rust 가 hang 되거나 git CLI 가 느리면
// frontend 가 무한 대기. 이를 wrapping 해서:
//   - 일반 명령: 30s timeout
//   - long-running (bulk_* / clone_repo / fetch_all / push / pull / ai_*): 5min
//   - 명시 비활성 (timeoutMs: 0): timeout 안 함
// timeout 시 reject 되어 useToast 의 onError 가 자동 표시.
//
// Sprint c30 / MED 1 — Network-flaky retry policy:
//   network IO 가 핵심인 명령 (clone_/fetch_/pull/push) 은 transient 실패 시
//   exponential backoff 1회 retry. timeout 자체는 재시도하지 않음 (retry 시
//   사용자 cancel 의지 가능). 인증 실패 (401/403) 도 재시도하지 않음.

import { invoke as nativeInvoke } from '@tauri-apps/api/core'
import { isMockEnabled, mockInvoke } from './devMock'
import {
  registerOperation as registerLongOp,
  completeOperation as completeLongOp,
} from '@/composables/useLongRunningProgress'

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

/**
 * Retry-eligible network commands (Sprint c30 / MED 1).
 * - clone/fetch/pull/push: transient TCP/TLS handshake fail 다수.
 * - bulk_*: 50+ 레포 일괄 fetch 시 일부 실패 ok.
 * - 인증성 실패는 별도 분기로 retry 안 함.
 */
const RETRYABLE_PREFIXES = ['clone_', 'fetch_', 'pull', 'push', 'bulk_fetch']

const RETRY_BACKOFF_MS = 800

function isLongRunning(cmd: string): boolean {
  return LONG_RUNNING_PREFIXES.some((p) => cmd.startsWith(p))
}

function isRetryable(cmd: string): boolean {
  return RETRYABLE_PREFIXES.some((p) => cmd.startsWith(p))
}

/**
 * Retry-금지 에러 패턴.
 *
 * 인증/권한/사용자 cancel/timeout/Validation 등 재시도해도 동일 결과.
 * 토큰 케이스 무관 substring 매칭.
 */
const NON_RETRYABLE_PATTERNS = [
  /401\b|403\b/, // HTTP auth
  /authentication|unauthor/i,
  /permission denied/i,
  /not found|404\b/i,
  /cancelled|canceled|abort/i,
  /IPC timeout/i, // self-timeout — retry 시 사용자 의지에 어긋남
  /validation|invalid input/i,
]

function isRetryableError(err: unknown): boolean {
  // string 또는 { message } 모두 검사.
  let msg = ''
  if (typeof err === 'string') {
    msg = err
  } else if (err && typeof err === 'object') {
    const e = err as { message?: unknown; kind?: unknown }
    if (typeof e.message === 'string') msg = e.message
    if (typeof e.kind === 'string') {
      // AppError serialization → kind 직접 비교.
      if (e.kind === 'validation' || e.kind === 'auth_expired' || e.kind === 'rate_limit') {
        return false
      }
    }
  }
  if (!msg) return true // 알 수 없으면 retry
  return !NON_RETRYABLE_PATTERNS.some((p) => p.test(msg))
}

export interface InvokeOptions {
  /** 0 = no timeout (사용자 명시 long-running). undefined = 자동 (30s 또는 5min) */
  timeoutMs?: number
  /**
   * Long-running progress banner 라벨 (Sprint E-4).
   * undefined 면 long-running prefix 자동 감지 시 cmd 를 라벨로 사용.
   * empty string ('') = 자동 감지도 비활성 (banner 표시 안 함).
   */
  progressLabel?: string
  /**
   * Sprint c30 / MED 1 — retry 정책 override.
   * undefined: prefix 자동 (clone_/fetch_/pull/push/bulk_fetch).
   * 0: retry 비활성.
   * 1+: 명시 retry 횟수.
   */
  retry?: number
}

/**
 * Single-shot invoke with timeout (재시도 없음).
 * retry 로직은 상위 `invoke()` 가 담당.
 */
function invokeOnce<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  timeoutMs: number,
  finalize: () => void,
): Promise<T> {
  if (timeoutMs === 0) {
    const p = nativeInvoke<T>(cmd, args)
    p.finally(finalize)
    return p
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      finalize()
      reject(
        new Error(
          `IPC timeout: '${cmd}' 가 ${(timeoutMs / 1000).toFixed(0)}초 안에 응답하지 않았습니다. ` +
            `(작업이 정말 오래 걸린다면 Settings 에서 timeout 늘리거나 git CLI 가 응답 중인지 확인)`,
        ),
      )
    }, timeoutMs)
    nativeInvoke<T>(cmd, args)
      .then((v) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        finalize()
        resolve(v)
      })
      .catch((e) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        finalize()
        reject(e)
      })
  })
}

export function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  opts?: InvokeOptions,
): Promise<T> {
  // dev-only mock: Tauri webview 부재 시 fixture 응답 (`docs/plan/23`).
  // 실 Tauri webview / production 빌드는 자동 우회.
  if (isMockEnabled()) {
    return mockInvoke<T>(cmd, args)
  }

  const long = isLongRunning(cmd)
  const t = opts?.timeoutMs ?? (long ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)

  // Long-running banner 등록 (Sprint E-4 / docs/plan/24 §7-1 E-4)
  const label = opts?.progressLabel === '' ? null : (opts?.progressLabel ?? (long ? cmd : null))
  const opId = label != null ? registerLongOp(label) : null

  const finalize = () => {
    if (opId != null) completeLongOp(opId)
  }

  // Sprint c30 / MED 1 — Retry 정책 결정.
  // explicit `opts.retry` 가 있으면 우선, 없으면 prefix 자동 (1회).
  const retryCount = opts?.retry !== undefined ? Math.max(0, opts.retry) : isRetryable(cmd) ? 1 : 0

  if (retryCount === 0) {
    return invokeOnce<T>(cmd, args, t, finalize)
  }

  // retry: finalize 는 정확히 한 번 (성공/최종 실패 시점).
  // 중간 실패 (retry 진행) 에서는 호출 금지.
  let attemptsLeft = retryCount + 1 // 첫 시도 + retry N
  let finalizedOnce = false
  const finalizeOnce = (): void => {
    if (finalizedOnce) return
    finalizedOnce = true
    finalize()
  }
  const tryOnce = (): Promise<T> => {
    attemptsLeft -= 1
    // invokeOnce 의 inner finalize 는 noop — 외부에서 직접 finalizeOnce 제어.
    return invokeOnce<T>(cmd, args, t, () => undefined).then(
      (v) => {
        finalizeOnce()
        return v
      },
      (err) => {
        const isLast = attemptsLeft === 0
        if (isLast || !isRetryableError(err)) {
          finalizeOnce()
          throw err
        }
        // backoff 후 재시도.
        return new Promise<T>((resolve, reject) => {
          setTimeout(() => {
            tryOnce().then(resolve, reject)
          }, RETRY_BACKOFF_MS)
        })
      },
    )
  }
  return tryOnce()
}
