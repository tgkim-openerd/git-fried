<script setup lang="ts">
// Sprint c25-4.5 (`docs/plan/25 §5-2`) — CommitDiffModal 의 inline 버전.
// Sprint c26-2 — 공통 로직을 useCommitDiff composable 로 추출 (DRY).

import { computed, useTemplateRef } from 'vue'
import { describeError } from '@/api/errors'
import { DIFF_MODE_LABELS, type DiffMode } from '@/composables/useDiffMode'
import { useCommitDiff } from '@/composables/useCommitDiff'
import AiResultModal from './AiResultModal.vue'
import DiffViewer from './DiffViewer.vue'
import DiffSplitView from './DiffSplitView.vue'

const props = defineProps<{
  repoId: number | null
  sha: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const cd = useCommitDiff({
  repoId: () => props.repoId,
  sha: () => props.sha,
})

const MODES: DiffMode[] = ['compact', 'default', 'context', 'split']

// Hunk navigation (DiffViewer expose).
type DiffViewerExpose = {
  nextHunk: () => void
  prevHunk: () => void
  hunkCount: () => number
}
const diffRef = useTemplateRef<DiffViewerExpose>('diffRef')
function onPrevHunk() {
  if (!cd.hunkNavDisabled.value) diffRef.value?.prevHunk()
}
function onNextHunk() {
  if (!cd.hunkNavDisabled.value) diffRef.value?.nextHunk()
}

const isSplit = computed(() => cd.diffMode.mode.value === 'split')
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
        <span v-if="cd.isFetching.value" class="text-[10px] text-muted-foreground">불러오는 중...</span>
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <!-- Hunk ↑↓ -->
        <div
          v-if="!isSplit"
          class="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 px-0.5"
          :title="
            cd.hunkNavDisabled.value
              ? '이 commit 은 hunk 1개 이하 — nav 불필요'
              : `${cd.hunkCount.value}개 hunk — ↑↓ 로 이동`
          "
        >
          <button
            type="button"
            class="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            :disabled="cd.hunkNavDisabled.value"
            title="이전 hunk"
            @click="onPrevHunk"
          >
            ↑
          </button>
          <button
            type="button"
            class="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            :disabled="cd.hunkNavDisabled.value"
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
              cd.diffMode.mode.value === m
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-accent/40'
            "
            @click="cd.diffMode.setMode(m)"
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
            @click="cd.onCherryPick"
          >
            🍒
          </button>
          <button
            type="button"
            class="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent/40"
            title="revert (새 commit 생성)"
            @click="cd.onRevert"
          >
            ↩
          </button>
          <div class="flex items-center gap-0.5 rounded border border-border bg-muted/40 p-0.5">
            <select
              v-model="cd.resetMode.value"
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
              :class="cd.resetMode.value === 'hard' ? 'text-destructive' : ''"
              title="HEAD reset to this commit"
              @click="cd.onReset"
            >
              ⏮
            </button>
          </div>
        </div>

        <button
          v-if="sha && cd.ai.available.value"
          type="button"
          class="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent/40 disabled:opacity-50"
          :disabled="cd.explainMut.isPending.value"
          :title="`✨ ${cd.ai.available.value} 로 설명`"
          @click="cd.explain"
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
        v-if="cd.error.value"
        class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs"
      >
        {{ describeError(cd.error.value) }}
      </p>
      <p
        v-else-if="!sha"
        class="p-6 text-center text-sm text-muted-foreground"
      >
        그래프에서 commit 을 선택하세요. (J/K 또는 클릭)
      </p>
      <DiffSplitView
        v-else-if="cd.data.value && isSplit"
        :patch="cd.data.value"
        class="h-full"
      />
      <DiffViewer v-else-if="cd.data.value" ref="diffRef" :patch="cd.data.value" class="h-full" />
    </div>

    <AiResultModal
      :open="cd.explainOpen.value"
      title="Commit 설명 (inline)"
      :content="cd.explainContent.value"
      :loading="cd.explainMut.isPending.value"
      :error="cd.explainError.value"
      @close="cd.explainOpen.value = false"
    />
  </section>
</template>
