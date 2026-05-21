<script setup lang="ts">
// Sprint c27-1 (ARCH-003 fix) — Sidebar 의 Open PR mini list (active-repo-only).

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePullRequests } from '@/composables/usePullRequests'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import MiniSection from './MiniSection.vue'
// Sprint c54+ (ARCH-c54-001 sister uniformity) — sidebar skeleton placeholder.
import SkeletonBlock from './SkeletonBlock.vue'

const { t } = useI18n()
const store = useReposStore()
const repoIdRef = computed(() => store.activeRepoId)

const { data: prs, isFetching } = usePullRequests(repoIdRef, () => 'open')
const miniPrs = computed(() => (prs.value ?? []).slice(0, 3))
const moreCount = computed(() => Math.max(0, (prs.value?.length ?? 0) - miniPrs.value.length))
</script>

<template>
  <MiniSection
    v-if="miniPrs.length > 0 || isFetching"
    title="Open PR"
    :count="prs?.length ?? 0"
    storage-key="active-repo-quick.pr"
    full-tooltip="PR 패널 (⌘6)"
    @full="dispatchShortcut('tab6')"
  >
    <SkeletonBlock
      v-if="miniPrs.length === 0 && isFetching"
      :count="5"
      height="sm"
      data-testid="mini-pr-skeleton"
    />
    <ul v-else class="space-y-0.5">
      <li
        v-for="p in miniPrs"
        :key="`mp-${p.number}`"
        class="flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-[11px] hover:bg-accent/30"
        :title="`#${p.number} ${p.title}\nby ${p.author.username} — ${p.headBranch} → ${p.baseBranch}`"
        role="button"
        tabindex="0"
        @click="dispatchShortcut('tab6')"
        @keydown.enter.self="dispatchShortcut('tab6')"
        @keydown.space.self.prevent="dispatchShortcut('tab6')"
      >
        <!-- SB-017 (Phase 4, 2026-05-18) — CI 4 아이콘 (GitKraken parity S9):
             draft (gray D) 최우선, 그 후 ci_status (green/yellow/red), 없으면 미표시. -->
        <span
          v-if="p.draft"
          class="shrink-0 text-[10px] text-muted-foreground"
          :title="t('pr.ciStatus.draft')"
          :aria-label="t('pr.ciStatus.draft')"
        >
          ⚫
        </span>
        <span
          v-else-if="p.ciStatus === 'success'"
          class="shrink-0 text-[10px] text-diff-add"
          :title="t('pr.ciStatus.passed')"
          :aria-label="t('pr.ciStatus.passed')"
        >
          ✓
        </span>
        <span
          v-else-if="p.ciStatus === 'pending'"
          class="shrink-0 text-[10px] text-warning-amber"
          :title="t('pr.ciStatus.pending')"
          :aria-label="t('pr.ciStatus.pending')"
        >
          ●
        </span>
        <span
          v-else-if="p.ciStatus === 'failure'"
          class="shrink-0 text-[10px] text-danger-rose"
          :title="t('pr.ciStatus.failed')"
          :aria-label="t('pr.ciStatus.failed')"
        >
          ✕
        </span>
        <span class="shrink-0 font-mono text-[10px] text-muted-foreground"> #{{ p.number }} </span>
        <span class="flex-1 truncate">{{ p.title }}</span>
        <span v-if="p.comments > 0" class="text-[9px] text-muted-foreground">
          💬{{ p.comments }}
        </span>
      </li>
      <li v-if="moreCount > 0" class="px-1 py-0.5 text-[10px] text-muted-foreground">
        {{ t('miniSection.moreLabel', { count: moreCount }) }}
      </li>
    </ul>
  </MiniSection>
</template>
