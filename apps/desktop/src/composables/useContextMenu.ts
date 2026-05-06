// Sprint c48 Wave B-1 — ContextMenu.vue script 316 LOC → 80 LOC 추출.
//
// 본 composable 은 우클릭 ContextMenu 의 imperative 로직 전부 담당:
//   - 상태: items / open / 좌표 / focused index (메인 + submenu)
//   - 액션: openAt / close / openSubmenu / onItemClick / onSubItemClick (destructive confirm 포함)
//   - 키보드: ↑↓ Enter Esc → ← (메인 + submenu 분기)
//   - 포커스 동기화: moveFocus / moveSubFocus / focusVisibleMenuItem / focusSubMenuItem
//   - viewport edge 회피: clampToViewport / clampSubmenuToViewport
//   - outside-click 감지 + lifecycle (mount/unmount window listener)
//
// SFC 는 template + 두 ref (rootRef, submenuRef) 만 보유. defineExpose 로 openAt/close 외부 노출.
//
// 관련: docs/plan/22 §3-1, Sprint c46 CMP-3 destructive confirm, Sprint c37 a11y DOM focus.
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'

export interface ContextMenuItem {
  label?: string // divider 면 생략 가능
  icon?: string
  shortcut?: string // 표시용 (예: '⌘D'). 실제 키 바인딩 아님
  destructive?: boolean
  divider?: boolean
  disabled?: boolean
  submenu?: ContextMenuItem[]
  action?: () => void
  /** Sprint c46 CMP-3 — destructive 액션 자동 confirm 우회 (이미 자체 confirm 있음). */
  skipConfirm?: boolean
  /** Sprint c46 CMP-3 — destructive 시 커스텀 confirm 메시지. 미지정 시 default. */
  confirmMessage?: string
}

export interface ContextMenuExpose {
  openAt: (event: MouseEvent | { x: number; y: number }, items: ContextMenuItem[]) => void
  close: () => void
}

