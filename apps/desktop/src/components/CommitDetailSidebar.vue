<script setup lang="ts">
// Phase 1 (plan-commit-graph-ux v2) — Commit detail metadata sidebar.
// Sprint c30 / GitKraken UX (Phase 1) — 헤더 / author / committer / parent / 파일 목록 GitKraken 스타일.
//
// 좌측 inline diff (CommitDiffPanel) 가 file content 중심이면, 우측 sidebar 는
// metadata + 파일 목록 중심.
//
// 데이터 source:
// - commit metadata: useGraph 의 rows 에서 sha lookup (vue-query dedupe — CommitGraph 와 cache 공유)
// - file stats + paths: useCommitDiff 의 patch 파싱 (patchStats)

import { computed, ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useGraph } from '@/composables/useGraph'
import { useCommitDiff } from '@/composables/useCommitDiff'
import { formatDateLocalized } from '@/composables/useUserSettings'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { parsePatchStats, type PatchFile, type PatchFileChange } from '@/utils/patchStats'
import { buildPathTree } from '@/utils/pathTree'
import { flattenTree, type FlatTreeRow } from '@/composables/useStatusTreeView'
import { aiExplainCommit } from '@/api/git'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
import AiResultModal from './AiResultModal.vue'
// Sprint c30 / GitKraken UX (Phase 3) — 파일 더블클릭 → fullscreen diff.
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'

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

