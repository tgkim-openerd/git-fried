<script setup lang="ts">
// Forge 통합 패널 — PR / Issues / Releases / Tags sub-tab.
// 우측 탭 'PR' 위치에서 사용. 좁은 폭에서도 한 자리로 묶어 효율.
import { ref } from 'vue'
import PrPanel from './PrPanel.vue'
import IssuesPanel from './IssuesPanel.vue'
import ReleasesPanel from './ReleasesPanel.vue'
import TagPanel from './TagPanel.vue'

defineProps<{ repoId: number | null }>()

type ForgeTab = 'pr' | 'issues' | 'releases' | 'tags'
const tab = ref<ForgeTab>('pr')
const TAB_LABELS: Record<ForgeTab, string> = {
  pr: 'PR',
  issues: 'Issue',
  releases: 'Release',
  tags: 'Tag',
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <nav class="flex border-b border-border text-[10px]">
      <button
        v-for="t in ['pr', 'issues', 'releases', 'tags'] as ForgeTab[]"
        :key="t"
        type="button"
        class="flex-1 py-1.5 uppercase tracking-wider"
        :class="
          tab === t
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'text-muted-foreground hover:bg-accent/40'
        "
        @click="tab = t"
      >
        {{ TAB_LABELS[t] }}
      </button>
    </nav>
    <div class="flex-1 overflow-hidden">
      <PrPanel v-if="tab === 'pr'" :repo-id="repoId" />
      <IssuesPanel v-else-if="tab === 'issues'" :repo-id="repoId" />
      <ReleasesPanel v-else-if="tab === 'releases'" :repo-id="repoId" />
      <TagPanel v-else :repo-id="repoId" />
    </div>
  </section>
</template>
