// 토스트 알림 — 글로벌 singleton.
// alert 를 대체하는 비-blocking 알림. 자동 사라짐, 클릭 시 닫기.
//
// Sprint 22-12 Q-6 — dedup (design 04 §7-2 / plan/22 §6).
// 같은 (kind, title) 의 toast 가 1초 내 중복 push 되면:
//   - 새 toast 생성 X
//   - 기존 toast 의 count + 1 → "(+N)" badge 표시
//   - duration 갱신 (마지막 trigger 기준 reset)
// 사용자 회사 50+ Gitea 레포 환경에서 같은 에러 반복 방지.
import { ref } from 'vue'

export type ToastKind = 'success' | 'info' | 'error' | 'warning'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  /** 본문 (선택). pre 처럼 표시 — git stderr 도 OK. */
  message?: string
  /** 자동 닫힘 ms. 0 이면 수동만. 디폴트: error=8000, success=3000, info=4000, warning=6000. */
  durationMs?: number
  /** Sprint 22-12 Q-6 — dedup count (1 이상). UI 에 "(+N)" 표시. */
  count: number
}

const toasts = ref<Toast[]>([])
let nextId = 1

// Sprint 22-12 Q-6 — dedup window. 같은 key 가 1초 내 도착하면 count++ 만.
const DEDUP_WINDOW_MS = 1_000
const dedupTimers = new Map<number, ReturnType<typeof setTimeout>>()

function dedupKey(kind: ToastKind, title: string): string {
  return `${kind}:${title}`
}

function defaultDuration(kind: ToastKind): number {
  switch (kind) {
    case 'success':
      return 3_000
    case 'info':
      return 4_000
    case 'warning':
      return 6_000
    case 'error':
      return 8_000
  }
}

function push(t: Omit<Toast, 'id' | 'count'>): number {
  const key = dedupKey(t.kind, t.title)
  const duration = t.durationMs ?? defaultDuration(t.kind)

  // dedup 검사 — 같은 (kind, title) 이 이미 활성 상태면 count + duration 갱신만.
  const existing = toasts.value.find((x) => dedupKey(x.kind, x.title) === key)
  if (existing) {
    existing.count += 1
    // body message 가 새로 들어왔으면 갱신 (마지막 trigger 의 detail).
    if (t.message) existing.message = t.message
    // duration 갱신 (마지막 trigger 기준).
    const prevTimer = dedupTimers.get(existing.id)
    if (prevTimer) clearTimeout(prevTimer)
    if (duration > 0) {
      dedupTimers.set(
        existing.id,
        setTimeout(() => dismiss(existing.id), duration),
      )
    }
    // reactivity trigger — find() 결과의 mutation 은 Vue 가 감지하지만,
    // 명시적 새 배열 생성으로 TransitionGroup 안전 update.
    toasts.value = [...toasts.value]
    return existing.id
  }

  const id = nextId++
  toasts.value = [...toasts.value, { id, count: 1, ...t }]
  if (duration > 0) {
    dedupTimers.set(
      id,
      setTimeout(() => dismiss(id), duration),
    )
  }
  return id
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
  const timer = dedupTimers.get(id)
  if (timer) clearTimeout(timer)
  dedupTimers.delete(id)
}

function clearAll() {
  for (const timer of dedupTimers.values()) clearTimeout(timer)
  dedupTimers.clear()
  toasts.value = []
}

export function useToast() {
  return {
    toasts,
    push,
    dismiss,
    clearAll,
    success: (title: string, message?: string, durationMs?: number) =>
      push({ kind: 'success', title, message, durationMs }),
    info: (title: string, message?: string, durationMs?: number) =>
      push({ kind: 'info', title, message, durationMs }),
    warning: (title: string, message?: string, durationMs?: number) =>
      push({ kind: 'warning', title, message, durationMs }),
    error: (title: string, message?: string, durationMs?: number) =>
      push({ kind: 'error', title, message, durationMs }),
  }
}

// Sprint 22-12 Q-6 — DEDUP_WINDOW_MS 는 향후 dedup 정책 확장 시 export.
export { DEDUP_WINDOW_MS }
