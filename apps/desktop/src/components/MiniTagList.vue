<script setup lang="ts">
// Phase 12-1 — Sidebar TAGS hierarchical tree (예: release/v2.0.0 → release > v2.0.0).

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { listTags, type TagInfo } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useReposStore } from '@/stores/repos'
import { buildBranchTree, filterTree } from '@/composables/useBranchTree'
import { useSidebarSearch } from '@/composables/useSidebarSearch'
import { semverCompare } from '@/utils/semverCompare'
import MiniSection from './MiniSection.vue'
import BranchTreeView from './BranchTreeView.vue'
// Sprint c54+ (ARCH-c54-001 sister uniformity) — sidebar skeleton placeholder.
import SkeletonBlock from './SkeletonBlock.vue'
// SB-013 (Phase 3, 2026-05-18) — hide/solo 시각 토큰 (BranchPanel SoT 일관성).
import { useBranchVisibilityActions } from '@/composables/useBranchVisibilityActions'

const { t } = useI18n()
const store = useReposStore()
const search = useSidebarSearch()
const repoIdRef = computed(() => store.activeRepoId)
// SB-013 — hide/solo 시각 토큰 (tag kind 도 hiddenSet/soloRef 공유).
const { isHidden, soloRef } = useBranchVisibilityActions(repoIdRef)

// SB-018 (UltraPlan v0.4 sidebar microgap Phase 5, 2026-05-18) — Tag mini 전용 filter bar
// (GitKraken parity S5: Tags section 의 dedicated filter). 통합 search 와 OR 조합 —
// 한 쪽이 active 면 작동, 둘 다 active 면 AND (intersect).
const tagFilter = ref('')
const tagFilterTrimmed = computed(() => tagFilter.value.trim().toLowerCase())

const { data: tags, isFetching } = useQuery({
  queryKey: computed(() => ['tags', store.activeRepoId]),
  queryFn: () => {
    if (store.activeRepoId == null) return Promise.resolve([])
    return listTags(store.activeRepoId)
  },
  enabled: computed(() => store.activeRepoId != null),
  staleTime: STALE_TIME.NORMAL,
})

// UltraPlan v0.4 sidebar GitKraken DIFF — SB-008 fix.
// git2 default alphabetical 정렬 → semver descending (최신 우선). GitKraken parity.
const tagsList = computed(() => {
  const list = tags.value ?? []
  return [...list].sort((a, b) => semverCompare(b.name, a.name))
})

const tree = computed(() => {
  const built = buildBranchTree<TagInfo>(tagsList.value, { getName: (t) => t.name })
  // SB-018 — 통합 search query 우선 적용 후 tag-only filter 추가 (AND 조합).
  const afterGlobal = filterTree(built, search.trimmed.value, (t) => t.name)
  if (!tagFilterTrimmed.value) return afterGlobal
  return filterTree(afterGlobal, tagFilterTrimmed.value, (t) => t.name)
})

// SB-030 (UltraPlan v0.4 sidebar microgap Phase 2, 2026-05-18) — tag click=jump to commit
// (GitKraken parity S5: tag click 은 checkout 이 아닌 commit graph 점프).
function onTagClick(sha: string): void {
  window.gitFriedSelectCommit?.(sha)
}
</script>

<template>
  <MiniSection
    v-if="tagsList.length > 0 || isFetching"
    title="TAGS"
    :count="tagsList.length"
    storage-key="active-repo-quick.tags"
  >
    <SkeletonBlock
      v-if="tagsList.length === 0 && isFetching"
      :count="5"
      height="sm"
      data-testid="mini-tag-skeleton"
    />
    <!-- SB-018 (Phase 5, 2026-05-18) — Tag-only filter bar (GitKraken S5 parity). -->
    <div v-else-if="tagsList.length > 5" class="px-1 pb-0.5">
      <input
        v-model="tagFilter"
        type="search"
        :placeholder="t('tagList.filterPlaceholder')"
        :aria-label="t('tagList.filterAriaLabel')"
        data-testid="mini-tag-filter"
        class="w-full rounded border border-input bg-background px-1.5 py-0.5 text-3xs outline-none focus:border-primary"
      />
    </div>
    <BranchTreeView
      v-if="tagsList.length > 0 || !isFetching"
      :nodes="tree"
      storage-key="branch-tree.tags"
      :auto-expand="search.isActive.value || tagFilterTrimmed.length > 0"
    >
      <template #default="{ data }: { data: TagInfo }">
        <div
          class="flex items-center gap-1 px-1 py-1 text-2xs text-muted-foreground hover:bg-accent/40 rounded"
          :class="[
            data.commitSha ? 'cursor-pointer' : '',
            isHidden(data.name) ? 'opacity-40 line-through' : '',
            soloRef === data.name ? 'ring-1 ring-orange-500/40' : '',
          ]"
          :title="data.subject ?? `tag ${data.name}`"
          @click="data.commitSha && onTagClick(data.commitSha)"
        >
          <span class="shrink-0 w-3 text-center text-4xs">{{ data.annotated ? '🏷' : '·' }}</span>
          <span class="flex-1 truncate font-mono">
            {{ data.name.split('/').pop() }}
          </span>
        </div>
      </template>
    </BranchTreeView>
  </MiniSection>
</template>
