<script setup lang="ts">
// Phase 12-3 — Sidebar SUBMODULES 카테고리 (GitKraken parity).
// listSubmodules IPC. 평면 list (path 기반, slash 분리해도 일반적으로 짧음).

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listSubmodules, type SubmoduleEntry } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { useSidebarSearch } from '@/composables/useSidebarSearch'
import MiniSection from './MiniSection.vue'

const store = useReposStore()
const search = useSidebarSearch()

const { data: submodules } = useQuery({
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

const miniSubmodules = computed(() => filtered.value.slice(0, 5))
const moreCount = computed(() => Math.max(0, filtered.value.length - miniSubmodules.value.length))

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
      return 'text-amber-500'
    case 'conflicted':
      return 'text-rose-500'
    case 'uninitialized':
      return 'text-muted-foreground/50'
    default:
      return 'text-muted-foreground'
  }
}
</script>

<template>
  <MiniSection
    v-if="(submodules?.length ?? 0) > 0"
    title="SUBMODULES"
    :count="submodules?.length ?? 0"
    storage-key="active-repo-quick.submodules"
    full-tooltip="전체 Submodule 패널 (⌘4)"
    @full="dispatchShortcut('tab4')"
  >
    <ul class="space-y-0.5">
      <li
        v-for="s in miniSubmodules"
        :key="`ms-${s.path}`"
        class="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/40"
        :title="`${s.path} (${s.status})${s.sha ? ' · ' + s.sha.slice(0, 7) : ''}`"
      >
        <span class="shrink-0 w-3 text-center text-[10px]" :class="statusColor(s)">
          {{ statusIcon(s) }}
        </span>
        <span class="flex-1 truncate font-mono">{{ s.path }}</span>
      </li>
      <li v-if="moreCount > 0" class="px-1 py-0.5 text-[10px] text-muted-foreground">
        ⋯ +{{ moreCount }}개 더 (전체 → 클릭)
      </li>
    </ul>
  </MiniSection>
</template>
