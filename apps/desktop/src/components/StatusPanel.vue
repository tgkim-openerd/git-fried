<script setup lang="ts">
// 작업 디렉토리 상태 패널.
// - staged / unstaged / untracked / conflicted 분리
// - 파일 클릭 시 stage / unstage 토글
// - "+ 모두 stage" / "− 모두 unstage" 단축
import { computed, ref, useTemplateRef } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { useStatus, useInvalidateRepoQueries } from '@/composables/useStatus'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
// TYPE-003 / ARCH-004 fix — DiffViewer 가 export 하는 공통 expose 타입 import.
import DiffViewer, { type DiffViewerExpose } from './DiffViewer.vue'
import {
  discardPaths,
  getDiff,
  launchMergetool,
  stageAll,
  stagePaths,
  unstagePaths,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useShortcut } from '@/composables/useShortcuts'
import { useToast } from '@/composables/useToast'
import { STALE_TIME } from '@/api/queryClient'
import FileHistoryModal from './FileHistoryModal.vue'
import MergeEditorModal from './MergeEditorModal.vue'
import HunkStageModal from './HunkStageModal.vue'
import { useSectionCollapse } from '@/composables/useSectionCollapse'
import { useStatusFilter } from '@/composables/useStatusFilter'

const collapsedStaged = useSectionCollapse('status.staged')
const collapsedUnstaged = useSectionCollapse('status.unstaged')
const collapsedUntracked = useSectionCollapse('status.untracked')
const collapsedConflicted = useSectionCollapse('status.conflicted')
import type { ChangeStatus, FileChange } from '@/types/git'

// Sprint c25-2.1 — Path/Tree 토글 (`docs/plan/25 §3-2`).
// GitKraken Image #1 의 우측 패널 헤더 `Path | Tree` 흡수.
// scope 최소화 — Modified (unstaged) 섹션만 tree 지원.
import { buildPathTree, type TreeNode } from '@/utils/pathTree'

type ViewMode = 'path' | 'tree'
const VIEW_MODE_KEY = 'git-fried.status.viewMode'
function loadViewMode(): ViewMode {
  if (typeof localStorage === 'undefined') return 'path'
  const v = localStorage.getItem(VIEW_MODE_KEY)
  return v === 'tree' ? 'tree' : 'path'
}
const viewMode = ref<ViewMode>(loadViewMode())
function setViewMode(m: ViewMode) {
  viewMode.value = m
  if (typeof localStorage !== 'undefined') localStorage.setItem(VIEW_MODE_KEY, m)
}

