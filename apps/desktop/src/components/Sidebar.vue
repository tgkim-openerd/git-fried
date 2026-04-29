<script setup lang="ts">
// Phase 11-6 (GitKraken parity issue #2) — Sidebar 활성 레포 카테고리 전용.
//
// Before (758 LOC): 워크스페이스 dropdown + 레포 (151) 평면 리스트 + INTEGRATIONS + ActiveRepoQuickActions
//   → 사용자 피드백 "워크스페이스와 리포지토리들이 같이 섞여서 난잡함"
// After (~80 LOC): compact 워크스페이스 selector + RouterLink to /repositories + ActiveRepoQuickActions body
//   → GitKraken 스타일 (좌측 = 활성 레포 LOCAL/REMOTE/WORKTREES/STASHES/PR/TAGS 카테고리)
//
// 이전된 기능:
//   - 레포 list / 검색 / 그룹 / pin / alias / context menu  → /repositories 페이지 (Phase 11-4)
//   - 워크스페이스 편집 / 신규  → /settings + /repositories
//   - INTEGRATIONS placeholder  → /settings (또는 v0.4 시점 부활)
//   - 일괄 fetch  → /repositories 의 [⤓ Fetch All]

import { computed, useTemplateRef } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter, RouterLink } from 'vue-router'
import { listWorkspaces } from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { useShortcut } from '@/composables/useShortcuts'
import { useToast } from '@/composables/useToast'
import { useSidebarSearch } from '@/composables/useSidebarSearch'
import ActiveRepoQuickActions from './ActiveRepoQuickActions.vue'

const store = useReposStore()
const qc = useQueryClient()
const toast = useToast()
const router = useRouter()
const search = useSidebarSearch()
const searchInputRef = useTemplateRef<HTMLInputElement>('searchInput')

const { data: workspaces } = useQuery({
  queryKey: ['workspaces'],
  queryFn: listWorkspaces,
})

const activeWorkspace = computed(
  () => workspaces.value?.find((w) => w.id === store.activeWorkspaceId) ?? null,
)

// 외부 (App.vue) 트리거 — File 메뉴 'Reload Repositories'.
window.gitFriedReloadRepos = () => {
  qc.invalidateQueries({ queryKey: ['repos'] })
  qc.invalidateQueries({ queryKey: ['repos-all-for-tabs'] })
  qc.invalidateQueries({ queryKey: ['repos-all-for-management'] })
  qc.invalidateQueries({ queryKey: ['workspaces'] })
  toast.success('레포 reload', '워크스페이스/레포 목록 갱신 중')
}

// Phase 12-2 — ⌘⌥F = sidebar 검색 input focus (예전 동작 복원).
//   /repositories 페이지 진입은 헤더 "레포" RouterLink + ⌘⇧R 메뉴.
function focusSidebarSearch() {
  const el = searchInputRef.value
  if (!el) {
    // sidebar hidden 시 fallback — /repositories 로 이동.
    void router.push('/repositories')
    return
  }
  el.focus()
  el.select()
}
window.gitFriedFocusRepoFilter = focusSidebarSearch
useShortcut('filterRepos', focusSidebarSearch)
</script>

<template>
  <aside
    data-testid="sidebar"
    class="flex h-screen flex-col border-r border-border bg-card text-card-foreground"
  >
    <header class="flex items-center justify-between border-b border-border px-3 py-2">
      <span class="font-mono text-sm font-semibold tracking-tight">git-fried</span>
      <span class="text-[10px] text-muted-foreground">v0.0</span>
    </header>

    <!-- Workspace context (compact) + 레포 페이지 진입.
         워크스페이스 변경/관리는 /repositories 또는 /settings. -->
    <section class="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
      <span
        v-if="activeWorkspace?.color"
        class="inline-block h-3 w-3 shrink-0 rounded-full"
        :style="{ backgroundColor: activeWorkspace.color }"
        :title="activeWorkspace.name"
      />
      <select
        :value="store.activeWorkspaceId ?? ''"
        @change="
          (e) =>
            store.setActiveWorkspace(
              ((e.target as HTMLSelectElement).value
                ? Number((e.target as HTMLSelectElement).value)
                : null) as never,
            )
        "
        class="flex-1 rounded-md border border-input bg-background px-2 py-0.5 text-xs"
        :title="activeWorkspace ? `워크스페이스: ${activeWorkspace.name}` : '전체 워크스페이스'"
      >
        <option value="">전체</option>
        <option v-for="w in workspaces" :key="w.id" :value="w.id">
          {{ w.name }}
        </option>
      </select>
      <RouterLink
        to="/repositories"
        data-testid="sidebar-repo-management-link"
        class="rounded-md border border-input px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
        title="모든 레포 관리 (Browse / Clone / 프로젝트 그룹) — ⌘⇧R"
      >
        📂 레포
      </RouterLink>
    </section>

    <!-- Phase 12-2 — sidebar 통합 검색 input (LOCAL/REMOTE/WORKTREES/STASHES/PR/TAGS/SUBMODULES filter). -->
    <section class="border-b border-border px-3 py-1.5">
      <div class="relative">
        <input
          ref="searchInput"
          v-model="search.query.value"
          type="search"
          data-testid="sidebar-search"
          placeholder="검색 (브랜치 / 태그 / submodule) — ⌘⌥F"
          class="w-full rounded border border-input bg-background px-2 py-1 pr-6 text-xs outline-none focus:border-primary"
        />
        <button
          v-if="search.isActive.value"
          type="button"
          class="absolute right-1 top-1/2 -translate-y-1/2 rounded text-[10px] text-muted-foreground hover:text-foreground"
          title="검색 지우기"
          aria-label="검색 지우기"
          @click="search.clear()"
        >
          ✕
        </button>
      </div>
    </section>

    <!-- Phase 11-6 — Sidebar body = 활성 레포 카테고리.
         LOCAL / REMOTE / WORKTREES / STASHES / SUBMODULES / PR / TAGS (각 collapsible).
         Phase 12-1: branch / tag tree (prefix `/` 자동 nesting). -->
    <div class="flex-1 overflow-y-auto">
      <ActiveRepoQuickActions />
    </div>

    <footer class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
      Tauri 2 · Vue 3 · Rust
    </footer>
  </aside>
</template>
