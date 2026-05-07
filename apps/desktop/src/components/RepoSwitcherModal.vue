<script setup lang="ts">
// 빠른 레포 전환 (⌘⇧P / ⌘T).
// fuzzy filter — 사용자 50+ 레포에서 즉시 검색.
//
// Sprint c49 — 폴더 그룹 + multi-add (Repository Management 와 일관):
//   - 결과를 useSidebarGroups (directory/org/forge) 로 그룹핑해서 헤더 + 자식 행 표시.
//   - 폴더 행도 keyboard navigable. Enter/Click → 그룹 모든 레포 openTab + 첫 활성 + close.
//   - 단독 그룹 (isSolo) 은 폴더 헤더 숨김 — 평면처럼 표시.
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { listRepos } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import type { Repo } from '@/types/git'
import { useReposStore } from '@/stores/repos'
import { useRepoAliases } from '@/composables/useRepoAliases'
import { useSidebarGroups, type RepoGroup } from '@/composables/useSidebarGroups'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const router = useRouter()
const store = useReposStore()
const filter = ref('')
const selected = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = useTemplateRef<HTMLUListElement>('listRef')

// 모든 레포 (워크스페이스 무시 — 빠른 전환은 전체 검색)
const { data: repos } = useQuery({
  queryKey: ['repos-all-for-switcher'],
  queryFn: () => listRepos(null),
  staleTime: STALE_TIME.NORMAL,
})

const aliases = useRepoAliases()

function aliasOrName(r: Repo): string {
  return aliases.resolveLocal(r.id, r.name).display
}

// 1단계: filter 매칭 (검색어 적용 후 정렬). 그룹화는 다음 단계.
const filteredRepos = computed<Repo[]>(() => {
  const q = filter.value.trim().toLowerCase()
  const list = repos.value ?? []
  if (!q) {
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
      const aStart = aliasOrName(a).toLowerCase().startsWith(q)
      const bStart = aliasOrName(b).toLowerCase().startsWith(q)
      if (aStart !== bStart) return aStart ? -1 : 1
      return aliasOrName(a).localeCompare(aliasOrName(b))
    })
})

// 2단계: 그룹화 (Repository Management 와 동일한 useSidebarGroups — localStorage 공유).
const { groups } = useSidebarGroups(filteredRepos)

// 3단계: 평면 row 시퀀스 — keyboard 네비게이션과 v-for 양쪽에서 사용.
type FlatRow =
  | { kind: 'group'; key: string; group: RepoGroup }
  | { kind: 'repo'; key: string; group: RepoGroup; repo: Repo }

const rows = computed<FlatRow[]>(() => {
  const out: FlatRow[] = []
  for (const g of groups.value) {
    // isSolo (label=null) 그룹은 헤더 안 그림 — 평면처럼.
    if (g.label) out.push({ kind: 'group', key: `g:${g.key}`, group: g })
    for (const r of g.repos) out.push({ kind: 'repo', key: `r:${r.id}`, group: g, repo: r })
  }
  return out
})

// 초기 selection 은 첫 repo row — 그룹 헤더에서 우연히 Enter 로 multi-add 되는 사고 방지.
function firstRepoIdx(): number {
  const idx = rows.value.findIndex((r) => r.kind === 'repo')
  return idx >= 0 ? idx : 0
}

// rows 가 변경되면(query 완료 / filter 변경) 가드:
//  ① out-of-range 거나 ② 현재 selected 가 group 헤더면 → 첫 repo row 로 복귀.
// 빈 검색 + query 완료 직후 첫 행이 group 인 race 시 사고 방지 (architecture review ARCH-007).
watch(rows, () => {
  const r = rows.value[selected.value]
  if (!r || r.kind === 'group') selected.value = firstRepoIdx()
})

watch(
  () => props.open,
  (o) => {
    if (o) {
      filter.value = ''
      selected.value = firstRepoIdx()
      nextTick(() => inputRef.value?.focus())
    }
  },
)

