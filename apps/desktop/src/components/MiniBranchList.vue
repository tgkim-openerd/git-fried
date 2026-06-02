<script setup lang="ts">
// Phase 12-1 — Sidebar LOCAL 카테고리 hierarchical tree (chore/v2, feat/api-data-revival).
//
// Sprint c27-1 (ARCH-003 fix) 의 평면 list 를 prefix `/` 기반 tree 로 격상.
// useBranchTree 가 build/sort/filter 로직, BranchTreeView 가 indent/toggle 렌더.
// useSidebarSearch query 와 통합 — 검색 시 모든 폴더 자동 expand.

import { computed, useTemplateRef } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useBranches } from '@/composables/useBranches'
// Sprint c54+++ — 우클릭 컨텍스트 메뉴 (GitKraken parity, Pattern 9 sister).
import { useBranchInteraction } from '@/composables/useBranchInteraction'
// SB-013 (UltraPlan v0.4 sidebar microgap Phase 3, 2026-05-18) — hide/solo 시각 토큰
// BranchPanel SoT 의 패턴을 Mini list 에 fan-out (Codex 권고: 일관성 확보).
import { useBranchVisibilityActions } from '@/composables/useBranchVisibilityActions'
// SB-012 (Phase 7-B, 2026-05-18) — branchClickAction (checkout/select) toggle.
import { useUiSettingsStore } from '@/composables/useUserSettings'
import { useBranchSelection } from '@/composables/useBranchSelection'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
// Sprint c38 fix HIGH-2 — plan/29 E5 acceptance "다른 worktree 점유 브랜치 cross-ref 배지".
import { useWorktrees } from '@/composables/useWorktrees'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useStatusCounts } from '@/composables/useStatusCounts'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { switchBranch } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { buildBranchTree, filterTree } from '@/composables/useBranchTree'
import { useSidebarSearch } from '@/composables/useSidebarSearch'
import MiniSection from './MiniSection.vue'
import BranchTreeView from './BranchTreeView.vue'
// Sprint c54 — Issue 2 — 첫 진입 시 sidebar tree skeleton placeholder.
import SkeletonBlock from './SkeletonBlock.vue'
import type { BranchInfo } from '@/api/git'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'

const { t } = useI18n()

const store = useReposStore()

// Sprint c54+++ — 우클릭 컨텍스트 메뉴 wiring (Pattern 5 TDZ 회피: store 정의 이후 호출).
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
const { onBranchContextMenu } = useBranchInteraction({
  ctxMenu,
  repoId: () => store.activeRepoId,
  onCompare: (b) => {
    // BranchPanel 의 compare wiring 재사용 (App.vue::openCompare 트리거).
    window.gitFriedOpenCompare?.('HEAD', b.name)
  },
})
const toast = useToast()
const invalidate = useInvalidateRepoQueries()
const repoIdRef = computed(() => store.activeRepoId)
const search = useSidebarSearch()

const { data: branches, isFetching } = useBranches(repoIdRef)
// SB-013 — hide/solo 시각 토큰 (BranchPanel SoT 일관성).
const { isHidden, soloRef } = useBranchVisibilityActions(repoIdRef)
// SB-012 — branchClickAction (checkout / select) toggle.
const uiSettings = useUiSettingsStore()
const { selected: selectedBranch, setSelected } = useBranchSelection()
const { counts } = useStatusCounts(repoIdRef)
// Sprint c38 fix HIGH-2 — worktree 점유 branch map (other-worktree 만, main 제외).
// branch name → 점유 worktree path (다른 worktree).
const { data: worktrees } = useWorktrees(repoIdRef)
const occupiedMap = computed<Map<string, string>>(() => {
  const m = new Map<string, string>()
  const list = worktrees.value ?? []
  for (const wt of list) {
    if (wt.isMain) continue
    if (!wt.branch) continue
    m.set(wt.branch, wt.path)
  }
  return m
})

const localBranches = computed(() => {
  const all = branches.value ?? []
  return all
    .filter((b) => b.kind === 'local')
    .sort((a, b) => {
      if (a.isHead && !b.isHead) return -1
      if (b.isHead && !a.isHead) return 1
      return 0
    })
})

const tree = computed(() => {
  const built = buildBranchTree<BranchInfo>(localBranches.value, { getName: (b) => b.name })
  return filterTree(built, search.trimmed.value, (b) => b.name)
})

