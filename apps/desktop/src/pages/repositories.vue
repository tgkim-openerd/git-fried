<script setup lang="ts">
// Repository Management — Phase 11-4 (GitKraken parity issue #1).
//
// 좌측 sidebar 의 평면 레포 목록을 dedicated 페이지로 분리.
// GitKraken Repository Management (image 4/5) 와 비슷한 구조:
//   - 헤더: Browse / Clone / + Init / + Workspace
//   - 섹션: Open repositories (활성 탭) / Favorites (pinned) / 프로젝트 그룹 (CarMain ▾)
//   - 검색 + 그룹 모드 (directory / org / forge)
//
// Sidebar.vue 와 동일 데이터 소스 (listRepos + useSidebarGroups) — single source.

import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { listRepos, listWorkspaces, openInExplorer } from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import { useSidebarGroups, type GroupMode, type RepoGroup } from '@/composables/useSidebarGroups'
import { useGroupCollapse } from '@/composables/useGroupCollapse'
import { useNavigateHome } from '@/composables/useNavigateHome'
import { useBulkQuickStatus } from '@/composables/useBulkQuickStatus'
import { useToast } from '@/composables/useToast'
import { describeError } from '@/api/errors'
import { useI18n } from 'vue-i18n'
import { useBulkFetchResult } from '@/composables/useBulkFetchResult'
// Sprint c80-1 — 3 mutation 통합 composable 위임.
import { useRepoManagementMutations } from '@/composables/useRepoManagementMutations'
import { confirmDialog, promptDialog } from '@/composables/useConfirm'
import CloneRepoModal from '@/components/CloneRepoModal.vue'
import BulkFetchResultModal from '@/components/BulkFetchResultModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import type { Repo } from '@/types/git'

const router = useRouter()
const goHome = useNavigateHome()
const store = useReposStore()
const aliases = useRepoAliases()
const toast = useToast()
const { t } = useI18n()

const cloneOpen = ref(false)
const filter = ref('')
const bulkResultOpen = ref(false)
const bulkResultStore = useBulkFetchResult()
const bulkResultFailedCount = computed(
  () => bulkResultStore.last.value?.results.filter((r) => !r.success).length ?? 0,
)

const { data: workspaces } = useQuery({
  queryKey: ['workspaces'],
  queryFn: listWorkspaces,
})

// Repository Management 는 모든 워크스페이스 통합 — `listRepos(null)` 사용.
const { data: allRepos, isFetching } = useQuery({
  queryKey: ['repos-all-for-management'],
  queryFn: () => listRepos(null),
})

const quickStatus = useBulkQuickStatus(() => null)

// 검색 필터 — name / alias / forge owner / path 부분 매칭.
const filteredRepos = computed<readonly Repo[]>(() => {
  const list = allRepos.value ?? []
  const q = filter.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((r) => {
    const display = aliases.resolveLocal(r.id, r.name).display
    return (
      r.name.toLowerCase().includes(q) ||
      display.toLowerCase().includes(q) ||
      (r.forgeOwner ?? '').toLowerCase().includes(q) ||
      r.localPath.toLowerCase().includes(q)
    )
  })
})

// 그룹 모드 (Sidebar 와 동일 useSidebarGroups composable 재사용 — localStorage 공유).
const { groupMode, setGroupMode, groups } = useSidebarGroups(filteredRepos)

// Sprint c50 — useGroupCollapse composable (Pattern 10) 위임.
const { collapsedKeys, allCollapsed, isOpen, setOpen, collapseAll, expandAll } =
  useGroupCollapse(groups)

// 그룹 ⊕ 액션 — 그 그룹의 모든 레포 탭 추가 + 첫 활성 (pinned 우선) + 홈으로.
// Sprint c50 — Pattern 9 (caller-decision): caller 정렬 → store.openRepoGroup 위임 → caller 가 router 결정.
function openGroupAll(g: RepoGroup): void {
  const sorted = [...g.repos].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return aliases
      .resolveLocal(a.id, a.name)
      .display.localeCompare(aliases.resolveLocal(b.id, b.name).display)
  })
  if (store.openRepoGroup(sorted)) goHome()
}

// 활성 탭 / 즐겨찾기 분리 표시.
const openTabRepos = computed<Repo[]>(() => {
  const map = new Map((allRepos.value ?? []).map((r) => [r.id, r]))
  return store.tabs.map((id) => map.get(id)).filter((r): r is Repo => r != null)
})
const favoriteRepos = computed<Repo[]>(() => (allRepos.value ?? []).filter((r) => r.isPinned))