// Tree mode — 디렉토리 collapse 상태 (path 별 Set).
//
// ARCH-005 (의도적 일관성) — 4 섹션 (Staged / Modified / Untracked / Conflicted) 이
// 동일한 `apps/desktop/src/api` 디렉토리 노드를 가질 수 있다. 한쪽에서 접으면 양쪽 모두
// 접히는 동작이 의도. 사용자가 "이 디렉토리 전체 숨김" 모델로 인지하기 쉽게 통일.
// 섹션별 분리가 필요하면 `Record<SectionKey, Set<string>>` 으로 변경 (현재 미적용).
const collapsedDirs = ref<Set<string>>(new Set())
function toggleDir(path: string) {
  const next = new Set(collapsedDirs.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  collapsedDirs.value = next
}

const props = defineProps<{ repoId: number | null }>()
const toast = useToast()
const { data: status, isFetching } = useStatus(() => props.repoId)
const invalidate = useInvalidateRepoQueries()

const stageMut = useMutation({
  mutationFn: ({ id, paths }: { id: number; paths: string[] }) => stagePaths(id, paths),
  onSuccess: () => invalidate(props.repoId),
})
const unstageMut = useMutation({
  mutationFn: ({ id, paths }: { id: number; paths: string[] }) => unstagePaths(id, paths),
  onSuccess: () => invalidate(props.repoId),
})
const discardMut = useMutation({
  mutationFn: ({ id, paths }: { id: number; paths: string[] }) => discardPaths(id, paths),
  onSuccess: () => invalidate(props.repoId),
})
const stageAllMut = useMutation({
  mutationFn: (id: number) => stageAll(id),
  onSuccess: () => invalidate(props.repoId),
})

function onStageOne(path: string) {
  if (props.repoId != null) stageMut.mutate({ id: props.repoId, paths: [path] })
}
function onUnstageOne(path: string) {
  if (props.repoId != null) unstageMut.mutate({ id: props.repoId, paths: [path] })
}
function onDiscardOne(path: string) {
  if (props.repoId == null) return
  if (confirm(`'${path}' 의 변경을 폐기하시겠습니까? 되돌릴 수 없습니다.`)) {
    discardMut.mutate({ id: props.repoId, paths: [path] })
  }
}
function onStageAll() {
  if (props.repoId != null) stageAllMut.mutate(props.repoId)
}

function statusLabel(s: ChangeStatus): string {
  switch (s) {
    case 'added':
      return '추가'
    case 'modified':
      return '수정'
    case 'deleted':
      return '삭제'
    case 'renamed':
      return '이름변경'
    case 'copied':
      return '복사'
    case 'typechange':
      return '타입변경'
    default:
      return '?'
  }
}

// File history modal state
const historyPath = ref<string | null>(null)
const historyOpen = ref(false)
function openHistory(path: string) {
  historyPath.value = path
  historyOpen.value = true
}

// 3-way merge modal state
const mergePath = ref<string | null>(null)
const mergeOpen = ref(false)
function openMerge(path: string) {
  mergePath.value = path
  mergeOpen.value = true
}

// Sprint H — Hunk-level stage / unstage
const hunkPath = ref<string | null>(null)
const hunkStaged = ref(false)
const hunkOpen = ref(false)
function openHunk(path: string, staged: boolean) {
  hunkPath.value = path
  hunkStaged.value = staged
  hunkOpen.value = true
}

// === Sprint 22-2 CM-3: file row 우클릭 메뉴 ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')

async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    toast.success('경로 복사', path)
  } catch (e) {
    toast.error('복사 실패', describeError(e))
  }
}

function onFileContextMenu(ev: MouseEvent, path: string, isStaged: boolean) {
  ev.preventDefault()
  selectPath(path)
  const items: ContextMenuItem[] = isStaged
    ? [
        { label: 'Unstage', icon: '−', action: () => onUnstageOne(path) },
        { divider: true },
        {
          label: 'Hunk-level unstage',
          icon: '✂',
          action: () => openHunk(path, true),
        },
        { divider: true },
        {
          label: 'File history',
          icon: '📜',
          action: () => openHistory(path),
        },
        { label: 'Copy path', icon: '📋', action: () => void copyPath(path) },
      ]
    : [
        { label: 'Stage', icon: '+', action: () => onStageOne(path) },
        {
          label: 'Discard',
          icon: '⤺',
          destructive: true,
          action: () => onDiscardOne(path),
        },
        { divider: true },
        {
          label: 'Hunk-level stage',
          icon: '✂',
          action: () => openHunk(path, false),
        },
        { divider: true },
        {
          label: 'File history',
          icon: '📜',
          action: () => openHistory(path),
        },
        { label: 'Copy path', icon: '📋', action: () => void copyPath(path) },
      ]
  ctxMenu.value?.openAt(ev, items)
}

// Sprint C6 — 외부 merge tool launch
const mergetoolMut = useMutation({
  mutationFn: ({ p }: { p: string }) => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return launchMergetool(props.repoId, p, null)
  },
  onSuccess: (res) => {
    if (res.success) {
      toast.success('Mergetool 종료', '')
      invalidate(props.repoId)
    } else {
      toast.error('Mergetool 실패', res.stderr.slice(0, 200) || `exit ${res.exitCode}`)
    }
  },
  onError: (e) => toast.error('Mergetool 호출 실패', describeError(e)),
})
function onLaunchMergetool(p: string) {
  if (props.repoId == null) return
  mergetoolMut.mutate({ p })
}

function statusColor(s: ChangeStatus): string {
  switch (s) {
    case 'added':
      return 'text-emerald-500'
    case 'modified':
      return 'text-amber-500'
    case 'deleted':
      return 'text-rose-500'
    case 'renamed':
    case 'copied':
      return 'text-sky-500'
    default:
      return 'text-muted-foreground'
  }
}

