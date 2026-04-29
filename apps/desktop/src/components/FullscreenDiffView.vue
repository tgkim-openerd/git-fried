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
// Sprint c30 / GitKraken UX (Phase 4-1) — 헤더 강화:
//   - Hunk ↑↓ + count badge (DiffViewer expose wire up)
//   - History 버튼 (FileHistoryModal 재사용 — 파일별 commit 이력 + blame)
//   - File View / Diff View 토글 (File View 는 Phase 5 placeholder)
//   - Blame 버튼 → History modal 의 blame tab 진입 (placeholder)

import { computed, ref, useTemplateRef, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getDiff, readFile } from '@/api/git'
import DiffViewer, { type DiffViewerExpose } from './DiffViewer.vue'
import FileHistoryModal from './FileHistoryModal.vue'
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

// Sprint c30 / GitKraken UX (Phase 4-1) — Hunk ↑↓ 네비게이션.
// DiffViewer expose (nextHunk / prevHunk / hunkCount) wire up.
const diffViewerRef = useTemplateRef<DiffViewerExpose>('diffViewer')

// patch 의 hunk 헤더 카운트 — DiffViewer.hunkCount() 는 reactive 아님이므로 자체 셈.
const hunkCount = computed(() => {
  const p = patchQuery.data.value
  if (!p) return 0
  return (p.match(/^@@\s/gm) ?? []).length
})
const hunkNavDisabled = computed(() => hunkCount.value <= 1)

function onPrevHunk() {
  if (hunkNavDisabled.value) return
  diffViewerRef.value?.prevHunk()
}
function onNextHunk() {
  if (hunkNavDisabled.value) return
  diffViewerRef.value?.nextHunk()
}

// Sprint c30 / GitKraken UX (Phase 4-1 + 6a) — File History modal (FileHistoryModal 재사용).
//   GitKraken 의 "History" 버튼 흡수 — 파일의 커밋 이력 + blame 표시.
//   Phase 6a — Blame 버튼은 동일 modal 의 'blame' tab 으로 직접 진입.
const historyOpen = ref(false)
const historyInitialTab = ref<'history' | 'blame'>('history')
function openHistory() {
  if (!fs.current.value) return
  historyInitialTab.value = 'history'
  historyOpen.value = true
}
function openBlame() {
  if (!fs.current.value) return
  historyInitialTab.value = 'blame'
  historyOpen.value = true
}

// Sprint c30 / GitKraken UX (Phase 4-1 + 6b) — File View / Diff View 토글.
//   Phase 6b — File View 활성화 (Rust read_file IPC 추가).
//     'diff' = 기존 patch + DiffViewer
//     'file' = readFile(repoId, path, rev?, isStaged) → raw content + <pre>
type ViewMode = 'diff' | 'file'
const viewMode = ref<ViewMode>('diff')
function setViewMode(m: ViewMode) {
  viewMode.value = m
}

const currentPath = computed(() => fs.current.value?.path ?? null)

// Sprint c30 / GitKraken UX (Phase 6b) — File View raw content fetch.
const fileQuery = useQuery({
  queryKey: computed(() => {
    const a = queryArgs.value
    if (!a) return ['fullscreen-file', 'idle'] as const
    return ['fullscreen-file', a.repoId, a.staged, a.path, a.rev] as const
  }),
  queryFn: () => {
    const a = queryArgs.value
    if (!a) return Promise.resolve('')
    return readFile(a.repoId, a.path, a.rev, a.staged)
  },
  enabled: computed(() => viewMode.value === 'file' && queryArgs.value != null),
  staleTime: STALE_TIME.REALTIME,
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

      <!-- Sprint c30 / GitKraken UX (Phase 4-1 + 6b) — File View / Diff View 토글 -->
      <div
        class="flex items-center gap-0.5 rounded border border-border bg-muted/30 p-0.5"
        title="View 모드"
      >
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-[10px]"
          :class="
            viewMode === 'file'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          "
          aria-label="File View"
          data-testid="fullscreen-diff-file-view"
          @click="setViewMode('file')"
        >
          File View
        </button>
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-[10px]"
          :class="
            viewMode === 'diff'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          "
          aria-label="Diff View"
          data-testid="fullscreen-diff-diff-view"
          @click="setViewMode('diff')"
        >
          Diff View
        </button>
      </div>

      <!-- Sprint c30 / GitKraken UX (Phase 4-1 + 6a) — Blame / History 버튼 (둘 다 활성) -->
      <button
        type="button"
        class="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        title="Blame — 파일 line-by-line author 추적 (FileHistoryModal blame tab)"
        aria-label="File blame"
        data-testid="fullscreen-diff-blame"
        @click="openBlame"
      >
        Blame
      </button>
      <button
        type="button"
        class="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        title="History — 파일 commit 이력"
        aria-label="File history"
        data-testid="fullscreen-diff-history"
        @click="openHistory"
      >
        History
      </button>

      <!-- Sprint c30 / GitKraken UX (Phase 4-1) — Hunk ↑↓ 네비게이션 -->
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-30"
          :disabled="hunkNavDisabled"
          title="이전 hunk (Alt+↑)"
          aria-label="이전 hunk"
          data-testid="fullscreen-diff-prev-hunk"
          @click="onPrevHunk"
        >
          ↑
        </button>
        <span
          v-if="hunkCount > 0"
          class="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          :title="`${hunkCount} hunk${hunkCount > 1 ? 's' : ''}`"
        >
          {{ hunkCount }}
        </span>
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-30"
          :disabled="hunkNavDisabled"
          title="다음 hunk (Alt+↓)"
          aria-label="다음 hunk"
          data-testid="fullscreen-diff-next-hunk"
          @click="onNextHunk"
        >
          ↓
        </button>
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

    <!-- Sprint c30 / GitKraken UX (Phase 6b) — viewMode 별 분기 -->
    <template v-if="viewMode === 'file'">
      <div
        v-if="fileQuery.isFetching.value"
        class="flex-1 p-6 text-center text-xs text-muted-foreground"
      >
        파일 로딩 중...
      </div>
      <div
        v-else-if="fileQuery.error.value"
        class="flex-1 overflow-auto p-3 text-xs text-destructive"
      >
        {{ describeError(fileQuery.error.value) }}
      </div>
      <div
        v-else-if="!fileQuery.data.value"
        class="flex-1 p-6 text-center text-xs text-muted-foreground"
      >
        파일이 비어있거나 binary 입니다.
      </div>
      <pre
        v-else
        data-testid="fullscreen-file-content"
        class="flex-1 overflow-auto whitespace-pre p-3 font-mono text-xs"
        >{{ fileQuery.data.value }}</pre
      >
    </template>

    <template v-else>
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
      <DiffViewer
        v-else
        ref="diffViewer"
        :patch="patchQuery.data.value"
        class="flex-1 overflow-auto"
      />
    </template>

    <!-- Sprint c30 / GitKraken UX (Phase 4-1 + 6a) — File History modal (Blame 버튼도 동일 modal). -->
    <FileHistoryModal
      v-if="historyOpen && currentPath"
      :repo-id="repoId"
      :path="currentPath"
      :open="historyOpen"
      :initial-tab="historyInitialTab"
      @close="historyOpen = false"
    />
  </section>
</template>