// c80-1 — 3 mutation (addRepo/pin/bulkFetch + bulk 결과 toast) composable 위임.
const { addRepoMut, pinMut, bulkFetchMut, removeRepoMut } = useRepoManagementMutations({
  bulkResultStore,
})

// === Actions ===
async function browseAndAdd() {
  try {
    const selected = await openDialog({ directory: true, multiple: false })
    if (typeof selected === 'string' && selected) {
      addRepoMut.mutate({ localPath: selected })
    }
  } catch (e) {
    toast.error(t('errors.folderSelectFailed'), describeError(e))
  }
}

function openRepo(repo: Repo) {
  store.openTab(repo.id)
  goHome()
}

// R2-R2 — 저장소 별칭 인라인 편집 (현재 프로필 기준).
async function onEditAlias(repo: Repo) {
  const current = aliases.activeAliasFor(repo.id) ?? ''
  const next = await promptDialog({
    title: t('repos.aliasPromptTitle'),
    message: t('repos.aliasPromptMessage', { name: repo.name }),
    defaultValue: current,
  })
  if (next === null) return
  const trimmed = next.trim()
  const profileId = aliases.activeProfileId.value
  if (trimmed) {
    aliases.setMut.mutate({ repoId: repo.id, profileId, alias: trimmed })
  } else if (current) {
    aliases.unsetMut.mutate({ repoId: repo.id, profileId })
  }
}

// R2-R1 — 저장소 추적 해제 (confirm 후 removeRepo IPC).
async function onRemoveRepo(repo: Repo) {
  const ok = await confirmDialog({
    title: t('confirm.untrackRepoTitle'),
    message: t('confirm.untrackRepoMessage', {
      name: aliases.resolveLocal(repo.id, repo.name).display,
    }),
    danger: true,
  })
  if (ok) removeRepoMut.mutate(repo.id)
}

function repoBranch(id: number): string | null {
  return quickStatus.value.byId.get(id)?.branch ?? null
}

function repoAhead(id: number): number {
  return quickStatus.value.byId.get(id)?.ahead ?? 0
}

function repoBehind(id: number): number {
  return quickStatus.value.byId.get(id)?.behind ?? 0
}