// Vim S/U — 현재 선택된 파일 stage / unstage (Sprint A2).
// 우선순위:
//   1. 명시적 클릭으로 selectedPath 가 있으면 그 파일.
//   2. unstage list 첫 파일 (stage S 의 일반 케이스).
//   3. staged list 첫 파일 (unstage U 의 일반 케이스).
const selectedPath = ref<string | null>(null)

function pickStageTarget(): string | null {
  if (selectedPath.value) {
    // staged 에 있으면 이미 stage 됨 → 다음 unstaged 행으로.
    if (status.value?.staged.some((f) => f.path === selectedPath.value)) {
      return status.value?.unstaged[0]?.path ?? status.value?.untracked[0] ?? null
    }
    return selectedPath.value
  }
  return status.value?.unstaged[0]?.path ?? status.value?.untracked[0] ?? null
}

function pickUnstageTarget(): string | null {
  if (selectedPath.value) {
    if (status.value?.unstaged.some((f) => f.path === selectedPath.value)) {
      return status.value?.staged[0]?.path ?? null
    }
    return selectedPath.value
  }
  return status.value?.staged[0]?.path ?? null
}

useShortcut('stageCurrent', () => {
  if (props.repoId == null) return
  const target = pickStageTarget()
  if (!target) return
  stageMut.mutate({ id: props.repoId, paths: [target] })
})

useShortcut('unstageCurrent', () => {
  if (props.repoId == null) return
  const target = pickUnstageTarget()
  if (!target) return
  unstageMut.mutate({ id: props.repoId, paths: [target] })
})

// Sprint B5 — ⌘⇧S / ⌘⇧U 일괄, ⌘⇧H 첫 unstaged 의 file history.
useShortcut('stageAllExplicit', () => {
  if (props.repoId != null) stageAllMut.mutate(props.repoId)
})

useShortcut('unstageAll', () => {
  if (props.repoId == null) return
  const paths = (status.value?.staged ?? []).map((f) => f.path)
  if (paths.length === 0) return
  unstageMut.mutate({ id: props.repoId, paths })
})

useShortcut('fileHistorySearch', () => {
  // 현재 selected 또는 첫 번째 unstaged/staged 의 history.
  const target =
    selectedPath.value ?? status.value?.unstaged[0]?.path ?? status.value?.staged[0]?.path ?? null
  if (target) openHistory(target)
})

function selectPath(path: string) {
  selectedPath.value = selectedPath.value === path ? null : path
}

// === Sprint 22-6 F-I1: 파일 필터 (50+ 파일 환경) ===
// composables/useStatusFilter.ts 로 추출 (StatusPanel.vue God comp 분리 1차).
const { fileFilter, filteredStaged, filteredUnstaged, filteredUntracked, filteredConflicted } =
  useStatusFilter(status)

// Sprint c25-2.1 / c27-2 (TYPE-005 fix) — generic 트리 평탄화.
// Modified / Staged / Untracked / Conflicted 4 섹션 공통 사용.
// row 의 meta 는 호출자 generic <T> — FileChange (Modified/Staged) 또는 string (Untracked/Conflicted).
// path / name 은 두 mode 모두 노출 (file row 의 SoT).
type FlatTreeRow<T> =
  | { kind: 'dir'; path: string; name: string; depth: number; collapsed: boolean }
  | { kind: 'file'; path: string; name: string; depth: number; meta: T }

function flattenTree<T>(
  nodes: TreeNode<T>[],
  collapsed: Set<string>,
  out: FlatTreeRow<T>[] = [],
): FlatTreeRow<T>[] {
  for (const n of nodes) {
    if (n.kind === 'dir') {
      const isCollapsed = collapsed.has(n.path)
      out.push({
        kind: 'dir',
        path: n.path,
        name: n.name,
        depth: n.depth,
        collapsed: isCollapsed,
      })
      if (!isCollapsed) flattenTree(n.children, collapsed, out)
    } else {
      out.push({ kind: 'file', path: n.path, name: n.name, depth: n.depth, meta: n.meta })
    }
  }
  return out
}

type FileChangeTreeRow = FlatTreeRow<FileChange>
type StringTreeRow = FlatTreeRow<string>

