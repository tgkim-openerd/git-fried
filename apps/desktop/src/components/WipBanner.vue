<script setup lang="ts">
// 그래프 상단 WIP 노트 입력 — Sprint J (`docs/plan/11 §28`).
//
// "// WIP <한 줄 작업 메모>" — stash push 시 메시지 자동 prefill.
// 비어있으면 placeholder 만, 입력하면 amber 강조.
import { computed } from 'vue'
import { useWipNote } from '@/composables/useWipNote'

const props = defineProps<{ repoId: number | null }>()

const wip = computed(() =>
  props.repoId == null ? null : useWipNote(props.repoId),
)
</script>

<template>
  <div
    v-if="wip"
    class="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-1 text-xs"
  >
    <span
      class="shrink-0 font-mono text-[10px]"
      :class="wip.value ? 'text-amber-500' : 'text-muted-foreground'"
    >
      // WIP
    </span>
    <input
      v-model="wip.value"
      placeholder="(작업 중인 내용 — stash push 시 메시지로 자동 사용)"
      class="flex-1 rounded border border-input bg-background px-2 py-0.5 text-xs outline-none focus:border-amber-500"
      :class="wip.value ? 'border-amber-500/50' : ''"
    />
    <button
      v-if="wip.value"
      type="button"
      class="rounded px-1 text-[10px] text-muted-foreground hover:text-foreground"
      title="WIP 노트 지우기"
      @click="wip.value = ''"
    >
      ✕
    </button>
  </div>
</template>
