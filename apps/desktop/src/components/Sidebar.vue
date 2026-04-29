<script setup lang="ts">
// 워크스페이스 + 레포 사이드바.
// 추가 기능 (v0.1 S4):
//   - 듀얼 레포 자동 그룹핑 (예: peeloff/frontend + peeloff/frontend-admin)
//   - 워크스페이스 전체 일괄 Fetch 버튼
import { computed, ref, useTemplateRef } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { open } from '@tauri-apps/plugin-dialog'
import {
  addRepo,
  bulkFetch,
  fetchAll,
  listRepos,
  listWorkspaces,
  maintenanceGc,
  openInExplorer,
  removeRepo,
  setRepoPinned,
} from '@/api/git'
import { useMutation } from '@tanstack/vue-query'
import { humanizeGitError, describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import { useSidebarFilter } from '@/composables/useSidebarFilter'
import { useSidebarGroups } from '@/composables/useSidebarGroups'
import { useWorkspaceMutations } from '@/composables/useWorkspaceMutations'
import { useShortcut } from '@/composables/useShortcuts'
import { useNotification } from '@/composables/useNotification'
import BulkFetchResultModal from './BulkFetchResultModal.vue'
import CloneRepoModal from './CloneRepoModal.vue'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import EmptyState from './EmptyState.vue'
import { useBulkFetchResult } from '@/composables/useBulkFetchResult'
import { useBulkQuickStatus } from '@/composables/useBulkQuickStatus'
import PlaceholderButton from './PlaceholderButton.vue'
// Sprint c25-3 step 1 — 좌측 sidebar 풍부화의 첫 진입 (uy `docs/plan/25 §4`).
import ActiveRepoQuickActions from './ActiveRepoQuickActions.vue'
import type { Repo } from '@/types/git'

// Sprint C14-2 (`docs/plan/14 §6 E1+E2`): Clone with sparse/shallow options.
const cloneOpen = ref(false)

// Sprint 22-1 R-2A C1: bulk fetch 결과 5+ 실패 시 toast 절단 해소.
const bulkResultStore = useBulkFetchResult()
const bulkResultOpen = ref(false)
const bulkResultFailedCount = computed(
  () => bulkResultStore.last.value?.results.filter((r) => !r.success).length ?? 0,
)

// Sprint B9 — Sidebar 그룹핑 모드 (디렉토리 / org). composables/useSidebarGroups.ts 로 추출 (Sidebar 분리 2/N).
// type / load / persist / groups computed 모두 composable 내부.
import type { GroupMode } from '@/composables/useSidebarGroups'

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

// Sprint 22-11 F-P3 — Sidebar 50+ repo "어느 레포 작업할까" preview.
// branch + ahead/behind 만 일괄 조회 (~50× lightweight). repo row default branch line 옆에 ↑↓ 표시.
const quickStatus = useBulkQuickStatus(() => store.activeWorkspaceId)

function repoBranch(repoId: number): string | null {
  return quickStatus.value.byId.get(repoId)?.branch ?? null
}
function repoAhead(repoId: number): number {
  return quickStatus.value.byId.get(repoId)?.ahead ?? 0
}
function repoBehind(repoId: number): number {
  return quickStatus.value.byId.get(repoId)?.behind ?? 0
}

const addRepoMutation = useMutation({
  mutationFn: addRepo,
  onSuccess: () => qc.invalidateQueries({ queryKey: ['repos'] }),
})

const notification = useNotification()
const bulkFetchMut = useMutation({
  mutationFn: () => bulkFetch(store.activeWorkspaceId),
  onSuccess: (results) => {
    qc.invalidateQueries({ queryKey: ['status'] })
    qc.invalidateQueries({ queryKey: ['log'] })
    qc.invalidateQueries({ queryKey: ['graph'] })
    qc.invalidateQueries({ queryKey: ['branches'] })
    // R-2A C1: 결과 전체 globalState 보관 — 사용자가 "최근 결과" 버튼으로 detail 열람.
    bulkResultStore.set(results)
    const failed = results.filter((r) => !r.success)
    const ok = results.length - failed.length
    if (failed.length > 0) {
      const PREVIEW = 5
      const lines = failed
        .slice(0, PREVIEW)
        .map((f) => `- ${f.repoName}: ${humanizeGitError((f.error || '').split('\n')[0] || '')}`)
      if (failed.length > PREVIEW) {
        lines.push(`...외 ${failed.length - PREVIEW}개 — 좌상단 📡 버튼으로 전체 보기`)
      }
      toast.warning(
        `일괄 Fetch: ${ok}/${results.length} 성공 (${failed.length} 실패)`,
        lines.join('\n'),
      )
      void notification.notify(`일괄 Fetch: ${ok}/${results.length}`, `${failed.length}개 실패`)
    } else if (results.length > 0) {
      toast.success(`일괄 Fetch 완료 (${ok} 레포)`)
      void notification.notify('일괄 Fetch 완료', `${ok} 레포`)
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
  mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) => setRepoPinned(id, pinned),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['repos'] }),
})

