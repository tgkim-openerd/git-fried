// Launchpad PR meta — Pin / Snooze / Saved Views (Sprint A4 / `docs/plan/11 §14`).
//
// Pin / Snooze 결정은 SQLite 영속, list_active 가 만료 snooze 자동 필터.
// Frontend 는 PullRequest 응답과 5-tuple 매칭 → meta 부여.

import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  inferBaseUrl,
  launchpadDeleteView,
  launchpadListActive,
  launchpadListViews,
  launchpadSaveView,
  launchpadSetPinned,
  launchpadSetSnooze,
  type PrIdentifier,
  type PrMeta,
  type PullRequest,
  type SavedView,
} from '@/api/git'

export const LAUNCHPAD_VIEW_KIND = 'launchpad_pr'

export function prIdFromPr(pr: PullRequest): PrIdentifier {
  return {
    forgeKind: pr.forgeKind,
    baseUrl: inferBaseUrl(pr.forgeKind),
    owner: pr.owner,
    repo: pr.repo,
    number: pr.number,
  }
}

function metaKey(m: PrMeta): string {
  return `${m.forgeKind}|${m.baseUrl}|${m.owner}|${m.repo}|${m.number}`
}
function idKey(id: PrIdentifier): string {
  return `${id.forgeKind}|${id.baseUrl}|${id.owner}|${id.repo}|${id.number}`
}

/**
 * 모든 active PR meta (pinned + 미만료 snooze) 를 Map 으로 반환.
 * Launchpad row 가 매칭 lookup 에 사용.
 */
export function useLaunchpadMeta() {
  const qc = useQueryClient()

  const activeQuery = useQuery({
    queryKey: ['launchpad-meta-active'],
    queryFn: () => launchpadListActive(),
    staleTime: 60_000,
  })

  const metaMap = computed(() => {
    const map = new Map<string, PrMeta>()
    for (const m of activeQuery.data.value ?? []) {
      map.set(metaKey(m), m)
    }
    return map
  })

  function metaFor(pr: PullRequest): PrMeta | null {
    return metaMap.value.get(idKey(prIdFromPr(pr))) ?? null
  }

  function isPinned(pr: PullRequest): boolean {
    return metaFor(pr)?.pinned ?? false
  }

  function snoozeRemaining(pr: PullRequest): number | null {
    const m = metaFor(pr)
    if (!m?.snoozedUntil) return null
    const now = Math.floor(Date.now() / 1000)
    return m.snoozedUntil > now ? m.snoozedUntil - now : null
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['launchpad-meta-active'] })
  }

  const pinMut = useMutation({
    mutationFn: ({ pr, pinned }: { pr: PullRequest; pinned: boolean }) =>
      launchpadSetPinned(prIdFromPr(pr), pinned),
    onSuccess: () => invalidate(),
  })

  const snoozeMut = useMutation({
    mutationFn: ({
      pr,
      snoozedUntil,
    }: {
      pr: PullRequest
      snoozedUntil: number | null
    }) => launchpadSetSnooze(prIdFromPr(pr), snoozedUntil),
    onSuccess: () => invalidate(),
  })

  function snoozeFor(pr: PullRequest, deltaSec: number) {
    const until = Math.floor(Date.now() / 1000) + deltaSec
    snoozeMut.mutate({ pr, snoozedUntil: until })
  }

  function clearSnooze(pr: PullRequest) {
    snoozeMut.mutate({ pr, snoozedUntil: null })
  }

  return {
    activeQuery,
    metaMap,
    metaFor,
    isPinned,
    snoozeRemaining,
    pinMut,
    snoozeMut,
    snoozeFor,
    clearSnooze,
  }
}

// ====== Saved Views ======

export function useSavedViews(viewKind: string) {
  const qc = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['saved-views', viewKind],
    queryFn: () => launchpadListViews(viewKind),
    staleTime: 60_000,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['saved-views', viewKind] })
  }

  const saveMut = useMutation({
    mutationFn: (args: {
      name: string
      filterJson: string
      sortJson?: string | null
    }) =>
      launchpadSaveView({
        viewKind,
        name: args.name,
        filterJson: args.filterJson,
        sortJson: args.sortJson,
      }),
    onSuccess: () => invalidate(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => launchpadDeleteView(id),
    onSuccess: () => invalidate(),
  })

  return {
    listQuery,
    views: computed<SavedView[]>(() => listQuery.data.value ?? []),
    saveMut,
    deleteMut,
  }
}
