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

interface SplitArgs {
  repoId: number
  path: string
  baseRev: string | null
  baseStaged: boolean
  currentRev: string | null
  currentStaged: boolean
  isUntracked: boolean
}

export function useFullscreenDiffSplitQuery(repoId: () => number | null, enabled: () => boolean) {
  const fs = useFullscreenDiff()
  const { data: status } = useStatus(repoId)

  const splitArgs = computed<SplitArgs | null>(() => {
    const cur = fs.current.value
    const id = repoId()
    if (!cur || id == null) return null

    if (cur.source === 'wip') {
      const isUntracked = !cur.isStaged && (status.value?.untracked.includes(cur.path) ?? false)
      if (isUntracked) {
        return {
          repoId: id,
          path: cur.path,
          baseRev: null,
          baseStaged: false,
          currentRev: null,
          currentStaged: false,
          isUntracked: true,
        }
      }
      if (cur.isStaged) {
        // staged: a=HEAD / b=index (staged 버전)
        return {
          repoId: id,
          path: cur.path,
          baseRev: 'HEAD',
          baseStaged: false,
          currentRev: null,
          currentStaged: true,
          isUntracked: false,
        }
      }
      // unstaged: a=index / b=working dir
      return {
        repoId: id,
        path: cur.path,
        baseRev: null,
        baseStaged: true,
        currentRev: null,
        currentStaged: false,
        isUntracked: false,
      }
    }
    // commit: a=parent (sha~) / b=commit (sha). root commit 은 baseRev=null fallback.
    return {
      repoId: id,
      path: cur.path,
      baseRev: `${cur.sha}~`,
      baseStaged: false,
      currentRev: cur.sha,
      currentStaged: false,
      isUntracked: false,
    }
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
