<script setup lang="ts">
// 빠른 레포 전환 (⌘⇧P).
// fuzzy filter — 사용자 50+ 레포에서 즉시 검색.
import { computed, nextTick, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listRepos } from '@/api/git'
import type { Repo } from '@/types/git'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useReposStore()
const filter = ref('')
const selected = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

// 모든 레포 (워크스페이스 무시 — 빠른 전환은 전체 검색)
const { data: repos } = useQuery({
  queryKey: ['repos-all-for-switcher'],
  queryFn: () => listRepos(null),
  staleTime: 30_000,
})

const aliases = useRepoAliases()

function aliasOrName(r: Repo): string {
  return aliases.resolveLocal(r.id, r.name).display
}

const filtered = computed<Repo[]>(() => {
  const q = filter.value.trim().toLowerCase()
  const list = repos.value ?? []
  if (!q) {
    // pinned 우선, 그 다음 alias/이름 알파벳
    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return aliasOrName(a).localeCompare(aliasOrName(b))
    })
  }
  return list
    .filter((r) => {
      const display = aliasOrName(r).toLowerCase()
      return (
        display.includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.localPath.toLowerCase().includes(q) ||
        (r.forgeOwner ?? '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      // 매칭 점수: alias/name startsWith > 포함
      const aStart = aliasOrName(a).toLowerCase().startsWith(q)
      const bStart = aliasOrName(b).toLowerCase().startsWith(q)
      if (aStart !== bStart) return aStart ? -1 : 1
      return aliasOrName(a).localeCompare(aliasOrName(b))
    })
})

watch(filter, () => (selected.value = 0))
watch(filtered, () => {
  if (selected.value >= filtered.value.length) selected.value = 0
})

watch(
  () => props.open,
  (o) => {
    if (o) {
      filter.value = ''
      selected.value = 0
      nextTick(() => inputRef.value?.focus())
    }
  },
)

function pick(r: Repo) {
  if (r.workspaceId !== store.activeWorkspaceId) {
    // 다른 워크스페이스의 레포 선택 시 워크스페이스도 따라감
    store.setActiveWorkspace(r.workspaceId ?? null)
  }
  store.setActiveRepo(r.id)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selected.value = Math.min(filtered.value.length - 1, selected.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selected.value = Math.max(0, selected.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const r = filtered.value[selected.value]
    if (r) pick(r)
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-32"
      @click.self="emit('close')"
      @keydown="onKeydown"
    >
      <div class="w-[640px] max-w-[90vw] rounded-lg border border-border bg-card shadow-xl">
        <input
          ref="inputRef"
          v-model="filter"
          placeholder="레포 검색... (이름 / 경로 / owner) — Esc 닫기"
          class="w-full rounded-t-lg border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
          @keydown="onKeydown"
        />
        <ul class="max-h-96 overflow-auto py-1">
          <li
            v-for="(r, i) in filtered"
            :key="r.id"
            class="cursor-pointer px-3 py-1.5 text-sm"
            :class="i === selected ? 'bg-accent text-accent-foreground' : ''"
            @mouseenter="selected = i"
            @click="pick(r)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-2 truncate">
                <span v-if="r.isPinned" class="text-amber-500">⭐</span>
                <span
                  class="font-medium"
                  :class="aliases.resolveLocal(r.id, r.name).aliased ? 'italic' : ''"
                >
                  {{ aliases.resolveLocal(r.id, r.name).display }}
                </span>
                <span
                  v-if="aliases.resolveLocal(r.id, r.name).aliased"
                  class="text-[10px] text-muted-foreground"
                  :title="`원본: ${r.name}`"
                >
                  ({{ r.name }})
                </span>
                <span
                  v-if="r.forgeKind !== 'unknown'"
                  class="rounded bg-muted px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {{ r.forgeKind }}
                </span>
              </span>
              <span class="shrink-0 text-[10px] text-muted-foreground">
                {{ r.defaultBranch || '?' }}
              </span>
            </div>
            <div class="truncate font-mono text-[10px] text-muted-foreground">
              {{ r.localPath }}
            </div>
          </li>
          <li
            v-if="filtered.length === 0"
            class="px-3 py-3 text-center text-xs text-muted-foreground"
          >
            결과 없음
          </li>
        </ul>
        <div class="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          ↑↓ 탐색 · Enter 선택 · Esc 닫기 · ⭐ pinned 우선
        </div>
      </div>
    </div>
  </Teleport>
</template>
