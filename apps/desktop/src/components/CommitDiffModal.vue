<script setup lang="ts">
// 단일 commit diff 모달 — Sprint B5 의 ⌘D 진입점 + B7 의 ✨ Explain.
//
// 기존 CommitGraph 가 selectCommit emit 하는 sha 를 받아 이 모달이 fetch + 표시.
// CodeMirror diff viewer 를 reuse 하지 않고 단순 <pre> — v1 단순화.
import { computed, ref } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiExplainCommit, getCommitDiff } from '@/api/git'
import { describeError } from '@/api/errors'
import { useAiCli, confirmAiSend } from '@/composables/useAiCli'
import AiResultModal from './AiResultModal.vue'

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

// AI Explain 진입점 (Sprint B7).
const ai = useAiCli()
const explainOpen = ref(false)
const explainContent = ref('')
const explainError = ref<string | null>(null)

const explainMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || props.sha == null) {
      return Promise.reject(new Error('레포/sha 미선택'))
    }
    if (ai.available.value == null) {
      return Promise.reject(new Error('Claude/Codex CLI 미설치'))
    }
    if (!confirmAiSend()) return Promise.reject(new Error('cancelled'))
    return aiExplainCommit(props.repoId, ai.available.value, props.sha, true)
  },
  onSuccess: (out) => {
    if (out.success) {
      explainContent.value = out.text
      explainError.value = null
    } else {
      explainContent.value = ''
      explainError.value = out.stderr || out.text || '응답 실패'
    }
  },
  onError: (e) => {
    const m = describeError(e)
    if (m.includes('cancelled')) {
      explainOpen.value = false
      return
    }
    explainContent.value = ''
    explainError.value = m
  },
})

function explain() {
  explainOpen.value = true
  explainContent.value = ''
  explainError.value = null
  explainMut.mutate()
}
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
          <div class="flex items-center gap-2">
            <button
              v-if="sha && ai.available.value"
              type="button"
              class="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent/40 disabled:opacity-50"
              :disabled="explainMut.isPending.value"
              :title="`✨ ${ai.available.value} 로 설명`"
              @click="explain"
            >
              ✨ {{ explainMut.isPending.value ? '...' : '설명' }}
            </button>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground"
              @click="$emit('close')"
            >
              ✕
            </button>
          </div>
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

    <AiResultModal
      :open="explainOpen"
      title="Commit 설명"
      :content="explainContent"
      :loading="explainMut.isPending.value"
      :error="explainError"
      @close="explainOpen = false"
    />
  </Teleport>
</template>
