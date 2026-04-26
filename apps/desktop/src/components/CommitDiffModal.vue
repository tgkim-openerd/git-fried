<script setup lang="ts">
// 단일 commit diff 모달 — Sprint B5 의 ⌘D 진입점.
//
// 기존 CommitGraph 가 selectCommit emit 하는 sha 를 받아 이 모달이 fetch + 표시.
// CodeMirror diff viewer 를 reuse 하지 않고 단순 <pre> — v1 단순화.
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getCommitDiff } from '@/api/git'
import { describeError } from '@/api/errors'

const props = defineProps<{
  repoId: number | null
  sha: string | null
  open: boolean
}>()
defineEmits<{ close: [] }>()

const { data, isFetching, error } = useQuery({
  queryKey: computed(() => ['commit-diff', props.repoId, props.sha] as const),
  queryFn: () => {
    if (props.repoId == null || props.sha == null) {
      return Promise.resolve('')
    }
    return getCommitDiff(props.repoId, props.sha)
  },
  enabled: computed(
    () =>
      props.open &&
      props.repoId != null &&
      props.sha != null &&
      props.sha.length > 0,
  ),
  staleTime: 60_000,
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="$emit('close')"
    >
      <div
        class="flex max-h-[90vh] w-[900px] max-w-full flex-col rounded-lg border border-border bg-card shadow-xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 class="font-mono text-sm">
            commit
            <span v-if="sha" class="ml-1 text-muted-foreground">{{ sha.slice(0, 12) }}</span>
            <span v-if="isFetching" class="ml-2 text-xs text-muted-foreground">불러오는 중...</span>
          </h2>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            @click="$emit('close')"
          >
            ✕
          </button>
        </header>
        <div class="flex-1 overflow-auto p-2">
          <p
            v-if="error"
            class="rounded border border-destructive bg-destructive/10 p-2 text-xs"
          >
            {{ describeError(error) }}
          </p>
          <p
            v-else-if="!sha"
            class="p-6 text-center text-sm text-muted-foreground"
          >
            먼저 그래프에서 commit 을 선택하세요. (J/K 또는 클릭)
          </p>
          <pre
            v-else-if="data"
            class="m-0 whitespace-pre-wrap break-words rounded bg-muted/30 p-2 font-mono text-[12px]"
          >{{ data }}</pre>
        </div>
      </div>
    </div>
  </Teleport>
</template>
