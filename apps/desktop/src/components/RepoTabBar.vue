<script setup lang="ts">
// Multi-repo Tab Bar — Sprint G + Phase 11-7 (GitKraken parity issue #1).
//
// Phase 11-7: 2-level tab hierarchy.
//   Row 1 — 프로젝트 탭 (parentDirName 기반 그룹). 클릭 → 그 프로젝트 의 활성 레포 활성화.
//     Solo 레포 (그룹 없음) 는 단독으로 자기 자신 탭.
//   Row 2 — 활성 프로젝트의 레포 탭 (drag-reorder, 우클릭 메뉴, ✕ 닫기). 단독 프로젝트면 미표시.
//
// 기존 (Sprint G + 22-4 + 22-14):
//   - drag-drop 으로 재정렬 (Row 2 에서)
//   - 우클릭 메뉴: Close / Close others / Close all / Move left / Move right
//   - 8 탭 초과 시 overflow ▾ 인디케이터 + ⌘T RepoSwitcher
//   - 활성 탭 자동 scrollIntoView
//
// store.tabs ↔ Repo[] 매핑은 listRepos(null) 에서 (모든 workspace 통합).
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { VueDraggable } from 'vue-draggable-plus'
import { useNavigateHome } from '@/composables/useNavigateHome'
import { listRepos } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import type { Repo } from '@/types/git'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
// Sprint c33 — 프로젝트 그룹화 + drag-drop 모델 분리.
import { useTabGroups, type ProjectGroup } from '@/composables/useTabGroups'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
// Sprint c31 — BaseTooltip primitive (kbd hint 노출).
import BaseTooltip from './BaseTooltip.vue'
import { visualWidth } from '@/utils/visualWidth'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'

const { t } = useI18n()

const OVERFLOW_THRESHOLD = 8

const store = useReposStore()
const aliases = useRepoAliases()
// 탭/프로젝트 클릭 시 항상 홈(/) 으로 — 사용자가 어느 화면(settings, launchpad, repositories)
// 에 있어도 레포 컨텍스트로 자연스럽게 복귀. Sprint c50 — useNavigateHome composable (Pattern 8).
const goHome = useNavigateHome()

defineEmits<{ openSwitcher: [] }>()

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

function tabLabel(id: number): string {
  const r = repoMap.value.get(id)
  if (!r) return `repo:${id}`
  return aliases.resolveLocal(id, r.name).display
}

function tabSubtitle(id: number): string {
  const r = repoMap.value.get(id)
  if (!r) return ''
  const fk = r.forgeKind
  return fk !== 'unknown' ? `${fk} · ${r.forgeOwner ?? ''}/${r.forgeRepo ?? ''}` : r.localPath
}

function tabLabelClass(id: number): string {
  const w = visualWidth(tabLabel(id))
  return w > 24 ? 'max-w-[280px]' : 'max-w-[180px]'
}

// === Phase 11-7 — 프로젝트 그룹화 (Sprint c33 useTabGroups composable 위임) ===
const { projectGroups, activeGroup, activeGroupTabs, activateProject } = useTabGroups(repoMap)

function activate(id: number) {
  store.setActiveRepo(id)
  goHome()
}

function onActivateProject(g: ProjectGroup) {
  activateProject(g)
  goHome()
}

function close(id: number, e: MouseEvent) {
  e.stopPropagation()
  store.closeTab(id)
}

function onMiddleClick(id: number, e: MouseEvent) {
  if (e.button === 1) {
    e.preventDefault()
    store.closeTab(id)
  }
}

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

const tabContainerRef = useTemplateRef<HTMLElement>('tabContainerRef')
const isOverflow = computed(() => store.tabs.length > OVERFLOW_THRESHOLD)
const overflowHiddenCount = computed(() => Math.max(0, store.tabs.length - OVERFLOW_THRESHOLD))

