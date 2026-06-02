<script setup lang="ts">
// Sprint c25-3 step 1 (`docs/plan/25 §4`) — 활성 레포 mini section.
// Sprint c27-1 (ARCH-003 fix) — God component 해소. mini list 는 별도 sub-component.
// Phase 11-6 (GitKraken parity issue #2) — Sidebar body 로 격상. <details> wrapper 제거,
// MiniRemoteBranchList / MiniTagList 추가 → LOCAL / REMOTE / WORKTREES / STASHES / PR / TAGS.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStatus } from '@/composables/useStatus'
import { useStatusCounts } from '@/composables/useStatusCounts'
import { dispatchShortcut, type ShortcutAction } from '@/composables/useShortcuts'
import { useReposStore } from '@/stores/repos'
// plan/30 P1-5 — Mini sidebar 섹션 visibility 사용자 토글.
import { useUiSettingsStore } from '@/composables/useUserSettings'
import MiniBranchList from './MiniBranchList.vue'
import MiniRemoteBranchList from './MiniRemoteBranchList.vue'
import MiniStashList from './MiniStashList.vue'
import MiniWorktreeList from './MiniWorktreeList.vue'
import MiniSubmoduleList from './MiniSubmoduleList.vue'
import MiniTagList from './MiniTagList.vue'
import MiniPrList from './MiniPrList.vue'
import EmptyState from './EmptyState.vue'

const { t } = useI18n()
const store = useReposStore()
const uiSettings = useUiSettingsStore()
const sections = computed(() => uiSettings.value.miniSidebarSections)

const repoIdRef = computed(() => store.activeRepoId)
const { data: status } = useStatus(repoIdRef)
// ARCH-006 — useStatusCounts 단일 진실원천.
const { counts } = useStatusCounts(repoIdRef)

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)

// 7-tab 단축 버튼 — pages/index.vue 의 useShortcut('tab1'~'tab7') 로 dispatch.
// SB-002 fix (UltraPlan v0.4 sidebar gitkraken-diff): label/title 을 i18n `sidebar.quickTab.*` 로 마이그.
const QUICK_TABS: ReadonlyArray<{
  key: ShortcutAction
  icon: string
  labelKey: string
  titleKey: string
}> = [
  {
    key: 'tab1',
    icon: '◇',
    labelKey: 'sidebar.quickTab.changes',
    titleKey: 'sidebar.quickTab.changesTitle',
  },
  {
    key: 'tab2',
    icon: '⎇',
    labelKey: 'sidebar.quickTab.branches',
    titleKey: 'sidebar.quickTab.branchesTitle',
  },
  {
    key: 'tab3',
    icon: '⤓',
    labelKey: 'sidebar.quickTab.stash',
    titleKey: 'sidebar.quickTab.stashTitle',
  },
  { key: 'tab6', icon: '⇄', labelKey: 'sidebar.quickTab.pr', titleKey: 'sidebar.quickTab.prTitle' },
  {
    key: 'tab7',
    icon: '🌳',
    labelKey: 'sidebar.quickTab.worktree',
    titleKey: 'sidebar.quickTab.worktreeTitle',
  },
]
</script>

<template>
  <div class="flex flex-col">
    <!-- 미선택 상태 — EmptyState 가이드 (SB-002 i18n 마이그). -->
    <EmptyState
      v-if="store.activeRepoId == null"
      icon="📁"
      :title="t('sidebar.emptyState.noActiveRepoTitle')"
      :description="t('sidebar.emptyState.noActiveRepoDescription')"
      size="sm"
    />

    <div v-else class="space-y-2 px-3 pt-2 pb-2">
      <!-- branch + upstream -->
      <div class="flex flex-wrap items-baseline gap-1 font-mono text-xs">
        <span class="text-muted-foreground">on</span>
        <span class="font-semibold text-foreground">{{ branch || '(no branch)' }}</span>
        <span v-if="upstream" class="text-[10px] text-muted-foreground">→ {{ upstream }}</span>
        <span v-if="ahead || behind" class="text-[10px]">
          <span v-if="ahead" class="text-diff-add">↑{{ ahead }}</span>
          <span v-if="behind" class="ml-0.5 text-danger-rose">↓{{ behind }}</span>
        </span>
      </div>

      <!-- changes count badges -->
      <div v-if="counts.total > 0" class="flex flex-wrap gap-1 text-[10px]">
        <span v-if="counts.staged > 0" class="rounded bg-emerald-500/15 px-1 text-diff-add">
          staged {{ counts.staged }}
        </span>
        <span v-if="counts.unstaged > 0" class="rounded bg-amber-500/15 px-1 text-warning-amber">
          mod {{ counts.unstaged }}
        </span>
        <span v-if="counts.untracked > 0" class="rounded bg-sky-500/15 px-1 text-sky-500">
          new {{ counts.untracked }}
        </span>
        <span v-if="counts.conflicted > 0" class="rounded bg-rose-500/15 px-1 text-danger-rose">
          ⚠ {{ counts.conflicted }}
        </span>
      </div>
      <div v-else class="text-[10px] text-muted-foreground">{{ t('common.noChanges') }}</div>

      <!-- quick tab buttons — SB-002 i18n migration (sidebar.quickTab.*). -->
      <div class="grid grid-cols-5 gap-1">
        <button
          v-for="qt in QUICK_TABS"
          :key="qt.key"
          type="button"
          class="flex flex-col items-center gap-0 rounded-md border border-border bg-card px-1 py-1 text-[10px] hover:bg-accent hover:text-accent-foreground"
          :title="t(qt.titleKey)"
          @click="dispatchShortcut(qt.key)"
        >
          <span class="text-sm leading-none">{{ qt.icon }}</span>
          <span class="leading-tight whitespace-nowrap">{{ t(qt.labelKey) }}</span>
        </button>
      </div>

      <!-- c27-1 (ARCH-003 fix) — mini list 는 sub-component 로 분리.
           Phase 11-6 (issue #2 GitKraken parity) — MiniRemoteBranchList / MiniTagList 추가.
           Phase 12-1/2/3 — branch tree (LOCAL/REMOTE/TAGS) + 검색 query 통합 + MiniSubmoduleList. -->
      <MiniBranchList v-if="sections.branch" />
      <MiniRemoteBranchList v-if="sections.remote" />
      <MiniWorktreeList v-if="sections.worktree" />
      <MiniStashList v-if="sections.stash" />
      <MiniSubmoduleList v-if="sections.submodule" />
      <MiniPrList v-if="sections.pr" />
      <MiniTagList v-if="sections.tag" />
    </div>
  </div>
</template>
