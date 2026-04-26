// 토스트 알림 — 글로벌 singleton.
// alert 를 대체하는 비-blocking 알림. 자동 사라짐, 클릭 시 닫기.
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
}

const toasts = ref<Toast[]>([])
let nextId = 1

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

function push(t: Omit<Toast, 'id'>): number {
  const id = nextId++
  const duration = t.durationMs ?? defaultDuration(t.kind)
  toasts.value = [...toasts.value, { id, ...t }]
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function clearAll() {
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
