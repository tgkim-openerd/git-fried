<script setup lang="ts">
// 공용 우클릭 ContextMenu — `docs/plan/22 §3-1` Sprint 22-2.
//
// 사용 패턴 (parent):
//   const ctxMenu = ref<ContextMenuExpose | null>(null)
//   function onContextMenu(e: MouseEvent, item: SomeItem) {
//     e.preventDefault()
//     ctxMenu.value?.openAt(e, [
//       { label: 'Show diff', shortcut: '⌘D', action: () => openDiff(item) },
//       { divider: true },
//       { label: 'Reset', submenu: [
//         { label: 'soft', action: () => reset(item, 'soft') },
//         { label: 'mixed', action: () => reset(item, 'mixed') },
//         { label: 'hard', destructive: true, action: () => reset(item, 'hard') },
//       ]},
//       { label: 'Delete', destructive: true, action: () => del(item) },
//     ])
//   }
//
//   <ContextMenu ref="ctxMenu" />
//
// 동작:
//   - Teleport to body, z-50
//   - mouse position 기반 + viewport edge 회피
//   - 키보드: ↑↓ Tab 이동, Enter 실행, Esc/outside-click 닫기, → submenu 진입, ← submenu 종료
//   - destructive 항목 빨강
//   - submenu 1 depth (충분, 더 깊으면 다른 UI 패턴 권장)
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

export interface ContextMenuItem {
  label?: string  // divider 면 생략 가능
  icon?: string
  shortcut?: string // 표시용 (예: '⌘D'). 실제 키 바인딩 아님
  destructive?: boolean
  divider?: boolean
  disabled?: boolean
  submenu?: ContextMenuItem[]
  action?: () => void
}

export interface ContextMenuExpose {
  openAt: (event: MouseEvent | { x: number; y: number }, items: ContextMenuItem[]) => void
  close: () => void
}

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

function openAt(
  event: MouseEvent | { x: number; y: number },
  next: ContextMenuItem[],
) {
  items.value = next
  x.value = 'clientX' in event ? event.clientX : event.x
  y.value = 'clientY' in event ? event.clientY : event.y
  open.value = true
  focusedIndex.value = 0
  submenuOpen.value = false
  void nextTick(() => clampToViewport())
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

function onItemClick(item: ContextMenuItem, idx: number) {
  if (item.disabled || item.divider) return
  if (item.submenu) {
    openSubmenu(idx)
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
  const itemEl = rootRef.value.querySelectorAll<HTMLElement>('[data-ctx-item]')[
    visibleIndexFromRaw(idx)
  ]
  if (!itemEl) return
  const rect = itemEl.getBoundingClientRect()
  submenuX.value = rect.right + 2
  submenuY.value = rect.top
  submenuParentIndex.value = idx
  submenuFocusedIndex.value = 0
  submenuOpen.value = true
  void nextTick(() => clampSubmenuToViewport())
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
}

function moveSubFocus(delta: number) {
  const sub = items.value[submenuParentIndex.value]?.submenu ?? []
  const total = sub.filter((s) => !s.divider).length
  if (total === 0) return
  submenuFocusedIndex.value = (submenuFocusedIndex.value + delta + total) % total
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
  const t = e.target as Node | null
  if (rootRef.value?.contains(t)) return
  if (submenuRef.value?.contains(t)) return
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

defineExpose<ContextMenuExpose>({ openAt, close })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="rootRef"
      class="fixed z-50 min-w-[180px] rounded-md border border-border bg-popover py-1 text-xs shadow-lg"
      :style="{ left: `${x}px`, top: `${y}px` }"
      role="menu"
    >
      <template v-for="(item, rawIdx) in items" :key="rawIdx">
        <div
          v-if="item.divider"
          class="my-1 border-t border-border"
        />
        <button
          v-else
          type="button"
          data-ctx-item
          class="flex w-full items-center justify-between gap-3 px-3 py-1 text-left hover:bg-accent disabled:opacity-50"
          :class="[
            visibleIndexFromRaw(rawIdx) === focusedIndex && !submenuOpen
              ? 'bg-accent text-accent-foreground'
              : '',
            item.destructive ? 'text-destructive hover:text-destructive' : '',
          ]"
          :disabled="item.disabled"
          @click="onItemClick(item, rawIdx)"
          @mouseenter="focusedIndex = visibleIndexFromRaw(rawIdx)"
        >
          <span class="flex items-center gap-2">
            <span v-if="item.icon" class="w-4 text-center">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </span>
          <span class="flex items-center gap-2">
            <span
              v-if="item.shortcut"
              class="font-mono text-[10px] text-muted-foreground"
            >
              {{ item.shortcut }}
            </span>
            <span v-if="item.submenu" class="text-muted-foreground">▸</span>
          </span>
        </button>
      </template>
    </div>

    <!-- submenu (1 depth) -->
    <div
      v-if="submenuOpen && submenuParentIndex >= 0"
      ref="submenuRef"
      class="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 text-xs shadow-lg"
      :style="{ left: `${submenuX}px`, top: `${submenuY}px` }"
      role="menu"
    >
      <template
        v-for="(sub, subRawIdx) in items[submenuParentIndex]?.submenu ?? []"
        :key="`s-${subRawIdx}`"
      >
        <div v-if="sub.divider" class="my-1 border-t border-border" />
        <button
          v-else
          type="button"
          class="flex w-full items-center justify-between gap-3 px-3 py-1 text-left hover:bg-accent disabled:opacity-50"
          :class="[
            subRawIdx === submenuFocusedIndex
              ? 'bg-accent text-accent-foreground'
              : '',
            sub.destructive ? 'text-destructive hover:text-destructive' : '',
          ]"
          :disabled="sub.disabled"
          @click="
            !sub.disabled &&
              (() => {
                sub.action?.()
                close()
              })()
          "
          @mouseenter="submenuFocusedIndex = subRawIdx"
        >
          <span class="flex items-center gap-2">
            <span v-if="sub.icon" class="w-4 text-center">{{ sub.icon }}</span>
            <span>{{ sub.label }}</span>
          </span>
          <span
            v-if="sub.shortcut"
            class="font-mono text-[10px] text-muted-foreground"
          >
            {{ sub.shortcut }}
          </span>
        </button>
      </template>
    </div>
  </Teleport>
</template>