const unstagedTreeRows = computed<FileChangeTreeRow[]>(() => {
  if (viewMode.value !== 'tree') return []
  const items = filteredUnstaged.value.map((f) => ({ path: f.path, meta: f }))
  const tree = buildPathTree(items, { collapseSingleChild: true })
  return flattenTree(tree, collapsedDirs.value)
})

const stagedTreeRows = computed<FileChangeTreeRow[]>(() => {
  if (viewMode.value !== 'tree') return []
  const items = filteredStaged.value.map((f) => ({ path: f.path, meta: f }))
  const tree = buildPathTree(items, { collapseSingleChild: true })
  return flattenTree(tree, collapsedDirs.value)
})

const untrackedTreeRows = computed<StringTreeRow[]>(() => {
  if (viewMode.value !== 'tree') return []
  const items = filteredUntracked.value.map((p) => ({ path: p, meta: p }))
  const tree = buildPathTree(items, { collapseSingleChild: true })
  return flattenTree(tree, collapsedDirs.value)
})

const conflictedTreeRows = computed<StringTreeRow[]>(() => {
  if (viewMode.value !== 'tree') return []
  const items = filteredConflicted.value.map((p) => ({ path: p, meta: p }))
  const tree = buildPathTree(items, { collapseSingleChild: true })
  return flattenTree(tree, collapsedDirs.value)
})
// === Sprint 22-7 V-5: 선택 파일 inline diff preview ===
const selectedIsStaged = computed<boolean>(() => {
  if (!selectedPath.value) return false
  return status.value?.staged.some((f) => f.path === selectedPath.value) ?? false
})

const detailDiffQuery = useQuery({
  queryKey: computed(
    () => ['file-diff', props.repoId, selectedPath.value, selectedIsStaged.value] as const,
  ),
  queryFn: () => {
    if (props.repoId == null || !selectedPath.value) return Promise.resolve('')
    return getDiff({
      repoId: props.repoId,
      staged: selectedIsStaged.value,
      path: selectedPath.value,
      context: 3,
    })
  },
  enabled: computed(() => props.repoId != null && !!selectedPath.value),
  staleTime: STALE_TIME.REALTIME,
})

const isSelected = computed(() => (path: string) => selectedPath.value === path)

// === Sprint c25-4 (`docs/plan/25 §5`) — inline diff 헤더 폴리시 ===
// DiffViewer ref + Hunk ↑↓ 네비게이션 (GitKraken Image #2 흡수).
const inlineDiffRef = useTemplateRef<DiffViewerExpose>('inlineDiff')

