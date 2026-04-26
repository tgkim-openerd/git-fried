<script setup lang="ts">
// 작업 디렉토리 상태 패널.
// - staged / unstaged / untracked / conflicted 분리
// - 파일 클릭 시 stage / unstage 토글
// - "+ 모두 stage" / "− 모두 unstage" 단축
import { computed, ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useStatus, useInvalidateRepoQueries } from '@/composables/useStatus'
import {
  discardPaths,
  launchMergetool,
  stageAll,
  stagePaths,
  unstagePaths,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useShortcut } from '@/composables/useShortcuts'
import { useToast } from '@/composables/useToast'
import FileHistoryModal from './FileHistoryModal.vue'
import MergeEditorModal from './MergeEditorModal.vue'
import HunkStageModal from './HunkStageModal.vue'
import { useSectionCollapse } from '@/composables/useSectionCollapse'

const collapsedStaged = useSectionCollapse('status.staged')
const collapsedUnstaged = useSectionCollapse('status.unstaged')
const collapsedUntracked = useSectionCollapse('status.untracked')
const collapsedConflicted = useSectionCollapse('status.conflicted')
import type { ChangeStatus, FileChange } from '@/types/git'

const props = defineProps<{ repoId: number | null }>()
const toast = useToast()
const { data: status, isFetching } = useStatus(() => props.repoId)
const invalidate = useInvalidateRepoQueries()

const stageMut = useMutation({
  mutationFn: ({ id, paths }: { id: number; paths: string[] }) =>
    stagePaths(id, paths),
  onSuccess: () => invalidate(props.repoId),
})
const unstageMut = useMutation({
  mutationFn: ({ id, paths }: { id: number; paths: string[] }) =>
    unstagePaths(id, paths),
  onSuccess: () => invalidate(props.repoId),
})
const discardMut = useMutation({
  mutationFn: ({ id, paths }: { id: number; paths: string[] }) =>
    discardPaths(id, paths),
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
  if (
    confirm(
      `'${path}' 의 변경을 폐기하시겠습니까? 되돌릴 수 없습니다.`,
    )
  ) {
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
      toast.error(
        'Mergetool 실패',
        res.stderr.slice(0, 200) || `exit ${res.exitCode}`,
      )
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
      return status.value?.unstaged[0]?.path
        ?? status.value?.untracked[0]
        ?? null
    }
    return selectedPath.value
  }
  return (
    status.value?.unstaged[0]?.path ??
    status.value?.untracked[0] ??
    null
  )
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
    selectedPath.value ??
    status.value?.unstaged[0]?.path ??
    status.value?.staged[0]?.path ??
    null
  if (target) openHistory(target)
})

function selectPath(path: string) {
  selectedPath.value = selectedPath.value === path ? null : path
}

const isSelected = computed(
  () => (path: string) => selectedPath.value === path,
)
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">변경사항</h3>
      <span v-if="isFetching" class="text-xs text-muted-foreground">갱신 중...</span>
    </header>

    <div v-if="!repoId" class="p-4 text-center text-xs text-muted-foreground">
      레포를 선택하세요.
    </div>

    <div v-else-if="status?.isClean" class="p-4 text-center text-xs text-muted-foreground">
      변경사항 없음 ✓
    </div>

    <div v-else class="flex-1 overflow-auto px-2 py-2 text-sm">
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
        <ul v-if="!collapsedStaged">
          <FileRow
            v-for="f in status.staged"
            :key="`s-${f.path}`"
            :file="f"
            :label="statusLabel(f.status)"
            :color="statusColor(f.status)"
            action="−"
            action-title="unstage"
            :selected="isSelected(f.path)"
            @select="selectPath(f.path)"
            @action="onUnstageOne(f.path)"
          >
            <template #extra>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-foreground"
                title="Hunk-level unstage (✂)"
                @click.stop="openHunk(f.path, true)"
              >
                ✂
              </button>
            </template>
          </FileRow>
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
        <ul v-if="!collapsedUnstaged">
          <li
            v-for="f in status.unstaged"
            :key="`u-${f.path}`"
            class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
            :class="isSelected(f.path) ? 'bg-accent ring-1 ring-primary/40' : ''"
            @click="selectPath(f.path)"
          >
            <span :class="['shrink-0 w-12 text-[10px] uppercase', statusColor(f.status)]">
              {{ statusLabel(f.status) }}
            </span>
            <span class="flex-1 truncate font-mono text-xs">{{ f.path }}</span>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
              title="file history / blame"
              @click.stop="openHistory(f.path)"
            >
              📜
            </button>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
              title="discard"
              @click.stop="onDiscardOne(f.path)"
            >
              ⤺
            </button>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-foreground"
              title="Hunk-level stage (✂)"
              @click.stop="openHunk(f.path, false)"
            >
              ✂
            </button>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
              title="stage"
              @click.stop="onStageOne(f.path)"
            >
              +
            </button>
          </li>
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
        <ul v-if="!collapsedUntracked">
          <li
            v-for="p in status.untracked"
            :key="`n-${p}`"
            class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
            :class="isSelected(p) ? 'bg-accent ring-1 ring-primary/40' : ''"
            @click="selectPath(p)"
          >
            <span class="shrink-0 w-12 text-[10px] uppercase text-muted-foreground">
              new
            </span>
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
        <ul v-if="!collapsedConflicted">
          <li
            v-for="p in status.conflicted"
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
      </div>
    </div>

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
  </section>
</template>
