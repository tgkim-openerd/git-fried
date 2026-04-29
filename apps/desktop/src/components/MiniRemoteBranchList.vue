<script setup lang="ts">
// Phase 12-1 — Sidebar REMOTE 카테고리 hierarchical tree.
// origin/feat/x → origin > feat > x. useBranchTree + BranchTreeView.

import { computed } from 'vue'
import { useBranches } from '@/composables/useBranches'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { buildBranchTree, filterTree } from '@/composables/useBranchTree'
import { useSidebarSearch } from '@/composables/useSidebarSearch'
import MiniSection from './MiniSection.vue'
import BranchTreeView from './BranchTreeView.vue'
import type { BranchInfo } from '@/api/git'

const store = useReposStore()
const repoIdRef = computed(() => store.activeRepoId)
const search = useSidebarSearch()

const { data: branches } = useBranches(repoIdRef)

const remoteBranches = computed(() => {
  const all = branches.value ?? []
  return all.filter((b) => b.kind === 'remote')
})

// REMOTE 는 'origin/feat/x' 그대로 split (rootPrefix 옵션 미사용 — 자연스러운 nesting).
const tree = computed(() => {
  const built = buildBranchTree<BranchInfo>(remoteBranches.value, { getName: (b) => b.name })
  return filterTree(built, search.trimmed.value, (b) => b.name)
})
</script>

<template>
  <MiniSection
    v-if="remoteBranches.length > 0"
    title="REMOTE"
    :count="remoteBranches.length"
    storage-key="active-repo-quick.remote"
    full-tooltip="전체 브랜치 패널 (⌘B)"
    @full="dispatchShortcut('newBranch')"
  >
    <BranchTreeView
      :nodes="tree"
      storage-key="branch-tree.remote"
      :auto-expand="search.isActive.value"
    >
      <template #default="{ data }: { data: BranchInfo }">
        <div
          class="flex items-center gap-1 px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/40 rounded"
          :title="`${data.name} (remote tracking)`"
        >
          <span class="shrink-0 w-3 text-center text-[9px]">⟶</span>
          <span class="flex-1 truncate font-mono">
            {{ data.name.split('/').pop() }}
          </span>
        </div>
      </template>
    </BranchTreeView>
  </MiniSection>
</template>
