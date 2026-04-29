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
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import {
  addRepo,
  bulkFetch,
  listRepos,
  listWorkspaces,
  openInExplorer,
  setRepoPinned,
} from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import { useSidebarGroups, type GroupMode } from '@/composables/useSidebarGroups'
import { useBulkQuickStatus } from '@/composables/useBulkQuickStatus'
import { useToast } from '@/composables/useToast'
import { describeError, humanizeGitError } from '@/api/errors'
import { useBulkFetchResult } from '@/composables/useBulkFetchResult'
import CloneRepoModal from '@/components/CloneRepoModal.vue'
import BulkFetchResultModal from '@/components/BulkFetchResultModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import type { Repo } from '@/types/git'

const router = useRouter()
const store = useReposStore()
const aliases = useRepoAliases()
const toast = useToast()
const qc = useQueryClient()

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

// 활성 탭 / 즐겨찾기 분리 표시.
const openTabRepos = computed<Repo[]>(() => {
  const map = new Map((allRepos.value ?? []).map((r) => [r.id, r]))
  return store.tabs.map((id) => map.get(id)).filter((r): r is Repo => r != null)
})
const favoriteRepos = computed<Repo[]>(() => (allRepos.value ?? []).filter((r) => r.isPinned))

// === Mutations ===
const addRepoMut = useMutation({
  mutationFn: addRepo,
  onSuccess: () => qc.invalidateQueries({ queryKey: ['repos-all-for-management'] }),
})

const pinMut = useMutation({
  mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) => setRepoPinned(id, pinned),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['repos-all-for-management'] }),
})

const bulkFetchMut = useMutation({
  mutationFn: () => bulkFetch(null),
  onSuccess: (results) => {
    qc.invalidateQueries({ queryKey: ['status'] })
    qc.invalidateQueries({ queryKey: ['log'] })
    qc.invalidateQueries({ queryKey: ['graph'] })
    qc.invalidateQueries({ queryKey: ['branches'] })
    bulkResultStore.set(results)
    const failed = results.filter((r) => !r.success)
    const ok = results.length - failed.length
    if (failed.length > 0) {
      const PREVIEW = 5
      const lines = failed
        .slice(0, PREVIEW)
        .map((f) => `- ${f.repoName}: ${humanizeGitError((f.error || '').split('\n')[0] || '')}`)
      if (failed.length > PREVIEW) {
        lines.push(`...외 ${failed.length - PREVIEW}개 — 📡 버튼으로 전체 보기`)
      }
      toast.warning(
        `일괄 Fetch: ${ok}/${results.length} 성공 (${failed.length} 실패)`,
        lines.join('\n'),
      )
    } else if (results.length > 0) {
      toast.success(`일괄 Fetch 완료 (${ok} 레포)`)
    }
  },
  onError: (e) => toast.error('일괄 Fetch 실패', describeError(e)),
})

// === Actions ===
async function browseAndAdd() {
  try {
    const selected = await openDialog({ directory: true, multiple: false })
    if (typeof selected === 'string' && selected) {
      addRepoMut.mutate({ localPath: selected })
    }
  } catch (e) {
    toast.error('폴더 선택 실패', describeError(e))
  }
}

function openRepo(repo: Repo) {
  store.openTab(repo.id)
  void router.push('/')
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
          title="로컬 폴더 선택 → 레포 추가"
          @click="browseAndAdd"
        >
          📂 Browse
        </button>
        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent"
          title="원격 URL 에서 clone (sparse / shallow 옵션)"
          @click="cloneOpen = true"
        >
          ⬇ Clone
        </button>
        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          :disabled="bulkFetchMut.isPending.value || (allRepos?.length ?? 0) === 0"
          :title="`전체 ${allRepos?.length ?? 0} 레포 일괄 fetch`"
          @click="bulkFetchMut.mutate()"
        >
          {{ bulkFetchMut.isPending.value ? '⟳ Fetching...' : '⤓ Fetch All' }}
        </button>
        <button
          v-if="bulkResultStore.last.value"
          type="button"
          class="relative rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent"
          :title="
            bulkResultFailedCount > 0
              ? `최근 일괄 fetch — ${bulkResultFailedCount}개 실패, 자세히 보기`
              : '최근 일괄 fetch 결과'
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
          title="설정 → 워크스페이스 관리"
          @click="router.push('/settings')"
        >
          ⚙ Workspaces
        </button>
      </div>
    </header>

    <!-- Toolbar — 검색 + 그룹 모드 + 카운트 -->
    <div class="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-2">
      <input
        v-model="filter"
        type="search"
        placeholder="레포 검색 (이름 / 별칭 / org / 경로)"
        class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      <div class="flex items-center gap-1 text-xs text-muted-foreground">
        <span class="mr-1">그룹:</span>
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
          {{ m === 'directory' ? '폴더' : m === 'org' ? 'Org' : 'Forge' }}
        </button>
      </div>
      <span class="text-xs text-muted-foreground">총 {{ filteredRepos.length }}</span>
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
          <span v-if="isFetching" class="text-[10px] normal-case">로딩...</span>
        </h2>

        <LoadingSpinner
          v-if="isFetching && (allRepos?.length ?? 0) === 0"
          label="레포 목록 로딩 중..."
          size="sm"
        />

        <EmptyState
          v-else-if="filteredRepos.length === 0"
          icon="📁"
          :title="filter ? `'${filter}' 매칭 없음` : '레포 없음'"
          :description="
            filter ? '검색어를 변경해 보세요.' : '우상단 [Browse] 또는 [Clone] 으로 시작하세요.'
          "
          size="sm"
        />

        <template v-else>
          <details
            v-for="g in groups"
            :key="g.key"
            open
            class="mb-3 rounded-md border border-border bg-card/30"
          >
            <summary
              class="cursor-pointer select-none rounded-t-md px-3 py-2 text-sm font-semibold hover:bg-accent/30"
            >
              <span v-if="g.label">📦 {{ g.label }}</span>
              <span v-else class="text-muted-foreground italic">기타</span>
              <span
                class="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
              >
                {{ g.repos.length }}
              </span>
            </summary>
            <ul class="space-y-0.5 border-t border-border/50 px-2 py-1">
              <li
                v-for="repo in g.repos"
                :key="repo.id"
                class="group flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent/40"
              >
                <button
                  type="button"
                  class="flex flex-1 items-center gap-2 text-left text-sm"
                  :class="store.activeRepoId === repo.id ? 'font-semibold text-foreground' : ''"
                  @click="openRepo(repo)"
                >
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
                  title="OS 파일 매니저로 열기"
                  @click.stop="openInExplorer(repo.id)"
                >
                  📂
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
