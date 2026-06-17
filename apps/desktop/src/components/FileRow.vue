<script setup lang="ts">
import type { FileChange } from '@/types/git'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  file: FileChange
  label: string
  color: string
  action: string
  actionTitle: string
  selected?: boolean
}>()
// Sprint c30 / GitKraken UX (Phase 3) — 더블클릭 → fullscreen diff.
defineEmits<{ action: []; select: []; dblclick: [] }>()
</script>

<template>
  <li
    class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
    :class="selected ? 'bg-accent ring-1 ring-primary/40' : ''"
    draggable="true"
    :title="t('templ.fileRowTitle')"
    @dblclick="$emit('dblclick')"
    @dragstart="(e: DragEvent) => e.dataTransfer && e.dataTransfer.setData('text/plain', file.path)"
  >
    <!-- WL-2 a11y: 행을 role=button 으로 두면 내부 action 버튼이 nested-interactive(ARIA 부적절).
         primary select 를 full-width 내부 <button> 으로 분리, action 은 형제. dblclick/drag 는 li 유지. -->
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      @click="$emit('select')"
    >
      <span
        :class="['shrink-0 w-12 text-3xs uppercase font-bold', color]"
        :aria-label="`${label} ${file.path}`"
        role="status"
        >{{ label }}</span
      >
      <span class="flex-1 truncate font-mono text-xs">{{ file.path }}</span>
    </button>
    <slot name="extra" />
    <button
      type="button"
      class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
      :title="actionTitle"
      @click.stop="$emit('action')"
    >
      {{ action }}
    </button>
  </li>
</template>
