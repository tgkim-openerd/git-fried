<script setup lang="ts">
// 워크스페이스 + 레포 사이드바.
// 추가 기능 (v0.1 S4):
//   - 듀얼 레포 자동 그룹핑 (예: peeloff/frontend + peeloff/frontend-admin)
//   - 워크스페이스 전체 일괄 Fetch 버튼
import { computed } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { open } from '@tauri-apps/plugin-dialog'
import { addRepo, bulkFetch, listRepos, listWorkspaces, setRepoPinned } from '@/api/git'
import { useMutation } from '@tanstack/vue-query'
import { humanizeGitError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import type { Repo } from '@/types/git'

const toast = useToast()

const store = useReposStore()
const qc = useQueryClient()

const { data: workspaces } = useQuery({
  queryKey: ['workspaces'],
  queryFn: listWorkspaces,
})

const { data: repos, isFetching } = useQuery({
  queryKey: computed(() => ['repos', store.activeWorkspaceId]),
  queryFn: () => listRepos(store.activeWorkspaceId),
})

const addRepoMutation = useMutation({
  mutationFn: addRepo,
  onSuccess: () => qc.invalidateQueries({ queryKey: ['repos'] }),
})

const bulkFetchMut = useMutation({
  mutationFn: () => bulkFetch(store.activeWorkspaceId),
  onSuccess: (results) => {
    qc.invalidateQueries({ queryKey: ['status'] })
    qc.invalidateQueries({ queryKey: ['log'] })
    qc.invalidateQueries({ queryKey: ['graph'] })
    qc.invalidateQueries({ queryKey: ['branches'] })
    const failed = results.filter((r) => !r.success)
    const ok = results.length - failed.length
    if (failed.length > 0) {
      const detail = failed
        .slice(0, 5)
        .map(
          (f) =>
            `- ${f.repoName}: ${humanizeGitError((f.error || '').split('\n')[0] || '')}`,
        )
        .join('\n')
      toast.warning(
        `일괄 Fetch: ${ok}/${results.length} 성공 (${failed.length} 실패)`,
        detail,
      )
    } else if (results.length > 0) {
      toast.success(`일괄 Fetch 완료 (${ok} 레포)`)
    }
  },
})

async function pickAndAddRepo() {
  const selected = await open({ directory: true, multiple: false })
  if (typeof selected === 'string' && selected) {
    addRepoMutation.mutate({
      localPath: selected,
      workspaceId: store.activeWorkspaceId,
    })
  }
}

function selectRepo(id: number) {
  store.setActiveRepo(id)
}

const pinMut = useMutation({
  mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
    setRepoPinned(id, pinned),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['repos'] }),
})

function togglePin(repo: Repo, e: Event) {
  e.stopPropagation()
  pinMut.mutate({ id: repo.id, pinned: !repo.isPinned })
}

// === 듀얼 레포 그룹핑 ===
//
// peeloff/frontend + peeloff/frontend-admin 같은 패턴 자동 감지:
// localPath 의 부모 디렉토리 이름이 같으면 같은 그룹으로 묶음.
interface RepoGroup {
  key: string
  label: string | null
  repos: Repo[]
}

