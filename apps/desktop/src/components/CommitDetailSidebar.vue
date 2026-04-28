<script setup lang="ts">
// Phase 1 (plan-commit-graph-ux v2) — Commit detail metadata sidebar.
//
// 좌측 inline diff (CommitDiffPanel) 가 file content 중심이면, 우측 sidebar 는
// metadata 중심 (SHA / author / date / message / refs / file stats).
// action button (cherry-pick / revert / reset / AI) 은 좌측 inline diff 에 이미 있어 중복 회피 (Phase 1).
//
// 데이터 source:
// - commit metadata: useGraph 의 rows 에서 sha lookup (vue-query dedupe — CommitGraph 와 cache 공유)
// - file stats: useCommitDiff 의 patch 단순 파싱 (+/- count, file count)

import { computed } from 'vue'
import { useGraph } from '@/composables/useGraph'
import { useCommitDiff } from '@/composables/useCommitDiff'
import { formatDateLocalized } from '@/composables/useUserSettings'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { parsePatchStats } from '@/utils/patchStats'

const props = defineProps<{
  repoId: number | null
  sha: string | null
}>()

const toast = useToast()

const { data: graph } = useGraph(() => props.repoId, 500)
const cd = useCommitDiff({
  repoId: () => props.repoId,
  sha: () => props.sha,
})

const commit = computed(() => {
  if (!props.sha) return null
  return graph.value?.rows.find((r) => r.commit.sha === props.sha)?.commit ?? null
})

const fileStats = computed(() => {
  const patch = cd.data.value
  if (!patch) return null
  return parsePatchStats(patch)
})

const authorInitial = computed(() => commit.value?.authorName?.charAt(0)?.toUpperCase() ?? '?')

function fmtDate(unix: number): string {
  return formatDateLocalized(unix, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function copySha() {
  if (!props.sha) return
  try {
    await navigator.clipboard.writeText(props.sha)
    toast.success('SHA 복사', props.sha.slice(0, 8))
  } catch (e) {
    toast.error('복사 실패', describeError(e))
  }
}
</script>

<template>
  <section data-testid="commit-detail-sidebar" class="flex h-full flex-col overflow-hidden bg-card">
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2"
    >
      <div class="flex items-center gap-2 font-mono text-xs">
        <span class="rounded bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-500">
          COMMIT
        </span>
        <button
          v-if="sha"
          type="button"
          class="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-xs hover:bg-accent/40"
          title="SHA 복사 (full)"
          aria-label="SHA 복사"
          @click="copySha"
        >
          {{ sha.slice(0, 12) }}
        </button>
      </div>
      <span v-if="cd.isFetching.value" class="text-[10px] text-muted-foreground">
        불러오는 중...
      </span>
    </header>

    <div v-if="!commit" class="p-6 text-center text-sm text-muted-foreground">
      그래프에서 commit 을 선택하세요.
    </div>

    <div v-else class="flex-1 space-y-3 overflow-auto px-3 py-3">
      <!-- author + date -->
      <div class="flex items-center gap-2">
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-500"
          :title="commit.authorEmail"
          :aria-label="`작성자: ${commit.authorName} (${commit.authorEmail})`"
        >
          {{ authorInitial }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium" :title="commit.authorEmail">
            {{ commit.authorName }}
          </div>
          <div class="text-[10px] text-muted-foreground">{{ fmtDate(commit.authorAt) }}</div>
        </div>
      </div>

      <!-- subject -->
      <div class="rounded-md border border-border bg-muted/20 p-2">
        <h3 class="text-sm font-semibold">{{ commit.subject }}</h3>
        <pre v-if="commit.body" class="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{{
          commit.body
        }}</pre>
      </div>

      <!-- refs -->
      <div v-if="commit.refs.length > 0" class="flex flex-wrap items-center gap-1">
        <span class="text-[10px] uppercase tracking-wider text-muted-foreground">refs</span>
        <span
          v-for="r in commit.refs"
          :key="r"
          class="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
        >
          {{ r }}
        </span>
      </div>

      <!-- file stats -->
      <div
        v-if="fileStats"
        class="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs"
        title="이 commit 의 변경 통계 (좌측 inline diff 의 patch 기반)"
      >
        <span class="text-emerald-500">+{{ fileStats.adds }}</span>
        <span class="text-rose-500">−{{ fileStats.dels }}</span>
        <span class="text-muted-foreground">({{ fileStats.files }} files)</span>
      </div>

      <!-- parents -->
      <div v-if="commit.parentShas.length > 0" class="text-[10px] text-muted-foreground">
        parents: {{ commit.parentShas.map((p) => p.slice(0, 7)).join(' · ') }}
      </div>

      <p
        v-if="cd.error.value"
        class="rounded border border-destructive bg-destructive/10 p-2 text-xs"
      >
        {{ describeError(cd.error.value) }}
      </p>

      <!-- Phase 1 — action button 없음 (좌측 inline diff 에서 cherry-pick/revert/reset/AI 사용). -->
      <p class="text-[10px] text-muted-foreground">
        💡 cherry-pick / revert / reset / AI 설명은 좌측 inline diff 의 toolbar 에서 사용하세요.
      </p>
    </div>
  </section>
</template>
