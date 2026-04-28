<script setup lang="ts">
// Sprint c25-4.5 (`docs/plan/25 §5-2`) — CommitDiffModal 의 inline 버전.
//
// GitKraken Image #2 의 "diff 보면서 다른 파일/commit 으로 점프 가능" 흡수.
// CommitDiffModal 과 동일 데이터 fetching + 헤더 + DiffViewer 렌더, BaseModal wrap 만 제거.
// CommitGraph 와 vertical split 로 좌측 영역 안에 배치 — 우측 7-tab 패널 그대로 보임.
//
// CommitDiffModal 과 코드 일부 중복하지만 단계적 마이그레이션 — c26 이후 통합 검토.

import { computed, ref, useTemplateRef } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiExplainCommit, getCommitDiff, type ResetMode } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
import { useCommitActions } from '@/composables/useCommitActions'
import { useDiffMode, DIFF_MODE_LABELS, type DiffMode } from '@/composables/useDiffMode'
import AiResultModal from './AiResultModal.vue'
import DiffViewer from './DiffViewer.vue'
import DiffSplitView from './DiffSplitView.vue'

const props = defineProps<{
  repoId: number | null
  sha: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const diffMode = useDiffMode()

const { data, isFetching, error } = useQuery({
  queryKey: computed(
    () => ['commit-diff', props.repoId, props.sha, diffMode.mode.value] as const,
  ),
  queryFn: () => {
    if (props.repoId == null || props.sha == null) return Promise.resolve('')
    return getCommitDiff(props.repoId, props.sha, diffMode.contextLines.value)
  },
  enabled: computed(
    () => props.repoId != null && props.sha != null && (props.sha?.length ?? 0) > 0,
  ),
  staleTime: STALE_TIME.STATIC,
})

// AI Explain.
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
      notifyAiDone('AI commit 설명', props.sha?.slice(0, 7))
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

const MODES: DiffMode[] = ['compact', 'default', 'context', 'split']

// Header actions (cherry-pick / revert / reset).
const commitActions = useCommitActions(() => props.repoId)
const resetMode = ref<ResetMode>('mixed')
function onCherryPick() {
  if (props.sha) void commitActions.cherryPick(props.sha)
}
function onRevert() {
  if (props.sha) void commitActions.revert(props.sha)
}
function onReset() {
  if (props.sha) void commitActions.reset(props.sha, resetMode.value)
}

// Hunk navigation (DiffViewer expose).
type DiffViewerExpose = {
  nextHunk: () => void
  prevHunk: () => void
  hunkCount: () => number
}
const diffRef = useTemplateRef<DiffViewerExpose>('diffRef')
const inlineHunkCount = computed(() => {
  const patch = data.value
  if (!patch) return 0
  const m = patch.match(/^@@\s/gm)
  return m ? m.length : 0
})
const hunkNavDisabled = computed(() => inlineHunkCount.value <= 1)
function onPrevHunk() {
  if (!hunkNavDisabled.value) diffRef.value?.prevHunk()
}
function onNextHunk() {
  if (!hunkNavDisabled.value) diffRef.value?.nextHunk()
}
</script>

<template>
  <section class="flex h-full flex-col overflow-hidden border-t border-border bg-card">
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-1.5">
      <div class="flex items-center gap-2 font-mono text-xs">
        <span class="rounded bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-500">
          INLINE DIFF
        </span>
        <span>commit</span>
        <span v-if="sha" class="text-muted-foreground">{{ sha.slice(0, 12) }}</span>
        <span v-if="isFetching" class="text-[10px] text-muted-foreground">불러오는 중...</span>
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <!-- Hunk ↑↓ -->
        <div
          v-if="diffMode.mode.value !== 'split'"
          class="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 px-0.5"
          :title="
            hunkNavDisabled
              ? '이 commit 은 hunk 1개 이하 — nav 불필요'
              : `${inlineHunkCount}개 hunk — ↑↓ 로 이동`
          "
        >
          <button
            type="button"
            class="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            :disabled="hunkNavDisabled"
            title="이전 hunk"
            @click="onPrevHunk"
          >
            ↑
          </button>
          <button
            type="button"
            class="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            :disabled="hunkNavDisabled"
            title="다음 hunk"
            @click="onNextHunk"
          >
            ↓
          </button>
        </div>

        <!-- 4-mode toggle -->
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
            @click="diffMode.setMode(m)"
          >
            {{ DIFF_MODE_LABELS[m] }}
          </button>
        </div>

        <!-- Cherry-pick / Revert / Reset -->
        <div v-if="sha" class="flex items-center gap-1 border-l border-border pl-1">
          <button
            type="button"
            class="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent/40"
            title="cherry-pick"
            @click="onCherryPick"
          >
            🍒
          </button>
          <button
            type="button"
            class="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent/40"
            title="revert (새 commit 생성)"
            @click="onRevert"
          >
            ↩
          </button>
          <div class="flex items-center gap-0.5 rounded border border-border bg-muted/40 p-0.5">
            <select
              v-model="resetMode"
              class="rounded bg-transparent px-1 text-[10px] text-muted-foreground focus:outline-none"
              title="Reset 모드"
            >
              <option value="soft">soft</option>
              <option value="mixed">mixed</option>
              <option value="hard">hard ⚠</option>
            </select>
            <button
              type="button"
              class="rounded px-1 py-0.5 text-[11px] hover:bg-accent/40"
              :class="resetMode === 'hard' ? 'text-destructive' : ''"
              title="HEAD reset to this commit"
              @click="onReset"
            >
              ⏮
            </button>
          </div>
        </div>

        <button
          v-if="sha && ai.available.value"
          type="button"
          class="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent/40 disabled:opacity-50"
          :disabled="explainMut.isPending.value"
          :title="`✨ ${ai.available.value} 로 설명`"
          @click="explain"
        >
          ✨
        </button>
        <button
          type="button"
          class="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40"
          aria-label="inline diff 닫기"
          title="닫기 (ESC)"
          @click="emit('close')"
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
        그래프에서 commit 을 선택하세요. (J/K 또는 클릭)
      </p>
      <DiffSplitView
        v-else-if="data && diffMode.mode.value === 'split'"
        :patch="data"
        class="h-full"
      />
      <DiffViewer v-else-if="data" ref="diffRef" :patch="data" class="h-full" />
    </div>

    <AiResultModal
      :open="explainOpen"
      title="Commit 설명 (inline)"
      :content="explainContent"
      :loading="explainMut.isPending.value"
      :error="explainError"
      @close="explainOpen = false"
    />
  </section>
</template>
