// Sprint c80-2 — WorktreePanel 183 → <130 LOC 추출.
//
// 5 mutation (add/remove/prune/lock/unlock) + 3 handler (onLock/confirmRemove/onWorktreeDblClick)
// 통합. caller-decision: newPath/newBranch ref 는 caller 보유.
import { type Ref, type MaybeRefOrGetter, toRef } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  addWorktree,
  lockWorktree,
  pruneWorktrees,
  removeWorktree,
  unlockWorktree,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import { confirmDialog, promptDialog } from '@/composables/useConfirm'
import { useI18n } from 'vue-i18n'

interface UseWorktreePanelActionsOpts {
  repoId: MaybeRefOrGetter<number | null>
  newPath: Ref<string>
  newBranch: Ref<string>
}

export function useWorktreePanelActions(opts: UseWorktreePanelActionsOpts) {
  const { t } = useI18n()
  const toast = useToast()
  const qc = useQueryClient()
  const reposStore = useReposStore()
  const repoId = toRef(opts.repoId)

  function invalidateWorktrees() {
    qc.invalidateQueries({ queryKey: ['worktrees', repoId.value] })
  }

  const addMut = useMutation({
    mutationFn: () => {
      if (repoId.value == null || !opts.newPath.value) return Promise.reject(new Error('no path'))
      return addWorktree({
        repoId: repoId.value,
        path: opts.newPath.value,
        createBranch: opts.newBranch.value || undefined,
      })
    },
    onSuccess: () => {
      opts.newPath.value = ''
      opts.newBranch.value = ''
      invalidateWorktrees()
    },
    onError: (e) => toast.error('Worktree add 실패', describeError(e)),
  })

  const removeMut = useMutation({
    mutationFn: ({ p, force }: { p: string; force: boolean }) =>
      removeWorktree(repoId.value!, p, force),
    onSuccess: invalidateWorktrees,
  })

  const pruneMut = useMutation({
    mutationFn: () => pruneWorktrees(repoId.value!),
    onSuccess: invalidateWorktrees,
  })

  // C1 — Lock / Unlock
  const lockMut = useMutation({
    mutationFn: ({ p, reason }: { p: string; reason: string | null }) =>
      lockWorktree(repoId.value!, p, reason),
    onSuccess: () => {
      invalidateWorktrees()
      toast.success('Worktree 잠금', '')
    },
    onError: (e) => toast.error('Lock 실패', describeError(e)),
  })

  const unlockMut = useMutation({
    mutationFn: (p: string) => unlockWorktree(repoId.value!, p),
    onSuccess: () => {
      invalidateWorktrees()
      toast.success('Worktree 잠금 해제', '')
    },
    onError: (e) => toast.error('Unlock 실패', describeError(e)),
  })

  async function confirmRemove(path: string) {
    const ok = await confirmDialog({
      title: t('confirm.removeWorktreeTitle'),
      message: t('confirm.removeWorktreeMessage', { path }),
      danger: true,
    })
    if (ok) removeMut.mutate({ p: path, force: false })
  }

  async function onLock(path: string) {
    if (repoId.value == null) return
    const reason = await promptDialog({
      title: t('worktree.lockPromptTitle'),
      message: t('worktree.lockPromptMessage', { path }),
      placeholder: t('worktree.lockPromptPlaceholder'),
      defaultValue: '',
    })
    if (reason === null) return
    lockMut.mutate({ p: path, reason: reason.trim() || null })
  }

  function onUnlock(path: string) {
    if (repoId.value == null) return
    unlockMut.mutate(path)
  }

  function onWorktreeDblClick(wt: { path: string; isMain: boolean }) {
    if (wt.isMain) return
    if (repoId.value == null) return
    reposStore.setActiveRepo(repoId.value)
    toast.success(t('toast.activate'), wt.path)
  }

  return {
    addMut,
    removeMut,
    pruneMut,
    lockMut,
    unlockMut,
    confirmRemove,
    onLock,
    onUnlock,
    onWorktreeDblClick,
  }
}
