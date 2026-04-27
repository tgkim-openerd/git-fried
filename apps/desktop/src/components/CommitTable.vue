<script setup lang="ts">
// Sprint C14 G2 — Author filter dropdown (`docs/plan/14 §8`).
// Sprint 22-2 CM-2 — row 우클릭 메뉴 (CommitGraph 와 동일 — useCommitActions 재사용).
import { computed, ref, useTemplateRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getLog } from '@/api/git'
import { describeError } from '@/api/errors'
import { formatDateLocalized } from '@/composables/useUserSettings'
import { useCommitActions } from '@/composables/useCommitActions'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import type { CommitSummary } from '@/types/git'

const props = defineProps<{ repoId: number | null }>()
const emit = defineEmits<{
  showDiff: [sha: string]
  compareWith: [sha: string]
  explainAi: [sha: string]
  openInForge: [sha: string]
}>()

const { data: commits, isFetching, error } = useQuery({
  queryKey: computed(() => ['log', props.repoId]),
  queryFn: () =>
    props.repoId == null
      ? Promise.resolve([])
      : getLog({ repoId: props.repoId, limit: 200 }),
  enabled: computed(() => props.repoId != null),
})

// === Sprint C14 G2: Author filter dropdown ===
const authorFilter = ref<string | null>(null)

const uniqueAuthors = computed<string[]>(() => {
  const set = new Set<string>()
  for (const c of commits.value ?? []) {
    if (c.authorName) set.add(c.authorName)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))
})

const filteredCommits = computed<CommitSummary[]>(() => {
  const all = commits.value ?? []
  if (!authorFilter.value) return all
  return all.filter((c) => c.authorName === authorFilter.value)
})

function formatDate(unix: number): string {
  return formatDateLocalized(unix, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function refsLabel(c: CommitSummary): string | null {
  if (!c.refs || c.refs.length === 0) return null
  return c.refs.join(', ')
}

// === Sprint 22-2 CM-2: row 우클릭 메뉴 ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
const commitActions = useCommitActions(() => props.repoId)

function onRowContextMenu(ev: MouseEvent, c: CommitSummary) {
  ev.preventDefault()
  ctxMenu.value?.openAt(
    ev,
    commitActions.buildItems(c.sha, {
      onShowDiff: (s) => emit('showDiff', s),
      onCompare: (s) => emit('compareWith', s),
      onExplainAi: (s) => emit('explainAi', s),
      onOpenInForge: (s) => emit('openInForge', s),
    }),
  )
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
      <h2 class="text-sm font-semibold">커밋 로그</h2>
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span v-if="isFetching">불러오는 중...</span>
        <select
          v-if="uniqueAuthors.length > 1"
          v-model="authorFilter"
          class="rounded border border-input bg-background px-2 py-0.5 text-[11px]"
          :title="`작성자 필터 (${uniqueAuthors.length}명)`"
        >
          <option :value="null">모든 작성자</option>
          <option v-for="a in uniqueAuthors" :key="a" :value="a">
            {{ a }}
          </option>
        </select>
      </div>
    </header>

    <div v-if="error" class="m-4 rounded border border-destructive bg-destructive/10 p-3 text-sm whitespace-pre-wrap">
      {{ describeError(error) }}
    </div>

    <div v-else-if="repoId == null" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      좌측에서 레포를 선택하세요.
    </div>

    <div v-else class="flex-1 overflow-auto">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-background text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-normal w-20">SHA</th>
            <th class="px-3 py-2 text-left font-normal">제목</th>
            <th class="px-3 py-2 text-left font-normal w-40">작성자</th>
            <th class="px-3 py-2 text-left font-normal w-44">날짜</th>
            <th class="px-3 py-2 text-left font-normal w-10"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in filteredCommits"
            :key="c.sha"
            class="border-t border-border hover:bg-accent/50"
            @dblclick="emit('showDiff', c.sha)"
            @contextmenu="onRowContextMenu($event, c)"
          >
            <td class="px-3 py-1.5 font-mono text-xs text-muted-foreground">
              {{ c.shortSha }}
            </td>
            <td class="px-3 py-1.5">
              <span>{{ c.subject }}</span>
              <span
                v-if="refsLabel(c)"
                class="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {{ refsLabel(c) }}
              </span>
            </td>
            <td class="px-3 py-1.5 text-xs text-muted-foreground">
              {{ c.authorName }}
            </td>
            <td class="px-3 py-1.5 text-xs text-muted-foreground">
              {{ formatDate(c.authorAt) }}
            </td>
            <td class="px-3 py-1.5">
              <span
                v-if="c.signed"
                class="text-xs text-emerald-500"
                title="GPG 서명됨"
                >✓</span
              >
            </td>
          </tr>
          <tr v-if="filteredCommits.length === 0">
            <td colspan="5" class="px-3 py-8 text-center text-xs text-muted-foreground">
              {{ authorFilter ? `'${authorFilter}' 의 커밋 없음` : '커밋이 없습니다.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <ContextMenu ref="ctxMenu" />
  </div>
</template>
