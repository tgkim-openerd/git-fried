<script setup lang="ts">
// Sprint c27-1 (ARCH-003 fix) — Sidebar 의 Worktree mini list.

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorktrees } from '@/composables/useWorktrees'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
// UltraPlan v0.4 SB-009 — worktree lock/unlock click toggle (inline icon).
import { useWorktreePanelActions } from '@/composables/useWorktreePanelActions'
import MiniSection from './MiniSection.vue'
// Sprint c54+ (ARCH-c54-001 sister uniformity) — sidebar skeleton placeholder.
import SkeletonBlock from './SkeletonBlock.vue'

const { t } = useI18n()
const store = useReposStore()
const repoIdRef = computed(() => store.activeRepoId)

const { data: worktrees, isFetching } = useWorktrees(repoIdRef)
// SB-016/SB-009 fix (Phase 9, 2026-05-18) — useWorktreePanelActions signature 정합.
// MiniWorktreeList 는 lock/unlock 만 사용 — addWorktree 의 newPath/newBranch 는 unused
// dummy ref 전달 (signature backward-compat). 추후 add 모달 분리 시 옵션 분할 권장.
const newPath = ref('')
const newBranch = ref('')
const { onLock, onUnlock } = useWorktreePanelActions({
  repoId: () => store.activeRepoId,
  newPath,
  newBranch,
})
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
    v-if="miniWorktrees.length > 1 || isFetching"
    title="Worktree"
    :count="sortedWorktrees.length"
    storage-key="active-repo-quick.worktree"
    full-tooltip="Worktree 패널 (⌘7)"
    @full="dispatchShortcut('tab7')"
  >
    <SkeletonBlock
      v-if="miniWorktrees.length <= 1 && isFetching"
      :count="3"
      height="sm"
      data-testid="mini-worktree-skeleton"
    />
    <ul v-else class="space-y-0.5">
      <li
        v-for="w in miniWorktrees"
        :key="`mw-${w.path}`"
        class="group flex items-center gap-1 rounded px-1 py-1 text-[11px]"
        :title="`${w.path}${w.branch ? ' [' + w.branch + ']' : ''}${w.isLocked ? ' (locked)' : ''}`"
      >
        <span class="shrink-0 w-3 text-center text-[10px]">
          <span v-if="w.isMain" class="text-warning-amber" title="main worktree">★</span>
          <button
            v-else-if="w.isLocked"
            type="button"
            class="text-danger-rose hover:text-danger-rose/70"
            :title="t('worktree.miniUnlockTitle')"
            @click="onUnlock(w.path)"
          >
            🔒
          </button>
          <button
            v-else
            type="button"
            class="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
            :title="t('worktree.miniLockTitle')"
            @click="onLock(w.path)"
          >
            🔓
          </button>
        </span>
        <span class="flex-1 truncate font-mono">{{ worktreeName(w.path) }}</span>
        <span
          v-if="w.branch"
          class="truncate text-[9px] text-muted-foreground"
          :style="{ maxWidth: '80px' }"
        >
          {{ w.branch }}
        </span>
      </li>
      <li v-if="moreCount > 0" class="px-1 py-0.5 text-[10px] text-muted-foreground">
        {{ t('miniSection.moreLabel', { count: moreCount }) }}
      </li>
    </ul>
  </MiniSection>
</template>
