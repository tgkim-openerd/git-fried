<script setup lang="ts">
// 워크스페이스 + 레포 사이드바.
// 추가 기능 (v0.1 S4):
//   - 듀얼 레포 자동 그룹핑 (예: peeloff/frontend + peeloff/frontend-admin)
//   - 워크스페이스 전체 일괄 Fetch 버튼
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { open } from '@tauri-apps/plugin-dialog'
import {
  addRepo,
  bulkFetch,
  createWorkspace,
  deleteWorkspace,
  listRepos,
  listWorkspaces,
  setRepoPinned,
  updateWorkspace,
} from '@/api/git'
import { useMutation } from '@tanstack/vue-query'
import { humanizeGitError, describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import type { Repo } from '@/types/git'

// Sprint B9 — Sidebar 그룹핑 모드 (디렉토리 / org) + workspace color 편집.
// localStorage 영속.
type GroupMode = 'directory' | 'org'
const GROUP_KEY = 'git-fried.sidebar-group-mode'
function loadGroupMode(): GroupMode {
  if (typeof localStorage === 'undefined') return 'directory'
  const v = localStorage.getItem(GROUP_KEY)
  return v === 'org' ? 'org' : 'directory'
}

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

// === 그룹핑 ===
//
// 두 가지 모드:
//   - directory: 부모 디렉토리 이름 (예: peeloff/frontend + peeloff/frontend-admin)
//   - org: forge_owner (예: opnd-frontend/x + opnd-frontend/y → "opnd-frontend")
//
// 사용자가 회사 50+ 레포를 organization 별 그룹화 — Sprint B9 (`docs/plan/11 §22`).
interface RepoGroup {
  key: string
  label: string | null
  repos: Repo[]
}

const groupMode = ref<GroupMode>(loadGroupMode())
function setGroupMode(m: GroupMode) {
  groupMode.value = m
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GROUP_KEY, m)
    } catch {
      /* ignore */
    }
  }
}

function groupKey(r: Repo): string {
  if (groupMode.value === 'org') {
    return r.forgeOwner ?? '__no-org__'
  }
  return parentDirName(r.localPath) ?? '__solo__'
}

const groups = computed<RepoGroup[]>(() => {
  if (!repos.value) return []
  const map = new Map<string, Repo[]>()
  for (const r of repos.value) {
    const k = groupKey(r)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  const result: RepoGroup[] = []
  for (const [key, list] of map.entries()) {
    const isSolo =
      key === '__solo__' || key === '__no-org__' || list.length === 1
    if (isSolo) {
      result.push({ key, label: null, repos: list })
    } else {
      result.push({ key, label: key, repos: list })
    }
  }
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

// === Workspace color / 신규 / 편집 (Sprint B9) ===
const newWorkspaceName = ref('')
const newWorkspaceColor = ref('#0ea5e9')
const editingWorkspaceId = ref<number | null>(null)

const COLOR_PRESETS = [
  '#0ea5e9', // sky
  '#22c55e', // green
  '#f59e0b', // amber
  '#a78bfa', // violet
  '#f43f5e', // rose
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#ef4444', // red
  '#6b7280', // gray
] as const

const createWorkspaceMut = useMutation({
  mutationFn: () =>
    createWorkspace(newWorkspaceName.value.trim(), newWorkspaceColor.value),
  onSuccess: () => {
    newWorkspaceName.value = ''
    qc.invalidateQueries({ queryKey: ['workspaces'] })
  },
  onError: (e) => toast.error('워크스페이스 생성 실패', describeError(e)),
})

const updateWorkspaceMut = useMutation({
  mutationFn: ({
    id,
    name,
    color,
  }: {
    id: number
    name?: string | null
    color?: string | null
  }) => updateWorkspace(id, name, color),
  onSuccess: () => {
    editingWorkspaceId.value = null
    qc.invalidateQueries({ queryKey: ['workspaces'] })
  },
  onError: (e) => toast.error('워크스페이스 수정 실패', describeError(e)),
})

const deleteWorkspaceMut = useMutation({
  mutationFn: (id: number) => deleteWorkspace(id),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['workspaces'] })
    qc.invalidateQueries({ queryKey: ['repos'] })
    if (store.activeWorkspaceId != null) store.setActiveWorkspace(null)
  },
  onError: (e) => toast.error('워크스페이스 삭제 실패', describeError(e)),
})

