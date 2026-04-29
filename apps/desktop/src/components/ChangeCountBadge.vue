<script setup lang="ts">
// 우측 패널 영구 헤더 (Sprint c25-2 — `docs/plan/25 §3`).
//
// GitKraken 의 "N file changes on {branch}" 헤더를 흡수.
// 탭 전환 무관 항상 표시 — Branches/Stash/PR 등 다른 패널 보고 있어도 변경 카운트가 보임.
// 클릭 시 status 탭으로 전환 (emit:'navigate-status').
//
// Sprint c30 / GitKraken UX (Phase 2b) — "Stage All Changes" emerald 버튼 추가.
//   GitKraken 스크린샷 3 의 우측 staging 패널 헤더 옆 큰 primary 버튼 흡수.
//   unstaged + untracked > 0 시 표시 (이미 모두 staged 면 의미 없음).
import { computed } from 'vue'
import { useMutation } from '@tanstack/vue-query'
// ARCH-006 fix — useStatusCounts composable 단일 진실원천 사용.
import { useStatusCounts } from '@/composables/useStatusCounts'
import { stageAll as apiStageAll } from '@/api/git'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  repoId: number | null
  branch: string | null
}>()
const emit = defineEmits<{
  'navigate-status': []
}>()

const repoIdRef = computed(() => props.repoId)
const { counts, isClean } = useStatusCounts(repoIdRef)

const toast = useToast()
const invalidate = useInvalidateRepoQueries()

const stageAllMut = useMutation({
  mutationFn: (repoId: number) => apiStageAll(repoId),
  onSuccess: () => {
    if (props.repoId != null) invalidate(props.repoId)
  },
  onError: (e) => toast.error('Stage all 실패', describeError(e)),
})

// "Stage All Changes" 가시성 — unstaged + untracked 가 있어야 의미 있음.
// conflicted 는 stage 가능하나 충돌 미해결 상태로 stage 하면 위험 — UI 단서 없이 포함.
const canStageAll = computed(() => counts.value.unstaged + counts.value.untracked > 0)

function onStageAll(e: MouseEvent) {
  e.stopPropagation() // outer button 의 navigate-status 차단
  if (!canStageAll.value || props.repoId == null) return
  stageAllMut.mutate(props.repoId)
}
</script>

<template>
  <div
    class="flex w-full items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5 text-left text-xs"
  >
    <button
      type="button"
      data-testid="change-count-badge"
      class="flex flex-1 items-center gap-1.5 truncate text-left hover:underline"
      :title="
        isClean
          ? '변경사항 없음 — 클릭 시 변경 탭으로 이동'
          : `${counts.total} file changes — 클릭 시 변경 탭으로 이동`
      "
      @click="emit('navigate-status')"
    >
      <span class="font-semibold">
        <span v-if="isClean" class="text-muted-foreground">변경사항 없음 ✓</span>
        <span v-else>
          <span class="text-foreground">{{ counts.total }}</span>
          <span class="text-muted-foreground"> file changes</span>
        </span>
      </span>
      <span v-if="!isClean" class="flex items-center gap-1 text-[10px]">
        <span v-if="counts.staged > 0" class="rounded bg-emerald-500/15 px-1 text-emerald-500">
          staged {{ counts.staged }}
        </span>
        <span v-if="counts.unstaged > 0" class="rounded bg-amber-500/15 px-1 text-amber-500">
          mod {{ counts.unstaged }}
        </span>
        <span v-if="counts.untracked > 0" class="rounded bg-sky-500/15 px-1 text-sky-500">
          new {{ counts.untracked }}
        </span>
        <span v-if="counts.conflicted > 0" class="rounded bg-rose-500/15 px-1 text-rose-500">
          ⚠ {{ counts.conflicted }}
        </span>
      </span>
      <span v-if="branch" class="ml-auto font-mono text-[11px] text-muted-foreground">
        on
        <span class="ml-0.5 font-semibold text-foreground">{{ branch }}</span>
      </span>
    </button>

    <!-- Sprint c30 / GitKraken UX (Phase 2b) — "Stage All Changes" emerald 버튼.
         click.stop 으로 outer navigate-status 차단. unstaged+untracked 0 시 미표시. -->
    <button
      v-if="canStageAll"
      type="button"
      data-testid="stage-all-changes"
      class="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="stageAllMut.isPending.value"
      :title="`${counts.unstaged + counts.untracked}개 변경 모두 stage`"
      :aria-label="`Stage All Changes (${counts.unstaged + counts.untracked}개)`"
      @click="onStageAll"
    >
      {{ stageAllMut.isPending.value ? 'Staging...' : 'Stage All Changes' }}
    </button>
  </div>
</template>
