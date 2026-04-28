<script setup lang="ts">
// Multi-repo Tab Bar — Sprint G (`docs/plan/11 §22`).
//
// 상단에 가로로 열린 레포 탭 strip 표시. drag-drop 으로 재정렬, ✕ 로 닫기.
// + 버튼 → RepoSwitcherModal 열어 새 탭 추가.
// 우클릭 메뉴 (Sprint 22-4 CM-7): Close / Close others / Close all / Move left / Move right.
//
// Sprint 22-14 M3 Tab overflow (design §8-1 hard constraint):
//  - 활성 탭 변경 시 자동 scrollIntoView (viewport 밖이면 보이게)
//  - 8 탭 초과 시 우측 끝 hint ("⌘T 로 검색") + scroll fade gradient (좌우 끝)
//  - 본격 "더 보기" dropdown 은 reka-ui Popover 도입 (Sprint B B-1) 후
//
// store.tabs ↔ Repo[] 매핑은 listRepos(null) 에서 (모든 workspace 통합).
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { VueDraggable } from 'vue-draggable-plus'
import { listRepos } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import type { Repo } from '@/types/git'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
import { visualWidth } from '@/utils/visualWidth'

// Sprint 22-14 M3: 탭 8개 초과 시 overflow 안내 표시.
const OVERFLOW_THRESHOLD = 8

const store = useReposStore()
const aliases = useRepoAliases()

defineEmits<{ openSwitcher: [] }>()

// 모든 레포 — tab id 의 정보를 빠르게 조회.
const reposQuery = useQuery({
  queryKey: ['repos-all-for-tabs'],
  queryFn: () => listRepos(null),
  staleTime: STALE_TIME.NORMAL,
})

const repoMap = computed<Map<number, Repo>>(() => {
  const m = new Map<number, Repo>()
  for (const r of reposQuery.data.value ?? []) m.set(r.id, r)
  return m
})

// VueDraggable 모델 — store.tabs 와 양방향. drag 끝나면 reorderTabs 호출.
const draggableTabs = computed<number[]>({
  get: () => store.tabs,
  set: (v) => store.reorderTabs(v),
})

function tabLabel(id: number): string {
  const r = repoMap.value.get(id)
  if (!r) return `repo:${id}`
  return aliases.resolveLocal(id, r.name).display
}

// Sprint 22-7 Q-3: 한글 tab label 은 시각 폭이 영문의 ~2배 →
// label visualWidth 가 일정 cell 초과 시 max-w 확장 (180px → 280px).
function tabLabelClass(id: number): string {
  const w = visualWidth(tabLabel(id))
  return w > 24 ? 'max-w-[280px]' : 'max-w-[180px]'
}

function tabSubtitle(id: number): string {
  const r = repoMap.value.get(id)
  if (!r) return ''
  const fk = r.forgeKind
  return fk !== 'unknown' ? `${fk} · ${r.forgeOwner ?? ''}/${r.forgeRepo ?? ''}` : r.localPath
}

function activate(id: number) {
  store.setActiveRepo(id)
}

function close(id: number, e: MouseEvent) {
  e.stopPropagation()
  store.closeTab(id)
}

function onMiddleClick(id: number, e: MouseEvent) {
  // 중간 버튼 클릭 = 탭 닫기 (브라우저 표준).
  if (e.button === 1) {
    e.preventDefault()
    store.closeTab(id)
  }
}

// === Sprint 22-4 CM-7: tab 우클릭 메뉴 ===
const tabCtxMenu = useTemplateRef<ContextMenuExpose>('tabCtxMenu')

function moveTab(id: number, delta: -1 | 1) {
  const idx = store.tabs.indexOf(id)
  if (idx < 0) return
  const target = idx + delta
  if (target < 0 || target >= store.tabs.length) return
  const next = [...store.tabs]
  ;[next[idx], next[target]] = [next[target], next[idx]]
  store.reorderTabs(next)
}

// Sprint 22-14 M3 — overflow 인디케이터 + 활성 탭 자동 scrollIntoView.
const tabContainerRef = useTemplateRef<HTMLElement>('tabContainerRef')
const isOverflow = computed(() => store.tabs.length > OVERFLOW_THRESHOLD)
const overflowHiddenCount = computed(() =>
  Math.max(0, store.tabs.length - OVERFLOW_THRESHOLD),
)

watch(
  () => store.activeRepoId,
  async (id) => {
    if (id == null) return
    await nextTick()
    const container = tabContainerRef.value
    if (!container) return
    // tab DOM 은 v-for 안에서 :key=id 로 렌더 — querySelector 로 활성 tab 검색.
    const el = container.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  },
)

