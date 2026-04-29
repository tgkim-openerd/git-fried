<script setup lang="ts">
// Sprint c30 / GitKraken UX (Phase 3) — Fullscreen Diff View.
//
// 파일 row 더블클릭 시 좌측 graph + inline diff 영역 전체를 차지하는 fullscreen
// diff viewer. GitKraken 스크린샷 2 흡수 (graph 사라지고 diff 만 표시).
//
// 동작:
//   useFullscreenDiff state 기반 — source='wip' (working dir) / 'commit' (특정 sha)
//   patch 는 getDiff(repoId, staged, path, rev?) 로 fetch
//   ESC 또는 ✕ 버튼 → close
//
// 의도적으로 미구현 (Phase 3 minimal):
//   - File View / Diff View 토글
//   - Blame / History 버튼
//   - Hunk ↑↓ 네비게이션 (DiffViewer 가 expose 하나 헤더 통합 안 함)
//   Phase 4 에서 보강 예정.

import { computed, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getDiff } from '@/api/git'
import DiffViewer from './DiffViewer.vue'
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'

const props = defineProps<{
  repoId: number | null
}>()

const fs = useFullscreenDiff()

const queryArgs = computed(() => {
  const cur = fs.current.value
  if (!cur || props.repoId == null) return null
  if (cur.source === 'wip') {
    return {
      repoId: props.repoId,
      staged: cur.isStaged,
      path: cur.path,
      rev: null as string | null,
    }
  }
  return {
    repoId: props.repoId,
    staged: false,
    path: cur.path,
    rev: cur.sha,
  }
})

const patchQuery = useQuery({
  queryKey: computed(() => {
    const a = queryArgs.value
    if (!a) return ['fullscreen-diff', 'idle'] as const
    return ['fullscreen-diff', a.repoId, a.staged, a.path, a.rev] as const
  }),
  queryFn: () => {
    const a = queryArgs.value
    if (!a) return Promise.resolve('')
    return getDiff({
      repoId: a.repoId,
      staged: a.staged,
      path: a.path,
      rev: a.rev,
      context: 3,
    })
  },
  enabled: computed(() => queryArgs.value != null),
  staleTime: STALE_TIME.REALTIME,
})

const headerLabel = computed(() => {
  const cur = fs.current.value
  if (!cur) return ''
  if (cur.source === 'wip') {
    return cur.isStaged ? `[STAGED] ${cur.path}` : cur.path
  }
  return `${cur.sha.slice(0, 7)} · ${cur.path}`
})

// Sprint c30 / GitKraken UX (Phase 3) — ESC 닫기.
//   index.vue 의 onEscKey 가 selectedSha 만 처리 — fullscreen 우선.
//   여기서 직접 listener 등록 (active 시에만).
function onEscKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (fs.current.value == null) return
  // 모달/입력 안에서는 skip
  const ae = document.activeElement
  if (
    ae &&
    (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.closest('[role="dialog"]'))
  ) {
    return
  }
  e.stopPropagation() // index.vue 의 onEscKey 가 selectedSha 도 같이 해제하는 것 차단
  fs.close()
}

watch(
  fs.current,
  (cur) => {
    if (cur) {
      window.addEventListener('keydown', onEscKey, { capture: true })
    } else {
      window.removeEventListener('keydown', onEscKey, { capture: true })
    }
  },
  { immediate: true },
)
</script>

<template>
  <section
    v-if="fs.current.value"
    data-testid="fullscreen-diff"
    class="flex h-full flex-col overflow-hidden bg-card"
  >
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-xs"
    >
      <div class="min-w-0 flex-1 truncate font-mono" :title="headerLabel">
        <span
          class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500"
        >
          DIFF
        </span>
        <span class="ml-2">{{ headerLabel }}</span>
      </div>
      <button
        type="button"
        class="rounded px-2 py-0.5 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        title="닫기 (ESC)"
        aria-label="fullscreen diff 닫기"
        data-testid="fullscreen-diff-close"
        @click="fs.close()"
      >
        ✕
      </button>
    </header>

    <div
      v-if="patchQuery.isFetching.value"
      class="flex-1 p-6 text-center text-xs text-muted-foreground"
    >
      불러오는 중...
    </div>
    <div
      v-else-if="patchQuery.error.value"
      class="flex-1 overflow-auto p-3 text-xs text-destructive"
    >
      {{ describeError(patchQuery.error.value) }}
    </div>
    <div
      v-else-if="!patchQuery.data.value"
      class="flex-1 p-6 text-center text-xs text-muted-foreground"
    >
      변경사항 없음 — 다른 파일을 더블클릭하거나 ESC 로 닫으세요.
    </div>
    <DiffViewer v-else :patch="patchQuery.data.value" class="flex-1 overflow-auto" />
  </section>
</template>
