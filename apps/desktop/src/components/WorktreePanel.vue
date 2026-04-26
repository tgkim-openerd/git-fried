<script setup lang="ts">
// Worktree 패널 — list / add / remove / prune.
// 사용자 8개 동시 사용 패턴 (`docs/plan/02 §3 W2`).
// AI 에이전트 자동 worktree (`worktree-agent-*`) 식별 가능.
import { ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useWorktrees } from '@/composables/useWorktrees'
import {
  addWorktree,
  pruneWorktrees,
  removeWorktree,
} from '@/api/git'
import { describeError } from '@/api/errors'

const props = defineProps<{ repoId: number | null }>()
const { data: trees } = useWorktrees(() => props.repoId)
const qc = useQueryClient()

const newPath = ref('')
const newBranch = ref('')

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
  onError: (e) => alert(`add 실패: ${describeError(e)}`),
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
          class="rounded px-2 py-1.5 hover:bg-accent/40"
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
          <div v-if="!t.isMain" class="mt-1 flex justify-end">
            <button
              type="button"
              class="text-[10px] text-destructive hover:underline"
              @click="confirmRemove(t.path)"
            >
              remove
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