// Sprint c30 / GitKraken UX — Path/Tree 토글 (StatusPanel 과 동일 패턴, 영속 키만 분리).
const VIEW_KEY = 'git-fried.commit-detail.viewMode'
type ViewMode = 'path' | 'tree'
function loadViewMode(): ViewMode {
  if (typeof localStorage === 'undefined') return 'path'
  return localStorage.getItem(VIEW_KEY) === 'tree' ? 'tree' : 'path'
}
const viewMode = ref<ViewMode>(loadViewMode())
function setViewMode(m: ViewMode) {
  viewMode.value = m
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(VIEW_KEY, m)
    } catch {
      /* ignore */
    }
  }
}
const collapsedDirs = ref<Set<string>>(new Set())
function toggleDir(path: string) {
  const next = new Set(collapsedDirs.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  collapsedDirs.value = next
}

const fileTreeRows = computed<FlatTreeRow<PatchFile>[]>(() => {
  if (viewMode.value !== 'tree' || !fileStats.value) return []
  const items = fileStats.value.paths.map((f) => ({ path: f.path, meta: f }))
  const tree = buildPathTree(items, { collapseSingleChild: true })
  return flattenTree(tree, collapsedDirs.value)
})

function changeIcon(c: PatchFileChange): string {
  switch (c) {
    case 'added':
      return '＋'
    case 'deleted':
      return '−'
    case 'renamed':
      return '↔'
    case 'modified':
    default:
      return '·'
  }
}

function changeColor(c: PatchFileChange): string {
  switch (c) {
    case 'added':
      return 'text-emerald-500'
    case 'deleted':
      return 'text-rose-500'
    case 'renamed':
      return 'text-violet-500'
    case 'modified':
    default:
      return 'text-amber-500'
  }
}

// Sprint c30 / GitKraken UX (Phase 3) — 파일 더블클릭 → fullscreen diff (commit context).
const fsDiff = useFullscreenDiff()
function openFullscreen(path: string) {
  if (!props.sha) return
  fsDiff.openCommit(props.sha, path)
}

// Phase 13-2 (GitKraken parity) — Explain commit (✨ AI) 버튼 (헤더 우상단).
//   기존: StatusBar 의 좌측 inline diff toolbar 의 ✨ AI (충돌 분석 전용)
//   여기 추가: 선택 commit 의 변경 내용을 AI 가 자연어로 설명.
const ai = useAiCli()
const explainOpen = ref(false)
const explainContent = ref('')
const explainError = ref<string | null>(null)
const explainMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || !props.sha) {
      return Promise.reject(new Error('레포/commit 미확정'))
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
      notifyAiDone('AI commit 설명', props.sha?.slice(0, 7) ?? '')
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
function onExplainCommit() {
  if (!props.sha) return
  if (ai.available.value == null) {
    toast.warning('AI CLI 미설치', 'Claude 또는 Codex CLI 설치 후 재시도')
    return
  }
  explainOpen.value = true
  explainContent.value = ''
  explainError.value = null
  explainMut.mutate()
}
</script>

<template>
  <section data-testid="commit-detail-sidebar" class="flex h-full flex-col overflow-hidden bg-card">
    <!-- Sprint c30 / GitKraken UX — header: "commit: SHA" + ✨ Explain commit (Phase 13-2). -->
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2"
    >
      <div class="flex items-center gap-1.5 text-xs">
        <span class="text-muted-foreground">commit:</span>
        <button
          v-if="sha"
          type="button"
          class="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-xs hover:bg-accent/40"
          title="SHA 복사 (full)"
          aria-label="SHA 복사"
          @click="copySha"
        >
          {{ sha.slice(0, 7) }}
        </button>
      </div>
      <div class="flex items-center gap-1.5">
        <span v-if="cd.isFetching.value" class="text-[10px] text-muted-foreground">
          불러오는 중...
        </span>
        <!-- Phase 13-2 — Explain commit (GitKraken parity). AI CLI 미설치 시 disabled. -->
        <button
          v-if="sha"
          type="button"
          class="flex items-center gap-1 rounded border border-input bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:hover:bg-card"
          :disabled="!ai.available.value || explainMut.isPending.value"
          :title="
            ai.available.value
              ? `✨ ${ai.available.value} — 이 commit 의 변경을 AI 가 설명`
              : 'Claude / Codex CLI 미설치'
          "
          aria-label="Explain commit (AI)"
          @click="onExplainCommit"
        >
          ✨ {{ explainMut.isPending.value ? '...' : 'Explain' }}
        </button>
      </div>
    </header>

    <div v-if="!commit" class="p-6 text-center text-sm text-muted-foreground">
      그래프에서 commit 을 선택하세요.
    </div>

    <div v-else class="flex-1 space-y-3 overflow-auto px-3 py-3">
      <!-- subject + body (헤더 바로 아래 가장 prominent — GitKraken 동일) -->
      <div>
        <h3 class="text-sm font-semibold leading-snug">{{ commit.subject }}</h3>
        <pre v-if="commit.body" class="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{{
          commit.body
        }}</pre>
      </div>

      <!-- author + committer (GitKraken 처럼 분리 표시) -->
      <div class="space-y-1.5 rounded-md border border-border bg-muted/10 p-2 text-xs">
        <div class="flex items-center gap-2">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-500"
            :title="commit.authorEmail"
            :aria-label="`작성자: ${commit.authorName} (${commit.authorEmail})`"
          >
            {{ authorInitial }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-medium" :title="commit.authorEmail">
              {{ commit.authorName }}
            </div>
            <div class="text-[10px] text-muted-foreground">
              authored {{ fmtDate(commit.authorAt) }}
            </div>
          </div>
        </div>
        <!-- committer date 별도 표시 (CommitSummary 가 committer name 미제공 — date 만) -->
        <div
          v-if="commit.committerAt !== commit.authorAt"
          class="ml-8 text-[10px] text-muted-foreground"
        >
          committed {{ fmtDate(commit.committerAt) }}
        </div>
      </div>

      <!-- meta — parents / refs (GitKraken 처럼 한 그룹) -->
      <div class="space-y-1 text-[10px] text-muted-foreground">
        <div v-if="commit.parentShas.length > 0" class="flex flex-wrap items-center gap-1">
          <span class="uppercase tracking-wider"
            >parent{{ commit.parentShas.length > 1 ? 's' : '' }}:</span
          >
          <span
            v-for="p in commit.parentShas"
            :key="p"
            class="rounded bg-muted/40 px-1.5 py-0.5 font-mono"
          >
            {{ p.slice(0, 7) }}
          </span>
        </div>
        <div v-if="commit.refs.length > 0" class="flex flex-wrap items-center gap-1">
          <span class="uppercase tracking-wider">refs:</span>
          <span
            v-for="r in commit.refs"
            :key="r"
            class="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono"
          >
            {{ r }}
          </span>
        </div>
      </div>

      <!-- file stats summary -->
      <div
        v-if="fileStats"
        class="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs"
        title="이 commit 의 변경 통계 (좌측 inline diff 의 patch 기반)"
      >
        <span class="text-emerald-500">+{{ fileStats.adds }}</span>
        <span class="text-rose-500">−{{ fileStats.dels }}</span>
        <span class="text-muted-foreground">({{ fileStats.files }} files)</span>
      </div>

      <!-- Sprint c30 / GitKraken UX — 파일 목록 (Path / Tree 토글) -->
      <div v-if="fileStats && fileStats.paths.length > 0" data-testid="commit-detail-files">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-[10px] uppercase tracking-wider text-muted-foreground">
            {{ fileStats.files }} modified
          </span>
          <div
            class="flex items-center gap-0.5 rounded border border-border bg-muted/30 p-0.5 text-[10px]"
            title="파일 목록 표시 모드"
          >
            <button
              type="button"
              class="rounded px-1.5 py-0.5"
              :class="
                viewMode === 'path'
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              "
              aria-label="평탄 path 모드"
              title="Path"
              @click="setViewMode('path')"
            >
              Path
            </button>
            <button
              type="button"
              class="rounded px-1.5 py-0.5"
              :class="
                viewMode === 'tree'
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              "
              aria-label="디렉토리 트리 모드"
              title="Tree"
              @click="setViewMode('tree')"
            >
              Tree
            </button>
          </div>
        </div>

        <ul v-if="viewMode === 'path'" class="space-y-0.5 text-xs">
          <li
            v-for="f in fileStats.paths"
            :key="f.path"
            class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
            :title="`${f.oldPath ? `renamed from ${f.oldPath} — ` : ''}클릭 — fullscreen diff (좌/우 사이드바 자동 hide)`"
            @click="openFullscreen(f.path)"
          >
            <span :class="['shrink-0 w-3 text-center', changeColor(f.change)]">
              {{ changeIcon(f.change) }}
            </span>
            <span class="flex-1 truncate font-mono text-[11px]">{{ f.path }}</span>
          </li>
        </ul>

        <ul v-else class="space-y-0.5 text-xs">
          <template v-for="(row, idx) in fileTreeRows" :key="`f-${idx}`">
            <li
              v-if="row.kind === 'dir'"
              class="flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/30"
              :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
              :title="`디렉토리 ${row.path}`"
              @click="toggleDir(row.path)"
            >
              <span class="text-[10px] text-muted-foreground">
                {{ row.collapsed ? '▶' : '▼' }}
              </span>
              <span class="font-mono text-[11px] text-muted-foreground">{{ row.name }}/</span>
            </li>
            <li
              v-else
              class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
              :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
              :title="`${row.meta.oldPath ? `renamed from ${row.meta.oldPath} — ` : ''}클릭 — fullscreen diff (좌/우 사이드바 자동 hide)`"
              @click="openFullscreen(row.path)"
            >
              <span :class="['shrink-0 w-3 text-center', changeColor(row.meta.change)]">
                {{ changeIcon(row.meta.change) }}
              </span>
              <span class="flex-1 truncate font-mono text-[11px]">{{
                row.path.split('/').pop()
              }}</span>
            </li>
          </template>
        </ul>
      </div>

      <p
        v-if="cd.error.value"
        class="rounded border border-destructive bg-destructive/10 p-2 text-xs"
      >
        {{ describeError(cd.error.value) }}
      </p>

      <!-- Phase 1 — action button 없음 (좌측 inline diff 에서 cherry-pick/revert/reset 사용).
           Phase 13-2 — AI commit 설명은 헤더 우상단 [✨ Explain] 버튼에서. -->
      <p class="text-[10px] text-muted-foreground">
        💡 cherry-pick / revert / reset 은 좌측 inline diff 의 toolbar 에서 사용하세요.
      </p>
    </div>

    <!-- Phase 13-2 — AI explain commit 결과 모달. -->
    <AiResultModal
      :open="explainOpen"
      title="Commit 설명 (AI)"
      :content="explainContent"
      :loading="explainMut.isPending.value"
      :error="explainError"
      @close="explainOpen = false"
    />
  </section>
</template>
