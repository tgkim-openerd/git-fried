// `git restore` 의미론 4축 mutation composable — Sprint c38 / plan/29 E1 (Restore Center).
//
// 기존 `useStageMutations.discardOne` 은 워킹트리 폐기만 처리 (= `git checkout --`).
// 본 composable 은 `git restore` 의 3 축 (--worktree / --staged / --source) 을
// 명시적으로 분리 → 사용자가 "되돌리는 대상" 과 "원본" 을 인지하고 선택 가능.
//
// 분리된 의미론 (StatusPanel 우클릭 메뉴에 4 액션):
//   1. restoreWorktree    : --worktree            (워킹트리만, 인덱스 보존)
//   2. restoreStaged      : --staged              (인덱스만 unstage, 워킹트리 보존)
//   3. restoreFromHead    : --staged --worktree --source=HEAD  (둘 다 HEAD 기준)
//   4. restoreFromCommit  : --staged --worktree --source=<sha> (특정 커밋 기준)
//
// 한글 메시지 + i18n 키 통일.
import { useMutation } from '@tanstack/vue-query'
import { restorePaths, type RestoreOpts } from '@/api/git'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { confirmDialog } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { describeError } from '@/api/errors'
import { i18n } from '@/i18n'

const t = i18n.global.t

export function useRestore(repoId: () => number | null) {
  const invalidate = useInvalidateRepoQueries()
  const toast = useToast()

  const restoreMut = useMutation({
    mutationFn: ({ id, paths, opts }: { id: number; paths: string[]; opts: RestoreOpts }) =>
      restorePaths(id, paths, opts),
    onSuccess: () => invalidate(repoId()),
    onError: (e) => toast.error(t('restore.failedTitle'), describeError(e)),
  })

  /**
   * Sprint c38 fix LOW-1 — `mutate` → `mutateAsync` 전환.
   * 기존: 호출자가 `await` 해도 IPC 완료 대기 안 함 (mutate 는 void 반환).
   * 변경: mutateAsync 가 Promise 반환 → 호출자가 await 시 완료 / 에러 정확 추적.
   * onError 토스트는 그대로 동작 (mutation option 유지).
   */

  /** 1. 워킹트리 복원 — 인덱스 보존, 워킹트리만 폐기. */
  async function restoreWorktree(paths: string[]): Promise<void> {
    const id = repoId()
    if (id == null || paths.length === 0) return
    const ok = await confirmDialog({
      title: t('restore.worktreeTitle'),
      message: t('restore.worktreeMessage', { n: paths.length, sample: paths[0] }),
      danger: true,
    })
    if (!ok) return
    await restoreMut
      .mutateAsync({
        id,
        paths,
        opts: { worktree: true, staged: false, source: null },
      })
      .catch(() => {
        /* onError 토스트가 이미 처리. await 쪽은 에러 swallow (UI 에서 throw 처리하면 토스트 중복). */
      })
  }

  /** 2. 인덱스 복원 (= unstage) — 워킹트리 보존. confirm 생략 (비파괴). */
  async function restoreStaged(paths: string[]): Promise<void> {
    const id = repoId()
    if (id == null || paths.length === 0) return
    await restoreMut
      .mutateAsync({
        id,
        paths,
        opts: { worktree: false, staged: true, source: null },
      })
      .catch(() => {})
  }

  /** 3. HEAD 기준 둘 다 복원 — 워킹트리 + 인덱스 모두 HEAD 로. */
  async function restoreFromHead(paths: string[]): Promise<void> {
    const id = repoId()
    if (id == null || paths.length === 0) return
    const ok = await confirmDialog({
      title: t('restore.fromHeadTitle'),
      message: t('restore.fromHeadMessage', { n: paths.length, sample: paths[0] }),
      danger: true,
    })
    if (!ok) return
    await restoreMut
      .mutateAsync({
        id,
        paths,
        opts: { worktree: true, staged: true, source: 'HEAD' },
      })
      .catch(() => {})
  }

  /** 4. 특정 커밋 기준 복원 — 워킹트리 + 인덱스 둘 다 source 로. */
  async function restoreFromCommit(paths: string[], source: string): Promise<void> {
    const id = repoId()
    if (id == null || paths.length === 0 || !source.trim()) return
    const ok = await confirmDialog({
      title: t('restore.fromCommitTitle'),
      message: t('restore.fromCommitMessage', {
        n: paths.length,
        sample: paths[0],
        source: source.trim(),
      }),
      danger: true,
    })
    if (!ok) return
    await restoreMut
      .mutateAsync({
        id,
        paths,
        opts: { worktree: true, staged: true, source: source.trim() },
      })
      .catch(() => {})
  }

  return {
    restoreMut,
    restoreWorktree,
    restoreStaged,
    restoreFromHead,
    restoreFromCommit,
  }
}