function togglePin(repo: Repo, e: Event) {
  e.stopPropagation()
  pinMut.mutate({ id: repo.id, pinned: !repo.isPinned })
}

// alias resolver — 필터 / 별칭 표시에 일찍 사용. 원래 below 였으나 hoist.
const aliases = useRepoAliases()

// Sprint I — Sidebar 레포 필터 (⌘⌥F). composables/useSidebarFilter.ts 로 추출 (Sidebar God comp 1/N).
const filterInputRef = useTemplateRef<HTMLInputElement>('filterInput')
const { repoFilter, filteredRepos } = useSidebarFilter(repos, (id, fallback) =>
  aliases.resolveLocal(id, fallback),
)

// 외부 (App.vue) 에서 호출 가능 — sidebar 가 hidden 일 때 App.vue 가 toggle 후 호출.
function focusRepoFilter() {
  filterInputRef.value?.focus()
  filterInputRef.value?.select()
}
window.gitFriedFocusRepoFilter = focusRepoFilter

// Phase 10-6 — 네이티브 메뉴 'File > Reload Repositories' bridge.
window.gitFriedReloadRepos = () => {
  qc.invalidateQueries({ queryKey: ['repos'] })
  qc.invalidateQueries({ queryKey: ['repos-all-for-tabs'] })
  qc.invalidateQueries({ queryKey: ['workspaces'] })
  toast.success('레포 reload', '워크스페이스/레포 목록 갱신 중')
}

useShortcut('filterRepos', focusRepoFilter)

// Sprint B9 — directory / org 그룹핑. composables/useSidebarGroups.ts 로 추출 (Sidebar 분리 2/N).
const { groupMode, setGroupMode, groups } = useSidebarGroups(filteredRepos)

// === Workspace mutations (Sprint c29-2 — composables/useWorkspaceMutations 로 추출) ===
const ws = useWorkspaceMutations(() => workspaces.value)
// 기존 코드 호환성 위해 alias 노출 (template binding 영향 최소).
const newWorkspaceName = ws.newName
const newWorkspaceColor = ws.newColor
const editingWorkspaceId = ws.editingId
const COLOR_PRESETS = ws.colorPresets
const createWorkspaceMut = ws.createMut
const updateWorkspaceMut = ws.updateMut
// deleteWorkspaceMut 는 confirmDeleteWorkspace 내부에서 ws 통해 호출 — 별도 노출 불필요
const activeWorkspace = ws.activeWorkspace
const confirmDeleteWorkspace = ws.confirmDelete
const tryCreateWorkspace = ws.tryCreate

// === Repo alias (Sprint B4) === — `aliases` 는 위에서 hoist (Sprint I).
const editingAliasRepoId = ref<number | null>(null)
const editingAliasValue = ref('')
const editingAliasScope = ref<'profile' | 'global'>('profile')

function startEditAlias(r: Repo) {
  editingAliasRepoId.value = r.id
  editingAliasValue.value = aliases.activeAliasFor(r.id) ?? ''
  editingAliasScope.value = aliases.activeProfileId.value != null ? 'profile' : 'global'
}

