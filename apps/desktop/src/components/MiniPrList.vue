<script setup lang="ts">
// Sprint c27-1 (ARCH-003 fix) — Sidebar 의 Open PR mini list (active-repo-only).

import { computed } from 'vue'
import { usePullRequests } from '@/composables/usePullRequests'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import MiniSection from './MiniSection.vue'

const store = useReposStore()
const repoIdRef = computed(() => store.activeRepoId)

const { data: prs } = usePullRequests(repoIdRef, () => 'open')
const miniPrs = computed(() => (prs.value ?? []).slice(0, 3))
const moreCount = computed(() =>
  Math.max(0, (prs.value?.length ?? 0) - miniPrs.value.length),
)
</script>

<template>
  <MiniSection
    v-if="miniPrs.length > 0"
    title="Open PR"
    :count="prs?.length ?? 0"
    storage-key="active-repo-quick.pr"
    full-tooltip="PR 패널 (⌘6)"
    @full="dispatchShortcut('tab6')"
  >
    <ul class="space-y-0.5">
      <li
        v-for="p in miniPrs"
        :key="`mp-${p.number}`"
        class="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-accent/30"
        :title="`#${p.number} ${p.title}\nby ${p.author.username} — ${p.headBranch} → ${p.baseBranch}`"
        @click="dispatchShortcut('tab6')"
      >
        <span class="shrink-0 font-mono text-[10px] text-muted-foreground">
          #{{ p.number }}
        </span>
        <span v-if="p.draft" class="shrink-0 rounded bg-muted/50 px-1 text-[9px] text-muted-foreground">
          draft
        </span>
        <span class="flex-1 truncate">{{ p.title }}</span>
        <span v-if="p.comments > 0" class="text-[9px] text-muted-foreground">
          💬{{ p.comments }}
        </span>
      </li>
      <li
        v-if="moreCount > 0"
        class="px-1 py-0.5 text-[10px] text-muted-foreground"
      >
        ⋯ +{{ moreCount }}개 더 (전체 → 클릭)
      </li>
    </ul>
  </MiniSection>
</template>