const activeWorkspace = computed(() =>
  workspaces.value?.find((w) => w.id === store.activeWorkspaceId),
)

function confirmDeleteWorkspace() {
  const w = activeWorkspace.value
  if (!w) return
  if (
    confirm(`워크스페이스 '${w.name}' 삭제? 레포는 보존되고 그룹 해제만.`)
  ) {
    deleteWorkspaceMut.mutate(w.id)
  }
}

function tryCreateWorkspace() {
  if (newWorkspaceName.value.trim()) createWorkspaceMut.mutate()
}

// === Repo alias (Sprint B4) ===
const aliases = useRepoAliases()
const editingAliasRepoId = ref<number | null>(null)
const editingAliasValue = ref('')
const editingAliasScope = ref<'profile' | 'global'>('profile')

function startEditAlias(r: Repo) {
  editingAliasRepoId.value = r.id
  editingAliasValue.value = aliases.activeAliasFor(r.id) ?? ''
  editingAliasScope.value =
    aliases.activeProfileId.value != null ? 'profile' : 'global'
}

function commitEditAlias() {
  const id = editingAliasRepoId.value
  if (id == null) return
  const v = editingAliasValue.value.trim()
  const profileId =
    editingAliasScope.value === 'profile'
      ? aliases.activeProfileId.value
      : null
  if (!v) {
    aliases.unsetMut.mutate({ repoId: id, profileId })
  } else {
    aliases.setMut.mutate({ repoId: id, profileId, alias: v })
  }
  editingAliasRepoId.value = null
}

