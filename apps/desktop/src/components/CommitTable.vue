<script setup lang="ts">
// Sprint C14 G2 — Author filter dropdown (`docs/plan/14 §8`).
// Sprint 22-2 CM-2 — row 우클릭 메뉴 (CommitGraph 와 동일 — useCommitActions 재사용).
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { getLog } from '@/api/git'
import { describeError } from '@/api/errors'
import { formatDateLocalized } from '@/composables/useUserSettings'
import { useCommitActions } from '@/composables/useCommitActions'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import type { CommitSummary } from '@/types/git'

const { t } = useI18n()

const props = defineProps<{ repoId: number | null }>()
const emit = defineEmits<{
  showDiff: [sha: string]
  compareWith: [sha: string]
  explainAi: [sha: string]
  openInForge: [sha: string]
}>()

const {
  data: commits,
  isFetching,
  error,
} = useQuery({
  queryKey: computed(() => ['log', props.repoId]),
  queryFn: () =>
    props.repoId == null ? Promise.resolve([]) : getLog({ repoId: props.repoId, limit: 200 }),
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

// === B8 (plan #44) — commit row 키보드 접근 (roving tabindex) ===
// 무가상화 200행이라 per-row tabindex=0 은 tab-stop 폭증 → 하나만 0, ↑↓ 이동, Enter = showDiff.
const focusedIdx = ref<number>(0)
const tbodyRef = useTemplateRef<HTMLTableSectionElement>('tbodyRef')
watch(filteredCommits, () => {
  if (focusedIdx.value >= filteredCommits.value.length) focusedIdx.value = 0
})
function focusRow(idx: number) {
  tbodyRef.value?.querySelectorAll<HTMLElement>('tr[data-commit-row]')[idx]?.focus()
}
function onRowKeydown(e: KeyboardEvent, i: number, sha: string) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const n = Math.min(filteredCommits.value.length - 1, i + 1)
    focusedIdx.value = n
    focusRow(n)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const n = Math.max(0, i - 1)
    focusedIdx.value = n
    focusRow(n)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    emit('showDiff', sha)
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
      <h2 class="text-sm font-semibold">{{ t('commitTable.title') }}</h2>
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span v-if="isFetching">{{ t('commitTable.loading') }}</span>
        <select
          v-if="uniqueAuthors.length > 1"
          v-model="authorFilter"
          class="rounded border border-input bg-background px-2 py-0.5 text-2xs"
          :title="`${t('commitTable.colAuthor')} filter (${uniqueAuthors.length})`"
        >
          <option :value="null">{{ t('commitTable.allAuthors') }}</option>
          <option v-for="a in uniqueAuthors" :key="a" :value="a">
            {{ a }}
          </option>
        </select>
      </div>
    </header>

    <div
      v-if="error"
      class="m-4 rounded border border-destructive bg-destructive/10 p-3 text-sm whitespace-pre-wrap"
    >
      {{ describeError(error) }}
    </div>

    <div
      v-else-if="repoId == null"
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
    >
      좌측에서 레포를 선택하세요.
    </div>

    <div v-else class="flex-1 overflow-auto">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-background text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-normal w-20">SHA</th>
            <th class="px-3 py-2 text-left font-normal">{{ t('commitTable.colSubject') }}</th>
            <th class="px-3 py-2 text-left font-normal w-40">{{ t('commitTable.colAuthor') }}</th>
            <th class="px-3 py-2 text-left font-normal w-44">{{ t('commitTable.colDate') }}</th>
            <th class="px-3 py-2 text-left font-normal w-10"></th>
          </tr>
        </thead>
        <tbody ref="tbodyRef">
          <tr
            v-for="(c, i) in filteredCommits"
            :key="c.sha"
            data-commit-row
            :tabindex="i === focusedIdx ? 0 : -1"
            :aria-label="`${c.shortSha} ${c.subject}`"
            class="border-t border-border hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            @dblclick="emit('showDiff', c.sha)"
            @contextmenu="onRowContextMenu($event, c)"
            @focus="focusedIdx = i"
            @keydown="onRowKeydown($event, i, c.sha)"
          >
            <td class="px-3 py-1.5 font-mono text-xs text-muted-foreground">
              {{ c.shortSha }}
            </td>
            <td class="px-3 py-1.5">
              <span>{{ c.subject }}</span>
              <span
                v-if="refsLabel(c)"
                class="ml-2 rounded bg-muted px-1.5 py-0.5 text-3xs text-muted-foreground"
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
                class="text-xs text-diff-add"
                :title="t('commitTable.gpgSigned')"
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
