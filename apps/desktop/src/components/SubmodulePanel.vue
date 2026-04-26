<script setup lang="ts">
// Submodule 패널 — list + init/update/sync.
// 사용자 회사 레포 6/6 모두 submodule 사용. 1급 시민 UI.
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useSubmodules } from '@/composables/useSubmodules'
import { initSubmodules, syncSubmodules, updateSubmodules } from '@/api/git'
import type { SubmoduleEntry } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()
const { data: subs } = useSubmodules(() => props.repoId)
const qc = useQueryClient()

const initMut = useMutation({
  mutationFn: (id: number) => initSubmodules(id),
  onSuccess: () =>
    qc.invalidateQueries({ queryKey: ['submodules', props.repoId] }),
})
const updateMut = useMutation({
  mutationFn: (args: { id: number; remote: boolean }) =>
    updateSubmodules(args.id, args.remote),
  onSuccess: () =>
    qc.invalidateQueries({ queryKey: ['submodules', props.repoId] }),
})
const syncMut = useMutation({
  mutationFn: (id: number) => syncSubmodules(id),
  onSuccess: () =>
    qc.invalidateQueries({ queryKey: ['submodules', props.repoId] }),
})

function statusColor(s: SubmoduleEntry['status']): string {
  switch (s) {
    case 'initialized':
      return 'text-emerald-500'
    case 'modified':
      return 'text-amber-500'
    case 'conflicted':
      return 'text-destructive'
    case 'uninitialized':
      return 'text-muted-foreground'
    default:
      return ''
  }
}

function statusLabel(s: SubmoduleEntry['status']): string {
  switch (s) {
    case 'initialized':
      return '초기화됨'
    case 'modified':
      return '수정됨'
    case 'conflicted':
      return '충돌'
    case 'uninitialized':
      return '미초기화'
    default:
      return '?'
  }
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header
      class="flex items-center justify-between border-b border-border px-3 py-2"
    >
      <h3 class="text-sm font-semibold">Submodule</h3>
      <div class="flex gap-1 text-xs">
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 hover:bg-accent disabled:opacity-50"
          :disabled="!repoId || initMut.isPending.value"
          @click="repoId && initMut.mutate(repoId)"
        >
          init
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 hover:bg-accent disabled:opacity-50"
          :disabled="!repoId || updateMut.isPending.value"
          @click="repoId && updateMut.mutate({ id: repoId, remote: false })"
        >
          update
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 hover:bg-accent disabled:opacity-50"
          :disabled="!repoId || syncMut.isPending.value"
          @click="repoId && syncMut.mutate(repoId)"
        >
          sync
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-auto px-2 py-2 text-sm">
      <ul>
        <li
          v-for="s in subs"
          :key="s.path"
          class="rounded px-2 py-1.5 hover:bg-accent/40"
        >
          <div class="flex items-center justify-between">
            <span class="truncate font-mono text-xs">{{ s.path }}</span>
            <span :class="['text-[10px]', statusColor(s.status)]">
              {{ statusLabel(s.status) }}
            </span>
          </div>
          <div v-if="s.sha" class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {{ s.sha }}
          </div>
        </li>
        <li
          v-if="subs && subs.length === 0"
          class="px-2 py-3 text-center text-xs text-muted-foreground"
        >
          서브모듈 없음
        </li>
      </ul>
    </div>
  </section>
</template>
