<script setup lang="ts">
// Sprint c27-1 (ARCH-003 fix) — Sidebar 의 Worktree mini list.

import { computed } from 'vue'
import { useWorktrees } from '@/composables/useWorktrees'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import MiniSection from './MiniSection.vue'

const store = useReposStore()
const repoIdRef = computed(() => store.activeRepoId)

const { data: worktrees } = useWorktrees(repoIdRef)
const sortedWorktrees = computed(() => {
  const list = [...(worktrees.value ?? [])]
  list.sort((a, b) => {
    if (a.isMain && !b.isMain) return -1
    if (b.isMain && !a.isMain) return 1
    return a.path.localeCompare(b.path)
  })
  return list
})
const miniWorktrees = computed(() => sortedWorktrees.value.slice(0, 4))
const moreCount = computed(() =>
  Math.max(0, sortedWorktrees.value.length - miniWorktrees.value.length),
)

function worktreeName(path: string): string {
  // path tail 만 표시 (e.g., 'C:/work/opnd/frontend' → 'frontend').
  const trimmed = path.replace(/[/\\]+$/, '')
  const segs = trimmed.split(/[/\\]/)
  return segs[segs.length - 1] || path
}
</script>

<template>
  <MiniSection
    v-if="miniWorktrees.length > 1"
    title="Worktree"
    :count="sortedWorktrees.length"
    storage-key="active-repo-quick.worktree"
    full-tooltip="Worktree 패널 (⌘7)"
    @full="dispatchShortcut('tab7')"
  >
    <ul class="space-y-0.5">
      <li
        v-for="w in miniWorktrees"
        :key="`mw-${w.path}`"
        class="flex items-center gap-1 rounded px-1 py-0.5 text-[11px]"
        :title="`${w.path}${w.branch ? ' [' + w.branch + ']' : ''}${w.isLocked ? ' (locked)' : ''}`"
      >
        <span class="shrink-0 w-3 text-center text-[10px]">
          <span v-if="w.isMain" class="text-amber-500" title="main worktree">★</span>
          <span v-else-if="w.isLocked" class="text-rose-500" title="locked">🔒</span>
          <span v-else class="text-muted-foreground">·</span>
        </span>
        <span class="flex-1 truncate font-mono">{{ worktreeName(w.path) }}</span>
        <span v-if="w.branch" class="truncate text-[9px] text-muted-foreground" :style="{ maxWidth: '80px' }">
          {{ w.branch }}
        </span>
      </li>
      <li
        v-if="moreCount > 0"
        class="px-1 py-0.5 text-[10px] text-muted-foreground"
      >
        ⋯ +{{ moreCount }}개 더 (전체 → 클릭)
      </li>
    </ul>
  </MiniSection>
</template>
