<script setup lang="ts">
// Sprint 22-7 V-5 inline diff preview 분리 (StatusPanel.vue God comp 분리 1/N).
// 선택 파일의 하단 30% diff preview — header 액션 버튼 + Hunk ↑↓ + DiffViewer.
import { computed, useTemplateRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import DiffViewer, { type DiffViewerExpose } from './DiffViewer.vue'
import BaseTooltip from './BaseTooltip.vue'
import { getDiff } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'

const props = defineProps<{
  repoId: number | null
  path: string
  isStaged: boolean
}>()

const emit = defineEmits<{
  close: []
  stage: [path: string]
  unstage: [path: string]
  discard: [path: string]
  hunk: [path: string, isStaged: boolean]
  history: [path: string]
}>()

const detailDiffQuery = useQuery({
  queryKey: computed(() => ['file-diff', props.repoId, props.path, props.isStaged] as const),
  queryFn: () => {
    if (props.repoId == null || !props.path) return Promise.resolve('')
    return getDiff({
      repoId: props.repoId,
      staged: props.isStaged,
      path: props.path,
      context: 3,
    })
  },
  enabled: computed(() => props.repoId != null && !!props.path),
  staleTime: STALE_TIME.REALTIME,
})

const inlineDiffRef = useTemplateRef<DiffViewerExpose>('inlineDiff')

// `@@ -... +... @@` 라인 매칭으로 hunk 카운트.
const inlineHunkCount = computed(() => {
  const patch = detailDiffQuery.data.value
  if (!patch) return 0
  const m = patch.match(/^@@\s/gm)
  return m ? m.length : 0
})
const hunkNavDisabled = computed(() => inlineHunkCount.value <= 1)

function onPrevHunk() {
  if (hunkNavDisabled.value) return
  inlineDiffRef.value?.prevHunk()
}
function onNextHunk() {
  if (hunkNavDisabled.value) return
  inlineDiffRef.value?.nextHunk()
}
</script>

<template>
  <div
    class="flex shrink-0 flex-col border-t border-border bg-muted/10"
    style="height: 30%; min-height: 140px"
  >
    <div class="flex items-center justify-between border-b border-border bg-card px-3 py-1.5">
      <div class="flex min-w-0 items-center gap-2 text-xs">
        <span
          class="shrink-0 rounded px-1.5 text-[10px] font-bold"
          :class="
            isStaged ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
          "
        >
          {{ isStaged ? 'STAGED' : 'WORKDIR' }}
        </span>
        <span class="truncate font-mono">{{ path }}</span>
      </div>
      <div class="flex shrink-0 items-center gap-1 text-[11px]">
        <!-- Sprint c25-4 §5 — Hunk ↑↓ 네비게이션 (1-hunk 이하면 disabled) -->
        <div class="flex items-center gap-0.5 rounded border border-border bg-muted/30 px-0.5">
          <BaseTooltip
            :text="
              hunkNavDisabled
                ? '이 patch 는 hunk 1개 이하 — nav 불필요'
                : `이전 hunk (${inlineHunkCount}개)`
            "
            kbd="Alt+↑"
            placement="bottom"
            :disabled="hunkNavDisabled"
          >
            <button
              type="button"
              class="px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              :disabled="hunkNavDisabled"
              aria-label="이전 hunk 로 이동"
              @click="onPrevHunk"
            >
              ↑
            </button>
          </BaseTooltip>
          <BaseTooltip
            :text="
              hunkNavDisabled
                ? '이 patch 는 hunk 1개 이하 — nav 불필요'
                : `다음 hunk (${inlineHunkCount}개)`
            "
            kbd="Alt+↓"
            placement="bottom"
            :disabled="hunkNavDisabled"
          >
            <button
              type="button"
              class="px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              :disabled="hunkNavDisabled"
              aria-label="다음 hunk 로 이동"
              @click="onNextHunk"
            >
              ↓
            </button>
          </BaseTooltip>
        </div>
        <BaseTooltip text="파일 히스토리 / Blame" kbd="⌘⇧H" placement="bottom">
          <button
            type="button"
            class="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-accent/40"
            aria-label="파일 히스토리 보기"
            @click="emit('history', path)"
          >
            📜 History
          </button>
        </BaseTooltip>
        <BaseTooltip v-if="!isStaged" text="이 파일 stage" kbd="S" placement="bottom">
          <button
            type="button"
            class="rounded border border-border px-2 py-0.5 hover:bg-accent/40"
            @click="emit('stage', path)"
          >
            + stage
          </button>
        </BaseTooltip>
        <BaseTooltip v-else text="이 파일 unstage" kbd="U" placement="bottom">
          <button
            type="button"
            class="rounded border border-border px-2 py-0.5 hover:bg-accent/40"
            @click="emit('unstage', path)"
          >
            − unstage
          </button>
        </BaseTooltip>
        <BaseTooltip text="Hunk-level stage / unstage (특정 라인만)" placement="bottom">
          <button
            type="button"
            class="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-accent/40"
            @click="emit('hunk', path, isStaged)"
          >
            ✂ hunk
          </button>
        </BaseTooltip>
        <BaseTooltip v-if="!isStaged" text="변경 폐기 (discard)" placement="bottom">
          <button
            type="button"
            class="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10"
            @click="emit('discard', path)"
          >
            ⤺ discard
          </button>
        </BaseTooltip>
        <BaseTooltip text="diff preview 닫기" kbd="Esc" placement="bottom">
          <button
            type="button"
            class="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-accent/40"
            aria-label="diff preview 닫기"
            @click="emit('close')"
          >
            ✕
          </button>
        </BaseTooltip>
      </div>
    </div>
    <div class="flex-1 overflow-hidden">
      <div
        v-if="detailDiffQuery.isFetching.value && !detailDiffQuery.data.value"
        class="p-4 text-center text-xs text-muted-foreground"
      >
        diff 불러오는 중...
      </div>
      <div
        v-else-if="detailDiffQuery.error.value"
        class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs"
      >
        {{ describeError(detailDiffQuery.error.value) }}
      </div>
      <div
        v-else-if="!detailDiffQuery.data.value"
        class="p-4 text-center text-xs text-muted-foreground"
      >
        (변경 없음 — binary 파일이거나 untracked)
      </div>
      <DiffViewer v-else ref="inlineDiff" :patch="detailDiffQuery.data.value" class="h-full" />
    </div>
  </div>
</template>
