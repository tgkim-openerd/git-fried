<script setup lang="ts">
// 단일 commit diff 모달 — Sprint B5 ⌘D 진입점 + B7 ✨ Explain + B1 3-mode 토글.
//
// 기존 CommitGraph 가 selectCommit emit 하는 sha 를 받아 fetch + DiffViewer 로 렌더.
// 모드 토글 (Hunk/Inline/Context) 은 git -U<n> 옵션으로 backend 에 직접 적용 —
// CodeMirror 의 mode 가 아니라 patch 자체가 변함.
import { computed, ref } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiExplainCommit, getCommitDiff } from '@/api/git'
import { describeError } from '@/api/errors'
import { useAiCli, confirmAiSend } from '@/composables/useAiCli'
import { useDiffMode, DIFF_MODE_LABELS, type DiffMode } from '@/composables/useDiffMode'
import AiResultModal from './AiResultModal.vue'
import DiffViewer from './DiffViewer.vue'

const props = defineProps<{
  repoId: number | null
  sha: string | null
  open: boolean
}>()
defineEmits<{ close: [] }>()

const diffMode = useDiffMode()

const { data, isFetching, error } = useQuery({
  queryKey: computed(
    () => ['commit-diff', props.repoId, props.sha, diffMode.mode.value] as const,
  ),
  queryFn: () => {
    if (props.repoId == null || props.sha == null) {
      return Promise.resolve('')
    }
    return getCommitDiff(props.repoId, props.sha, diffMode.contextLines.value)
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

const MODES: DiffMode[] = ['compact', 'default', 'context']
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="$emit('close')"
    >
      <div
        class="flex max-h-[90vh] w-[1000px] max-w-full flex-col rounded-lg border border-border bg-card shadow-xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 class="font-mono text-sm">
            commit
            <span v-if="sha" class="ml-1 text-muted-foreground">{{ sha.slice(0, 12) }}</span>
            <span v-if="isFetching" class="ml-2 text-xs text-muted-foreground">불러오는 중...</span>
          </h2>
          <div class="flex items-center gap-2">
            <!-- 3-mode 토글 (Sprint B1) -->
            <div class="flex gap-0.5 rounded-md border border-border bg-muted/40 p-0.5 text-[10px]">
              <button
                v-for="m in MODES"
                :key="m"
                type="button"
                class="rounded px-1.5 py-0.5"
                :class="
                  diffMode.mode.value === m
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-accent/40'
                "
                :title="
                  m === 'compact'
                    ? '변경 라인만 (-U0)'
                    : m === 'default'
                    ? '기본 컨텍스트 3 라인 (-U3)'
                    : '확장 컨텍스트 25 라인 (-U25)'
                "
                @click="diffMode.setMode(m)"
              >
                {{ DIFF_MODE_LABELS[m] }}
              </button>
            </div>
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
        <div class="flex-1 overflow-hidden">
          <p
            v-if="error"
            class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs"
          >
            {{ describeError(error) }}
          </p>
          <p
            v-else-if="!sha"
            class="p-6 text-center text-sm text-muted-foreground"
          >
            먼저 그래프에서 commit 을 선택하세요. (J/K 또는 클릭)
          </p>
          <DiffViewer v-else-if="data" :patch="data" class="h-full" />
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
