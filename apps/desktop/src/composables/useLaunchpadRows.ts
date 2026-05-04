// launchpad.vue 에서 추출 (2026-05-04 /analyze 후속).
// bulkListPrs query + derived rows (flat / searched / human/bot / pinned / snoozed / active).
// 통계 (stats) + 실패 repo 목록.
//
// 사용:
//   const meta = useLaunchpadMeta()
//   const rows = useLaunchpadRows({
//     workspaceId: () => store.activeWorkspaceId,
//     stateFilter: () => stateFilter.value,
//     matches: matchesQuery,         // useLaunchpadFilter().matches
//     isPinned: (pr) => meta.isPinned(pr),
//     snoozeRemaining: (pr) => meta.snoozeRemaining(pr),
//   })
//   rows.activeNotSnoozedRows / rows.pinnedRows / rows.snoozedRows / rows.botPrs / rows.stats
//
// isBot 휴리스틱은 여기서 캡슐화 (모든 row 분류의 단일 출처).
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { bulkListPrs } from '@/api/git'
import type { BulkResult, PrState, PullRequest } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'

export interface FlatRow {
  repoName: string
  pr: PullRequest
}

export interface UseLaunchpadRowsOpts {
  workspaceId: () => number | null
  stateFilter: () => PrState | null
  matches: (row: FlatRow) => boolean
  isPinned: (pr: PullRequest) => boolean
  snoozeRemaining: (pr: PullRequest) => number | null
}

export function isBot(pr: PullRequest): boolean {
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

export function useLaunchpadRows(opts: UseLaunchpadRowsOpts) {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: computed(() => ['launchpad-prs', opts.workspaceId(), opts.stateFilter()]),
    queryFn: () => bulkListPrs(opts.workspaceId(), opts.stateFilter()),
    staleTime: STALE_TIME.NORMAL,
  })

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

  const searchedRows = computed(() => flatRows.value.filter(opts.matches))
  const humanPrs = computed(() => searchedRows.value.filter((r) => !isBot(r.pr)))
  const botPrs = computed(() => searchedRows.value.filter((r) => isBot(r.pr)))

  const pinnedRows = computed(() => humanPrs.value.filter((r) => opts.isPinned(r.pr)))
  const snoozedRows = computed(() =>
    humanPrs.value.filter((r) => opts.snoozeRemaining(r.pr) != null),
  )

  const activeNotSnoozedRows = computed(() => {
    // tab='active' 의 메인 리스트: pinned 우선, 그 다음 일반 (snoozed 제외).
    const list = humanPrs.value.filter((r) => opts.snoozeRemaining(r.pr) == null)
    return list.slice().sort((a, b) => {
      const ap = opts.isPinned(a.pr) ? 1 : 0
      const bp = opts.isPinned(b.pr) ? 1 : 0
      if (ap !== bp) return bp - ap // pinned 먼저
      return b.pr.updatedAt - a.pr.updatedAt // 최신 갱신 먼저
    })
  })

  const failedRepos = computed<BulkResult<PullRequest[]>[]>(() =>
    (data.value ?? []).filter((r) => !r.success),
  )

  const stats = computed(() => ({
    total: flatRows.value.length,
    human: humanPrs.value.length,
    bot: botPrs.value.length,
    pinned: pinnedRows.value.length,
    snoozed: snoozedRows.value.length,
    reposWithPrs: new Set(flatRows.value.map((r) => r.repoName)).size,
    reposScanned: data.value?.length ?? 0,
    failed: failedRepos.value.length,
  }))

  return {
    data,
    isFetching,
    error,
    refetch,
    flatRows,
    searchedRows,
    humanPrs,
    botPrs,
    pinnedRows,
    snoozedRows,
    activeNotSnoozedRows,
    failedRepos,
    stats,
    isBot,
  }
}
