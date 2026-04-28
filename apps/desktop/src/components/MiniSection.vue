<script setup lang="ts">
// Sprint c27-1 (`docs/plan/25 §c27-1`, ARCH-003 fix) — Sidebar mini section 공통 wrapper.
//
// ActiveRepoQuickActions 의 4 mini list (Branches / Stash / Worktree / PR) 가 동일한
// collapsible header + body slot + '전체 →' 버튼 구조를 4번 복붙. SOLID Single Responsibility
// 위반 해소 — 각 list 의 data fetching + UI rendering 책임을 분리.
//
// 사용법:
//   <MiniSection
//     title="로컬 브랜치"
//     :count="localBranches.length"
//     storage-key="active-repo-quick.branches"
//     full-tooltip="전체 브랜치 패널 (⌘B)"
//     :on-full="() => dispatchShortcut('newBranch')"
//   >
//     <ul>...rows...</ul>
//   </MiniSection>

import { useSectionCollapse } from '@/composables/useSectionCollapse'

const props = defineProps<{
  /** 섹션 제목 (uppercase 표기). */
  title: string
  /** 항목 개수 — title 옆 괄호 표시. */
  count: number
  /** localStorage 영속 키 (`active-repo-quick.{name}` prefix 사용). */
  storageKey: string
  /** '전체 →' 버튼 tooltip (생략 시 버튼 미표시). */
  fullTooltip?: string
}>()

const emit = defineEmits<{
  full: []
}>()

const collapsed = useSectionCollapse(props.storageKey)
</script>

<template>
  <div class="mt-1 space-y-0.5">
    <div class="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
      <button
        type="button"
        class="flex flex-1 items-center gap-1 hover:text-foreground"
        :title="`${title} 섹션 ${collapsed ? '펴기' : '접기'}`"
        @click="collapsed = !collapsed"
      >
        <span class="text-[9px]">{{ collapsed ? '▶' : '▼' }}</span>
        <span>{{ title }} ({{ count }})</span>
      </button>
      <button
        v-if="!collapsed && fullTooltip"
        type="button"
        class="rounded px-1 hover:bg-accent/40 hover:text-foreground"
        :title="fullTooltip"
        @click="emit('full')"
      >
        전체 →
      </button>
    </div>
    <slot v-if="!collapsed" />
  </div>
</template>
