<script setup lang="ts">
// 작업 디렉토리 상태 패널.
// - staged / unstaged / untracked / conflicted 분리
// - 파일 클릭 시 stage / unstage 토글
// - "+ 모두 stage" / "− 모두 unstage" 단축
import { computed, useTemplateRef } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useStatus, useInvalidateRepoQueries } from '@/composables/useStatus'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
import { launchMergetool } from '@/api/git'
import { useStageMutations } from '@/composables/useStageMutations'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import FileHistoryModal from './FileHistoryModal.vue'
import MergeEditorModal from './MergeEditorModal.vue'
import HunkStageModal from './HunkStageModal.vue'
// Sprint c30 / HIGH 1 — 4 섹션 sticky header sub-component.
import StatusSectionHeader from './StatusSectionHeader.vue'
// Sprint c31 — inline diff preview 분리 (StatusPanel.vue God comp 분리 1/N).
import StatusInlineDiff from './StatusInlineDiff.vue'
import { useSectionCollapse } from '@/composables/useSectionCollapse'
import { useStatusFilter } from '@/composables/useStatusFilter'
import { flattenTree, useStatusTreeView } from '@/composables/useStatusTreeView'
import { statusColor, statusLabel } from '@/utils/statusFormat'
// Sprint c30 / GitKraken UX (Phase 3) — 파일 더블클릭 → fullscreen diff.
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
// Sprint c37 god 20/N — selectedPath + vim S/U/⌘⇧S/⌘⇧U/⌘⇧H + copyPath 분리.
import { useStatusSelection } from '@/composables/useStatusSelection'
// Sprint c31 god comp 분리 6/N — 3 modal state (history / merge / hunk) composable.
import { useStatusModals } from '@/composables/useStatusModals'
// Sprint c31 — BaseTooltip primitive (kbd hint + viewport edge + a11y).
import BaseTooltip from './BaseTooltip.vue'

const collapsedStaged = useSectionCollapse('status.staged')
const collapsedUnstaged = useSectionCollapse('status.unstaged')
const collapsedUntracked = useSectionCollapse('status.untracked')
const collapsedConflicted = useSectionCollapse('status.conflicted')
import type { FileChange } from '@/types/git'

// Sprint c25-2.1 — Path/Tree 토글. composables/useStatusTreeView.ts 로 추출 (StatusPanel 분리 2/N).
import { buildPathTree } from '@/utils/pathTree'

const { viewMode, setViewMode, collapsedDirs, toggleDir } = useStatusTreeView()

const props = defineProps<{ repoId: number | null }>()
const toast = useToast()
const { data: status, isFetching } = useStatus(() => props.repoId)
const invalidate = useInvalidateRepoQueries()

// === Stage / unstage / discard mutations (Sprint c29-6 — composables/useStageMutations 로 추출) ===
const sm = useStageMutations(
  () => props.repoId,
  () => status.value,
)
// 기존 binding 호환 alias.
const stageMut = sm.stageMut
const unstageMut = sm.unstageMut
// discardMut 는 sm.discardOne 내부에서 호출 — 외부 노출 불필요.
const stageAllMut = sm.stageAllMut
const onStageOne = sm.stageOne
const onUnstageOne = sm.unstageOne
const onDiscardOne = sm.discardOne
const onStageAll = sm.stageAll
const onUnstageAll = sm.unstageAll

// statusLabel / statusColor → utils/statusFormat.ts 로 이동 (test 가능 + DiffViewer 공용)

// Sprint c31 god comp 분리 6/N — File history / 3-way merge / Hunk-level modal state
// 통합 composable. close handler 는 template 의 @close 에서 직접 호출.
const {
  historyPath,
  historyOpen,
  openHistory,
  closeHistory,
  mergePath,
  mergeOpen,
  openMerge,
  closeMerge,
  hunkPath,
  hunkStaged,
  hunkOpen,
  openHunk,
  closeHunk,
} = useStatusModals()

// Sprint c37 god 20/N — selectedPath + vim shortcuts + copyPath 통합.
const { selectedPath, selectPath, copyPath } = useStatusSelection({
  repoId: () => props.repoId,
  status,
  stageMut,
  unstageMut,
  stageAllMut,
  openHistory,
})

// === Sprint 22-2 CM-3: file row 우클릭 메뉴 ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')

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

// Sprint c37 god 20/N — vim S/U + ⌘⇧S/⌘⇧U + ⌘⇧H 단축키 + selectedPath 토글 + copyPath 는
//   useStatusSelection composable 위임 (위에서 destructure).

// Sprint c30 / GitKraken UX (Phase 3) — 파일 더블클릭 → fullscreen diff.
const fsDiff = useFullscreenDiff()
function openFullscreen(path: string, isStaged: boolean) {
  fsDiff.openWip(path, isStaged)
}

// Sprint c37 — 파일 단일 클릭 = 좌측 fullscreen 진입 + selectedPath set.
//   사용자 요청 (2026-04-30): "변경사항 파일도 클릭하면 커밋 diff 와 같이 좌측 영역 사용".
//   기존 selectPath (토글) 는 키보드 / 외부 호출 (vim shortcut) 용도로 보존.
//   FileRow 클릭은 항상 selectedPath 설정 + fullscreen 진입.
function onFileClick(path: string, isStaged: boolean) {
  selectedPath.value = path
  fsDiff.openWip(path, isStaged)
}

