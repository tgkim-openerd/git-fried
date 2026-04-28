<script setup lang="ts">
// Worktree 패널 — list / add / remove / prune.
// 사용자 8개 동시 사용 패턴 (`docs/plan/02 §3 W2`).
// AI 에이전트 자동 worktree (`worktree-agent-*`) 식별 가능.
import { ref, useTemplateRef } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useWorktrees } from '@/composables/useWorktrees'
import {
  addWorktree,
  lockWorktree,
  openInExplorer,
  pruneWorktrees,
  removeWorktree,
  unlockWorktree,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'

const reposStore = useReposStore()

const toast = useToast()

const props = defineProps<{ repoId: number | null }>()
const { data: trees } = useWorktrees(() => props.repoId)
const qc = useQueryClient()

const newPath = ref('')
const newBranch = ref('')

// Sprint 22-9 V-10 — row click 시 시각 focus.
// (현재 worktree 별 repo_id 가 별도가 아니므로 active worktree 추적 무의미 — 시각 highlight 만 유지)
const selectedPath = ref<string | null>(null)

function onWorktreeDblClick(t: { path: string; isMain: boolean }) {
  if (t.isMain) return
  if (props.repoId == null) return
  reposStore.setActiveRepo(props.repoId)
  toast.success('활성화', t.path)
}

const addMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || !newPath.value)
      return Promise.reject(new Error('no path'))
    return addWorktree({
      repoId: props.repoId,
      path: newPath.value,
      createBranch: newBranch.value || undefined,
    })
  },
  onSuccess: () => {
    newPath.value = ''
    newBranch.value = ''
    qc.invalidateQueries({ queryKey: ['worktrees', props.repoId] })
  },
  onError: (e) => toast.error('Worktree add 실패', describeError(e)),
})

const removeMut = useMutation({
  mutationFn: ({ p, force }: { p: string; force: boolean }) =>
    removeWorktree(props.repoId!, p, force),
  onSuccess: () =>
    qc.invalidateQueries({ queryKey: ['worktrees', props.repoId] }),
})

const pruneMut = useMutation({
  mutationFn: () => pruneWorktrees(props.repoId!),
  onSuccess: () =>
    qc.invalidateQueries({ queryKey: ['worktrees', props.repoId] }),
})

