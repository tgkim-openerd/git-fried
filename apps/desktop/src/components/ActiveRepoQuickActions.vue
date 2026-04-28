<script setup lang="ts">
// Sprint c25-3 step 1 (`docs/plan/25 §4`) — 좌측 Sidebar 하단 mini section.
// Sprint c27-1 (ARCH-003 fix) — God component 해소. 4 mini list 는 별도 sub-component 로 분리.
//
// 본 컴포넌트의 책임 = 활성 레포 status header + 5 quick tab btn 만.
// Branch / Stash / Worktree / PR 리스트는 각각 MiniXxxList.vue 가 자체 data + UI 책임.

import { computed } from 'vue'
import { useStatus } from '@/composables/useStatus'
import { useStatusCounts } from '@/composables/useStatusCounts'
import { dispatchShortcut, type ShortcutAction } from '@/composables/useShortcuts'
import { useReposStore } from '@/stores/repos'
import { useSectionCollapse } from '@/composables/useSectionCollapse'
import MiniBranchList from './MiniBranchList.vue'
import MiniStashList from './MiniStashList.vue'
import MiniWorktreeList from './MiniWorktreeList.vue'
import MiniPrList from './MiniPrList.vue'

const store = useReposStore()
const collapsed = useSectionCollapse('active-repo-quick')

const repoIdRef = computed(() => store.activeRepoId)
const { data: status } = useStatus(repoIdRef)
// ARCH-006 — useStatusCounts 단일 진실원천.
const { counts } = useStatusCounts(repoIdRef)

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)

// 7-tab 단축 버튼 — pages/index.vue 의 useShortcut('tab1'~'tab7') 로 dispatch.
// (변경/브랜치/Stash/Sub/LFS/PR/WT 매핑)
// TYPE-006 — key: ShortcutAction 명시.
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
  <details
    class="border-t border-border bg-muted/20"
    :open="!collapsed"
    @toggle="(e: ToggleEvent) => (collapsed = !(e.target as HTMLDetailsElement).open)"
  >
    <summary
      class="cursor-pointer select-none px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      활성 레포
      <span v-if="store.activeRepoId == null" class="ml-1 font-normal normal-case text-muted-foreground/70">(미선택)</span>
    </summary>

    <div v-if="store.activeRepoId != null" class="space-y-2 px-3 pb-2">
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

      <!-- c27-1 (ARCH-003 fix) — 4 mini list 는 sub-component 로 분리. -->
      <MiniBranchList />
      <MiniStashList />
      <MiniWorktreeList />
      <MiniPrList />
    </div>
  </details>
</template>