// selected 변경 시 해당 row 가 보이게 — 그룹 헤더에서 사용자가 키로 빠르게 내려갈 때 UX.
watch(selected, () => {
  nextTick(() => {
    const el = listRef.value?.querySelector<HTMLElement>(`[data-row-idx="${selected.value}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
})

function goHome() {
  if (router.currentRoute.value.path !== '/') void router.push('/')
}

function pick(r: Repo) {
  if (r.workspaceId !== store.activeWorkspaceId) {
    store.setActiveWorkspace(r.workspaceId ?? null)
  }
  store.setActiveRepo(r.id)
  goHome()
  emit('close')
}

// 폴더 헤더 행 선택 — 그룹의 모든 레포를 탭에 추가하고 첫 레포 활성.
// pinned 우선, 그 다음 alias/이름 알파벳 (filteredRepos 정렬과 동일 로직).
function pickGroup(g: RepoGroup) {
  if (g.repos.length === 0) return
  for (const r of g.repos) store.openTab(r.id)
  const sorted = [...g.repos].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return aliasOrName(a).localeCompare(aliasOrName(b))
  })
  const first = sorted[0]
  if (first.workspaceId !== store.activeWorkspaceId) {
    store.setActiveWorkspace(first.workspaceId ?? null)
  }
  store.setActiveRepo(first.id)
  goHome()
  emit('close')
}

function pickRow(row: FlatRow) {
  if (row.kind === 'repo') pick(row.repo)
  else pickGroup(row.group)
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selected.value = Math.min(rows.value.length - 1, selected.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selected.value = Math.max(0, selected.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const r = rows.value[selected.value]
    if (r) pickRow(r)
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    align="top"
    :show-close-button="false"
    panel-class="w-[640px] max-w-[90vw]"
    max-width="full"
    @close="emit('close')"
  >
    <div @keydown="onKeydown">
      <input
        ref="inputRef"
        v-model="filter"
        :placeholder="t('switcher.searchPlaceholder')"
        class="w-full rounded-t-lg border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
        :aria-label="t('switcher.searchAriaLabel')"
        @keydown="onKeydown"
      />
      <ul ref="listRef" class="max-h-96 overflow-auto py-1">
        <template v-for="(row, i) in rows" :key="row.key">
          <!-- 폴더 헤더 행 — Enter 시 그룹 multi-add. -->
          <li
            v-if="row.kind === 'group'"
            :data-row-idx="i"
            :data-row-kind="'group'"
            class="cursor-pointer px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
            :class="
              i === selected
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/30'
            "
            :title="
              t('switcher.openAllInGroupTitle', {
                label: row.group.label,
                n: row.group.repos.length,
              })
            "
            @mouseenter="selected = i"
            @click="pickGroup(row.group)"
          >
            <span class="flex items-center gap-2">
              <span>📦</span>
              <span class="flex-1 truncate normal-case">{{ row.group.label }}</span>
              <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal">
                {{ row.group.repos.length }}
              </span>
              <span class="text-[10px] font-normal text-muted-foreground">
                {{ t('switcher.openAllInGroupHint') }}
              </span>
            </span>
          </li>

          <!-- 레포 행 — 단일 활성. group 안일 땐 들여쓰기. -->
          <li
            v-else
            :data-row-idx="i"
            :data-row-kind="'repo'"
            class="cursor-pointer py-1.5 pr-3 text-sm"
            :class="[
              i === selected ? 'bg-accent text-accent-foreground' : '',
              row.group.label ? 'pl-6' : 'pl-3',
            ]"
            @mouseenter="selected = i"
            @click="pick(row.repo)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-2 truncate">
                <span v-if="row.repo.isPinned" class="text-warning-amber">⭐</span>
                <span
                  class="font-medium"
                  :class="aliases.resolveLocal(row.repo.id, row.repo.name).aliased ? 'italic' : ''"
                >
                  {{ aliases.resolveLocal(row.repo.id, row.repo.name).display }}
                </span>
                <span
                  v-if="aliases.resolveLocal(row.repo.id, row.repo.name).aliased"
                  class="text-[10px] text-muted-foreground"
                  :title="`원본: ${row.repo.name}`"
                >
                  ({{ row.repo.name }})
                </span>
                <span
                  v-if="row.repo.forgeKind !== 'unknown'"
                  class="rounded bg-muted px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {{ row.repo.forgeKind }}
                </span>
              </span>
              <span class="shrink-0 text-[10px] text-muted-foreground">
                {{ row.repo.defaultBranch || '?' }}
              </span>
            </div>
            <div
              class="truncate font-mono text-[10px] text-muted-foreground"
              :class="row.group.label ? 'pl-0' : ''"
            >
              {{ row.repo.localPath }}
            </div>
          </li>
        </template>
        <li v-if="rows.length === 0" class="px-3 py-3 text-center text-xs text-muted-foreground">
          {{ t('switcher.empty') }}
        </li>
      </ul>
      <div class="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        {{ t('switcher.footer') }}
      </div>
    </div>
  </BaseModal>
</template>
