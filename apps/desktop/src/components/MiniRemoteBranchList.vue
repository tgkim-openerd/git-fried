<script setup lang="ts">
// Phase 11-6 — Sidebar 활성 레포 카테고리 (REMOTE branches).
// MiniBranchList 의 remote 버전. 동일 데이터 소스 useBranches → kind='remote' filter.

import { computed } from 'vue'
import { useBranches } from '@/composables/useBranches'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import MiniSection from './MiniSection.vue'

const store = useReposStore()
const repoIdRef = computed(() => store.activeRepoId)

const { data: branches } = useBranches(repoIdRef)

const remoteBranches = computed(() => {
  const all = branches.value ?? []
  return all.filter((b) => b.kind === 'remote')
})
const miniRemote = computed(() => remoteBranches.value.slice(0, 5))
const moreCount = computed(() => Math.max(0, remoteBranches.value.length - miniRemote.value.length))
</script>

<template>
  <MiniSection
    v-if="miniRemote.length > 0"
    title="REMOTE"
    :count="remoteBranches.length"
    storage-key="active-repo-quick.remote"
    full-tooltip="전체 브랜치 패널 (⌘B)"
    @full="dispatchShortcut('newBranch')"
  >
    <ul class="space-y-0.5">
      <li
        v-for="b in miniRemote"
        :key="`mr-${b.name}`"
        class="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/40"
        :title="`origin/${b.name} (remote tracking)`"
      >
        <span class="shrink-0 w-3 text-center text-[9px]">⟶</span>
        <span class="flex-1 truncate font-mono">{{ b.name }}</span>
      </li>
      <li v-if="moreCount > 0" class="px-1 py-0.5 text-[10px] text-muted-foreground">
        ⋯ +{{ moreCount }}개 더 (전체 → 클릭)
      </li>
    </ul>
  </MiniSection>
</template>
