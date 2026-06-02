<script setup lang="ts">
// 작업 디렉토리 상태 패널.
// - staged / unstaged / untracked / conflicted 분리
// - 파일 클릭 시 stage / unstage 토글
// - "+ 모두 stage" / "− 모두 unstage" 단축
import { computed, useTemplateRef } from 'vue'
import { useStatus } from '@/composables/useStatus'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import { useStageMutations } from '@/composables/useStageMutations'
import FileHistoryModal from './FileHistoryModal.vue'
import MergeEditorModal from './MergeEditorModal.vue'
import HunkStageModal from './HunkStageModal.vue'
// Sprint c30 / HIGH 1 — 4 섹션 sticky header sub-component.
import StatusSectionHeader from './StatusSectionHeader.vue'
// Sprint c31 — inline diff preview 분리 (StatusPanel.vue God comp 분리 1/N).
// Sprint c54+ — StatusInlineDiff 우측 panel 사용 제거 (사용자 보고 GitKraken parity).
// 단클릭 시 좌측 fullscreen viewer (FullscreenDiffView) 가 diff 표시 — 우측 inline preview 중복.
// StatusInlineDiff.vue 파일 자체는 dead 보존 (재활성화 옵션) — c55+ 정리 후보.
// import StatusInlineDiff from './StatusInlineDiff.vue'
import { useSectionCollapse } from '@/composables/useSectionCollapse'
import { useStatusFilter } from '@/composables/useStatusFilter'
import { useStatusTreeView } from '@/composables/useStatusTreeView'
// Sprint c40 — 4 tree row computed + mergetool mutation 분리.
import { useStatusTreeRows } from '@/composables/useStatusTreeRows'
import { statusColor, statusLabel } from '@/utils/statusFormat'
// Sprint c30 / GitKraken UX (Phase 3) — 파일 더블클릭 → fullscreen diff.
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
// Sprint c37 god 20/N — selectedPath + vim S/U/⌘⇧S/⌘⇧U/⌘⇧H + copyPath 분리.
import { useStatusSelection } from '@/composables/useStatusSelection'
// Sprint c31 god comp 분리 6/N — 3 modal state (history / merge / hunk) composable.
import { useStatusModals } from '@/composables/useStatusModals'
// Sprint c38 / plan/29 E1 — Restore Center (4축 git restore 의미론).
import { useRestore } from '@/composables/useRestore'
// Sprint c38 fix MED-2 — context menu builder 추출 (StatusPanel god comp 다이어트).
import { useStatusContextMenu } from '@/composables/useStatusContextMenu'
// Sprint c31 — BaseTooltip primitive (kbd hint + viewport edge + a11y).
import BaseTooltip from './BaseTooltip.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const collapsedStaged = useSectionCollapse('status.staged')
const collapsedUnstaged = useSectionCollapse('status.unstaged')
const collapsedUntracked = useSectionCollapse('status.untracked')
const collapsedConflicted = useSectionCollapse('status.conflicted')
// Sprint c25-2.1 — Path/Tree 토글. composables/useStatusTreeView.ts 로 추출 (StatusPanel 분리 2/N).
const { viewMode, setViewMode, collapsedDirs, toggleDir } = useStatusTreeView()

const props = defineProps<{ repoId: number | null }>()
const { data: status, isFetching } = useStatus(() => props.repoId)

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

// === Sprint c38 / plan/29 E1 — Restore Center (4축 git restore) ===
const restore = useRestore(() => props.repoId)

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

// === Sprint 22-2 CM-3: file row 우클릭 메뉴 (Sprint c38 fix MED-2 — composable 추출) ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')

const ctxBuilder = useStatusContextMenu({
  selectPath,
  onStageOne,
  onUnstageOne,
  onDiscardOne,
  restore,
  openHunk,
  openHistory,
  copyPath,
})