function workspaceName(id: number | null): string {
  if (id == null) return '-'
  return workspaces.value?.find((w) => w.id === id)?.name ?? `ws:${id}`
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-background">
    <!-- Header bar — 4 액션 버튼 -->
    <header class="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
      <h1 class="text-lg font-semibold text-foreground">Repository Management</h1>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          :disabled="addRepoMut.isPending.value"
          :title="t('repos.browseTitle')"
          @click="browseAndAdd"
        >
          📂 Browse
        </button>
        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent"
          :title="t('repos.cloneTitle')"
          @click="cloneOpen = true"
        >
          ⬇ Clone
        </button>
        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          :disabled="bulkFetchMut.isPending.value || (allRepos?.length ?? 0) === 0"
          :title="t('repos.fetchAllTitle', { n: allRepos?.length ?? 0 })"
          @click="bulkFetchMut.mutate()"
        >
          {{ bulkFetchMut.isPending.value ? t('repos.fetching') : t('repos.fetchAllBtn') }}
        </button>
        <button
          v-if="bulkResultStore.last.value"
          type="button"
          class="relative rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent"
          :title="
            bulkResultFailedCount > 0
              ? t('repos.bulkResultFailed', { n: bulkResultFailedCount })
              : t('repos.bulkResultRecent')
          "
          @click="bulkResultOpen = true"
        >
          📡
          <span
            v-if="bulkResultFailedCount > 0"
            class="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white"
          >
            {{ bulkResultFailedCount > 99 ? '99+' : bulkResultFailedCount }}
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent"
          :title="t('repos.workspacesBtnTitle')"
          @click="router.push('/settings')"
        >
          ⚙ {{ t('repos.workspacesBtnLabel') }}
        </button>
      </div>
    </header>

    <!-- Toolbar — 검색 + 그룹 모드 + 카운트 -->
    <div class="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-2">
      <input
        v-model="filter"
        type="search"
        :placeholder="t('repos.searchPlaceholder')"
        class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      <div class="flex items-center gap-1 text-xs text-muted-foreground">
        <span class="mr-1">{{ t('repos.groupLabel') }}</span>
        <button
          v-for="m in ['directory', 'org', 'forge'] as GroupMode[]"
          :key="m"
          type="button"
          class="rounded border border-input px-2 py-1"
          :class="
            groupMode === m
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:bg-accent/40'
          "
          @click="setGroupMode(m)"
        >
          {{ m === 'directory' ? t('repos.groupModeFolder') : m === 'org' ? 'Org' : 'Forge' }}
        </button>
      </div>
      <!-- Sprint c49 — Collapse/Expand all (GitKraken parity). -->
      <div class="flex items-center gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          class="rounded border border-input px-2 py-1 hover:bg-accent/40 disabled:opacity-50"
          :disabled="groups.length === 0 || allCollapsed"
          :title="t('repos.collapseAllTitle', { n: groups.length })"
          @click="collapseAll"
        >
          {{ t('repos.collapseAll') }}
        </button>
        <button
          type="button"
          class="rounded border border-input px-2 py-1 hover:bg-accent/40 disabled:opacity-50"
          :disabled="groups.length === 0 || collapsedKeys.size === 0"
          :title="t('repos.expandAllTitle', { n: groups.length })"
          @click="expandAll"
        >
          {{ t('repos.expandAll') }}
        </button>
      </div>
      <span class="text-xs text-muted-foreground">{{
        t('repos.totalCount', { n: filteredRepos.length })
      }}</span>
    </div>

    <!-- 본문 — Open / Favorites / All -->
    <div class="flex-1 overflow-auto px-4 py-3">
      <!-- Open repositories (현재 탭) -->
      <section v-if="openTabRepos.length > 0" class="mb-4">
        <h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Open repositories
          <span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
            {{ openTabRepos.length }}
          </span>
        </h2>
        <ul class="space-y-1">
          <li
            v-for="repo in openTabRepos"
            :key="repo.id"
            class="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 hover:bg-accent/40"
          >
            <button
              type="button"
              class="flex flex-1 items-center gap-2 text-left"
              :class="store.activeRepoId === repo.id ? 'font-semibold text-foreground' : ''"
              @click="openRepo(repo)"
            >
              <span class="text-xs text-muted-foreground">📁</span>
              <span class="flex-1 truncate text-sm">
                {{ aliases.resolveLocal(repo.id, repo.name).display }}
              </span>
              <span v-if="repoBranch(repo.id)" class="font-mono text-xs text-muted-foreground">
                {{ repoBranch(repo.id) }}
              </span>
              <span v-if="repoAhead(repo.id)" class="text-xs text-emerald-500">
                ↑{{ repoAhead(repo.id) }}
              </span>
              <span v-if="repoBehind(repo.id)" class="text-xs text-rose-500">
                ↓{{ repoBehind(repo.id) }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <!-- Favorites (pinned) -->
      <section v-if="favoriteRepos.length > 0" class="mb-4">
        <h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          ⭐ Favorites
          <span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
            {{ favoriteRepos.length }}
          </span>
        </h2>
        <ul class="space-y-1">
          <li
            v-for="repo in favoriteRepos"
            :key="repo.id"
            class="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 hover:bg-accent/40"
          >
            <button
              type="button"
              class="flex flex-1 items-center gap-2 text-left"
              @click="openRepo(repo)"
            >
              <span class="text-xs text-amber-500">⭐</span>
              <span class="flex-1 truncate text-sm">
                {{ aliases.resolveLocal(repo.id, repo.name).display }}
              </span>
              <span v-if="repoBranch(repo.id)" class="font-mono text-xs text-muted-foreground">
                {{ repoBranch(repo.id) }}
              </span>
            </button>
            <button
              type="button"
              class="rounded text-xs text-amber-500 hover:opacity-80"
              :title="`'${repo.name}' Unpin`"
              @click.stop="pinMut.mutate({ id: repo.id, pinned: false })"
            >
              ☆
            </button>
          </li>
        </ul>
      </section>

      <!-- All repositories — 프로젝트 그룹 -->
      <section>
        <h2
          class="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          <span>
            All repositories
            <span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {{ filteredRepos.length }}
            </span>
          </span>
          <span v-if="isFetching" class="text-[10px] normal-case">{{ t('repos.loading') }}</span>
        </h2>

        <LoadingSpinner
          v-if="isFetching && (allRepos?.length ?? 0) === 0"
          :label="t('repos.loadingDetail')"
          size="sm"
        />

        <EmptyState
          v-else-if="filteredRepos.length === 0"
          icon="📁"
          :title="filter ? t('repos.emptyMatchedTitle', { filter }) : t('repos.emptyTitle')"
          :description="filter ? t('repos.emptyMatchedDescription') : t('repos.emptyDescription')"
          size="sm"
        />

        <template v-else>
          <details
            v-for="g in groups"
            :key="g.key"
            :open="isOpen(g.key)"
            class="group mb-3 rounded-md border border-border bg-card/30"
            @toggle="(e) => setOpen(g.key, (e.currentTarget as HTMLDetailsElement).open)"
          >
            <summary
              class="flex cursor-pointer select-none items-center justify-between gap-2 rounded-t-md px-3 py-2 text-sm font-semibold hover:bg-accent/30 [&::-webkit-details-marker]:hidden"
            >
              <span class="flex flex-1 items-center gap-2 truncate">
                <!-- Sprint c50 — design-verify Critical 1: native <details> marker 가 flex summary 에서 가려져
                     명시 ▼/▶ 추가 (isOpen 으로 양방향 동기화 — Pattern 10). -->
                <span class="w-3 text-[10px] text-muted-foreground">{{
                  isOpen(g.key) ? '▼' : '▶'
                }}</span>
                <span v-if="g.label">📦 {{ g.label }}</span>
                <span v-else class="text-muted-foreground italic">{{
                  t('repos.miscGroupLabel')
                }}</span>
                <span
                  class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
                >
                  {{ g.repos.length }}
                </span>
              </span>
              <!-- Sprint c49 — 그룹 hover ⊕: 그룹 모든 레포 탭 추가. label 있는 그룹만. -->
              <button
                v-if="g.label && g.repos.length > 0"
                type="button"
                class="rounded p-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                :title="t('repos.openGroupAllTitle', { label: g.label, n: g.repos.length })"
                :aria-label="t('repos.openGroupAllAriaLabel', { label: g.label })"
                @click.stop.prevent="openGroupAll(g)"
              >
                {{ t('repos.openGroupAllBtn') }}
              </button>
            </summary>
            <ul class="space-y-0.5 border-t border-border/50 px-2 py-1">
              <li
                v-for="repo in g.repos"
                :key="repo.id"
                :data-testid="`repositories-repo-${repo.name}`"
                class="group flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent/40"
              >
                <!-- Phase 11-4 — nested button HTML 위반 회피: pin 은 sibling, 행 본체는 div + click. -->
                <button
                  type="button"
                  class="text-xs"
                  :class="
                    repo.isPinned
                      ? 'text-amber-500'
                      : 'text-muted-foreground/40 group-hover:text-muted-foreground hover:text-amber-500'
                  "
                  :title="repo.isPinned ? 'Unpin' : 'Pin'"
                  @click.stop="pinMut.mutate({ id: repo.id, pinned: !repo.isPinned })"
                >
                  {{ repo.isPinned ? '⭐' : '☆' }}
                </button>
                <button
                  type="button"
                  class="flex flex-1 items-center gap-2 text-left text-sm"
                  :class="store.activeRepoId === repo.id ? 'font-semibold text-foreground' : ''"
                  @click="openRepo(repo)"
                >
                  <span class="flex-1 truncate">
                    {{ aliases.resolveLocal(repo.id, repo.name).display }}
                  </span>
                  <span
                    v-if="repo.forgeKind !== 'unknown'"
                    class="rounded bg-muted px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {{ repo.forgeKind }}
                  </span>
                  <span v-if="repoBranch(repo.id)" class="font-mono text-xs text-muted-foreground">
                    {{ repoBranch(repo.id) }}
                  </span>
                  <span v-if="repoAhead(repo.id)" class="text-xs text-emerald-500">
                    ↑{{ repoAhead(repo.id) }}
                  </span>
                  <span v-if="repoBehind(repo.id)" class="text-xs text-rose-500">
                    ↓{{ repoBehind(repo.id) }}
                  </span>
                </button>
                <button
                  type="button"
                  class="rounded p-1 text-xs opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                  :title="t('repos.openInExplorerTitle')"
                  @click.stop="openInExplorer(repo.id)"
                >
                  📂
                </button>
                <!-- R2-R2 — 별칭 편집 -->
                <button
                  type="button"
                  class="rounded p-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  :title="t('repos.aliasEditTitle')"
                  @click.stop="onEditAlias(repo)"
                >
                  ✎
                </button>
                <!-- R2-R1 — 추적 해제 -->
                <button
                  type="button"
                  class="rounded p-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                  :title="t('repos.removeTitle')"
                  :disabled="removeRepoMut.isPending.value"
                  @click.stop="onRemoveRepo(repo)"
                >
                  ✕
                </button>
                <span
                  v-if="repo.workspaceId != null"
                  class="hidden text-[10px] text-muted-foreground/70 sm:inline"
                  :title="`workspace: ${workspaceName(repo.workspaceId)}`"
                >
                  {{ workspaceName(repo.workspaceId) }}
                </span>
              </li>
            </ul>
          </details>
        </template>
      </section>
    </div>

    <CloneRepoModal :open="cloneOpen" :workspace-id="null" @close="cloneOpen = false" />
    <BulkFetchResultModal :open="bulkResultOpen" @close="bulkResultOpen = false" />
  </div>
</template>
