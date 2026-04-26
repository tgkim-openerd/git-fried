<script setup lang="ts">
// Launchpad — 워크스페이스 모든 레포 PR 통합 보드.
// GitKraken Cloud Workspace 의 로컬 first 버전.
//
// 핵심 가치 (`docs/plan/02 §3 W1`): 회사 50+ 레포 PR 전체 조망 + bot/사람 분리.
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { bulkListPrs } from '@/api/git'
import type { BulkResult, PrState, PullRequest } from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { describeError } from '@/api/errors'

const store = useReposStore()
const stateFilter = ref<PrState | null>('open')
const showBots = ref(false)

const { data, isFetching, error, refetch } = useQuery({
  queryKey: computed(() => [
    'launchpad-prs',
    store.activeWorkspaceId,
    stateFilter.value,
  ]),
  queryFn: () => bulkListPrs(store.activeWorkspaceId, stateFilter.value),
  staleTime: 30_000,
})

interface FlatRow {
  repoName: string
  pr: PullRequest
}

function isBot(pr: PullRequest): boolean {
  const u = pr.author.username.toLowerCase()
  return (
    u.endsWith('-bot') ||
    u.endsWith('[bot]') ||
    u === 'release-please' ||
    u === 'dependabot' ||
    u === 'renovate' ||
    u === 'github-actions' ||
    u.includes('bot')
  )
}

const flatRows = computed<FlatRow[]>(() => {
  if (!data.value) return []
  const out: FlatRow[] = []
  for (const r of data.value) {
    if (!r.success || !r.data) continue
    for (const pr of r.data) {
      out.push({ repoName: r.repoName, pr })
    }
  }
  return out
})

const humanPrs = computed(() => flatRows.value.filter((r) => !isBot(r.pr)))
const botPrs = computed(() => flatRows.value.filter((r) => isBot(r.pr)))

const failedRepos = computed<BulkResult<PullRequest[]>[]>(() =>
  (data.value ?? []).filter((r) => !r.success),
)