function fmtSize(bytes: number | null): string {
  if (bytes == null) return '?'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`
}

function isAiAgent(branch: string | null): boolean {
  return !!branch && /worktree-agent-/i.test(branch)
}

function confirmRemove(path: string) {
  if (window.confirm(`worktree '${path}' 제거?`)) {
    removeMut.mutate({ p: path, force: false })
  }
}

// === Sprint C1 — Lock / Unlock ===
const lockMut = useMutation({
  mutationFn: ({ p, reason }: { p: string; reason: string | null }) =>
    lockWorktree(props.repoId!, p, reason),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['worktrees', props.repoId] })
    toast.success('Worktree 잠금', '')
  },
  onError: (e) => toast.error('Lock 실패', describeError(e)),
})

const unlockMut = useMutation({
  mutationFn: (p: string) => unlockWorktree(props.repoId!, p),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['worktrees', props.repoId] })
    toast.success('Worktree 잠금 해제', '')
  },
  onError: (e) => toast.error('Unlock 실패', describeError(e)),
})

function onLock(path: string) {
  if (props.repoId == null) return
  const reason = window.prompt(
    `'${path}' 잠금 사유 (선택, 외장 디스크 / 비활성 등)`,
    '',
  )
  // reason 이 null = cancel.
  if (reason === null) return
  lockMut.mutate({ p: path, reason: reason.trim() || null })
}

function onUnlock(path: string) {
  if (props.repoId == null) return
  unlockMut.mutate(path)
}

// === Sprint 22-4 CM-11: worktree row 우클릭 (5 액션) ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
type WorktreeItem = NonNullable<typeof trees.value>[number]

function onWorktreeContextMenu(ev: MouseEvent, t: WorktreeItem) {
  ev.preventDefault()
  ev.stopPropagation()
  const items: ContextMenuItem[] = [
    {
      label: 'Open in Explorer',
      icon: '📂',
      action: () => {
        // openInExplorer 는 repoId 단위 — worktree 의 경로는 직접 열 수 없으므로
        // 일단 main repo 위치를 열고, 사용자에게 안내.
        if (props.repoId != null) void openInExplorer(props.repoId)
        toast.success('Explorer 열림 (main repo)', t.path)
      },
    },
    {
      label: t.isMain ? 'Switch (이미 main repo)' : 'Switch — main repo 활성화',
      icon: '⊙',
      disabled: t.isMain,
      action: () => {
        // worktree 별 repo_id 가 별도가 아니므로 단순히 active 로 set (한 worktree = 한 repoId 가정).
        if (props.repoId != null) reposStore.setActiveRepo(props.repoId)
        toast.success('활성화', t.path)
      },
    },
    { divider: true },
    {
      label: t.isLocked ? 'Unlock' : 'Lock',
      icon: t.isLocked ? '🔓' : '🔒',
      action: () => (t.isLocked ? onUnlock(t.path) : onLock(t.path)),
    },
    { divider: true },
    {
      label: t.isMain ? 'Remove (main 불가)' : 'Remove',
      icon: '🗑',
      destructive: true,
      disabled: t.isMain || t.isLocked,
      action: () => confirmRemove(t.path),
    },
  ]
  ctxMenu.value?.openAt(ev, items)
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header
      class="flex items-center justify-between border-b border-border px-3 py-2"
    >
      <h3 class="text-sm font-semibold">Worktree</h3>
      <button
        type="button"
        class="rounded-md border border-input px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-50"
        :disabled="!repoId || pruneMut.isPending.value"
        @click="pruneMut.mutate()"
      >
        prune
      </button>
    </header>

    <!-- 새 worktree -->
    <div class="flex flex-col gap-1 border-b border-border px-3 py-2 text-xs">
      <input
        v-model="newPath"
        placeholder="새 worktree 경로 (예: ../proj-feat-abc)"
        class="rounded-md border border-input bg-background px-2 py-1"
      />
      <div class="flex gap-1">
        <input
          v-model="newBranch"
          placeholder="새 브랜치 (선택, -b)"
          class="flex-1 rounded-md border border-input bg-background px-2 py-1"
        />
        <button
          type="button"
          class="rounded-md bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50"
          :disabled="!repoId || !newPath || addMut.isPending.value"
          @click="addMut.mutate()"
        >
          add
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto px-2 py-2 text-sm">
      <ul>
        <li
          v-for="t in trees"
          :key="t.path"
          class="cursor-pointer rounded px-2 py-1.5 hover:bg-accent/40"
          :class="selectedPath === t.path ? 'bg-accent/60 ring-1 ring-primary/40' : ''"
          :title="`${t.path}\nclick=focus, dblclick=Switch (main repo 활성화), 우클릭=메뉴`"
          @click="selectedPath = t.path"
          @dblclick="onWorktreeDblClick(t)"
          @contextmenu="onWorktreeContextMenu($event, t)"
        >
          <div class="flex items-center justify-between">
            <span class="truncate text-xs">
              <span v-if="t.isMain" class="text-emerald-500" title="main worktree">●</span>
              <span v-if="isAiAgent(t.branch)" class="text-violet-500" title="AI agent">🤖</span>
              <span v-if="t.isLocked" class="text-amber-500" title="locked">🔒</span>
              <span v-if="t.isPrunable" class="text-rose-500" title="prunable">⚠</span>
              <span class="ml-1 font-mono">{{ t.branch || '(detached)' }}</span>
            </span>
            <span class="text-[10px] text-muted-foreground">{{ fmtSize(t.sizeBytes) }}</span>
          </div>
          <div class="truncate font-mono text-[10px] text-muted-foreground">{{ t.path }}</div>
          <div v-if="!t.isMain" class="mt-1 flex justify-end gap-2">
            <button
              v-if="!t.isLocked"
              type="button"
              class="text-[10px] text-amber-500 hover:underline"
              :disabled="lockMut.isPending.value"
              @click="onLock(t.path)"
            >
              lock
            </button>
            <button
              v-else
              type="button"
              class="text-[10px] text-amber-500 hover:underline"
              :disabled="unlockMut.isPending.value"
              @click="onUnlock(t.path)"
            >
              unlock
            </button>
            <button
              type="button"
              class="text-[10px] text-destructive hover:underline"
              :disabled="t.isLocked"
              :title="t.isLocked ? 'unlock 후 제거' : ''"
              @click="confirmRemove(t.path)"
            >
              remove
            </button>
          </div>
        </li>
      </ul>
    </div>
    <ContextMenu ref="ctxMenu" />
  </section>
</template>
