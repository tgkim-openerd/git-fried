// Sprint c54+++ Issue 2 — GitKraken parity Split (side-by-side) diff view query.
//
// 책임:
//   - useFullscreenDiff().current 의 source ('wip' / 'commit') + isStaged + untracked 분기로
//     base (a) / current (b) 두 readFile fetch
//   - WIP staged: a=HEAD / b=index (staged 파일)
//   - WIP unstaged: a=index / b=working dir
//   - WIP untracked: a='' / b=working dir (status.untracked 포함 시)
//   - commit: a=parent (sha~) / b=commit (sha)
//   - binary 감지 (null byte) — placeholder 반환
//
// useQuery 단일 (Promise.allSettled 로 두 readFile 동시), staleTime REALTIME.
// 부모 (FullscreenDiffView) 의 viewMode 'split' 에서만 enabled.

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { readFile } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
import { useStatus } from '@/composables/useStatus'

export interface SplitDiffData {
  base: string
  current: string
  isBinary: boolean
  isMissing: boolean // base 없음 (untracked 또는 root commit)
}

export interface SplitArgs {
  repoId: number
  path: string
  baseRev: string | null
  baseStaged: boolean
  currentRev: string | null
  currentStaged: boolean
  isUntracked: boolean
}

/**
 * c66-B: splitArgs state machine pure 함수 export.
 *
 * - current=null 또는 repoId=null → null
 * - wip + untracked path 포함 → isUntracked=true (base 빈, current readFile)
 * - wip + staged → baseRev=HEAD / currentStaged=true
 * - wip + unstaged → baseStaged=true / currentRev=null (working dir)
 * - commit → baseRev=`${sha}~` / currentRev=sha
 */
export function computeSplitArgs(
  current: { source: 'wip' | 'commit'; path: string; isStaged?: boolean; sha?: string } | null,
  repoId: number | null,
  untrackedPaths: readonly string[],
): SplitArgs | null {
  if (!current || repoId == null) return null

  if (current.source === 'wip') {
    const isUntracked = !current.isStaged && untrackedPaths.includes(current.path)
    if (isUntracked) {
      return {
        repoId,
        path: current.path,
        baseRev: null,
        baseStaged: false,
        currentRev: null,
        currentStaged: false,
        isUntracked: true,
      }
    }
    if (current.isStaged) {
      // staged: a=HEAD / b=index (staged 버전)
      return {
        repoId,
        path: current.path,
        baseRev: 'HEAD',
        baseStaged: false,
        currentRev: null,
        currentStaged: true,
        isUntracked: false,
      }
    }
    // unstaged: a=index / b=working dir
    return {
      repoId,
      path: current.path,
      baseRev: null,
      baseStaged: true,
      currentRev: null,
      currentStaged: false,
      isUntracked: false,
    }
  }
  // commit: a=parent (sha~) / b=commit (sha). root commit 은 baseRev=null fallback.
  return {
    repoId,
    path: current.path,
    baseRev: `${current.sha}~`,
    baseStaged: false,
    currentRev: current.sha ?? null,
    currentStaged: false,
    isUntracked: false,
  }
}

export function useFullscreenDiffSplitQuery(repoId: () => number | null, enabled: () => boolean) {
  const fs = useFullscreenDiff()
  const { data: status } = useStatus(repoId)

  const splitArgs = computed<SplitArgs | null>(() => {
    // c66-B: pure 함수 computeSplitArgs 위임 — fs.current + status.untracked 만 추출.
    return computeSplitArgs(fs.current.value ?? null, repoId(), status.value?.untracked ?? [])
  })

  const splitQuery = useQuery({
    queryKey: computed(() => {
      const a = splitArgs.value
      if (!a) return ['fullscreen-diff-split', 'idle'] as const
      return [
        'fullscreen-diff-split',
        a.repoId,
        a.path,
        a.baseRev,
        a.baseStaged,
        a.currentRev,
        a.currentStaged,
        a.isUntracked,
      ] as const
    }),
    queryFn: async (): Promise<SplitDiffData> => {
      const a = splitArgs.value
      if (!a) return { base: '', current: '', isBinary: false, isMissing: false }

      // untracked: base 빈, current readFile.
      if (a.isUntracked) {
        try {
          const content = await readFile(a.repoId, a.path, null, false)
          if (content.includes('\0')) {
            return { base: '', current: '', isBinary: true, isMissing: false }
          }
          return { base: '', current: content, isBinary: false, isMissing: true }
        } catch {
          return { base: '', current: '', isBinary: false, isMissing: true }
        }
      }

      // 두 readFile 병렬. base 실패 (root commit / 없는 ref) 는 빈 string 으로 fallback.
      const [base, current] = await Promise.allSettled([
        readFile(a.repoId, a.path, a.baseRev, a.baseStaged),
        readFile(a.repoId, a.path, a.currentRev, a.currentStaged),
      ])
      const baseText = base.status === 'fulfilled' ? base.value : ''
      const currentText = current.status === 'fulfilled' ? current.value : ''
      const baseMissing = base.status === 'rejected'
      const isBinary = baseText.includes('\0') || currentText.includes('\0')
      if (isBinary) {
        return { base: '', current: '', isBinary: true, isMissing: baseMissing }
      }
      return { base: baseText, current: currentText, isBinary: false, isMissing: baseMissing }
    },
    enabled: computed(() => enabled() && splitArgs.value != null),
    staleTime: STALE_TIME.REALTIME,
  })

  return { splitQuery, splitArgs }
}