export function useContextMenu() {
  const { t } = useI18n()

  const items = ref<ContextMenuItem[]>([])
  const open = ref(false)
  const x = ref(0)
  const y = ref(0)
  const focusedIndex = ref(-1)

  // submenu 1 depth
  const submenuOpen = ref(false)
  const submenuParentIndex = ref(-1)
  const submenuFocusedIndex = ref(-1)
  const submenuX = ref(0)
  const submenuY = ref(0)

  const rootRef = useTemplateRef<HTMLElement>('rootRef')
  const submenuRef = useTemplateRef<HTMLElement>('submenuRef')

  const visibleItems = computed(() => items.value.filter((i) => !i.divider))

  function openAt(event: MouseEvent | { x: number; y: number }, next: ContextMenuItem[]) {
    items.value = next
    x.value = 'clientX' in event ? event.clientX : event.x
    y.value = 'clientY' in event ? event.clientY : event.y
    open.value = true
    focusedIndex.value = 0
    submenuOpen.value = false
    void nextTick(() => {
      clampToViewport()
      // Sprint c37 a11y — open 시 첫 menuitem 에 실제 DOM focus (screen reader 알림).
      focusVisibleMenuItem(0)
    })
  }

  function close() {
    open.value = false
    submenuOpen.value = false
    items.value = []
    focusedIndex.value = -1
    submenuParentIndex.value = -1
    submenuFocusedIndex.value = -1
  }

  function clampToViewport() {
    if (!rootRef.value) return
    const rect = rootRef.value.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) x.value = Math.max(4, vw - rect.width - 4)
    if (rect.bottom > vh) y.value = Math.max(4, vh - rect.height - 4)
  }

  async function onSubItemClick(sub: ContextMenuItem) {
    // Sprint c46 CMP-3 — submenu destructive 항목도 confirm.
    if (sub.destructive && !sub.skipConfirm) {
      close()
      const ok = await confirmDialog({
        title: t('contextMenu.confirmDestructiveTitle'),
        message:
          sub.confirmMessage ??
          t('contextMenu.confirmDestructiveMessage', { label: sub.label ?? '' }),
        danger: true,
      })
      if (!ok) return
      sub.action?.()
      return
    }
    sub.action?.()
    close()
  }

  async function onItemClick(item: ContextMenuItem, idx: number) {
    if (item.disabled || item.divider) return
    if (item.submenu) {
      openSubmenu(idx)
      return
    }
    // Sprint c46 CMP-3 — destructive 항목 자동 confirm (skipConfirm 시 우회).
    if (item.destructive && !item.skipConfirm) {
      close()
      const ok = await confirmDialog({
        title: t('contextMenu.confirmDestructiveTitle'),
        message:
          item.confirmMessage ??
          t('contextMenu.confirmDestructiveMessage', { label: item.label ?? '' }),
        danger: true,
      })
      if (!ok) return
      item.action?.()
      return
    }
    item.action?.()
    close()
  }

  function openSubmenu(idx: number) {
    if (!rootRef.value) return
    const item = items.value[idx]
    if (!item?.submenu) return
    // submenu 위치: parent item 의 우측
    const itemEl =
      rootRef.value.querySelectorAll<HTMLElement>('[data-ctx-item]')[visibleIndexFromRaw(idx)]
    if (!itemEl) return
    const rect = itemEl.getBoundingClientRect()
    submenuX.value = rect.right + 2
    submenuY.value = rect.top
    submenuParentIndex.value = idx
    // submenuFocusedIndex 는 raw idx — 첫 non-divider 찾기.
    const sub = item.submenu ?? []
    let firstNonDivider = 0
    for (let i = 0; i < sub.length; i++) {
      if (!sub[i].divider) {
        firstNonDivider = i
        break
      }
    }
    submenuFocusedIndex.value = firstNonDivider
    submenuOpen.value = true
    void nextTick(() => {
      clampSubmenuToViewport()
      // Sprint c37 a11y — submenu open 시 첫 menuitem 에 focus.
      focusSubMenuItem(firstNonDivider)
    })
  }

  function clampSubmenuToViewport() {
    if (!submenuRef.value || !rootRef.value) return
    const rect = submenuRef.value.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) {
      // 좌측에 다시 띄움
      const parentRect = rootRef.value.getBoundingClientRect()
      submenuX.value = Math.max(4, parentRect.left - rect.width - 2)
    }
    if (rect.bottom > vh) submenuY.value = Math.max(4, vh - rect.height - 4)
  }

  // visible (divider 제외) 인덱스 ↔ raw 인덱스 변환
  function rawIndexFromVisible(visIdx: number): number {
    let count = 0
    for (let i = 0; i < items.value.length; i++) {
      if (items.value[i].divider) continue
      if (count === visIdx) return i
      count++
    }
    return -1
  }

  function visibleIndexFromRaw(rawIdx: number): number {
    let count = 0
    for (let i = 0; i < rawIdx; i++) {
      if (!items.value[i].divider) count++
    }
    return count
  }

  function moveFocus(delta: number) {
    const total = visibleItems.value.length
    if (total === 0) return
    const next = (focusedIndex.value + delta + total) % total
    focusedIndex.value = next
    // Sprint c37 a11y — focus 변경 시 실제 DOM focus 동기화 (WCAG 2.1.1 + ARIA menu 패턴).
    focusVisibleMenuItem(next)
  }

  // Sprint c37 a11y — visible index 의 menuitem 버튼 DOM focus.
  function focusVisibleMenuItem(visIdx: number) {
    void nextTick(() => {
      const buttons = rootRef.value?.querySelectorAll<HTMLButtonElement>('[data-ctx-item]')
      buttons?.[visIdx]?.focus()
    })
  }

  function moveSubFocus(delta: number) {
    const sub = items.value[submenuParentIndex.value]?.submenu ?? []
    const total = sub.filter((s) => !s.divider).length
    if (total === 0) return
    submenuFocusedIndex.value = (submenuFocusedIndex.value + delta + total) % total
    // Sprint c37 a11y — submenu DOM focus 동기화.
    focusSubMenuItem(submenuFocusedIndex.value)
  }

  function focusSubMenuItem(rawIdx: number) {
    void nextTick(() => {
      const buttons = submenuRef.value?.querySelectorAll<HTMLButtonElement>('[data-ctx-sub-item]')
      // submenuFocusedIndex 는 raw idx (divider 포함). visible 만 querySelectorAll → idx 매핑 필요.
      const sub = items.value[submenuParentIndex.value]?.submenu ?? []
      let visIdx = 0
      for (let i = 0; i < rawIdx; i++) {
        if (!sub[i]?.divider) visIdx++
      }
      buttons?.[visIdx]?.focus()
    })
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open.value) return
    if (submenuOpen.value) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveSubFocus(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveSubFocus(-1)
      } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault()
        submenuOpen.value = false
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const sub = items.value[submenuParentIndex.value]?.submenu ?? []
        const visibleSub = sub.filter((s) => !s.divider)
        const target = visibleSub[submenuFocusedIndex.value]
        if (target && !target.disabled) {
          target.action?.()
          close()
        }
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveFocus(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveFocus(-1)
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault()
      const rawIdx = rawIndexFromVisible(focusedIndex.value)
      const target = items.value[rawIdx]
      if (target?.submenu) {
        openSubmenu(rawIdx)
      } else if (target && !target.disabled) {
        target.action?.()
        close()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  function onOutsideClick(e: MouseEvent) {
    if (!open.value) return
    const target = e.target as Node | null
    if (rootRef.value?.contains(target)) return
    if (submenuRef.value?.contains(target)) return
    close()
  }

  watch(open, (v) => {
    if (v) {
      window.addEventListener('keydown', onKeydown)
      window.addEventListener('mousedown', onOutsideClick, { capture: true })
    } else {
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('mousedown', onOutsideClick, { capture: true })
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('mousedown', onOutsideClick, { capture: true })
  })

  return {
    // refs (template 바인딩용)
    rootRef,
    submenuRef,
    // 상태
    items,
    open,
    x,
    y,
    focusedIndex,
    submenuOpen,
    submenuParentIndex,
    submenuFocusedIndex,
    submenuX,
    submenuY,
    // 메서드
    openAt,
    close,
    onItemClick,
    onSubItemClick,
    visibleIndexFromRaw,
  }
}
