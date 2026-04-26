<script setup lang="ts">
// Forge issue 목록 (Gitea + GitHub).
// v0.3 단계: read-only. 코멘트/생성은 v1.0+.
import { useIssues } from '@/composables/useIssuesReleases'
import { describeError } from '@/api/errors'

const props = defineProps<{ repoId: number | null }>()
const { data: issues, isFetching, error } = useIssues(() => props.repoId)

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">Issues</h3>
    </header>

    <div
      v-if="error"
      class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
    >
      {{ describeError(error) }}
    </div>

    <div class="flex-1 overflow-auto px-2 py-1 text-sm">
      <div v-if="isFetching" class="px-2 py-3 text-xs text-muted-foreground">불러오는 중...</div>

      <ul>
        <li
          v-for="i in issues"
          :key="i.number"
          class="rounded px-2 py-1.5 hover:bg-accent/40"
        >
          <a :href="i.htmlUrl" target="_blank" rel="noopener" class="block">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs text-muted-foreground">#{{ i.number }}</span>
              <span class="text-[10px] text-muted-foreground">{{ fmtDate(i.updatedAt) }}</span>
            </div>
            <div class="truncate text-sm">{{ i.title }}</div>
            <div class="text-[11px] text-muted-foreground">
              {{ i.author.username }} · 💬 {{ i.comments }}
            </div>
            <div v-if="i.labels.length" class="mt-0.5 flex flex-wrap gap-1">
              <span
                v-for="l in i.labels"
                :key="l.name"
                class="rounded px-1 py-0.5 text-[10px]"
                :style="{ backgroundColor: l.color + '33', color: l.color }"
              >
                {{ l.name }}
              </span>
            </div>
          </a>
        </li>
        <li
          v-if="issues && issues.length === 0 && !isFetching"
          class="px-2 py-3 text-center text-xs text-muted-foreground"
        >
          Open issue 없음
        </li>
      </ul>
    </div>
  </div>
</template>
