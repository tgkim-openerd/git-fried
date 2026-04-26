<script setup lang="ts">
// 작업 디렉토리 상태 패널.
// - staged / unstaged / untracked / conflicted 분리
// - 파일 클릭 시 stage / unstage 토글
// - "+ 모두 stage" / "− 모두 unstage" 단축
import { ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useStatus, useInvalidateRepoQueries } from '@/composables/useStatus'
import {
  discardPaths,
  stageAll,
  stagePaths,
  unstagePaths,
} from '@/api/git'
import FileHistoryModal from './FileHistoryModal.vue'
import MergeEditorModal from './MergeEditorModal.vue'
import type { ChangeStatus, FileChange } from '@/types/git'

const props = defineProps<{ repoId: number | null }>()
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
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs uppercase tracking-wider text-muted-foreground">
            Staged ({{ status.staged.length }})
          </span>
        </div>
        <ul>
          <FileRow
            v-for="f in status.staged"
            :key="`s-${f.path}`"
            :file="f"
            :label="statusLabel(f.status)"
            :color="statusColor(f.status)"
            action="−"
            action-title="unstage"
            @action="onUnstageOne(f.path)"
          />
        </ul>
      </div>

      <!-- Unstaged -->
      <div v-if="status && status.unstaged.length > 0" class="mb-3">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs uppercase tracking-wider text-muted-foreground">
            Modified ({{ status.unstaged.length }})
          </span>
          <button
            type="button"
            class="text-xs text-muted-foreground hover:text-foreground"
            @click="onStageAll"
          >
            모두 stage
          </button>
        </div>
        <ul>
          <li
            v-for="f in status.unstaged"
            :key="`u-${f.path}`"
            class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
          >
            <span :class="['shrink-0 w-12 text-[10px] uppercase', statusColor(f.status)]">
              {{ statusLabel(f.status) }}
            </span>
            <span class="flex-1 truncate font-mono text-xs">{{ f.path }}</span>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
              title="file history / blame"
              @click="openHistory(f.path)"
            >
              📜
            </button>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
              title="discard"
              @click="onDiscardOne(f.path)"
            >
              ⤺
            </button>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
              title="stage"
              @click="onStageOne(f.path)"
            >
              +
            </button>
          </li>
        </ul>
      </div>

      <!-- Untracked -->
      <div v-if="status && status.untracked.length > 0" class="mb-3">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs uppercase tracking-wider text-muted-foreground">
            Untracked ({{ status.untracked.length }})
          </span>
        </div>
        <ul>
          <li
            v-for="p in status.untracked"
            :key="`n-${p}`"
            class="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
          >
            <span class="shrink-0 w-12 text-[10px] uppercase text-muted-foreground">
              new
            </span>
            <span class="flex-1 truncate font-mono text-xs">{{ p }}</span>
            <button
              type="button"
              class="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground"
              @click="onStageOne(p)"
            >
              +
            </button>
          </li>
        </ul>
      </div>

      <!-- Conflicted -->
      <div v-if="status && status.conflicted.length > 0" class="mb-3">
        <div class="mb-1 text-xs uppercase tracking-wider text-destructive">
          Conflicted ({{ status.conflicted.length }})
        </div>
        <ul>
          <li
            v-for="p in status.conflicted"
            :key="`c-${p}`"
            class="group flex items-center gap-2 rounded px-1 py-0.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <span class="flex-1 truncate font-mono">! {{ p }}</span>
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
  </section>
</template>
