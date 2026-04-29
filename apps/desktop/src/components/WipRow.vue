<script setup lang="ts">
// Sprint c30 / GitKraken UX (Phase 2a) — Working tree pseudo-row.
//
// GitKraken 의 graph 최상단 "// WIP" 점선 dashed circle row 를 흡수.
// CommitGraph 의 첫 row 위 sticky 로 mount — column 정렬은 별도 (canvas 내부 정렬과
// 분리. UI 적으로 graph 의 첫 row 처럼 보임).
//
// 동작:
//   - working dir dirty 시에만 표시 (status.isClean=false)
//   - 클릭 시 selectedSha='__WIP__' sentinel + tab='status' 자동 전환
//   - selected=true 일 때 active highlight (background + ring)
//
// data-testid='wip-row' — e2e 진입점.

defineProps<{
  /** 변경된 파일 수 (staged + unstaged + untracked + conflicted). */
  changeCount: number
  /** 현재 브랜치 (헤더 라벨용). */
  branch: string | null
  /** selectedSha === '__WIP__' 인지. */
  selected: boolean
}>()

const emit = defineEmits<{
  (e: 'select'): void
}>()
</script>

<template>
  <div
    data-testid="wip-row"
    class="flex shrink-0 cursor-pointer select-none items-center gap-2 border-b border-border/40 px-2 py-1.5 text-xs transition-colors"
    :class="selected ? 'bg-accent ring-1 ring-primary/40' : 'hover:bg-accent/30'"
    :title="`Working directory — ${changeCount} change${changeCount !== 1 ? 's' : ''}${branch ? ` on ${branch}` : ''}`"
    :aria-label="`작업 트리 변경 ${changeCount}개${branch ? ` (${branch})` : ''} — 클릭하면 staging 패널`"
    role="button"
    tabindex="0"
    @click="emit('select')"
    @keydown.enter.prevent="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <!-- BRANCH/TAG 컬럼 placeholder (graph row column 폭 정렬용) -->
    <div class="w-24 shrink-0 truncate font-mono text-[10px] text-muted-foreground">
      <span v-if="branch" class="rounded bg-emerald-500/15 px-1 py-0.5 text-emerald-500">
        ●&nbsp;{{ branch }}
      </span>
    </div>

    <!-- GRAPH 컬럼 — 점선 dashed circle (GitKraken 의 WIP 시각 단서) -->
    <div class="w-12 shrink-0 flex items-center justify-center">
      <span
        class="block h-3 w-3 rounded-full border border-dashed border-foreground/60"
        :class="selected ? 'bg-primary/40' : ''"
        aria-hidden="true"
      />
    </div>

    <!-- COMMIT MESSAGE 컬럼 — // WIP + change count badge -->
    <div class="flex flex-1 items-center gap-2 truncate">
      <span class="font-mono text-muted-foreground">// WIP</span>
      <span
        v-if="changeCount > 0"
        class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600"
      >
        {{ changeCount }}
      </span>
    </div>
  </div>
</template>
