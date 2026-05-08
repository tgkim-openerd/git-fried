<script setup lang="ts">
// Phase 12-1 — Sidebar REMOTE 카테고리 hierarchical tree.
// origin/feat/x → origin > feat > x. useBranchTree + BranchTreeView.

import { computed, useTemplateRef } from 'vue'
import { useBranches } from '@/composables/useBranches'
// Sprint c54+++ — 우클릭 컨텍스트 메뉴 (GitKraken parity, Pattern 9 sister).
import { useBranchInteraction } from '@/composables/useBranchInteraction'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { buildBranchTree, filterTree } from '@/composables/useBranchTree'
import { useSidebarSearch } from '@/composables/useSidebarSearch'
import MiniSection from './MiniSection.vue'
import BranchTreeView from './BranchTreeView.vue'
// Sprint c54 — Issue 2 — sidebar tree skeleton placeholder.
import SkeletonBlock from './SkeletonBlock.vue'
import type { BranchInfo } from '@/api/git'

const store = useReposStore()

// Sprint c54+++ — 우클릭 컨텍스트 메뉴 wiring (Mini sister, Pattern 5 TDZ 회피: store 이후).
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
const { onBranchContextMenu } = useBranchInteraction({
  ctxMenu,
  repoId: () => store.activeRepoId,
  onCompare: (b) => {
    window.gitFriedOpenCompare?.('HEAD', b.name)
  },
})
const repoIdRef = computed(() => store.activeRepoId)
const search = useSidebarSearch()

const { data: branches, isFetching } = useBranches(repoIdRef)

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
    v-if="remoteBranches.length > 0 || isFetching"
    title="REMOTE"
    :count="remoteBranches.length"
    storage-key="active-repo-quick.remote"
    full-tooltip="전체 브랜치 패널 (⌘B)"
    @full="dispatchShortcut('newBranch')"
  >
    <SkeletonBlock
      v-if="remoteBranches.length === 0 && isFetching"
      :count="5"
      height="sm"
      data-testid="mini-remote-skeleton"
    />
    <BranchTreeView
      v-else
      :nodes="tree"
      storage-key="branch-tree.remote"
      :auto-expand="search.isActive.value"
    >
      <template #default="{ data }: { data: BranchInfo }">
        <div
          class="flex items-center gap-1 px-1 py-1 text-[11px] text-muted-foreground hover:bg-accent/40 rounded"
          :title="`${data.name} (remote tracking)`"
          @contextmenu="onBranchContextMenu($event, data)"
        >
          <span class="shrink-0 w-3 text-center text-[9px]">⟶</span>
          <span class="flex-1 truncate font-mono">
            {{ data.name.split('/').pop() }}
          </span>
        </div>
      </template>
    </BranchTreeView>
    <ContextMenu ref="ctxMenu" />
  </MiniSection>
</template>