watch(
  () => store.activeRepoId,
  async (id) => {
    if (id == null) return
    await nextTick()
    const container = tabContainerRef.value
    if (!container) return
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
        void (async () => {
          const ok = await confirmDialog({
            title: t('confirm.closeAllTabsTitle'),
            message: t('confirm.closeAllTabsMessage', { n: total }),
            danger: true,
          })
          if (ok) store.closeAll()
        })()
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

function onProjectContextMenu(ev: MouseEvent, g: ProjectGroup) {
  ev.preventDefault()
  ev.stopPropagation()
  const items: ContextMenuItem[] = [
    {
      label: `Close all in '${g.label}' (${g.tabIds.length})`,
      icon: '✕',
      destructive: g.tabIds.length > 1,
      action: () => {
        void (async () => {
          if (g.tabIds.length > 1) {
            const ok = await confirmDialog({
              title: t('confirm.closeGroupTabsTitle'),
              message: t('confirm.closeGroupTabsMessage', {
                n: g.tabIds.length,
                label: g.label,
              }),
              danger: true,
            })
            if (!ok) return
          }
          for (const id of g.tabIds) store.closeTab(id)
        })()
      },
    },
  ]
  tabCtxMenu.value?.openAt(ev, items)
}
</script>

<template>
  <!-- Phase 13-3 — 탭 0개여도 trailing slot (헤더 nav) 노출 위해 항상 렌더. -->
  <div class="flex flex-col border-b border-border bg-muted/40" data-testid="repo-tab-bar">
    <!-- Row 1 — 프로젝트 탭 (Phase 11-7).
         그룹 1개 + solo 면 단순 평면 표시 (label = repo 이름). -->
    <div class="flex items-center gap-0.5 px-1 pt-0.5">
      <button
        v-for="g in projectGroups"
        :key="g.key"
        type="button"
        :data-testid="`project-tab-${g.label}`"
        class="group flex shrink-0 cursor-pointer items-center gap-1 rounded-t border border-b-0 border-border px-2 py-0.5 text-[11px] hover:bg-accent/40"
        :class="
          activeGroup?.key === g.key
            ? 'bg-card text-foreground font-semibold'
            : 'bg-muted/20 text-muted-foreground'
        "
        :title="
          g.isSolo
            ? t('tabs.soloTitle', { label: g.label })
            : t('tabs.projectTitle', { label: g.label, n: g.tabIds.length })
        "
        @click="onActivateProject(g)"
        @contextmenu="onProjectContextMenu($event, g)"
      >
        <span class="text-[10px]">{{ g.isSolo ? '📁' : '📦' }}</span>
        <span class="truncate max-w-[180px]">{{ g.label }}</span>
        <span
          v-if="!g.isSolo && g.tabIds.length > 1"
          class="rounded bg-muted px-1 text-[9px] text-muted-foreground"
        >
          {{ g.tabIds.length }}
        </span>
      </button>
      <BaseTooltip
        v-if="isOverflow"
        :text="t('tabs.overflowTooltip', { n: overflowHiddenCount })"
        kbd="⌘T"
        placement="bottom"
      >
        <button
          type="button"
          class="ml-1 shrink-0 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40"
          @click="$emit('openSwitcher')"
        >
          ▾ {{ overflowHiddenCount }}+
        </button>
      </BaseTooltip>
      <BaseTooltip :text="t('tabs.newRepoTooltip')" kbd="⌘T" placement="bottom">
        <button
          type="button"
          class="ml-1 shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/40"
          :aria-label="t('templ.newRepoTab')"
          @click="$emit('openSwitcher')"
        >
          +
        </button>
      </BaseTooltip>
      <!-- Phase 13-3 — Row 1 우측 trailing slot (App.vue 헤더 nav 통합). -->
      <div class="ml-auto flex shrink-0 items-center">
        <slot name="trailing" />
      </div>
    </div>

    <!-- Row 2 — 활성 프로젝트의 레포 탭. solo 그룹이면 미표시 (Row 1 이 곧 레포). -->
    <div
      v-if="activeGroup && !activeGroup.isSolo && activeGroup.tabIds.length > 0"
      ref="tabContainerRef"
      class="repo-tab-strip relative min-w-0 border-t border-border/50 bg-card/30 px-2 py-0.5"
      :class="isOverflow ? 'has-overflow' : ''"
      data-testid="active-project-repo-row"
    >
      <VueDraggable
        v-model="activeGroupTabs"
        :animation="150"
        class="flex items-center gap-0.5 overflow-x-auto"
        handle=".tab-handle"
      >
        <div
          v-for="id in activeGroupTabs"
          :key="id"
          :data-tab-id="id"
          class="tab-handle group flex shrink-0 cursor-pointer items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[11px] hover:bg-accent/40"
          :class="
            store.activeRepoId === id
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'bg-card text-muted-foreground'
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
            :title="t('tabs.closeTab', { label: tabLabel(id) })"
            :aria-label="t('tabs.closeTab', { label: tabLabel(id) })"
            @click="close(id, $event)"
          >
            ✕
          </button>
        </div>
      </VueDraggable>
    </div>

    <ContextMenu ref="tabCtxMenu" />
  </div>
</template>

<style scoped>
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
  background: linear-gradient(to right, hsl(var(--muted) / 0.6), transparent);
}
.repo-tab-strip.has-overflow::after {
  right: 0;
  background: linear-gradient(to left, hsl(var(--muted) / 0.6), transparent);
}
</style>