function commitEditAlias() {
  const id = editingAliasRepoId.value
  if (id == null) return
  const v = editingAliasValue.value.trim()
  const profileId = editingAliasScope.value === 'profile' ? aliases.activeProfileId.value : null
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

// === Sprint 22-4 CM-6: Sidebar repo row 우클릭 (8 액션) ===
const repoCtxMenu = useTemplateRef<ContextMenuExpose>('repoCtxMenu')

const removeRepoMut = useMutation({
  mutationFn: (id: number) => removeRepo(id),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['repos'] })
    qc.invalidateQueries({ queryKey: ['repos-all-for-tabs'] })
  },
  onError: (e) => toast.error('레포 제거 실패', describeError(e)),
})

const fetchOneMut = useMutation({
  mutationFn: (id: number) => fetchAll(id),
  onSuccess: (_r, id) => {
    qc.invalidateQueries({ queryKey: ['status'] })
    qc.invalidateQueries({ queryKey: ['log'] })
    qc.invalidateQueries({ queryKey: ['graph'] })
    qc.invalidateQueries({ queryKey: ['branches'] })
    toast.success('Fetch 완료', `repo:${id}`)
  },
  onError: (e) => toast.error('Fetch 실패', describeError(e)),
})

const gcMut = useMutation({
  mutationFn: ({ id, aggressive }: { id: number; aggressive: boolean }) =>
    maintenanceGc(id, aggressive),
  onSuccess: () => toast.success('git gc 완료', ''),
  onError: (e) => toast.error('git gc 실패', describeError(e)),
})

async function copyRepoPath(p: string) {
  try {
    await navigator.clipboard.writeText(p)
    toast.success('경로 복사', p)
  } catch (e) {
    toast.error('복사 실패', describeError(e))
  }
}

function onRepoContextMenu(ev: MouseEvent, repo: Repo) {
  ev.preventDefault()
  ev.stopPropagation()
  const isActive = store.activeRepoId === repo.id
  const items: ContextMenuItem[] = [
    {
      label: 'Open in Explorer',
      icon: '📂',
      action: () => void openInExplorer(repo.id),
    },
    {
      label: 'Copy path',
      icon: '📋',
      action: () => void copyRepoPath(repo.localPath),
    },
    { divider: true },
    {
      label: isActive ? 'Set as active (이미 활성)' : 'Set as active',
      icon: '⊙',
      disabled: isActive,
      action: () => selectRepo(repo.id),
    },
    {
      label: 'Fetch only this',
      icon: '⬇',
      action: () => fetchOneMut.mutate(repo.id),
    },
    { divider: true },
    {
      label: repo.isPinned ? 'Unpin ★' : 'Pin ☆',
      icon: repo.isPinned ? '⭐' : '☆',
      action: () => pinMut.mutate({ id: repo.id, pinned: !repo.isPinned }),
    },
    {
      label: 'Set alias / Rename',
      icon: '✏',
      action: () => startEditAlias(repo),
    },
    { divider: true },
    {
      label: 'Run gc (housekeeping)',
      icon: '🧹',
      submenu: [
        { label: 'gc', action: () => gcMut.mutate({ id: repo.id, aggressive: false }) },
        {
          label: 'gc --aggressive (오래 걸림)',
          destructive: true,
          action: () => {
            if (window.confirm(`'${repo.name}' aggressive gc — 수 분 소요. 진행?`)) {
              gcMut.mutate({ id: repo.id, aggressive: true })
            }
          },
        },
      ],
    },
    { divider: true },
    {
      label: 'Remove from workspace',
      icon: '🗑',
      destructive: true,
      action: () => {
        if (window.confirm(`레포 '${repo.name}' 를 워크스페이스에서 제거? (디스크 파일은 보존)`)) {
          removeRepoMut.mutate(repo.id)
        }
      },
    },
  ]
  repoCtxMenu.value?.openAt(ev, items)
}
</script>