const switchMut = useMutation({
  mutationFn: ({ id, name }: { id: number; name: string }) => switchBranch(id, name),
  onSuccess: (_res, vars) => {
    invalidate(store.activeRepoId)
    toast.success(t('toast.branchSwitched'), vars.name)
  },
  onError: (e) => toast.error(t('errors.branchSwitchFailed'), describeError(e)),
})

// SB-012 (Phase 7-B, 2026-05-18) — click 분기: 'checkout' 즉시 전환 / 'select' selection 만.
// dblclick 은 setting 무관 즉시 checkout.
function onBranchRowClick(name: string, isHead: boolean) {
  if (isHead) {
    setSelected(name)
    return
  }
  if (uiSettings.value.branchClickAction === 'select') {
    setSelected(name)
  } else {
    void onSwitchBranch(name, isHead)
  }
}

async function onSwitchBranch(name: string, isHead: boolean) {
  if (isHead) return
  if (store.activeRepoId == null) return
  if (counts.value.total > 0) {
    const ok = await confirmDialog({
      title: t('confirm.switchWithChangesTitle'),
      message: t('confirm.switchWithChangesMessage', {
        n: counts.value.total,
        name,
      }),
      danger: true,
    })
    if (!ok) return
  }
  switchMut.mutate({ id: store.activeRepoId, name })
}
</script>

<template>
  <MiniSection
    v-if="localBranches.length > 0 || isFetching"
    title="LOCAL"
    :count="localBranches.length"
    storage-key="active-repo-quick.branches"
    full-tooltip="전체 브랜치 패널 (⌘B)"
    @full="dispatchShortcut('newBranch')"
  >
    <SkeletonBlock
      v-if="localBranches.length === 0 && isFetching"
      :count="5"
      height="sm"
      data-testid="mini-branch-skeleton"
    />
    <BranchTreeView
      v-else
      :nodes="tree"
      storage-key="branch-tree.local"
      :auto-expand="search.isActive.value"
    >
      <template #default="{ data }: { data: BranchInfo }">
        <button
          type="button"
          class="group flex w-full items-center gap-1 px-1 py-1 text-2xs"
          @contextmenu="onBranchContextMenu($event, data)"
          :class="[
            data.isHead
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 rounded'
              : occupiedMap.has(data.name)
                ? 'text-muted-foreground cursor-not-allowed rounded'
                : 'text-foreground hover:bg-accent/40 cursor-pointer rounded',
            isHidden(data.name) ? 'opacity-40 line-through' : '',
            soloRef === data.name ? 'ring-1 ring-orange-500/40' : '',
            selectedBranch === data.name && !data.isHead ? 'ring-1 ring-primary/50' : '',
          ]"
          :disabled="occupiedMap.has(data.name) && !data.isHead"
          :title="
            data.isHead
              ? t('branchList.headTitle')
              : occupiedMap.has(data.name)
                ? t('branchList.occupiedTitle', {
                    name: data.name,
                    path: occupiedMap.get(data.name) ?? '',
                  })
                : t('branchList.checkoutTitle', { name: data.name })
          "
          @click="onBranchRowClick(data.name, data.isHead)"
          @dblclick="onSwitchBranch(data.name, data.isHead)"
        >
          <span class="shrink-0 w-3 text-center">{{ data.isHead ? '●' : '' }}</span>
          <span class="flex-1 truncate font-mono text-left">
            {{ data.name.split('/').pop() }}
          </span>
          <!-- Sprint c38 fix HIGH-2 — 다른 worktree 점유 표시 (branch 옆 🔗) -->
          <span
            v-if="occupiedMap.has(data.name) && !data.isHead"
            class="text-3xs text-warning-amber"
            :title="t('branchList.occupiedBadgeTitle', { path: occupiedMap.get(data.name) ?? '' })"
            >🔗</span
          >
          <span v-if="data.ahead || data.behind" class="text-4xs">
            <span v-if="data.ahead" class="text-diff-add">↑{{ data.ahead }}</span>
            <span v-if="data.behind" class="ml-0.5 text-danger-rose">↓{{ data.behind }}</span>
          </span>
        </button>
      </template>
    </BranchTreeView>
    <ContextMenu ref="ctxMenu" />
  </MiniSection>
</template>
