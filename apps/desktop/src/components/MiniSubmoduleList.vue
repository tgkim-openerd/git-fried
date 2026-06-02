<script setup lang="ts">
// Phase 12-3 — Sidebar SUBMODULES 카테고리 (GitKraken parity).
// Sprint c74 — click → open as repo (new tab) + 우클릭 ContextMenu 7 액션 + scrollable.

import { computed, useTemplateRef } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { listSubmodules, type SubmoduleEntry } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { useSidebarSearch } from '@/composables/useSidebarSearch'
import { useSubmoduleInteraction } from '@/composables/useSubmoduleInteraction'
import MiniSection from './MiniSection.vue'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
// Sprint c54 — Issue 2 — sidebar skeleton placeholder.
import SkeletonBlock from './SkeletonBlock.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useReposStore()
const search = useSidebarSearch()
const qc = useQueryClient()

const { data: submodules, isFetching } = useQuery({
  queryKey: computed(() => ['submodules', store.activeRepoId]),
  queryFn: () => {
    if (store.activeRepoId == null) return Promise.resolve([])
    return listSubmodules(store.activeRepoId)
  },
  enabled: computed(() => store.activeRepoId != null),
  staleTime: STALE_TIME.NORMAL,
})

const filtered = computed<SubmoduleEntry[]>(() => {
  const list = submodules.value ?? []
  const q = search.trimmed.value.toLowerCase()
  if (!q) return list
  return list.filter((s) => s.path.toLowerCase().includes(q))
})

const submoduleCount = computed(() => submodules.value?.length ?? 0)

// M-2: 우클릭 + click 액션. caller-decision — queryClient invalidate 만 콜백.
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
const { openAsRepo, onSubmoduleContextMenu } = useSubmoduleInteraction({
  ctxMenu,
  onInvalidate: () => qc.invalidateQueries({ queryKey: ['submodules', store.activeRepoId] }),
})

function statusIcon(s: SubmoduleEntry): string {
  switch (s.status) {
    case 'uninitialized':
      return '○'
    case 'initialized':
      return '●'
    case 'modified':
      return '◐'
    case 'conflicted':
      return '⚠'
    default:
      return '·'
  }
}
function statusColor(s: SubmoduleEntry): string {
  switch (s.status) {
    case 'modified':
      return 'text-warning-amber'
    case 'conflicted':
      return 'text-danger-rose'
    case 'uninitialized':
      return 'text-muted-foreground/50'
    default:
      return 'text-muted-foreground'
  }
}
</script>

<template>
  <MiniSection
    v-if="submoduleCount > 0 || isFetching"
    title="SUBMODULES"
    :count="submoduleCount"
    storage-key="active-repo-quick.submodules"
    :full-tooltip="t('submoduleList.fullTooltip')"
    @full="dispatchShortcut('tab4')"
  >
    <SkeletonBlock
      v-if="submoduleCount === 0 && isFetching"
      :count="3"
      height="sm"
      data-testid="mini-submodule-skeleton"
    />
    <!-- M-4: slice 제거 + max-h scrollable -->
    <ul v-else class="mini-list-scroll max-h-[32vh] space-y-0.5 overflow-y-auto">
      <li
        v-for="s in filtered"
        :key="`ms-${s.path}`"
        class="group flex items-center gap-1 rounded px-1 py-1 text-2xs text-muted-foreground hover:bg-accent/40 hover:text-foreground cursor-pointer"
        :title="
          t('submoduleList.itemTitle', {
            path: s.path,
            status: s.status,
            sha: s.sha ? s.sha.slice(0, 7) : '—',
          })
        "
        @dblclick="openAsRepo(s)"
        @contextmenu="onSubmoduleContextMenu($event, s)"
      >
        <span class="shrink-0 w-3 text-center text-3xs" :class="statusColor(s)">
          {{ statusIcon(s) }}
        </span>
        <span class="flex-1 truncate font-mono">{{ s.path }}</span>
        <!-- M-5: sha inline (7 char) — 동기화 상태 즉시 확인 -->
        <span v-if="s.sha" class="shrink-0 font-mono text-4xs text-muted-foreground/60">
          {{ s.sha.slice(0, 7) }}
        </span>
      </li>
    </ul>
    <ContextMenu ref="ctxMenu" />
  </MiniSection>
</template>
