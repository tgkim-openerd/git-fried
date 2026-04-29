<script setup lang="ts">
// Sprint c25-3 step 1 (`docs/plan/25 §4`) — 활성 레포 mini section.
// Sprint c27-1 (ARCH-003 fix) — God component 해소. mini list 는 별도 sub-component.
// Phase 11-6 (GitKraken parity issue #2) — Sidebar body 로 격상. <details> wrapper 제거,
// MiniRemoteBranchList / MiniTagList 추가 → LOCAL / REMOTE / WORKTREES / STASHES / PR / TAGS.

import { computed } from 'vue'
import { useStatus } from '@/composables/useStatus'
import { useStatusCounts } from '@/composables/useStatusCounts'
import { dispatchShortcut, type ShortcutAction } from '@/composables/useShortcuts'
import { useReposStore } from '@/stores/repos'
import MiniBranchList from './MiniBranchList.vue'
import MiniRemoteBranchList from './MiniRemoteBranchList.vue'
import MiniStashList from './MiniStashList.vue'
import MiniWorktreeList from './MiniWorktreeList.vue'
import MiniSubmoduleList from './MiniSubmoduleList.vue'
import MiniTagList from './MiniTagList.vue'
import MiniPrList from './MiniPrList.vue'
import EmptyState from './EmptyState.vue'

const store = useReposStore()

const repoIdRef = computed(() => store.activeRepoId)
const { data: status } = useStatus(repoIdRef)
// ARCH-006 — useStatusCounts 단일 진실원천.
const { counts } = useStatusCounts(repoIdRef)

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)

// 7-tab 단축 버튼 — pages/index.vue 의 useShortcut('tab1'~'tab7') 로 dispatch.
const QUICK_TABS: ReadonlyArray<{
  key: ShortcutAction
  icon: string
  label: string
  title: string
}> = [
  { key: 'tab1', icon: '◇', label: '변경', title: '변경 탭 (⌘1)' },
  { key: 'tab2', icon: '⎇', label: '브랜치', title: '브랜치 탭 (⌘2 / ⌘B)' },
  { key: 'tab3', icon: '⤓', label: 'Stash', title: 'Stash 탭 (⌘3)' },
  { key: 'tab6', icon: '⇄', label: 'PR', title: 'PR 탭 (⌘6)' },
  { key: 'tab7', icon: '🌳', label: 'Worktree', title: 'Worktree 탭 (⌘7)' },
]
</script>

<template>
  <div class="flex flex-col">
    <!-- 미선택 상태 — EmptyState 가이드. -->
    <EmptyState
      v-if="store.activeRepoId == null"
      icon="📁"
      title="레포 미선택"
      description="상단 탭 또는 '레포' 페이지에서 활성 레포 선택"
      size="sm"
    />

    <div v-else class="space-y-2 px-3 pt-2 pb-2">
      <!-- branch + upstream -->
      <div class="flex flex-wrap items-baseline gap-1 font-mono text-xs">
        <span class="text-muted-foreground">on</span>
        <span class="font-semibold text-foreground">{{ branch || '(no branch)' }}</span>
        <span v-if="upstream" class="text-[10px] text-muted-foreground">→ {{ upstream }}</span>
        <span v-if="ahead || behind" class="text-[10px]">
          <span v-if="ahead" class="text-emerald-500">↑{{ ahead }}</span>
          <span v-if="behind" class="ml-0.5 text-rose-500">↓{{ behind }}</span>
        </span>
      </div>

      <!-- changes count badges -->
      <div v-if="counts.total > 0" class="flex flex-wrap gap-1 text-[10px]">
        <span v-if="counts.staged > 0" class="rounded bg-emerald-500/15 px-1 text-emerald-500">
          staged {{ counts.staged }}
        </span>
        <span v-if="counts.unstaged > 0" class="rounded bg-amber-500/15 px-1 text-amber-500">
          mod {{ counts.unstaged }}
        </span>
        <span v-if="counts.untracked > 0" class="rounded bg-sky-500/15 px-1 text-sky-500">
          new {{ counts.untracked }}
        </span>
        <span v-if="counts.conflicted > 0" class="rounded bg-rose-500/15 px-1 text-rose-500">
          ⚠ {{ counts.conflicted }}
        </span>
      </div>
      <div v-else class="text-[10px] text-muted-foreground">변경사항 없음 ✓</div>

      <!-- quick tab buttons -->
      <div class="grid grid-cols-5 gap-1">
        <button
          v-for="t in QUICK_TABS"
          :key="t.key"
          type="button"
          class="flex flex-col items-center gap-0 rounded-md border border-border bg-card px-1 py-1 text-[10px] hover:bg-accent hover:text-accent-foreground"
          :title="t.title"
          @click="dispatchShortcut(t.key)"
        >
          <span class="text-sm leading-none">{{ t.icon }}</span>
          <span class="leading-tight">{{ t.label }}</span>
        </button>
      </div>

      <!-- c27-1 (ARCH-003 fix) — mini list 는 sub-component 로 분리.
           Phase 11-6 (issue #2 GitKraken parity) — MiniRemoteBranchList / MiniTagList 추가.
           Phase 12-1/2/3 — branch tree (LOCAL/REMOTE/TAGS) + 검색 query 통합 + MiniSubmoduleList. -->
      <MiniBranchList />
      <MiniRemoteBranchList />
      <MiniWorktreeList />
      <MiniStashList />
      <MiniSubmoduleList />
      <MiniPrList />
      <MiniTagList />
    </div>
  </div>
</template>
