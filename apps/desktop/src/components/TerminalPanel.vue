<script setup lang="ts">
// 통합 터미널 — `docs/plan/10 옵션 A`.
//
// xterm.js + Tauri Channel<Vec<u8>> 로 PTY (pwsh.exe / sh) stdin·stdout binding.
// 활성 레포의 local_path 를 cwd 로 spawn. 레포 변경 시 자동 재spawn.
//
// Sprint c48 Wave B-3 — script 211 → ~25 LOC. xterm/PTY 라이프사이클 + drag-drop
// 을 composables/usePtyTerminal 로 분리.
import { useTemplateRef } from 'vue'
import { usePtyTerminal } from '@/composables/usePtyTerminal'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const containerRef = useTemplateRef<HTMLDivElement>('container')
const { defaultShell, error, spawn, refit, onDragOver, onDrop } = usePtyTerminal({
  visible: () => props.visible,
  containerRef,
})

defineExpose({ refit })
</script>

<template>
  <div v-show="visible" class="flex h-full flex-col border-t border-border bg-[#0a0a0a]">
    <header
      class="flex items-center justify-between border-b border-border bg-card px-3 py-1 text-xs"
    >
      <span class="text-muted-foreground">
        Terminal — {{ defaultShell }}
        <span v-if="error" class="ml-2 text-danger-rose">{{ error }}</span>
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          title="재시작"
          @click="spawn"
        >
          ⟳
        </button>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          title="닫기 (⌘`)"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
    </header>
    <div ref="container" class="flex-1 overflow-hidden p-1" @dragover="onDragOver" @drop="onDrop" />
  </div>
</template>