const groups = computed<RepoGroup[]>(() => {
  if (!repos.value) return []
  const map = new Map<string, Repo[]>()
  for (const r of repos.value) {
    const key = parentDirName(r.localPath) || '__solo__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  const result: RepoGroup[] = []
  for (const [key, list] of map.entries()) {
    if (list.length === 1) {
      result.push({ key, label: null, repos: list })
    } else {
      result.push({ key, label: key, repos: list })
    }
  }
  // 그룹 우선 → solo 알파벳
  result.sort((a, b) => {
    if (a.label && !b.label) return -1
    if (!a.label && b.label) return 1
    return (a.label || a.repos[0].name).localeCompare(b.label || b.repos[0].name)
  })
  return result
})

function parentDirName(p: string): string | null {
  // 윈도/유닉스 둘 다 처리
  const norm = p.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = norm.split('/')
  return parts.length >= 2 ? parts[parts.length - 2] : null
}
</script>

<template>
  <aside
    class="flex h-screen flex-col border-r border-border bg-card text-card-foreground"
  >
    <header
      class="flex items-center justify-between border-b border-border px-4 py-3"
    >
      <span class="font-mono text-sm font-semibold tracking-tight">git-fried</span>
      <span class="text-xs text-muted-foreground">v0.0</span>
    </header>

    <!-- 워크스페이스 + 일괄 Fetch -->
    <section class="border-b border-border px-3 py-2">
      <label class="text-xs uppercase tracking-wider text-muted-foreground">
        워크스페이스
      </label>
      <div class="mt-1 flex gap-1">
        <select
          :value="store.activeWorkspaceId ?? ''"
          @change="
            (e) =>
              store.setActiveWorkspace(
                ((e.target as HTMLSelectElement).value || null) as never,
              )
          "
          class="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="">전체</option>
          <option v-for="w in workspaces" :key="w.id" :value="w.id">
            {{ w.name }}
          </option>
        </select>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          :disabled="bulkFetchMut.isPending.value || !repos || repos.length === 0"
          :title="`현재 ${repos?.length ?? 0}개 레포 일괄 fetch`"
          @click="bulkFetchMut.mutate()"
        >
          {{ bulkFetchMut.isPending.value ? '⟳' : '⤓' }}
        </button>
      </div>
    </section>

    <!-- 레포 리스트 (그룹 + solo) -->
    <section class="flex-1 overflow-auto">
      <div class="flex items-center justify-between px-3 py-2">
        <span class="text-xs uppercase tracking-wider text-muted-foreground">
          레포 ({{ repos?.length ?? 0 }})
        </span>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 text-xs hover:bg-accent"
          :disabled="addRepoMutation.isPending.value"
          @click="pickAndAddRepo"
        >
          + 추가
        </button>
      </div>

      <ul class="px-1 pb-3">
        <template v-for="g in groups" :key="g.key">
          <!-- 그룹 헤더 (듀얼 레포만) -->
          <li
            v-if="g.label"
            class="mt-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            ⇆ {{ g.label }}
          </li>
          <li
            v-for="repo in g.repos"
            :key="repo.id"
            class="group cursor-pointer rounded-md py-1 text-sm hover:bg-accent"
            :class="[
              g.label ? 'pl-5 pr-2' : 'px-2',
              store.activeRepoId === repo.id ? 'bg-accent text-accent-foreground' : '',
            ]"
            @click="selectRepo(repo.id)"
          >
            <div class="flex items-center justify-between gap-1">
              <span class="flex flex-1 items-center gap-1 truncate">
                <button
                  type="button"
                  class="shrink-0 text-xs"
                  :class="
                    repo.isPinned
                      ? 'text-amber-500'
                      : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-amber-500'
                  "
                  :title="repo.isPinned ? 'Unpin' : 'Pin'"
                  @click="togglePin(repo, $event)"
                >
                  {{ repo.isPinned ? '⭐' : '☆' }}
                </button>
                <span class="truncate">{{ repo.name }}</span>
              </span>
              <span
                v-if="repo.forgeKind !== 'unknown'"
                class="ml-2 shrink-0 rounded bg-muted px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                {{ repo.forgeKind }}
              </span>
            </div>
            <div
              v-if="repo.defaultBranch"
              class="truncate text-[11px] text-muted-foreground"
              :class="g.label ? 'pl-5' : 'pl-4'"
            >
              {{ repo.defaultBranch }}
            </div>
          </li>
        </template>

        <li
          v-if="!isFetching && (!repos || repos.length === 0)"
          class="px-2 py-3 text-xs text-muted-foreground"
        >
          레포가 없습니다. 우측 상단 [+ 추가] 로 시작.
        </li>
      </ul>
    </section>

    <footer
      class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground"
    >
      Tauri 2 · Vue 3 · Rust
    </footer>
  </aside>
</template>
