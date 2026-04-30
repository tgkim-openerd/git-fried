// Stage / unstage / discard / stageAll 통합 mutation composable.
// StatusPanel.vue 의 mutation 영역 추출 (StatusPanel God comp 분리, Sprint c29-6).
//
// useWorkspaceMutations 패턴 mirror — caller (StatusPanel) 는 helper 만 사용.
//
// 사용:
//   const stage = useStageMutations(() => props.repoId, () => status.value)
//   stage.stageOne(path) / stage.unstageOne(path) / stage.discardOne(path) / stage.stageAll() / stage.unstageAll()

import { useMutation } from '@tanstack/vue-query'
import { discardPaths, stageAll, stagePaths, unstagePaths } from '@/api/git'
import type { RepoStatus } from '@/types/git'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { confirmDialog } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

const t = i18n.global.t

export function useStageMutations(
  repoId: () => number | null,
  status: () => RepoStatus | null | undefined,
) {
  const invalidate = useInvalidateRepoQueries()

  const stageMut = useMutation({
    mutationFn: ({ id, paths }: { id: number; paths: string[] }) => stagePaths(id, paths),
    onSuccess: () => invalidate(repoId()),
  })
  const unstageMut = useMutation({
    mutationFn: ({ id, paths }: { id: number; paths: string[] }) => unstagePaths(id, paths),
    onSuccess: () => invalidate(repoId()),
  })
  const discardMut = useMutation({
    mutationFn: ({ id, paths }: { id: number; paths: string[] }) => discardPaths(id, paths),
    onSuccess: () => invalidate(repoId()),
  })
  const stageAllMut = useMutation({
    mutationFn: (id: number) => stageAll(id),
    onSuccess: () => invalidate(repoId()),
  })

  function stageOne(path: string): void {
    const id = repoId()
    if (id != null) stageMut.mutate({ id, paths: [path] })
  }
  function unstageOne(path: string): void {
    const id = repoId()
    if (id != null) unstageMut.mutate({ id, paths: [path] })
  }
  async function discardOne(path: string): Promise<void> {
    const id = repoId()
    if (id == null) return
    const ok = await confirmDialog({
      title: t('confirm.discardFileTitle'),
      message: t('confirm.discardFileMessage', { path }),
      danger: true,
    })
    if (ok) {
      discardMut.mutate({ id, paths: [path] })
    }
  }
  function stageAllAction(): void {
    const id = repoId()
    if (id != null) stageAllMut.mutate(id)
  }
  function unstageAllAction(): void {
    const id = repoId()
    if (id == null) return
    const paths = (status()?.staged ?? []).map((f) => f.path)
    if (paths.length === 0) return
    unstageMut.mutate({ id, paths })
  }

  return {
    // mutations (template 의 isPending 등 binding 용도)
    stageMut,
    unstageMut,
    discardMut,
    stageAllMut,
    // helpers
    stageOne,
    unstageOne,
    discardOne,
    stageAll: stageAllAction,
    unstageAll: unstageAllAction,
  }
}
