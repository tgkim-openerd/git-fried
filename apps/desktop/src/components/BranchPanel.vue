<script setup lang="ts">
// 브랜치 패널 — 로컬/원격 트리 + switch / create / delete.
// HEAD 표시, ahead/behind 카운터 포함.
import { computed, ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useBranches } from '@/composables/useBranches'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import {
  createBranch,
  deleteBranch,
  switchBranch,
} from '@/api/git'
import type { BranchInfo } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()
const { data: branches } = useBranches(() => props.repoId)
const invalidate = useInvalidateRepoQueries()

const newBranchName = ref('')
const filterKind = ref<'all' | 'local' | 'remote'>('local')

const filtered = computed(() => {
  if (!branches.value) return []
  if (filterKind.value === 'all') return branches.value
  return branches.value.filter((b) => b.kind === filterKind.value)
})

const switchMut = useMutation({
  mutationFn: ({ id, name }: { id: number; name: string }) =>
    switchBranch(id, name, false),
  onSuccess: () => invalidate(props.repoId),
  onError: (e) => alert(`switch 실패: ${String(e)}`),
})

const createMut = useMutation({
  mutationFn: ({ id, name }: { id: number; name: string }) =>
    createBranch(id, name),
  onSuccess: () => {
    newBranchName.value = ''
    invalidate(props.repoId)
  },
  onError: (e) => alert(`create 실패: ${String(e)}`),
})

const deleteMut = useMutation({
  mutationFn: ({ id, name, force }: { id: number; name: string; force: boolean }) =>
    deleteBranch(id, name, force),
  onSuccess: () => invalidate(props.repoId),
  onError: (e) => alert(`delete 실패: ${String(e)}`),
})

function onSwitch(b: BranchInfo) {
  if (props.repoId == null) return
  if (b.is_head) return
  switchMut.mutate({ id: props.repoId, name: localName(b.name) })
}

function onCreate() {
  if (props.repoId == null) return
  if (!newBranchName.value.trim()) return
  createMut.mutate({ id: props.repoId, name: newBranchName.value.trim() })
}

function onDelete(b: BranchInfo) {
  if (props.repoId == null) return
  const force = (b.ahead > 0)
  if (
    !confirm(
      `브랜치 '${b.name}' 를 삭제하시겠습니까?` +
        (force ? '\n⚠ 머지되지 않은 커밋이 있어 강제 삭제 -D 합니다.' : ''),
    )
  )
    return
  deleteMut.mutate({ id: props.repoId, name: localName(b.name), force })
}

// "origin/foo" → "foo" (remote 브랜치 작업 시)
function localName(name: string): string {
  const parts = name.split('/')
  if (parts.length > 1) return parts.slice(1).join('/')
  return name
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">브랜치</h3>
      <div class="flex gap-1 text-[10px]">
        <button
          v-for="k in ['local', 'remote', 'all'] as const"
          :key="k"
          type="button"
          class="rounded px-1.5 py-0.5"
          :class="filterKind === k ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
          @click="filterKind = k"
        >
          {{ k }}
        </button>
      </div>
    </header>

    <!-- 새 브랜치 입력 -->
    <div class="flex gap-1 border-b border-border px-3 py-2">
      <input
        v-model="newBranchName"
        placeholder="새 브랜치 (예: feat/foo)"
        class="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
        @keyup.enter="onCreate"
      />
      <button
        type="button"
        class="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
        :disabled="!newBranchName.trim() || createMut.isPending.value"
        @click="onCreate"
      >
        +
      </button>
    </div>

    <div class="flex-1 overflow-auto px-1 py-2">
      <ul>
        <li
          v-for="b in filtered"
          :key="`${b.kind}-${b.name}`"
          class="group flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/40"
          :class="b.is_head ? 'bg-accent/60 font-semibold' : ''"
          @dblclick="onSwitch(b)"
        >
          <span class="w-3 text-[10px]">{{ b.is_head ? '●' : '' }}</span>
          <span class="flex-1 truncate font-mono text-xs">{{ b.name }}</span>
          <span v-if="b.ahead || b.behind" class="text-[10px]">
            <span v-if="b.ahead" class="text-emerald-500">↑{{ b.ahead }}</span>
            <span v-if="b.behind" class="ml-0.5 text-rose-500">↓{{ b.behind }}</span>
          </span>
          <button
            v-if="!b.is_head && b.kind === 'local'"
            type="button"
            class="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-destructive"
            title="삭제"
            @click.stop="onDelete(b)"
          >
            ×
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
