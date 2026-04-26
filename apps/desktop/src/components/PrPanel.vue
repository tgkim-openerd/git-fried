<script setup lang="ts">
// PR 패널 — 현재 레포의 PR 목록 (Gitea / GitHub) + 상세 read-only.
// v0.1 S5: list + detail. PR 코멘트 / 리뷰는 v1.0.
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { usePullRequests } from '@/composables/usePullRequests'
import { getPullRequest } from '@/api/git'
import type { PrState, PullRequest } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()

const stateFilter = ref<PrState | null>('open')
const { data: prs, isFetching, error } = usePullRequests(
  () => props.repoId,
  () => stateFilter.value,
)

const selectedNumber = ref<number | null>(null)
const { data: detail } = useQuery({
  queryKey: computed(() => ['pr', props.repoId, selectedNumber.value]),
  queryFn: () => {
    if (props.repoId == null || selectedNumber.value == null)
      return Promise.reject(new Error('no selection'))
    return getPullRequest(props.repoId, selectedNumber.value)
  },
  enabled: computed(() => props.repoId != null && selectedNumber.value != null),
})

function stateColor(s: PrState): string {
  switch (s) {
    case 'open':
      return 'text-emerald-500'
    case 'merged':
      return 'text-violet-500'
    case 'closed':
      return 'text-rose-500'
    case 'draft':
      return 'text-muted-foreground'
  }
}

function isBot(pr: PullRequest): boolean {
  const u = pr.author.username.toLowerCase()
  return (
    u.endsWith('-bot') ||
    u.endsWith('[bot]') ||
    u === 'release-please' ||
    u === 'dependabot' ||
    u === 'renovate'
  )
}
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header class="border-b border-border px-3 py-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Pull Requests</h3>
        <div class="flex gap-1 text-[10px]">
          <button
            v-for="s in [null, 'open', 'closed'] as (PrState | null)[]"
            :key="String(s)"
            type="button"
            class="rounded px-1.5 py-0.5"
            :class="
              stateFilter === s
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            "
            @click="stateFilter = s"
          >
            {{ s ?? 'all' }}
          </button>
        </div>
      </div>
    </header>

    <div v-if="error" class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs">
      {{ String(error) }}
    </div>

    <div class="flex-1 overflow-auto px-2 py-1 text-sm">
      <div v-if="isFetching" class="px-2 py-3 text-xs text-muted-foreground">불러오는 중...</div>

      <ul>
        <li
          v-for="pr in prs"
          :key="pr.number"
          class="cursor-pointer rounded px-2 py-1.5 hover:bg-accent/40"
          :class="selectedNumber === pr.number ? 'bg-accent' : ''"
          @click="selectedNumber = pr.number"
        >
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-muted-foreground">#{{ pr.number }}</span>
            <span :class="['text-[10px] uppercase', stateColor(pr.state)]">
              {{ pr.state }}
            </span>
          </div>
          <div class="truncate text-sm">
            <span v-if="isBot(pr)" class="text-[10px] text-muted-foreground">🤖 </span>
            {{ pr.title }}
          </div>
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{{ pr.author.username }}</span>
            <span>{{ pr.headBranch }} → {{ pr.baseBranch }}</span>
          </div>
          <div v-if="pr.labels.length" class="mt-0.5 flex flex-wrap gap-1">
            <span
              v-for="l in pr.labels"
              :key="l.name"
              class="rounded px-1 py-0.5 text-[10px]"
              :style="{
                backgroundColor: l.color + '33',
                color: l.color,
              }"
            >
              {{ l.name }}
            </span>
          </div>
        </li>
        <li
          v-if="prs && prs.length === 0 && !isFetching"
          class="px-2 py-3 text-center text-xs text-muted-foreground"
        >
          PR 없음
        </li>
      </ul>
    </div>

    <!-- 상세 (선택 시) -->
    <div
      v-if="detail"
      class="max-h-72 overflow-auto border-t border-border bg-muted/20 p-3 text-xs"
    >
      <div class="mb-1 flex items-center justify-between">
        <a
          :href="detail.htmlUrl"
          target="_blank"
          rel="noopener"
          class="font-semibold hover:underline"
        >
          #{{ detail.number }} {{ detail.title }}
        </a>
        <button class="text-muted-foreground" @click="selectedNumber = null">×</button>
      </div>
      <pre class="whitespace-pre-wrap font-mono text-[11px]">{{ detail.bodyMd || '(본문 없음)' }}</pre>
    </div>
  </section>
</template>