// === Sprint 22-6 F-I1: 파일 필터 (50+ 파일 환경) ===
// composables/useStatusFilter.ts 로 추출 (StatusPanel.vue God comp 분리 1차).
const { fileFilter, filteredStaged, filteredUnstaged, filteredUntracked, filteredConflicted } =
  useStatusFilter(status)

// Sprint c25-2.1 / c27-2 (TYPE-005 fix) — generic 트리 평탄화 type.
// flattenTree + FlatTreeRow 본체는 composables/useStatusTreeView.ts (분리 2/N).
import type { FlatTreeRow } from '@/composables/useStatusTreeView'

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

// 선택 파일이 staged 인지 — StatusInlineDiff 에 prop 으로 전달.
const selectedIsStaged = computed<boolean>(() => {
  if (!selectedPath.value) return false
  return status.value?.staged.some((f) => f.path === selectedPath.value) ?? false
})

const isSelected = computed(() => (path: string) => selectedPath.value === path)
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
      >
        <BaseTooltip text="전체 경로 한 줄 표시 (localStorage 영속)" placement="bottom">
          <button
            type="button"
            class="rounded px-1.5 py-0.5"
            :class="
              viewMode === 'path'
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            "
            aria-label="평탄 path 모드"
            @click="setViewMode('path')"
          >
            Path
          </button>
        </BaseTooltip>
        <BaseTooltip text="디렉토리 그룹핑 (collapse 가능, localStorage 영속)" placement="bottom">
          <button
            type="button"
            class="rounded px-1.5 py-0.5"
            :class="
              viewMode === 'tree'
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            "
            aria-label="디렉토리 트리 모드"
            @click="setViewMode('tree')"
          >
            Tree
          </button>
        </BaseTooltip>
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
          <StatusSectionHeader
            title="Staged"
            :count="status.staged.length"
            :collapsed="collapsedStaged"
            bulk-label="모두 unstage"
            bulk-title="모두 unstage (⌘⇧U)"
            :bulk-aria-label="`staged ${status.staged.length}개 모두 unstage`"
            @update:collapsed="collapsedStaged = $event"
            @bulk="onUnstageAll"
          />
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
              @select="onFileClick(f.path, true)"
              @action="onUnstageOne(f.path)"
              @dblclick="openFullscreen(f.path, true)"
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
                @click="onFileClick(row.path, true)"
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
          <StatusSectionHeader
            title="Modified"
            :count="status.unstaged.length"
            :collapsed="collapsedUnstaged"
            bulk-label="모두 stage"
            @update:collapsed="collapsedUnstaged = $event"
            @bulk="onStageAll"
          />
          <ul v-if="!collapsedUnstaged && viewMode === 'path'">
            <li
              v-for="f in filteredUnstaged"
              :key="`u-${f.path}`"
              class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
              :class="isSelected(f.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
              draggable="true"
              title="클릭 — fullscreen diff"
              @click="onFileClick(f.path, false)"
              @dblclick="openFullscreen(f.path, false)"
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
                @click="onFileClick(row.path, false)"
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
          <StatusSectionHeader
            title="Untracked"
            :count="status.untracked.length"
            :collapsed="collapsedUntracked"
            @update:collapsed="collapsedUntracked = $event"
          />
          <ul v-if="!collapsedUntracked && viewMode === 'path'">
            <li
              v-for="p in filteredUntracked"
              :key="`n-${p}`"
              class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
              :class="isSelected(p) ? 'bg-accent ring-1 ring-primary/40' : ''"
              draggable="true"
              title="클릭 — fullscreen diff"
              @click="onFileClick(p, false)"
              @dblclick="openFullscreen(p, false)"
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
                @click="onFileClick(row.path, false)"
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
          <StatusSectionHeader
            title="Conflicted"
            :count="status.conflicted.length"
            :collapsed="collapsedConflicted"
            destructive
            @update:collapsed="collapsedConflicted = $event"
          />
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

      <!-- Sprint 22-7 V-5: 선택 파일 inline diff preview (하단 fixed 30%) — Sprint c31 분리 1/N -->
      <StatusInlineDiff
        v-if="selectedPath"
        :repo-id="repoId"
        :path="selectedPath"
        :is-staged="selectedIsStaged"
        @close="selectedPath = null"
        @stage="onStageOne"
        @unstage="onUnstageOne"
        @discard="onDiscardOne"
        @hunk="(p, s) => openHunk(p, s)"
        @history="openHistory"
      />
    </template>

    <FileHistoryModal
      :repo-id="repoId"
      :path="historyPath"
      :open="historyOpen"
      @close="closeHistory"
    />
    <MergeEditorModal :repo-id="repoId" :path="mergePath" :open="mergeOpen" @close="closeMerge" />
    <HunkStageModal
      :repo-id="repoId"
      :path="hunkPath"
      :staged="hunkStaged"
      :open="hunkOpen"
      @close="closeHunk"
    />
    <ContextMenu ref="ctxMenu" />
  </section>
</template>
