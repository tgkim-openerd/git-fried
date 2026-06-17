<script setup lang="ts">
// Sprint c103 (B) — StatusPanel 의 손수 작성 file row `<li>` 5 변형(staged-tree /
// modified-path / modified-tree / untracked-path / untracked-tree)을 흡수하는 공용
// 행 컴포넌트. **DOM-identical**: 기존 markup 을 그대로 재현하며 차이만 prop 으로 노출.
//
// - badge(label/color) — statusLabel/statusColor 또는 "new"/text-muted-foreground
// - display — 표시 텍스트(전체 경로 또는 basename). path 는 drag/title 식별자
// - depth — tree 들여쓰기(undefined=path 모드 → <li> title=fullscreen, span title 없음)
// - draggable — drag 가능 여부(변형별로 다름)
// - 액션 버튼(history/discard/hunk/stage/unstage)은 default slot 으로 주입
//
// FileRow.vue 와 구분: FileRow 는 badge font-bold+aria + 항상 draggable/title/단일
// action 버튼이라 본 5 변형과 markup 이 달라 재사용 불가(Staged-path 만 FileRow 사용).
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  /** drag payload + tree 모드 span title + aria 식별자 */
  path: string
  /** badge 텍스트 (statusLabel(...) 또는 'new') */
  label: string
  /** badge 색 클래스 (statusColor(...) 또는 'text-muted-foreground') */
  color: string
  /** 표시 텍스트 (전체 경로 또는 basename) */
  display: string
  selected?: boolean
  /** tree 들여쓰기 depth. undefined = path 모드(들여쓰기 없음 + <li> fullscreen title) */
  depth?: number
  /** drag 가능 여부 (staged-tree / untracked-tree 는 false) */
  draggable?: boolean
}>()

defineEmits<{ select: []; dblclick: []; contextmenu: [e: MouseEvent] }>()
</script>

<template>
  <li
    class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
    :class="selected ? 'bg-accent ring-1 ring-primary/40' : ''"
    :style="depth != null ? { paddingLeft: `${depth * 12 + 4}px` } : undefined"
    :draggable="draggable || undefined"
    role="button"
    tabindex="0"
    :title="depth == null ? t('status.fullscreenTitle') : undefined"
    @click="$emit('select')"
    @keydown.enter.self="$emit('select')"
    @keydown.space.self.prevent="$emit('select')"
    @dblclick="$emit('dblclick')"
    @contextmenu="$emit('contextmenu', $event)"
    @dragstart="
      (e: DragEvent) => draggable && e.dataTransfer && e.dataTransfer.setData('text/plain', path)
    "
  >
    <span :class="['shrink-0 w-12 text-3xs uppercase', color]">{{ label }}</span>
    <span class="flex-1 truncate font-mono text-xs" :title="depth != null ? path : undefined">{{
      display
    }}</span>
    <slot />
  </li>
</template>
