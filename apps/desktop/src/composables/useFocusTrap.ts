// Focus trap — 모달 내부 Tab 순환 + 열릴 때 자동 focus + 닫힐 때 직전 focus 복원
// (`docs/plan/22 §5 Q-2`, WCAG 2.1 AA: 2.1.2 No Keyboard Trap, 2.4.3 Focus Order).
//
// 사용 패턴:
//   const root = useTemplateRef<HTMLElement>('rootRef')
//   useFocusTrap(root, computed(() => props.open))
//
//   <div ref="rootRef" v-if="open">...</div>
//
// 동작:
//   - open=true 가 되는 watch tick 에서 rootRef 내 첫 focusable 에 focus()
//   - Tab/Shift+Tab 가 마지막/첫 focusable 에서 wrap (외부로 못 나감)
//   - open=false 가 되면 모달 열리기 직전 활성 요소로 focus 복원
//
// focusable 셀렉터:
//   button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])
//   * disabled / aria-hidden 제외

import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE_SEL =
  'button:not([disabled]):not([tabindex="-1"]),[href]:not([tabindex="-1"]),' +
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]),' +
  'select:not([disabled]):not([tabindex="-1"]),' +
  'textarea:not([disabled]):not([tabindex="-1"]),' +
  '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])'

export function useFocusTrap(
  rootRef: Readonly<Ref<HTMLElement | null>>,
  isOpen: Readonly<Ref<boolean>>,
) {
  let prevActive: HTMLElement | null = null

  function getFocusables(): HTMLElement[] {
    const root = rootRef.value
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !isOpen.value) return
    const focusables = getFocusables()
    if (focusables.length === 0) {
      e.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (e.shiftKey) {
      // Shift+Tab — 첫 요소에서 마지막으로 wrap
      if (active === first || !rootRef.value?.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      // Tab — 마지막 요소에서 첫 요소로 wrap
      if (active === last || !rootRef.value?.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  watch(
    isOpen,
    (open) => {
      if (open) {
        prevActive = document.activeElement as HTMLElement | null
        window.addEventListener('keydown', onKeydown, { capture: true })
        // 모달 DOM 이 mount 된 다음 tick 에 focus
        void nextTick(() => {
          const focusables = getFocusables()
          if (focusables.length > 0) focusables[0].focus()
          else rootRef.value?.focus()
        })
      } else {
        window.removeEventListener('keydown', onKeydown, { capture: true })
        // 직전 focus 복원 — 단 모달이 닫힐 때 외부로 자연 이동했다면 그대로 둠
        if (prevActive && document.body.contains(prevActive)) {
          prevActive.focus()
        }
        prevActive = null
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown, { capture: true })
  })
}
