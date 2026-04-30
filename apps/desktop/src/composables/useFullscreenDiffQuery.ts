// Sprint c35 god 16/N — FullscreenDiffView.vue 의 patch query 영역 추출.
//
// 책임:
//   - useFullscreenDiff().current 의 source ('wip' / 'commit') 분기로 queryArgs 계산
//   - commit context 시 diffRev (parent..commit) 적용 — `git diff sha~..sha`
//     (working dir 비교 vs commit 변경 분리)
//   - patchQuery (getDiff IPC) — staleTime REALTIME
//   - hunkCount + hunkNavDisabled computed (헤더 ↑↓ 네비 disable)
//
// 부모 (FullscreenDiffView) 는 viewMode / DiffViewer ref / blame / file viewer 만 관리.
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getDiff } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'

export function useFullscreenDiffQuery(repoId: () => number | null) {
  const fs = useFullscreenDiff()

  const queryArgs = computed(() => {
    const cur = fs.current.value
    const id = repoId()
    if (!cur || id == null) return null
    if (cur.source === 'wip') {
      return {
        repoId: id,
        staged: cur.isStaged,
        path: cur.path,
        rev: null as string | null,
      }
    }
    return {
      repoId: id,
      staged: false,
      path: cur.path,
      rev: cur.sha,
    }
  })

  // Phase 14-3 — diff query 전용 rev (parent..commit). File / Blame 쿼리는 단일 sha 유지.
  //   기존: getDiff(rev=sha) → backend `git diff sha -- path` = sha~working dir 비교 → 같으면 empty.
  //   변경: diff query 만 rev=`sha~..sha` → backend `git diff sha~..sha -- path` = 그 commit 의 파일 변경.
  //   (root commit 의 경우 ~ 없어서 git error — rare 케이스, fallback 추후.)
  const diffRev = computed<string | null>(() => {
    const cur = fs.current.value
    if (!cur || cur.source !== 'commit') return null
    return `${cur.sha}~..${cur.sha}`
  })

  const patchQuery = useQuery({
    queryKey: computed(() => {
      const a = queryArgs.value
      if (!a) return ['fullscreen-diff', 'idle'] as const
      // Phase 14-3 — commit context 시 diffRev (parent..commit) 사용.
      const rev = diffRev.value ?? a.rev
      return ['fullscreen-diff', a.repoId, a.staged, a.path, rev] as const
    }),
    queryFn: () => {
      const a = queryArgs.value
      if (!a) return Promise.resolve('')
      const rev = diffRev.value ?? a.rev
      return getDiff({
        repoId: a.repoId,
        staged: a.staged,
        path: a.path,
        rev,
        context: 3,
      })
    },
    enabled: computed(() => queryArgs.value != null),
    staleTime: STALE_TIME.REALTIME,
  })

  // patch 의 hunk 헤더 카운트 — DiffViewer.hunkCount() 는 reactive 아님이므로 자체 셈.
  const hunkCount = computed(() => {
    const p = patchQuery.data.value
    if (!p) return 0
    return (p.match(/^@@\s/gm) ?? []).length
  })
  const hunkNavDisabled = computed(() => hunkCount.value <= 1)

  return {
    queryArgs,
    diffRev,
    patchQuery,
    hunkCount,
    hunkNavDisabled,
  }
}