function onFileContextMenu(ev: MouseEvent, path: string, isStaged: boolean) {
  ev.preventDefault()
  ctxMenu.value?.openAt(ev, ctxBuilder.buildItems(path, isStaged))
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

// Sprint c40 — 4 tree row computed + mergetool 통합.
const {
  stagedTreeRows,
  unstagedTreeRows,
  untrackedTreeRows,
  conflictedTreeRows,
  mergetoolMut,
  onLaunchMergetool,
} = useStatusTreeRows({
  repoId: () => props.repoId,
  viewMode,
  collapsedDirs,
  filteredStaged,
  filteredUnstaged,
  filteredUntracked,
  filteredConflicted,
})

// Sprint c54+ — selectedIsStaged 제거 (StatusInlineDiff prop 전용이었음, 우측 inline preview 폐기 후 사용처 0).
// selectedPath 는 vim shortcut + copyPath + isSelected hover 표시 용도로 잔존.

const isSelected = computed(() => (path: string) => selectedPath.value === path)
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold">{{ t('status.changesHeader') }}</h3>
        <span v-if="isFetching" class="text-xs text-muted-foreground">
          {{ t('status.refreshing') }}
        </span>
      </div>
      <!-- Sprint c25-2.1 — Path / Tree 토글 (Modified 섹션에 적용) -->
      <div
        class="flex items-center gap-0.5 rounded border border-border bg-muted/30 p-0.5 text-3xs"
      >
        <BaseTooltip :text="t('status.viewModePathTooltip')" placement="bottom">
          <button
            type="button"
            class="rounded px-1.5 py-0.5"
            :class="
              viewMode === 'path'
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            "
            :aria-label="t('status.viewModePathAria')"
            @click="setViewMode('path')"
          >
            Path
          </button>
        </BaseTooltip>
        <BaseTooltip :text="t('status.viewModeTreeTooltip')" placement="bottom">
          <button
            type="button"
            class="rounded px-1.5 py-0.5"
            :class="
              viewMode === 'tree'
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            "
            :aria-label="t('status.viewModeTreeAria')"
            @click="setViewMode('tree')"
          >
            Tree
          </button>
        </BaseTooltip>
      </div>
    </header>

    <div v-if="!repoId" class="p-4 text-center text-xs text-muted-foreground">
      {{ t('status.selectRepo') }}
    </div>

    <div v-else-if="status?.isClean" class="p-4 text-center text-xs text-muted-foreground">
      {{ t('status.noChanges') }}
    </div>

    <template v-else>
      <!-- Sprint 22-6 F-I1: 파일 필터 (50+ 파일 환경) -->
      <div class="border-b border-border px-3 py-1.5">
        <div class="relative">
          <input
            v-model="fileFilter"
            type="text"
            :placeholder="t('status.filterPlaceholder')"
            class="w-full rounded border border-input bg-background px-2 py-1 text-2xs"
            :aria-label="t('status.filterAria')"
          />
          <button
            v-if="fileFilter"
            type="button"
            class="absolute right-1 top-1/2 -translate-y-1/2 px-1 text-xs text-muted-foreground hover:text-foreground"
            :aria-label="t('status.filterClear')"
            :title="t('status.filterClear')"
            @click="fileFilter = ''"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-auto px-2 py-2 text-sm">
        <!-- Staged — Sprint c95+ C2 G2: 빈 영역 (0개) 도 헤더 표시 (GitKraken parity).
             기존 v-if="staged.length > 0" 가 빈 상태 hide → 사용자가 stage 후 영역 발견
             어려움 + GitKraken 의 "Staged Files (0)" 라벨과 정합 안 됨. -->
        <div v-if="status" class="mb-3">
          <StatusSectionHeader
            title="Staged"
            :count="status.staged.length"
            :collapsed="collapsedStaged"
            :bulk-label="t('status.unstageAll')"
            :bulk-title="`${t('status.unstageAll')} (⌘⇧U)`"
            :bulk-aria-label="t('status.bulkUnstageAria', { n: status.staged.length })"
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
                  class="text-3xs text-muted-foreground/70 hover:text-foreground"
                  :title="t('status.hunkUnstageTooltip')"
                  :aria-label="t('status.hunkUnstageAria', { path: f.path })"
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
              <StatusTreeDirRow
                v-if="row.kind === 'dir'"
                :depth="row.depth"
                :collapsed="row.collapsed"
                :name="row.name"
                :path="row.path"
                @toggle="toggleDir"
              />
              <li
                v-else
                class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
                :class="isSelected(row.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                role="button"
                tabindex="0"
                @click="onFileClick(row.path, true)"
                @keydown.enter.self="onFileClick(row.path, true)"
                @keydown.space.self.prevent="onFileClick(row.path, true)"
                @contextmenu="onFileContextMenu($event, row.path, true)"
              >
                <span :class="['shrink-0 w-12 text-3xs uppercase', statusColor(row.meta.status)]">
                  {{ statusLabel(row.meta.status) }}
                </span>
                <span class="flex-1 truncate font-mono text-xs" :title="row.path">
                  {{ row.path.split('/').pop() }}
                </span>
                <button
                  type="button"
                  class="text-3xs text-muted-foreground/70 hover:text-foreground"
                  title="Hunk-level unstage"
                  :aria-label="t('status.hunkUnstageAria', { path: row.path })"
                  @click.stop="openHunk(row.path, true)"
                >
                  ✂ hunk
                </button>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
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
            :bulk-label="t('status.stageAll')"
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
              :title="t('status.fullscreenTitle')"
              role="button"
              tabindex="0"
              @click="onFileClick(f.path, false)"
              @keydown.enter.self="onFileClick(f.path, false)"
              @keydown.space.self.prevent="onFileClick(f.path, false)"
              @dblclick="openFullscreen(f.path, false)"
              @contextmenu="onFileContextMenu($event, f.path, false)"
              @dragstart="
                (e: DragEvent) => e.dataTransfer && e.dataTransfer.setData('text/plain', f.path)
              "
            >
              <span :class="['shrink-0 w-12 text-3xs uppercase', statusColor(f.status)]">
                {{ statusLabel(f.status) }}
              </span>
              <span class="flex-1 truncate font-mono text-xs">{{ f.path }}</span>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                title="file history / blame"
                :aria-label="`'${f.path}' history / blame`"
                @click.stop="openHistory(f.path)"
              >
                📜
              </button>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                title="discard"
                :aria-label="t('status.discardAria', { path: f.path })"
                @click.stop="onDiscardOne(f.path)"
              >
                ⤺
              </button>
              <button
                type="button"
                class="text-3xs text-muted-foreground/70 hover:text-foreground"
                :title="t('status.hunkStageTooltip')"
                :aria-label="t('status.hunkStageAria', { path: f.path })"
                @click.stop="openHunk(f.path, false)"
              >
                ✂ hunk
              </button>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
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
              <StatusTreeDirRow
                v-if="row.kind === 'dir'"
                :depth="row.depth"
                :collapsed="row.collapsed"
                :name="row.name"
                :path="row.path"
                @toggle="toggleDir"
              />
              <li
                v-else
                class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
                :class="isSelected(row.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                draggable="true"
                role="button"
                tabindex="0"
                @click="onFileClick(row.path, false)"
                @keydown.enter.self="onFileClick(row.path, false)"
                @keydown.space.self.prevent="onFileClick(row.path, false)"
                @contextmenu="onFileContextMenu($event, row.path, false)"
                @dragstart="
                  (e: DragEvent) => e.dataTransfer && e.dataTransfer.setData('text/plain', row.path)
                "
              >
                <span :class="['shrink-0 w-12 text-3xs uppercase', statusColor(row.meta.status)]">
                  {{ statusLabel(row.meta.status) }}
                </span>
                <span class="flex-1 truncate font-mono text-xs" :title="row.path">
                  {{ row.path.split('/').pop() }}
                </span>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                  title="file history / blame"
                  :aria-label="`'${row.path}' history / blame`"
                  @click.stop="openHistory(row.path)"
                >
                  📜
                </button>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                  title="discard"
                  :aria-label="t('status.discardAria', { path: row.path })"
                  @click.stop="onDiscardOne(row.path)"
                >
                  ⤺
                </button>
                <button
                  type="button"
                  class="text-3xs text-muted-foreground/70 hover:text-foreground"
                  title="Hunk-level stage"
                  :aria-label="t('status.hunkStageAria', { path: row.path })"
                  @click.stop="openHunk(row.path, false)"
                >
                  ✂ hunk
                </button>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
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
              :title="t('status.fullscreenTitle')"
              role="button"
              tabindex="0"
              @click="onFileClick(p, false)"
              @keydown.enter.self="onFileClick(p, false)"
              @keydown.space.self.prevent="onFileClick(p, false)"
              @dblclick="openFullscreen(p, false)"
              @dragstart="
                (e: DragEvent) => e.dataTransfer && e.dataTransfer.setData('text/plain', p)
              "
            >
              <span class="shrink-0 w-12 text-3xs uppercase text-muted-foreground"> new </span>
              <span class="flex-1 truncate font-mono text-xs">{{ p }}</span>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
                title="stage"
                :aria-label="`'${p}' stage`"
                @click.stop="onStageOne(p)"
              >
                +
              </button>
            </li>
          </ul>

          <!-- c25-2.3 — Tree 모드: Untracked (string row, action='+' stage) -->
          <ul v-else-if="!collapsedUntracked && viewMode === 'tree'">
            <template v-for="(row, idx) in untrackedTreeRows" :key="`unt-${idx}`">
              <StatusTreeDirRow
                v-if="row.kind === 'dir'"
                :depth="row.depth"
                :collapsed="row.collapsed"
                :name="row.name"
                :path="row.path"
                @toggle="toggleDir"
              />
              <li
                v-else
                class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
                :class="isSelected(row.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
                role="button"
                tabindex="0"
                @click="onFileClick(row.path, false)"
                @keydown.enter.self="onFileClick(row.path, false)"
                @keydown.space.self.prevent="onFileClick(row.path, false)"
              >
                <span class="shrink-0 w-12 text-3xs uppercase text-muted-foreground">new</span>
                <span class="flex-1 truncate font-mono text-xs" :title="row.path">{{
                  row.name
                }}</span>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-xs text-muted-foreground hover:text-foreground"
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
                class="opacity-100 rounded border border-border px-1.5 py-0.5 text-3xs text-muted-foreground hover:bg-accent/40"
                :title="t('status.mergetoolTitle')"
                :disabled="mergetoolMut.isPending.value"
                @click="onLaunchMergetool(p)"
              >
                🛠
              </button>
              <button
                type="button"
                class="opacity-100 rounded border border-destructive/40 px-1.5 py-0.5 text-3xs hover:bg-destructive/20"
                :title="t('status.resolveTitle')"
                @click="openMerge(p)"
              >
                {{ t('status.resolve') }}
              </button>
            </li>
          </ul>

          <!-- c25-2.3 — Tree 모드: Conflicted (string row, action=mergetool / 해결) -->
          <ul v-else-if="!collapsedConflicted && viewMode === 'tree'">
            <template v-for="(row, idx) in conflictedTreeRows" :key="`ct-${idx}`">
              <StatusTreeDirRow
                v-if="row.kind === 'dir'"
                :depth="row.depth"
                :collapsed="row.collapsed"
                :name="row.name"
                :path="row.path"
                variant="destructive"
                @toggle="toggleDir"
              />
              <li
                v-else
                class="group flex items-center gap-2 rounded px-1 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                :style="{ paddingLeft: `${row.depth * 12 + 4}px` }"
              >
                <span class="flex-1 truncate font-mono" :title="row.path">! {{ row.name }}</span>
                <button
                  type="button"
                  class="opacity-100 rounded border border-border px-1.5 py-0.5 text-3xs text-muted-foreground hover:bg-accent/40"
                  :title="t('status.mergetoolShort')"
                  :disabled="mergetoolMut.isPending.value"
                  @click="onLaunchMergetool(row.path)"
                >
                  🛠
                </button>
                <button
                  type="button"
                  class="opacity-100 rounded border border-destructive/40 px-1.5 py-0.5 text-3xs hover:bg-destructive/20"
                  :title="t('status.resolveTitle')"
                  @click="openMerge(row.path)"
                >
                  {{ t('status.resolve') }}
                </button>
              </li>
            </template>
          </ul>
        </div>
      </div>

      <!-- Sprint c54+ — StatusInlineDiff 우측 panel 사용 제거.
           기존: 단클릭 시 우측 panel 하단 30% 에 inline diff preview + 인라인 액션 row (WORKDIR badge,
           Hunk↑↓, History, +stage, ✂hunk, ⤺discard, ✕close) 표시 → 좁은 420px 안에 깨짐 + 좌측
           메인 fullscreen viewer 와 중복.
           현재: 단클릭 시 onFileClick → fsDiff.openWip → 좌측 메인 FullscreenDiffView 만 표시.
           우측 panel = file list + 우클릭 컨텍스트 메뉴 (GitKraken parity 100%). -->
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
