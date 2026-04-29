<script setup lang="ts">
// Phase 11-6 — Sidebar 활성 레포 카테고리 (TAGS).
// listTags IPC 직접 호출 (별도 composable 없음).

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listTags } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useReposStore } from '@/stores/repos'
import MiniSection from './MiniSection.vue'

const store = useReposStore()

const { data: tags } = useQuery({
  queryKey: computed(() => ['tags', store.activeRepoId]),
  queryFn: () => {
    if (store.activeRepoId == null) return Promise.resolve([])
    return listTags(store.activeRepoId)
  },
  enabled: computed(() => store.activeRepoId != null),
  staleTime: STALE_TIME.NORMAL,
})

const miniTags = computed(() => (tags.value ?? []).slice(0, 5))
const moreCount = computed(() => Math.max(0, (tags.value?.length ?? 0) - miniTags.value.length))
</script>

<template>
  <MiniSection
    v-if="miniTags.length > 0"
    title="TAGS"
    :count="tags?.length ?? 0"
    storage-key="active-repo-quick.tags"
  >
    <ul class="space-y-0.5">
      <li
        v-for="t in miniTags"
        :key="`mt-${t.name}`"
        class="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/40"
        :title="t.subject ?? `tag ${t.name}`"
      >
        <span class="shrink-0 w-3 text-center text-[9px]">{{ t.annotated ? '🏷' : '·' }}</span>
        <span class="flex-1 truncate font-mono">{{ t.name }}</span>
      </li>
      <li v-if="moreCount > 0" class="px-1 py-0.5 text-[10px] text-muted-foreground">
        ⋯ +{{ moreCount }}개 더
      </li>
    </ul>
  </MiniSection>
</template>