<template>
  <aside class="flex h-screen flex-col border-r border-border bg-card text-card-foreground">
    <header class="flex items-center justify-between border-b border-border px-4 py-3">
      <span class="font-mono text-sm font-semibold tracking-tight">git-fried</span>
      <span class="text-xs text-muted-foreground">v0.0</span>
    </header>

    <!-- 워크스페이스 + 일괄 Fetch -->
    <section class="border-b border-border px-3 py-2">
      <label class="text-xs uppercase tracking-wider text-muted-foreground"> 워크스페이스 </label>
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
          :aria-label="`'${activeWorkspace.name}' 워크스페이스 편집`"
          @click="editingWorkspaceId = activeWorkspace.id"
        >
          ⚙
        </button>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          :disabled="bulkFetchMut.isPending.value || !repos || repos.length === 0"
          :title="`현재 ${repos?.length ?? 0}개 레포 일괄 fetch`"
          :aria-label="`현재 ${repos?.length ?? 0}개 레포 일괄 fetch`"
          @click="bulkFetchMut.mutate()"
        >
          {{ bulkFetchMut.isPending.value ? '⟳' : '⤓' }}
        </button>
        <button
          v-if="bulkResultStore.last.value"
          type="button"
          class="relative rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
          :title="
            bulkResultFailedCount > 0
              ? `최근 일괄 fetch: ${bulkResultFailedCount}개 실패 — 자세히 보기`
              : '최근 일괄 fetch 결과'
          "
          :aria-label="
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
      </div>

      <!-- 워크스페이스 편집 inline (color picker + name + delete) -->
      <div
        v-if="editingWorkspaceId != null && activeWorkspace"
        class="mt-2 rounded border border-border bg-muted/20 p-2"
      >
        <input
          :value="activeWorkspace.name"
          class="mb-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
          @change="
            (e) =>
              updateWorkspaceMut.mutate({
                id: activeWorkspace!.id,
                name: (e.target as HTMLInputElement).value,
              })
          "
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
            @click="
              updateWorkspaceMut.mutate({
                id: activeWorkspace!.id,
                color: c,
              })
            "
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
            v-for="m in ['directory', 'org', 'forge'] as GroupMode[]"
            :key="m"
            type="button"
            class="rounded px-1.5 py-0.5 border border-input"
            :class="
              groupMode === m
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/40'
            "
            :title="
              m === 'directory'
                ? '부모 디렉토리 그룹'
                : m === 'org'
                  ? 'forge organization 그룹'
                  : 'forge kind 그룹 (Gitea / GitHub / Local-only)'
            "
            :aria-label="
              m === 'directory'
                ? '부모 디렉토리 그룹으로 정렬'
                : m === 'org'
                  ? 'forge organization 그룹으로 정렬'
                  : 'forge kind 그룹으로 정렬'
            "
            :aria-pressed="groupMode === m"
            @click="setGroupMode(m)"
          >
            {{ m === 'directory' ? '폴더' : m === 'org' ? 'Org' : 'Forge' }}
          </button>
          <button
            type="button"
            class="rounded-md border border-input px-2 py-0.5 hover:bg-accent"
            title="원격 URL 에서 clone (sparse / shallow 옵션 지원)"
            aria-label="원격 URL 에서 clone (sparse / shallow 옵션 지원)"
            @click="cloneOpen = true"
          >
            ⬇ Clone
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

      <div class="px-3 pb-1">
        <input
          ref="filterInput"
          v-model="repoFilter"
          type="search"
          placeholder="필터 (이름 / 별칭 / org / 경로) — ⌘⌥F"
          class="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        />
      </div>
      <p
        v-if="repoFilter && filteredRepos.length === 0"
        class="px-3 py-2 text-center text-[11px] text-muted-foreground"
      >
        '{{ repoFilter }}' 매칭 레포 없음
      </p>

      <ul data-testid="sidebar-repo-list" class="px-1 pb-3">
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
            :data-testid="`sidebar-repo-${repo.name}`"
            class="group cursor-pointer rounded-md py-1 text-sm hover:bg-accent"
            :class="[
              g.label ? 'pl-5 pr-2' : 'px-2',
              store.activeRepoId === repo.id ? 'bg-accent text-accent-foreground' : '',
            ]"
            @click="selectRepo(repo.id)"
            @contextmenu="onRepoContextMenu($event, repo)"
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
                  :aria-label="repo.isPinned ? `'${repo.name}' Unpin` : `'${repo.name}' Pin`"
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
                    @change="
                      (e) =>
                        (editingAliasScope = (e.target as HTMLSelectElement).value as
                          | 'profile'
                          | 'global')
                    "
                  >
                    <option value="profile" :disabled="aliases.activeProfileId.value == null">
                      profile
                    </option>
                    <option value="global">global</option>
                  </select>
                </template>
                <template v-else>
                  <span
                    class="flex-1 truncate"
                    :title="
                      aliases.resolveLocal(repo.id, repo.name).aliased
                        ? `별칭 (원본: ${repo.name})`
                        : repo.name
                    "
                  >
                    <span :class="aliases.resolveLocal(repo.id, repo.name).aliased ? 'italic' : ''">
                      {{ aliases.resolveLocal(repo.id, repo.name).display }}
                    </span>
                  </span>
                  <button
                    type="button"
                    class="shrink-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                    title="별칭 편집"
                    :aria-label="`'${repo.name}' 별칭 편집`"
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
              v-if="repo.defaultBranch || repoBranch(repo.id)"
              class="flex items-center gap-1 truncate text-[11px] text-muted-foreground"
              :class="g.label ? 'pl-5' : 'pl-4'"
            >
              <!-- 현재 HEAD 브랜치 우선, 없으면 default branch -->
              <span class="truncate">
                {{ repoBranch(repo.id) ?? repo.defaultBranch }}
              </span>
              <!-- Sprint 22-11 F-P3: ahead/behind preview -->
              <span
                v-if="repoAhead(repo.id)"
                class="shrink-0 text-emerald-500"
                :title="`${repoAhead(repo.id)}개 commit push 가능`"
              >
                ↑{{ repoAhead(repo.id) }}
              </span>
              <span
                v-if="repoBehind(repo.id)"
                class="shrink-0 text-rose-500"
                :title="`${repoBehind(repo.id)}개 commit pull 필요`"
              >
                ↓{{ repoBehind(repo.id) }}
              </span>
            </div>
          </li>
        </template>

        <!-- F-P1: 첫 로딩 시 spinner (150 레포 환경 3s+ 대기 안내) -->
        <li v-if="isFetching && (!repos || repos.length === 0)" class="px-2">
          <LoadingSpinner label="레포 목록 로딩 중..." size="sm" />
        </li>

        <li v-if="!isFetching && (!repos || repos.length === 0)">
          <EmptyState
            icon="📁"
            title="레포 없음"
            description="우측 상단 [+ 추가] 또는 [⬇ Clone] 으로 시작하세요."
            size="sm"
          />
        </li>
      </ul>
    </section>

    <!-- Sprint 22-12 E-9 / design §8-3 §8-6 — Integrations slot (Cloud-Free 시각화 대체).
         GitKraken Pro 의 Cloud Workspace 위치를 로컬-우선 / CLI-위임 plugin 슬롯으로 채움.
         현재 placeholder 상태 — v0.4+ 에서 실 plugin 도입 시 본 영역 채워짐.
    -->
    <details class="border-t border-border px-3 py-2">
      <summary
        class="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Integrations
      </summary>
      <div class="mt-2 flex flex-wrap gap-1">
        <PlaceholderButton
          label="GitHub Actions"
          eta="v0.4"
          icon="⚡"
          detail="CI run 상태 인디케이터 (per-branch / per-PR)"
        />
        <PlaceholderButton
          label="Linear / Jira"
          eta="v0.5"
          icon="🔗"
          detail="commit / branch 이름 → 이슈 자동 매핑"
        />
        <PlaceholderButton
          label="Discord 알림"
          eta="v0.5"
          icon="🔔"
          detail="bulk fetch / push 결과 webhook"
        />
      </div>
    </details>

    <!-- Sprint c25-3 step 1 — 활성 레포 mini quick actions (collapsible) -->
    <ActiveRepoQuickActions />

    <footer class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
      Tauri 2 · Vue 3 · Rust
    </footer>

    <CloneRepoModal
      :open="cloneOpen"
      :workspace-id="store.activeWorkspaceId"
      @close="cloneOpen = false"
    />
    <BulkFetchResultModal :open="bulkResultOpen" @close="bulkResultOpen = false" />
    <ContextMenu ref="repoCtxMenu" />
  </aside>
</template>
