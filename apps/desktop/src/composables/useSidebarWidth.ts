// UltraPlan v0.4 sidebar GitKraken DIFF — SB-001 fix.
//
// Sidebar 너비 사용자 drag 조정 + localStorage 영속.
// GitKraken parity: drag handle 로 사용자 조정 가능, 200~400px 범위.
//
// Pattern 8 (idempotent navigation guard) sister — composable 내부 reactive ref +
// caller 가 grid-cols dynamic binding 으로 활용.

import { ref, watch, type Ref } from 'vue'

const STORAGE_KEY = 'git-fried.sidebar-width.v1'
export const SIDEBAR_WIDTH_MIN = 180
export const SIDEBAR_WIDTH_MAX = 400
export const SIDEBAR_WIDTH_DEFAULT = 220

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SIDEBAR_WIDTH_DEFAULT
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT
    return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, n))
  } catch {
    return SIDEBAR_WIDTH_DEFAULT
  }
}

let _widthRef: Ref<number> | null = null

/** Singleton (App.vue 와 Sidebar 가 같은 width state 참조). */
export function useSidebarWidth(): Ref<number> {
  if (_widthRef) return _widthRef
  _widthRef = ref(loadWidth())
  watch(_widthRef, (n) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(n))
    } catch {
      /* localStorage 차단 환경 — silent fallback. */
    }
  })
  return _widthRef
}

/** drag handle 의 pointer event 처리 — `pointerdown` 후 `pointermove` 로 width 갱신. */
export function startSidebarResize(
  e: PointerEvent,
  widthRef: Ref<number>,
  opts: { onCommit?: (w: number) => void } = {},
): void {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = widthRef.value
  const target = e.currentTarget as HTMLElement | null
  target?.setPointerCapture?.(e.pointerId)

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX
    const next = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, startWidth + dx))
    widthRef.value = next
  }
  const onUp = (ev: PointerEvent) => {
    target?.releasePointerCapture?.(e.pointerId)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    opts.onCommit?.(widthRef.value)
    void ev
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
