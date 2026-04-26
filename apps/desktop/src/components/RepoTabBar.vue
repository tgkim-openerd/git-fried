<script setup lang="ts">
// Multi-repo Tab Bar — Sprint G (`docs/plan/11 §22`).
//
// 상단에 가로로 열린 레포 탭 strip 표시. drag-drop 으로 재정렬, ✕ 로 닫기.
// + 버튼 → RepoSwitcherModal 열어 새 탭 추가.
// 우클릭 메뉴: Close / Close others / Close all / Pin (다음 sprint).
//
// store.tabs ↔ Repo[] 매핑은 listRepos(null) 에서 (모든 workspace 통합).
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { VueDraggable } from 'vue-draggable-plus'
import { listRepos } from '@/api/git'
import type { Repo } from '@/types/git'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'

const store = useReposStore()
const aliases = useRepoAliases()

defineEmits<{ openSwitcher: [] }>()

// 모든 레포 — tab id 의 정보를 빠르게 조회.
const reposQuery = useQuery({
  queryKey: ['repos-all-for-tabs'],
  queryFn: () => listRepos(null),
  staleTime: 30_000,
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
</script>

<template>
  <div
    v-if="store.tabs.length > 0"
    class="flex items-center gap-0.5 border-b border-border bg-muted/40 px-1 py-0.5"
  >
    <VueDraggable
      v-model="draggableTabs"
      :animation="150"
      class="flex items-center gap-0.5 overflow-x-auto"
      handle=".tab-handle"
    >
      <div
        v-for="id in draggableTabs"
        :key="id"
        class="tab-handle group flex shrink-0 cursor-pointer items-center gap-1 rounded-t border border-b-0 border-border px-2 py-1 text-[11px] hover:bg-accent/40"
        :class="
          store.activeRepoId === id
            ? 'bg-card text-foreground font-semibold'
            : 'bg-muted/20 text-muted-foreground'
        "
        :title="tabSubtitle(id)"
        @click="activate(id)"
        @mousedown="onMiddleClick(id, $event)"
      >
        <span class="max-w-[180px] truncate">{{ tabLabel(id) }}</span>
        <button
          type="button"
          class="rounded text-muted-foreground opacity-50 hover:bg-destructive/40 hover:text-destructive-foreground hover:opacity-100"
          :title="`탭 닫기: ${tabLabel(id)}`"
          @click="close(id, $event)"
        >
          ✕
        </button>
      </div>
    </VueDraggable>
    <button
      type="button"
      class="ml-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/40"
      title="새 탭 (⌘T)"
      @click="$emit('openSwitcher')"
    >
      +
    </button>
  </div>
</template>
