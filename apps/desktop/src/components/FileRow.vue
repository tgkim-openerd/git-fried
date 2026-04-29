<script setup lang="ts">
import type { FileChange } from '@/types/git'

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
    title="더블클릭 — fullscreen diff"
    @click="$emit('select')"
    @dblclick="$emit('dblclick')"
    @dragstart="(e: DragEvent) => e.dataTransfer && e.dataTransfer.setData('text/plain', file.path)"
  >
    <span :class="['shrink-0 w-12 text-[10px] uppercase', color]">{{ label }}</span>
    <span class="flex-1 truncate font-mono text-xs">{{ file.path }}</span>
    <slot name="extra" />
    <button
      type="button"
      class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
      :title="actionTitle"
      @click.stop="$emit('action')"
    >
      {{ action }}
    </button>
  </li>
</template>
