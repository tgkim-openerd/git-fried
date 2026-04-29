<script setup lang="ts">
// Phase 12-1 — Sidebar LOCAL 카테고리 hierarchical tree (chore/v2, feat/api-data-revival).
//
// Sprint c27-1 (ARCH-003 fix) 의 평면 list 를 prefix `/` 기반 tree 로 격상.
// useBranchTree 가 build/sort/filter 로직, BranchTreeView 가 indent/toggle 렌더.
// useSidebarSearch query 와 통합 — 검색 시 모든 폴더 자동 expand.

import { computed } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useBranches } from '@/composables/useBranches'
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
import type { BranchInfo } from '@/api/git'

const store = useReposStore()
const toast = useToast()
const invalidate = useInvalidateRepoQueries()
const repoIdRef = computed(() => store.activeRepoId)
const search = useSidebarSearch()

const { data: branches } = useBranches(repoIdRef)
const { counts } = useStatusCounts(repoIdRef)

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
    toast.success('브랜치 전환', vars.name)
  },
  onError: (e) => toast.error('브랜치 전환 실패', describeError(e)),
})

function onSwitchBranch(name: string, isHead: boolean) {
  if (isHead) return
  if (store.activeRepoId == null) return
  if (counts.value.total > 0) {
    if (
      !confirm(
        `변경사항 있음 (${counts.value.total} files) — '${name}' 으로 체크아웃 진행?\n\n` +
          `• git checkout 이 거부할 수 있음 (overwrite 위험)\n` +
          `• 안전하게 진행하려면 stash 먼저 권장\n\n` +
          `그래도 시도하시겠습니까?`,
      )
    ) {
      return
    }
  }
  switchMut.mutate({ id: store.activeRepoId, name })
}
</script>

<template>
  <MiniSection
    v-if="localBranches.length > 0"
    title="LOCAL"
    :count="localBranches.length"
    storage-key="active-repo-quick.branches"
    full-tooltip="전체 브랜치 패널 (⌘B)"
    @full="dispatchShortcut('newBranch')"
  >
    <BranchTreeView
      :nodes="tree"
      storage-key="branch-tree.local"
      :auto-expand="search.isActive.value"
    >
      <template #default="{ data }: { data: BranchInfo }">
        <button
          type="button"
          class="group flex w-full items-center gap-1 px-1 py-0.5 text-[11px]"
          :class="
            data.isHead
              ? 'bg-emerald-500/10 text-emerald-500 rounded'
              : 'text-foreground hover:bg-accent/40 cursor-pointer rounded'
          "
          :title="
            data.isHead
              ? '현재 HEAD (체크아웃 됨)'
              : `${data.name} 으로 체크아웃 (clean working tree 권장)`
          "
          @click="onSwitchBranch(data.name, data.isHead)"
        >
          <span class="shrink-0 w-3 text-center">{{ data.isHead ? '●' : '' }}</span>
          <span class="flex-1 truncate font-mono text-left">
            {{ data.name.split('/').pop() }}
          </span>
          <span v-if="data.ahead || data.behind" class="text-[9px]">
            <span v-if="data.ahead" class="text-emerald-500">↑{{ data.ahead }}</span>
            <span v-if="data.behind" class="ml-0.5 text-rose-500">↓{{ data.behind }}</span>
          </span>
        </button>
      </template>
    </BranchTreeView>
  </MiniSection>
</template>
