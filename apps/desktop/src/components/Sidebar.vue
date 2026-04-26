<script setup lang="ts">
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { open } from '@tauri-apps/plugin-dialog'
import { addRepo, listRepos, listWorkspaces } from '@/api/git'
import { useReposStore } from '@/stores/repos'

const store = useReposStore()
const queryClient = useQueryClient()

const { data: workspaces } = useQuery({
  queryKey: ['workspaces'],
  queryFn: listWorkspaces,
})

const { data: repos, isFetching } = useQuery({
  queryKey: ['repos', store.activeWorkspaceId],
  queryFn: () => listRepos(store.activeWorkspaceId),
})

const addRepoMutation = useMutation({
  mutationFn: addRepo,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repos'] }),
})

async function pickAndAddRepo() {
  // OS 네이티브 폴더 선택 다이얼로그
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
</script>

<template>
  <aside
    class="flex h-screen flex-col border-r border-border bg-card text-card-foreground"
  >
    <header class="flex items-center justify-between border-b border-border px-4 py-3">
      <span class="font-mono text-sm font-semibold tracking-tight">git-fried</span>
      <span class="text-xs text-muted-foreground">v0.0</span>
    </header>

    <!-- 워크스페이스 선택 -->
    <section class="border-b border-border px-3 py-2">
      <label class="text-xs uppercase tracking-wider text-muted-foreground">
        워크스페이스
      </label>
      <select
        :value="store.activeWorkspaceId ?? ''"
        @change="
          (e) =>
            store.setActiveWorkspace(
              ((e.target as HTMLSelectElement).value || null) as never
            )
        "
        class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="">전체</option>
        <option v-for="w in workspaces" :key="w.id" :value="w.id">
          {{ w.name }}
        </option>
      </select>
    </section>

    <!-- 레포 리스트 -->
    <section class="flex-1 overflow-auto">
      <div class="flex items-center justify-between px-3 py-2">
        <span class="text-xs uppercase tracking-wider text-muted-foreground">
          레포
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
        <li
          v-for="repo in repos"
          :key="repo.id"
          class="cursor-pointer rounded-md px-2 py-1 text-sm hover:bg-accent"
          :class="{
            'bg-accent text-accent-foreground': store.activeRepoId === repo.id,
          }"
          @click="selectRepo(repo.id)"
        >
          <div class="flex items-center justify-between">
            <span class="truncate">{{ repo.name }}</span>
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
          >
            {{ repo.defaultBranch }}
          </div>
        </li>
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
