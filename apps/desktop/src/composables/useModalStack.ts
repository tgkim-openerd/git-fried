// plan #44 A1 — modal/overlay stack manager.
//
// 중첩 overlay(modal-over-modal, palette-over-modal) 에서 발생하던 4 결함을 해소:
//   1. focus-trap 경쟁 — 열린 modal 마다 window keydown 핸들러가 Tab 을 가로채 하위 modal 이
//      상위 modal 의 focus 를 빼앗음 → top 만 trap 활성 (isTop gate).
//   2. Esc 모호 — Esc 가 top overlay 하나만 닫도록 (isTop gate).
//   3. z 계층 — DOM teleport 순서로 자연 stacking 되나, 농도(backdrop)는 depth 로 판정.
//   4. backdrop double-darken (A4) — bottom(depth 0) 만 dark, 그 위는 transparent.
//
// 모듈-스코프 ref singleton (createGlobalState 미사용 정책 정합 — usePullStrategy / useToast 와 동일).
// BaseModal + CommandPalette 이 useModalStackEntry(open) 으로 진입/이탈 자동 등록.
import { computed, onBeforeUnmount, readonly, ref, watch, type Ref } from 'vue'

let seq = 0
const stack = ref<number[]>([])

function register(): number {
  const token = ++seq
  stack.value = [...stack.value, token]
  return token
}

function release(token: number): void {
  const i = stack.value.indexOf(token)
  if (i === -1) return
  const next = stack.value.slice()
  next.splice(i, 1)
  stack.value = next
}

function isTop(token: number): boolean {
  const s = stack.value
  return s.length > 0 && s[s.length - 1] === token
}

function depth(token: number): number {
  return stack.value.indexOf(token)
}

export function useModalStack() {
  return {
    stack: readonly(stack),
    size: computed<number>(() => stack.value.length),
    register,
    release,
    isTop,
    depth,
  }
}

/**
 * BaseModal / CommandPalette 가 호출 — open 이 true 가 되는 tick 에 stack 등록,
 * false / unmount 시 이탈. isTop(focus-trap·Esc gate) / depth(backdrop 농도) 를 반응형으로 노출.
 */
export function useModalStackEntry(isOpen: Readonly<Ref<boolean>>) {
  const mgr = useModalStack()
  const token = ref<number | null>(null)

  watch(
    isOpen,
    (open) => {
      if (open) {
        if (token.value == null) token.value = mgr.register()
      } else if (token.value != null) {
        mgr.release(token.value)
        token.value = null
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (token.value != null) {
      mgr.release(token.value)
      token.value = null
    }
  })

  const isTopEntry = computed<boolean>(() => token.value != null && mgr.isTop(token.value))
  const depthEntry = computed<number>(() => (token.value != null ? mgr.depth(token.value) : 0))

  return { isTop: isTopEntry, depth: depthEntry }
}