function cancelEditAlias() {
  editingAliasRepoId.value = null
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
      <div class="mt-1 flex items-center gap-1">
        <span
          v-if="activeWorkspace?.color"
          class="inline-block h-3 w-3 shrink-0 rounded-full"
          :style="{ backgroundColor: activeWorkspace.color }"
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
          class="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="">전체</option>
          <option v-for="w in workspaces" :key="w.id" :value="w.id">
            {{ w.name }}
          </option>
        </select>
        <button
          v-if="activeWorkspace"
          type="button"
          class="rounded-md border border-input px-1.5 py-1 text-xs hover:bg-accent"
          title="워크스페이스 편집"
          @click="editingWorkspaceId = activeWorkspace.id"
        >
          ⚙
        </button>
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

      <!-- 워크스페이스 편집 inline (color picker + name + delete) -->
      <div
        v-if="editingWorkspaceId != null && activeWorkspace"
        class="mt-2 rounded border border-border bg-muted/20 p-2"
      >
        <input
          :value="activeWorkspace.name"
          class="mb-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
          @change="(e) => updateWorkspaceMut.mutate({
            id: activeWorkspace!.id,
            name: (e.target as HTMLInputElement).value,
          })"
        />
        <div class="mb-1 flex flex-wrap gap-1">
          <button
            v-for="c in COLOR_PRESETS"
            :key="c"
            type="button"
            class="h-5 w-5 rounded-full ring-2"
            :class="
              activeWorkspace.color === c
                ? 'ring-foreground'
                : 'ring-transparent hover:ring-muted-foreground'
            "
            :style="{ backgroundColor: c }"
            @click="updateWorkspaceMut.mutate({
              id: activeWorkspace!.id,
              color: c,
            })"
          />
        </div>
        <div class="flex justify-between gap-1 text-[10px]">
          <button
            type="button"
            class="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10"
            @click="confirmDeleteWorkspace"
          >
            삭제
          </button>
          <button
            type="button"
            class="rounded border border-input px-2 py-0.5 hover:bg-accent"
            @click="editingWorkspaceId = null"
          >
            닫기
          </button>
        </div>
      </div>

      <!-- 신규 워크스페이스 -->
      <details class="mt-1 text-[11px]">
        <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
          + 새 워크스페이스
        </summary>
        <div class="mt-1 flex flex-col gap-1">
          <input
            v-model="newWorkspaceName"
            placeholder="이름 (예: 회사)"
            class="rounded border border-input bg-background px-2 py-1 text-xs"
            @keyup.enter="tryCreateWorkspace"
          />
          <div class="flex flex-wrap gap-1">
            <button
              v-for="c in COLOR_PRESETS"
              :key="c"
              type="button"
              class="h-4 w-4 rounded-full ring-2"
              :class="
                newWorkspaceColor === c
                  ? 'ring-foreground'
                  : 'ring-transparent hover:ring-muted-foreground'
              "
              :style="{ backgroundColor: c }"
              @click="newWorkspaceColor = c"
            />
            <button
              type="button"
              class="ml-auto rounded border border-input px-2 py-0.5 text-[10px] hover:bg-accent disabled:opacity-50"
              :disabled="!newWorkspaceName.trim() || createWorkspaceMut.isPending.value"
              @click="createWorkspaceMut.mutate()"
            >
              생성
            </button>
          </div>
        </div>
      </details>
    </section>

    <!-- 레포 리스트 (그룹 + solo) -->
    <section class="flex-1 overflow-auto">
      <div class="flex items-center justify-between gap-1 px-3 py-2">
        <span class="text-xs uppercase tracking-wider text-muted-foreground">
          레포 ({{ repos?.length ?? 0 }})
        </span>
        <div class="flex gap-1 text-[10px]">
          <button
            v-for="m in (['directory', 'org'] as GroupMode[])"
            :key="m"
            type="button"
            class="rounded px-1.5 py-0.5 border border-input"
            :class="
              groupMode === m
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/40'
            "
            :title="m === 'directory' ? '부모 디렉토리 그룹' : 'forge organization 그룹'"
            @click="setGroupMode(m)"
          >
            {{ m === 'directory' ? '폴더' : 'Org' }}
          </button>
          <button
            type="button"
            class="rounded-md border border-input px-2 py-0.5 hover:bg-accent"
            :disabled="addRepoMutation.isPending.value"
            @click="pickAndAddRepo"
          >
            + 추가
          </button>
        </div>
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
                <template v-if="editingAliasRepoId === repo.id">
                  <input
                    v-model="editingAliasValue"
                    autofocus
                    class="flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs"
                    :placeholder="repo.name"
                    @click.stop
                    @keyup.enter.stop="commitEditAlias"
                    @keyup.esc.stop="cancelEditAlias"
                    @blur="commitEditAlias"
                  />
                  <select
                    :value="editingAliasScope"
                    class="rounded border border-input bg-background px-1 py-0.5 text-[10px]"
                    @click.stop
                    @change="(e) => (editingAliasScope = (e.target as HTMLSelectElement).value as 'profile' | 'global')"
                  >
                    <option
                      value="profile"
                      :disabled="aliases.activeProfileId.value == null"
                    >
                      profile
                    </option>
                    <option value="global">global</option>
                  </select>
                </template>
                <template v-else>
                  <span class="flex-1 truncate" :title="aliases.resolveLocal(repo.id, repo.name).aliased ? `별칭 (원본: ${repo.name})` : repo.name">
                    <span :class="aliases.resolveLocal(repo.id, repo.name).aliased ? 'italic' : ''">
                      {{ aliases.resolveLocal(repo.id, repo.name).display }}
                    </span>
                  </span>
                  <button
                    type="button"
                    class="shrink-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                    title="별칭 편집"
                    @click.stop="startEditAlias(repo)"
                  >
                    ✏
                  </button>
                </template>
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
