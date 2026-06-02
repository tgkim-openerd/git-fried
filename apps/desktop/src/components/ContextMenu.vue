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
//   - destructive 항목 빨강 + auto confirm (Sprint c46 CMP-3)
//   - submenu 1 depth (충분, 더 깊으면 다른 UI 패턴 권장)
//
// Sprint c48 Wave B-1 — script 316 LOC → composables/useContextMenu 분리.
// 본 SFC 는 template 바인딩 + defineExpose 만 담당.
import {
  useContextMenu,
  type ContextMenuExpose,
  type ContextMenuItem,
} from '@/composables/useContextMenu'

export type { ContextMenuItem, ContextMenuExpose }

const cm = useContextMenu()
defineExpose<ContextMenuExpose>({ openAt: cm.openAt, close: cm.close })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="cm.open.value"
      ref="rootRef"
      class="mini-list-scroll fixed z-50 min-w-[220px] max-h-[80vh] overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-popover"
      :style="{ left: `${cm.x.value}px`, top: `${cm.y.value}px` }"
      role="menu"
      aria-orientation="vertical"
      aria-label="컨텍스트 메뉴"
    >
      <template v-for="(item, rawIdx) in cm.items.value" :key="rawIdx">
        <div v-if="item.divider" class="my-1 border-t border-border" role="separator" />
        <button
          v-else
          type="button"
          data-ctx-item
          role="menuitem"
          :aria-haspopup="item.submenu ? 'menu' : undefined"
          :aria-expanded="
            item.submenu
              ? cm.submenuOpen.value && cm.submenuParentIndex.value === rawIdx
              : undefined
          "
          class="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-accent disabled:opacity-50"
          :class="[
            cm.visibleIndexFromRaw(rawIdx) === cm.focusedIndex.value && !cm.submenuOpen.value
              ? 'bg-accent text-accent-foreground'
              : '',
            item.destructive ? 'text-destructive hover:text-destructive' : '',
          ]"
          :disabled="item.disabled"
          @click="cm.onItemClick(item, rawIdx)"
          @mouseenter="cm.focusedIndex.value = cm.visibleIndexFromRaw(rawIdx)"
        >
          <span class="flex items-center gap-2">
            <span v-if="item.icon" class="w-4 text-center">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </span>
          <span class="flex items-center gap-2">
            <span v-if="item.shortcut" class="font-mono text-[11px] text-muted-foreground">
              {{ item.shortcut }}
            </span>
            <span v-if="item.submenu" class="text-muted-foreground">›</span>
          </span>
        </button>
      </template>
    </div>

    <!-- submenu (1 depth) -->
    <div
      v-if="cm.submenuOpen.value && cm.submenuParentIndex.value >= 0"
      ref="submenuRef"
      class="mini-list-scroll fixed z-50 min-w-[200px] max-h-[80vh] overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-popover"
      :style="{ left: `${cm.submenuX.value}px`, top: `${cm.submenuY.value}px` }"
      role="menu"
      aria-orientation="vertical"
      aria-label="서브메뉴"
    >
      <template
        v-for="(sub, subRawIdx) in cm.items.value[cm.submenuParentIndex.value]?.submenu ?? []"
        :key="`s-${subRawIdx}`"
      >
        <div v-if="sub.divider" class="my-1 border-t border-border" role="separator" />
        <button
          v-else
          type="button"
          data-ctx-sub-item
          role="menuitem"
          class="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-accent disabled:opacity-50"
          :class="[
            cm.subVisibleIndexFromRaw(subRawIdx) === cm.submenuFocusedIndex.value
              ? 'bg-accent text-accent-foreground'
              : '',
            sub.destructive ? 'text-destructive hover:text-destructive' : '',
          ]"
          :disabled="sub.disabled"
          @click="!sub.disabled && cm.onSubItemClick(sub)"
          @mouseenter="cm.submenuFocusedIndex.value = cm.subVisibleIndexFromRaw(subRawIdx)"
        >
          <span class="flex items-center gap-2">
            <span v-if="sub.icon" class="w-4 text-center">{{ sub.icon }}</span>
            <span>{{ sub.label }}</span>
          </span>
          <span v-if="sub.shortcut" class="font-mono text-[11px] text-muted-foreground">
            {{ sub.shortcut }}
          </span>
        </button>
      </template>
    </div>
  </Teleport>
</template>
