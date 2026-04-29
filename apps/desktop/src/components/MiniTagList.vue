<script setup lang="ts">
// Phase 12-1 — Sidebar TAGS hierarchical tree (예: release/v2.0.0 → release > v2.0.0).

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listTags, type TagInfo } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useReposStore } from '@/stores/repos'
import { buildBranchTree, filterTree } from '@/composables/useBranchTree'
import { useSidebarSearch } from '@/composables/useSidebarSearch'
import MiniSection from './MiniSection.vue'
import BranchTreeView from './BranchTreeView.vue'

const store = useReposStore()
const search = useSidebarSearch()

const { data: tags } = useQuery({
  queryKey: computed(() => ['tags', store.activeRepoId]),
  queryFn: () => {
    if (store.activeRepoId == null) return Promise.resolve([])
    return listTags(store.activeRepoId)
  },
  enabled: computed(() => store.activeRepoId != null),
  staleTime: STALE_TIME.NORMAL,
})

const tagsList = computed(() => tags.value ?? [])

const tree = computed(() => {
  const built = buildBranchTree<TagInfo>(tagsList.value, { getName: (t) => t.name })
  return filterTree(built, search.trimmed.value, (t) => t.name)
})
</script>

<template>
  <MiniSection
    v-if="tagsList.length > 0"
    title="TAGS"
    :count="tagsList.length"
    storage-key="active-repo-quick.tags"
  >
    <BranchTreeView
      :nodes="tree"
      storage-key="branch-tree.tags"
      :auto-expand="search.isActive.value"
    >
      <template #default="{ data }: { data: TagInfo }">
        <div
          class="flex items-center gap-1 px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/40 rounded"
          :title="data.subject ?? `tag ${data.name}`"
        >
          <span class="shrink-0 w-3 text-center text-[9px]">{{ data.annotated ? '🏷' : '·' }}</span>
          <span class="flex-1 truncate font-mono">
            {{ data.name.split('/').pop() }}
          </span>
        </div>
      </template>
    </BranchTreeView>
  </MiniSection>
</template>