const stats = computed(() => ({
  total: flatRows.value.length,
  human: humanPrs.value.length,
  bot: botPrs.value.length,
  reposWithPrs: new Set(flatRows.value.map((r) => r.repoName)).size,
  reposScanned: data.value?.length ?? 0,
  failed: failedRepos.value.length,
}))

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  })
}

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
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header class="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div class="flex items-center gap-3">
        <h1 class="text-base font-semibold">Launchpad</h1>
        <span class="text-xs text-muted-foreground">
          {{ stats.reposWithPrs }}/{{ stats.reposScanned }} 레포 ·
          PR {{ stats.human }}+{{ stats.bot }}봇
          <span v-if="stats.failed > 0" class="text-amber-500">
            · {{ stats.failed }}개 실패
          </span>
        </span>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <div class="flex gap-1">
          <button
            v-for="s in [null, 'open', 'closed', 'merged'] as (PrState | null)[]"
            :key="String(s)"
            type="button"
            class="rounded-md border border-input px-2 py-0.5"
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
        <label class="ml-2 flex items-center gap-1">
          <input v-model="showBots" type="checkbox" />
          봇 PR 표시
        </label>
        <button
          type="button"
          class="rounded-md border border-input px-2 py-0.5 hover:bg-accent disabled:opacity-50"
          :disabled="isFetching"
          @click="refetch()"
        >
          {{ isFetching ? '...' : '↻' }}
        </button>
      </div>
    </header>

    <div
      v-if="error"
      class="m-3 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
    >
      {{ describeError(error) }}
    </div>

    <div class="flex-1 overflow-auto p-4">
      <!-- 사람 PR -->
      <section v-if="humanPrs.length" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          PR ({{ humanPrs.length }})
        </h2>
        <div class="overflow-hidden rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th class="px-2 py-1.5 text-left font-normal w-40">레포</th>
                <th class="px-2 py-1.5 text-left font-normal w-12">#</th>
                <th class="px-2 py-1.5 text-left font-normal">제목</th>
                <th class="px-2 py-1.5 text-left font-normal w-28">작성자</th>
                <th class="px-2 py-1.5 text-left font-normal w-32">브랜치</th>
                <th class="px-2 py-1.5 text-left font-normal w-16">상태</th>
                <th class="px-2 py-1.5 text-left font-normal w-16">갱신</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in humanPrs"
                :key="`${row.repoName}-${row.pr.number}`"
                class="border-t border-border/50 hover:bg-accent/30"
              >
                <td class="truncate px-2 py-1 font-mono text-xs">{{ row.repoName }}</td>
                <td class="px-2 py-1 font-mono text-xs text-muted-foreground">
                  #{{ row.pr.number }}
                </td>
                <td class="px-2 py-1">
                  <a
                    :href="row.pr.htmlUrl"
                    target="_blank"
                    rel="noopener"
                    class="hover:underline"
                  >
                    {{ row.pr.title }}
                  </a>
                  <template v-for="l in row.pr.labels" :key="l.name">
                    <span
                      class="ml-1 rounded px-1 py-0.5 text-[10px]"
                      :style="{
                        backgroundColor: l.color + '33',
                        color: l.color,
                      }"
                    >
                      {{ l.name }}
                    </span>
                  </template>
                </td>
                <td class="truncate px-2 py-1 text-xs">{{ row.pr.author.username }}</td>
                <td class="truncate px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {{ row.pr.headBranch }}
                </td>
                <td :class="['px-2 py-1 text-[10px] uppercase', stateColor(row.pr.state)]">
                  {{ row.pr.state }}
                </td>
                <td class="px-2 py-1 text-[10px] text-muted-foreground">
                  {{ fmtDate(row.pr.updatedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 봇 PR -->
      <section v-if="showBots && botPrs.length" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          🤖 봇 PR ({{ botPrs.length }})
        </h2>
        <div class="overflow-hidden rounded-md border border-border">
          <table class="w-full text-sm">
            <tbody>
              <tr
                v-for="row in botPrs"
                :key="`${row.repoName}-${row.pr.number}-bot`"
                class="border-t border-border/50 hover:bg-accent/30"
              >
                <td class="px-2 py-1 font-mono text-xs">{{ row.repoName }}</td>
                <td class="px-2 py-1 font-mono text-xs text-muted-foreground w-12">
                  #{{ row.pr.number }}
                </td>
                <td class="px-2 py-1 truncate">
                  <a :href="row.pr.htmlUrl" target="_blank" rel="noopener" class="hover:underline">
                    {{ row.pr.title }}
                  </a>
                </td>
                <td class="px-2 py-1 text-xs text-muted-foreground w-28">
                  {{ row.pr.author.username }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 실패한 레포 -->
      <section v-if="failedRepos.length" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-wider text-amber-500">
          ⚠ 조회 실패 ({{ failedRepos.length }})
        </h2>
        <ul class="rounded-md border border-amber-500/30 bg-amber-500/5">
          <li
            v-for="r in failedRepos"
            :key="r.repoId"
            class="border-b border-amber-500/20 px-3 py-1.5 text-xs last:border-0"
          >
            <span class="font-mono">{{ r.repoName }}</span>
            <span class="ml-2 text-muted-foreground">
              {{ r.error?.split('\n')[0] || '?' }}
            </span>
          </li>
        </ul>
        <p class="mt-1 text-[10px] text-muted-foreground">
          힌트: forge 계정 (PAT) 미등록이거나 forge_kind=unknown 인 레포는 자동 skip 됩니다.
          설정 → Forge 계정 에서 등록.
        </p>
      </section>

      <div
        v-if="!isFetching && stats.total === 0 && failedRepos.length === 0"
        class="mt-12 text-center text-sm text-muted-foreground"
      >
        PR 없음. 워크스페이스 / 필터 / Forge 계정 등록 상태 확인.
      </div>
    </div>
  </div>
</template>