// Hunk count 는 patch 텍스트에서 직접 셈 — DiffViewer.hunkCount() 는 reactive 하지 않음.
// `@@ -... +... @@` 라인 매칭 (split 모드 외).
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
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold">변경사항</h3>
        <span v-if="isFetching" class="text-xs text-muted-foreground">갱신 중...</span>
      </div>
      <!-- Sprint c25-2.1 — Path / Tree 토글 (Modified 섹션에 적용) -->
      <div
        class="flex items-center gap-0.5 rounded border border-border bg-muted/30 p-0.5 text-[10px]"
        title="Modified 파일 목록 표시 모드 (localStorage 영속)"
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
          title="Path — 전체 경로 한 줄 표시"
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
          title="Tree — 디렉토리 그룹핑 (collapse 가능)"
          @click="setViewMode('tree')"
        >
          Tree
        </button>
      </div>
    </header>

    <div v-if="!repoId" class="p-4 text-center text-xs text-muted-foreground">
      레포를 선택하세요.
    </div>

    <div v-else-if="status?.isClean" class="p-4 text-center text-xs text-muted-foreground">
      변경사항 없음 ✓
    </div>

    <template v-else>
      <!-- Sprint 22-6 F-I1: 파일 필터 (50+ 파일 환경) -->
      <div class="border-b border-border px-3 py-1.5">
        <div class="relative">
          <input
            v-model="fileFilter"
            type="text"
            placeholder="🔍 파일 경로 필터 (부분 매칭)"
            class="w-full rounded border border-input bg-background px-2 py-1 text-[11px]"
            aria-label="변경 파일 경로 필터"
          />
          <button
            v-if="fileFilter"
            type="button"
            class="absolute right-1 top-1/2 -translate-y-1/2 px-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label="필터 초기화"
            title="필터 초기화"
            @click="fileFilter = ''"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-auto px-2 py-2 text-sm">
        <!-- Staged -->
        <div v-if="status && status.staged.length > 0" class="mb-3">
          <div
            class="mb-1 flex cursor-pointer select-none items-center justify-between"
            title="우클릭 = 섹션 접기/펴기"
            @contextmenu.prevent="collapsedStaged = !collapsedStaged"
            @click="collapsedStaged = !collapsedStaged"
          >
            <span class="text-xs uppercase tracking-wider text-muted-foreground">
              {{ collapsedStaged ? '▶' : '▼' }} Staged ({{ status.staged.length }})
            </span>
          </div>
          <ul v-if="!collapsedStaged && viewMode === 'path'">
            <FileRow
              v-for="f in filteredStaged"
              :key="`s-${f.path}`"
              :file="f"
              :label="statusLabel(f.status)"
              :color="statusColor(f.status)"
              action="−"
              action-title="unstage"
              :selected="isSelected(f.path)"
              @select="selectPath(f.path)"
              @action="onUnstageOne(f.path)"
              @contextmenu="onFileContextMenu($event, f.path, true)"
            >
              <template #extra>
                <button
                  type="button"
                  class="text-[10px] text-muted-foreground/70 hover:text-foreground"
                  title="Hunk-level unstage — 특정 라인만 골라 unstage (`docs/plan/14 §H1`)"
                  :aria-label="`'${f.path}' hunk 단위 unstage`"
                  @click.stop="openHunk(f.path, true)"
                >
                  ✂ hunk
                </button>
              </template>
            </FileRow>
          </ul>

          <!-- c25-2.2 — Tree 모드: Staged (Modified 와 동일 패턴, action='-' unstage) -->
          <ul v-else-if="!collapsedStaged && viewMode === 'tree'">
            <template v-for="(row, idx) in stagedTreeRows" :key="`st-${idx}`">
              <li
                v-if="row.kind === 'dir'"
                class="flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/30"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                :title="`디렉토리 ${row.path} — 클릭으로 ${row.collapsed ? '펴기' : '접기'}`"
                @click="toggleDir(row.path)"
              >
                <span class="text-[10px] text-muted-foreground">{{
                  row.collapsed ? '▶' : '▼'
                }}</span>
                <span class="font-mono text-[11px] text-muted-foreground">{{ row.name }}/</span>
              </li>
              <li
                v-else
                class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
                :class="isSelected(row.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                @click="selectPath(row.path)"
                @contextmenu="onFileContextMenu($event, row.path, true)"
              >
                <span
                  :class="['shrink-0 w-12 text-[10px] uppercase', statusColor(row.meta.status)]"
                >
                  {{ statusLabel(row.meta.status) }}
                </span>
                <span class="flex-1 truncate font-mono text-xs" :title="row.path">
                  {{ row.path.split('/').pop() }}
                </span>
                <button
                  type="button"
                  class="text-[10px] text-muted-foreground/70 hover:text-foreground"
                  title="Hunk-level unstage"
                  :aria-label="`'${row.path}' hunk 단위 unstage`"
                  @click.stop="openHunk(row.path, true)"
                >
                  ✂ hunk
                </button>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                  title="unstage"
                  :aria-label="`'${row.path}' unstage`"
                  @click.stop="onUnstageOne(row.path)"
                >
                  −
                </button>
              </li>
            </template>
          </ul>
        </div>

        <!-- Unstaged -->
        <div v-if="status && status.unstaged.length > 0" class="mb-3">
          <div
            class="mb-1 flex cursor-pointer select-none items-center justify-between"
            title="우클릭 = 섹션 접기/펴기"
            @contextmenu.prevent="collapsedUnstaged = !collapsedUnstaged"
          >
            <span
              class="text-xs uppercase tracking-wider text-muted-foreground"
              @click="collapsedUnstaged = !collapsedUnstaged"
            >
              {{ collapsedUnstaged ? '▶' : '▼' }} Modified ({{ status.unstaged.length }})
            </span>
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground"
              @click.stop="onStageAll"
            >
              모두 stage
            </button>
          </div>
          <ul v-if="!collapsedUnstaged && viewMode === 'path'">
            <li
              v-for="f in filteredUnstaged"
              :key="`u-${f.path}`"
              class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
              :class="isSelected(f.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
              draggable="true"
              @click="selectPath(f.path)"
              @contextmenu="onFileContextMenu($event, f.path, false)"
              @dragstart="
                (e: DragEvent) => e.dataTransfer && e.dataTransfer.setData('text/plain', f.path)
              "
            >
              <span :class="['shrink-0 w-12 text-[10px] uppercase', statusColor(f.status)]">
                {{ statusLabel(f.status) }}
              </span>
              <span class="flex-1 truncate font-mono text-xs">{{ f.path }}</span>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                title="file history / blame"
                :aria-label="`'${f.path}' history / blame`"
                @click.stop="openHistory(f.path)"
              >
                📜
              </button>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                title="discard"
                :aria-label="`'${f.path}' 변경 폐기`"
                @click.stop="onDiscardOne(f.path)"
              >
                ⤺
              </button>
              <button
                type="button"
                class="text-[10px] text-muted-foreground/70 hover:text-foreground"
                title="Hunk-level stage — 특정 라인만 골라 stage (`docs/plan/14 §H1`)"
                :aria-label="`'${f.path}' hunk 단위 stage`"
                @click.stop="openHunk(f.path, false)"
              >
                ✂ hunk
              </button>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                title="stage"
                :aria-label="`'${f.path}' stage`"
                @click.stop="onStageOne(f.path)"
              >
                +
              </button>
            </li>
          </ul>

          <!-- Sprint c25-2.1 — Tree 모드: 디렉토리 collapse + indent. file row 액션 동등. -->
          <ul v-else-if="!collapsedUnstaged && viewMode === 'tree'">
            <template v-for="(row, idx) in unstagedTreeRows" :key="`ut-${idx}`">
              <li
                v-if="row.kind === 'dir'"
                class="flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/30"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                :title="`디렉토리 ${row.path} — 클릭으로 ${row.collapsed ? '펴기' : '접기'}`"
                @click="toggleDir(row.path)"
              >
                <span class="text-[10px] text-muted-foreground">{{
                  row.collapsed ? '▶' : '▼'
                }}</span>
                <span class="font-mono text-[11px] text-muted-foreground">{{ row.name }}/</span>
              </li>
              <li
                v-else
                class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
                :class="isSelected(row.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                draggable="true"
                @click="selectPath(row.path)"
                @contextmenu="onFileContextMenu($event, row.path, false)"
                @dragstart="
                  (e: DragEvent) => e.dataTransfer && e.dataTransfer.setData('text/plain', row.path)
                "
              >
                <span
                  :class="['shrink-0 w-12 text-[10px] uppercase', statusColor(row.meta.status)]"
                >
                  {{ statusLabel(row.meta.status) }}
                </span>
                <span class="flex-1 truncate font-mono text-xs" :title="row.path">
                  {{ row.path.split('/').pop() }}
                </span>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                  title="file history / blame"
                  :aria-label="`'${row.path}' history / blame`"
                  @click.stop="openHistory(row.path)"
                >
                  📜
                </button>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                  title="discard"
                  :aria-label="`'${row.path}' 변경 폐기`"
                  @click.stop="onDiscardOne(row.path)"
                >
                  ⤺
                </button>
                <button
                  type="button"
                  class="text-[10px] text-muted-foreground/70 hover:text-foreground"
                  title="Hunk-level stage"
                  :aria-label="`'${row.path}' hunk 단위 stage`"
                  @click.stop="openHunk(row.path, false)"
                >
                  ✂ hunk
                </button>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                  title="stage"
                  :aria-label="`'${row.path}' stage`"
                  @click.stop="onStageOne(row.path)"
                >
                  +
                </button>
              </li>
            </template>
          </ul>
        </div>

        <!-- Untracked -->
        <div v-if="status && status.untracked.length > 0" class="mb-3">
          <div
            class="mb-1 flex cursor-pointer select-none items-center justify-between"
            title="우클릭 = 섹션 접기/펴기"
            @contextmenu.prevent="collapsedUntracked = !collapsedUntracked"
            @click="collapsedUntracked = !collapsedUntracked"
          >
            <span class="text-xs uppercase tracking-wider text-muted-foreground">
              {{ collapsedUntracked ? '▶' : '▼' }} Untracked ({{ status.untracked.length }})
            </span>
          </div>
          <ul v-if="!collapsedUntracked && viewMode === 'path'">
            <li
              v-for="p in filteredUntracked"
              :key="`n-${p}`"
              class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
              :class="isSelected(p) ? 'bg-accent ring-1 ring-primary/40' : ''"
              draggable="true"
              @click="selectPath(p)"
              @dragstart="
                (e: DragEvent) => e.dataTransfer && e.dataTransfer.setData('text/plain', p)
              "
            >
              <span class="shrink-0 w-12 text-[10px] uppercase text-muted-foreground"> new </span>
              <span class="flex-1 truncate font-mono text-xs">{{ p }}</span>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                @click.stop="onStageOne(p)"
              >
                +
              </button>
            </li>
          </ul>

          <!-- c25-2.3 — Tree 모드: Untracked (string row, action='+' stage) -->
          <ul v-else-if="!collapsedUntracked && viewMode === 'tree'">
            <template v-for="(row, idx) in untrackedTreeRows" :key="`unt-${idx}`">
              <li
                v-if="row.kind === 'dir'"
                class="flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/30"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                :title="`디렉토리 ${row.path} — 클릭으로 ${row.collapsed ? '펴기' : '접기'}`"
                @click="toggleDir(row.path)"
              >
                <span class="text-[10px] text-muted-foreground">{{
                  row.collapsed ? '▶' : '▼'
                }}</span>
                <span class="font-mono text-[11px] text-muted-foreground">{{ row.name }}/</span>
              </li>
              <li
                v-else
                class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
                :class="isSelected(row.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                @click="selectPath(row.path)"
              >
                <span class="shrink-0 w-12 text-[10px] uppercase text-muted-foreground">new</span>
                <span class="flex-1 truncate font-mono text-xs" :title="row.path">{{
                  row.name
                }}</span>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                  title="stage"
                  :aria-label="`'${row.path}' stage`"
                  @click.stop="onStageOne(row.path)"
                >
                  +
                </button>
              </li>
            </template>
          </ul>
        </div>

        <!-- Conflicted -->
        <div v-if="status && status.conflicted.length > 0" class="mb-3">
          <div
            class="mb-1 cursor-pointer select-none text-xs uppercase tracking-wider text-destructive"
            title="우클릭 = 섹션 접기/펴기"
            @contextmenu.prevent="collapsedConflicted = !collapsedConflicted"
            @click="collapsedConflicted = !collapsedConflicted"
          >
            {{ collapsedConflicted ? '▶' : '▼' }} Conflicted ({{ status.conflicted.length }})
          </div>
          <ul v-if="!collapsedConflicted && viewMode === 'path'">
            <li
              v-for="p in filteredConflicted"
              :key="`c-${p}`"
              class="group flex items-center gap-2 rounded px-1 py-0.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <span class="flex-1 truncate font-mono">! {{ p }}</span>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40"
                :title="`외부 mergetool (git config merge.tool)`"
                :disabled="mergetoolMut.isPending.value"
                @click="onLaunchMergetool(p)"
              >
                🛠
              </button>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] hover:bg-destructive/20"
                @click="openMerge(p)"
              >
                해결
              </button>
            </li>
          </ul>

          <!-- c25-2.3 — Tree 모드: Conflicted (string row, action=mergetool / 해결) -->
          <ul v-else-if="!collapsedConflicted && viewMode === 'tree'">
            <template v-for="(row, idx) in conflictedTreeRows" :key="`ct-${idx}`">
              <li
                v-if="row.kind === 'dir'"
                class="flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5 text-destructive hover:bg-destructive/10"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                :title="`디렉토리 ${row.path} — 클릭으로 ${row.collapsed ? '펴기' : '접기'}`"
                @click="toggleDir(row.path)"
              >
                <span class="text-[10px]">{{ row.collapsed ? '▶' : '▼' }}</span>
                <span class="font-mono text-[11px]">{{ row.name }}/</span>
              </li>
              <li
                v-else
                class="group flex items-center gap-2 rounded px-1 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
              >
                <span class="flex-1 truncate font-mono" :title="row.path">! {{ row.name }}</span>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40"
                  title="외부 mergetool"
                  :disabled="mergetoolMut.isPending.value"
                  @click="onLaunchMergetool(row.path)"
                >
                  🛠
                </button>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] hover:bg-destructive/20"
                  @click="openMerge(row.path)"
                >
                  해결
                </button>
              </li>
            </template>
          </ul>
        </div>
      </div>

      <!-- Sprint 22-7 V-5: 선택 파일 inline diff preview (하단 fixed 30%) -->
      <div
        v-if="selectedPath"
        class="flex shrink-0 flex-col border-t border-border bg-muted/10"
        style="height: 30%; min-height: 140px"
      >
        <div class="flex items-center justify-between border-b border-border bg-card px-3 py-1.5">
          <div class="flex min-w-0 items-center gap-2 text-xs">
            <span
              class="shrink-0 rounded px-1.5 text-[10px] font-bold"
              :class="
                selectedIsStaged
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : 'bg-amber-500/20 text-amber-500'
              "
            >
              {{ selectedIsStaged ? 'STAGED' : 'WORKDIR' }}
            </span>
            <span class="truncate font-mono">{{ selectedPath }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-1 text-[11px]">
            <!-- Sprint c25-4 §5 — Hunk ↑↓ 네비게이션 (GitKraken Image #2). 1-hunk 이하면 disabled -->
            <div
              class="flex items-center gap-0.5 rounded border border-border bg-muted/30 px-0.5"
              :title="
                hunkNavDisabled
                  ? '이 patch 는 hunk 1개 이하 — nav 불필요'
                  : `${inlineHunkCount}개 hunk — ↑↓ 로 이동`
              "
            >
              <button
                type="button"
                class="px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
                :disabled="hunkNavDisabled"
                title="이전 hunk"
                aria-label="이전 hunk 로 이동"
                @click="onPrevHunk"
              >
                ↑
              </button>
              <button
                type="button"
                class="px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
                :disabled="hunkNavDisabled"
                title="다음 hunk"
                aria-label="다음 hunk 로 이동"
                @click="onNextHunk"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              class="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-accent/40"
              title="파일 히스토리 / Blame (⌘⇧H)"
              aria-label="파일 히스토리 보기"
              @click="openHistory(selectedPath)"
            >
              📜 History
            </button>
            <button
              v-if="!selectedIsStaged"
              type="button"
              class="rounded border border-border px-2 py-0.5 hover:bg-accent/40"
              title="이 파일 stage"
              @click="onStageOne(selectedPath)"
            >
              + stage
            </button>
            <button
              v-else
              type="button"
              class="rounded border border-border px-2 py-0.5 hover:bg-accent/40"
              title="이 파일 unstage"
              @click="onUnstageOne(selectedPath)"
            >
              − unstage
            </button>
            <button
              type="button"
              class="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-accent/40"
              title="Hunk-level"
              @click="openHunk(selectedPath, selectedIsStaged)"
            >
              ✂ hunk
            </button>
            <button
              v-if="!selectedIsStaged"
              type="button"
              class="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10"
              title="discard"
              @click="onDiscardOne(selectedPath)"
            >
              ⤺ discard
            </button>
            <button
              type="button"
              class="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-accent/40"
              aria-label="diff preview 닫기"
              title="닫기"
              @click="selectedPath = null"
            >
              ✕
            </button>
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

    <FileHistoryModal
      :repo-id="repoId"
      :path="historyPath"
      :open="historyOpen"
      @close="historyOpen = false"
    />
    <MergeEditorModal
      :repo-id="repoId"
      :path="mergePath"
      :open="mergeOpen"
      @close="mergeOpen = false"
    />
    <HunkStageModal
      :repo-id="repoId"
      :path="hunkPath"
      :staged="hunkStaged"
      :open="hunkOpen"
      @close="hunkOpen = false"
    />
    <ContextMenu ref="ctxMenu" />
  </section>
</template>
