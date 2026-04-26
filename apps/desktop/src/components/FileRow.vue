<script setup lang="ts">
import type { FileChange } from '@/types/git'

defineProps<{
  file: FileChange
  label: string
  color: string
  action: string
  actionTitle: string
}>()
defineEmits<{ action: [] }>()
</script>

<template>
  <li class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40">
    <span :class="['shrink-0 w-12 text-[10px] uppercase', color]">{{ label }}</span>
    <span class="flex-1 truncate font-mono text-xs">{{ file.path }}</span>
    <button
      type="button"
      class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
      :title="actionTitle"
      @click="$emit('action')"
    >
      {{ action }}
    </button>
  </li>
</template>
