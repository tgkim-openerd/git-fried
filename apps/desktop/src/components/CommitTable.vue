<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getLog } from '@/api/git'
import { describeError } from '@/api/errors'
import type { CommitSummary } from '@/types/git'

const props = defineProps<{ repoId: number | null }>()

const { data: commits, isFetching, error } = useQuery({
  queryKey: computed(() => ['log', props.repoId]),
  queryFn: () =>
    props.repoId == null
      ? Promise.resolve([])
      : getLog({ repoId: props.repoId, limit: 200 }),
  enabled: computed(() => props.repoId != null),
})

function formatDate(unix: number): string {
  const d = new Date(unix * 1000)
  return d.toLocaleString('ko-KR', {
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
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex items-center justify-between border-b border-border px-4 py-2">
      <h2 class="text-sm font-semibold">커밋 로그</h2>
      <span v-if="isFetching" class="text-xs text-muted-foreground">불러오는 중...</span>
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
            v-for="c in commits"
            :key="c.sha"
            class="border-t border-border hover:bg-accent/50"
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
          <tr v-if="commits && commits.length === 0">
            <td colspan="5" class="px-3 py-8 text-center text-xs text-muted-foreground">
              커밋이 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