function onTabContextMenu(ev: MouseEvent, id: number) {
  ev.preventDefault()
  ev.stopPropagation()
  const idx = store.tabs.indexOf(id)
  const total = store.tabs.length
  const items: ContextMenuItem[] = [
    { label: 'Close', icon: '✕', shortcut: 'Mid', action: () => store.closeTab(id) },
    {
      label: 'Close others',
      icon: '⊘',
      disabled: total <= 1,
      action: () => store.closeOthers(id),
    },
    {
      label: 'Close all',
      icon: '✕✕',
      destructive: true,
      action: () => {
        if (window.confirm(`${total}개 탭 모두 닫기?`)) store.closeAll()
      },
    },
    { divider: true },
    {
      label: 'Move left',
      icon: '←',
      disabled: idx <= 0,
      action: () => moveTab(id, -1),
    },
    {
      label: 'Move right',
      icon: '→',
      disabled: idx < 0 || idx >= total - 1,
      action: () => moveTab(id, 1),
    },
  ]
  tabCtxMenu.value?.openAt(ev, items)
}
</script>

<template>
  <div
    v-if="store.tabs.length > 0"
    class="flex items-center gap-0.5 border-b border-border bg-muted/40 px-1 py-0.5"
  >
    <!-- Sprint 22-14 M3: tab strip + overflow indicator (좌/우 fade + 우측 hint) -->
    <div ref="tabContainerRef" class="repo-tab-strip relative min-w-0 flex-1" :class="isOverflow ? 'has-overflow' : ''">
      <VueDraggable
        v-model="draggableTabs"
        :animation="150"
        class="flex items-center gap-0.5 overflow-x-auto"
        handle=".tab-handle"
      >
        <div
          v-for="id in draggableTabs"
          :key="id"
          :data-tab-id="id"
          class="tab-handle group flex shrink-0 cursor-pointer items-center gap-1 rounded-t border border-b-0 border-border px-2 py-1 text-[11px] hover:bg-accent/40"
          :class="
            store.activeRepoId === id
              ? 'bg-card text-foreground font-semibold'
              : 'bg-muted/20 text-muted-foreground'
          "
          :title="tabSubtitle(id)"
          @click="activate(id)"
          @mousedown="onMiddleClick(id, $event)"
          @contextmenu="onTabContextMenu($event, id)"
        >
        <span class="truncate" :class="tabLabelClass(id)">{{ tabLabel(id) }}</span>
        <button
          type="button"
          class="rounded text-muted-foreground opacity-50 hover:bg-destructive/40 hover:text-destructive-foreground hover:opacity-100"
          :title="`탭 닫기: ${tabLabel(id)}`"
          :aria-label="`탭 닫기: ${tabLabel(id)}`"
          @click="close(id, $event)"
        >
          ✕
        </button>
      </div>
    </VueDraggable>
    </div>
    <!-- Sprint 22-14 M3: 8개 초과 시 RepoSwitcher (⌘T) 안내 -->
    <button
      v-if="isOverflow"
      type="button"
      class="ml-1 shrink-0 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40"
      :title="`${overflowHiddenCount}+ 탭 — ⌘T 로 검색·전환`"
      :aria-label="`${overflowHiddenCount}개+ 탭이 가려져 있음. ⌘T 로 검색·전환`"
      @click="$emit('openSwitcher')"
    >
      ▾ {{ overflowHiddenCount }}+
    </button>
    <button
      type="button"
      class="ml-1 shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/40"
      title="새 탭 (⌘T)"
      aria-label="새 레포 탭 추가 (⌘T)"
      @click="$emit('openSwitcher')"
    >
      +
    </button>
    <ContextMenu ref="tabCtxMenu" />
  </div>
</template>

<style scoped>
/* Sprint 22-14 M3 — overflow fade gradient (좌/우 끝).
 * 8개 초과 (.has-overflow) 시 좌우 끝에 fade 표시 → 스크롤 가능 인지.
 */
.repo-tab-strip.has-overflow {
  position: relative;
}
.repo-tab-strip.has-overflow::before,
.repo-tab-strip.has-overflow::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  pointer-events: none;
  z-index: 1;
}
.repo-tab-strip.has-overflow::before {
  left: 0;
  background: linear-gradient(
    to right,
    hsl(var(--muted) / 0.6),
    transparent
  );
}
.repo-tab-strip.has-overflow::after {
  right: 0;
  background: linear-gradient(
    to left,
    hsl(var(--muted) / 0.6),
    transparent
  );
}
</style>
