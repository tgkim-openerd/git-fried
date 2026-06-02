<script setup lang="ts">
// Phase 12-1 — Sidebar REMOTE 카테고리 hierarchical tree.
// origin/feat/x → origin > feat > x. useBranchTree + BranchTreeView.

import { computed, useTemplateRef } from 'vue'
import { useBranches } from '@/composables/useBranches'
// Sprint c54+++ — 우클릭 컨텍스트 메뉴 (GitKraken parity, Pattern 9 sister).
import { useBranchInteraction } from '@/composables/useBranchInteraction'
// SB-013 (Phase 3, 2026-05-18) — hide/solo 시각 토큰 (BranchPanel SoT 일관성).
import { useBranchVisibilityActions } from '@/composables/useBranchVisibilityActions'
// SB-051 (Phase 7-B, 2026-05-18) — Remote row click 대칭성 (Local row 와 동일 정책 적용).
import { useUiSettingsStore } from '@/composables/useUserSettings'
import { useBranchSelection } from '@/composables/useBranchSelection'
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
// SB-013 — hide/solo 시각 토큰.
const { isHidden, soloRef } = useBranchVisibilityActions(repoIdRef)
// SB-051 — select 모드일 때 Remote row click → selection. 'checkout' 모드는 동작 없음
// (checkout-from-remote 는 별도 sprint — useBranchActions 확장 필요).
const uiSettings = useUiSettingsStore()
const { selected: selectedBranch, setSelected } = useBranchSelection()
function onRemoteRowClick(name: string) {
  if (uiSettings.value.branchClickAction === 'select') {
    setSelected(name)
  }
}

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
          class="flex items-center gap-1 px-1 py-1 text-2xs text-muted-foreground hover:bg-accent/40 rounded"
          :class="[
            isHidden(data.name) ? 'opacity-40 line-through' : '',
            soloRef === data.name ? 'ring-1 ring-orange-500/40' : '',
            selectedBranch === data.name ? 'ring-1 ring-primary/50' : '',
            uiSettings.branchClickAction === 'select' ? 'cursor-pointer' : '',
          ]"
          :title="`${data.name} (remote tracking)`"
          @click="onRemoteRowClick(data.name)"
          @contextmenu="onBranchContextMenu($event, data)"
        >
          <!-- marker 자리 유지 (LOCAL ● 정렬 align). GitKraken parity — leaf prefix 화살표 제거. -->
          <span class="shrink-0 w-3" aria-hidden="true" />
          <span class="flex-1 truncate font-mono">
            {{ data.name.split('/').pop() }}
          </span>
        </div>
      </template>
    </BranchTreeView>
    <ContextMenu ref="ctxMenu" />
  </MiniSection>
</template>
