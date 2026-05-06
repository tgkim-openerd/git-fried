// Sprint c48 Wave B-3 — HunkStageModal.vue script 235 LOC 분리.
//
// 본 composable: hunk apply / line apply / restore worktree mutation 통합.
//   - applyMut (apply_patch IPC, hunk 또는 line 단위)
//   - restoreWtMut (restore_worktree_patch IPC, hunk 또는 line 단위)
//   - 4 핸들러: applyHunk / applySelectedLines / restoreHunkToWorktree(linesOnly) / applyAllHunks
//
// SFC 는 expanded state / lineColor / template + ctxMenu builder 만 담당.
import { computed, type ComputedRef } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { applyPatch, getDiff, restoreWorktreePatch } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useHunkLineSelection } from '@/composables/useHunkLineSelection'
import { confirmDialog } from '@/composables/useConfirm'
import {
  buildHunkPatch,
  buildLinePatch,
  parseDiffWithHunks,
  type DiffFileWithHunks,
  type DiffHunk,
} from '@/utils/parseDiff'
import { useI18n } from 'vue-i18n'

interface UseHunkStageActionsArgs {
  repoId: ComputedRef<number | null> | (() => number | null)
  path: ComputedRef<string | null> | (() => string | null)
  staged: ComputedRef<boolean> | (() => boolean)
  open: ComputedRef<boolean> | (() => boolean)
}

function unwrap<T>(v: ComputedRef<T> | (() => T)): T {
  return typeof v === 'function' ? v() : v.value
}

export function useHunkStageActions(args: UseHunkStageActionsArgs) {
  const { t } = useI18n()
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()

  const diffQuery = useQuery({
    queryKey: computed(
      () => ['hunk-diff', unwrap(args.repoId), unwrap(args.path), unwrap(args.staged)] as const,
    ),
    queryFn: () => {
      const repoId = unwrap(args.repoId)
      const path = unwrap(args.path)
      if (repoId == null || !path) return Promise.resolve('')
      return getDiff({
        repoId,
        staged: unwrap(args.staged),
        path,
        context: null,
      })
    },
    enabled: computed(
      () => unwrap(args.open) && unwrap(args.repoId) != null && unwrap(args.path) != null,
    ),
    // staleTime=0 의도적 (always-fresh): hunk-stage 모달 진입 시 항상 최신 patch 필요.
    staleTime: 0,
  })

  const file = computed<DiffFileWithHunks | null>(() => {
    const raw = diffQuery.data.value || ''
    return parseDiffWithHunks(raw)[0] ?? null
  })

  const hunks = computed<DiffHunk[]>(() => file.value?.hunks ?? [])

  // Sprint c40 후속 — 라인 선택 state composable 위임.
  const sel = useHunkLineSelection(hunks)

  const applyMut = useMutation({
    mutationFn: (a: { patch: string; what: string }) => {
      const repoId = unwrap(args.repoId)
      if (repoId == null) return Promise.reject(new Error(t('hunkStage.errRepoNotSelected')))
      return applyPatch(repoId, a.patch, unwrap(args.staged)).then(() => a.what)
    },
    onSuccess: (what) => {
      const action = unwrap(args.staged) ? t('hunkStage.actionUnstage') : t('hunkStage.actionStage')
      toast.success(t('hunkStage.applySuccessTitle', { what, action }), '')
      invalidate(unwrap(args.repoId))
      diffQuery.refetch()
      sel.resetAll()
    },
    onError: (e) =>
      toast.error(
        unwrap(args.staged) ? t('hunkStage.unstageFailed') : t('hunkStage.stageFailed'),
        describeError(e),
      ),
  })

  function applyHunk(idx: number) {
    const f = file.value
    const h = hunks.value[idx]
    if (!f || !h) return
    applyMut.mutate({ patch: buildHunkPatch(f, h), what: t('hunkStage.wholeHunk') })
  }

  function applySelectedLines(hunkIdx: number) {
    const f = file.value
    const h = hunks.value[hunkIdx]
    const s = sel.selected.value.get(hunkIdx)
    if (!f || !h || !s || s.size === 0) return
    const patch = buildLinePatch(f, h, s)
    if (!patch) {
      toast.warning(t('hunkStage.noChange'), t('hunkStage.noChangeMessage'))
      return
    }
    applyMut.mutate({ patch, what: t('hunkStage.linesSuffix', { n: s.size }) })
  }

  // Sprint c38 / plan/29 E1 후속 — hunk-level restore worktree (discard hunk).
  const restoreWtMut = useMutation({
    mutationFn: (a: { patch: string; what: string }) => {
      const repoId = unwrap(args.repoId)
      if (repoId == null) return Promise.reject(new Error(t('hunkStage.errRepoNotSelected')))
      return restoreWorktreePatch(repoId, a.patch).then(() => a.what)
    },
    onSuccess: (what) => {
      toast.success(t('hunkStage.restoreSuccessTitle', { what }), '')
      invalidate(unwrap(args.repoId))
      diffQuery.refetch()
      sel.resetAll()
    },
    onError: (e) => toast.error(t('hunkStage.restoreFailed'), describeError(e)),
  })

  async function restoreHunkToWorktree(hunkIdx: number, linesOnly: boolean) {
    const f = file.value
    const h = hunks.value[hunkIdx]
    if (!f || !h) return
    let patch: string | null
    let what: string
    if (linesOnly) {
      const s = sel.selected.value.get(hunkIdx)
      if (!s || s.size === 0) return
      patch = buildLinePatch(f, h, s)
      what = t('hunkStage.linesSuffix', { n: s.size })
    } else {
      patch = buildHunkPatch(f, h)
      what = t('hunkStage.wholeHunk')
    }
    if (!patch) {
      toast.warning(t('hunkStage.noChange'), t('hunkStage.noChangeMessage'))
      return
    }
    const ok = await confirmDialog({
      title: t('hunkStage.restoreConfirmTitle'),
      message: t('hunkStage.restoreConfirmMessage', { what, path: unwrap(args.path) ?? '' }),
      danger: true,
    })
    if (!ok) return
    restoreWtMut.mutate({ patch, what })
  }

  function applyAllHunks() {
    const f = file.value
    if (!f || hunks.value.length === 0) return
    const tail = hunks.value.map((h) => `${h.header}\n${h.bodyLines.join('\n')}`).join('\n')
    const patch = `${f.fileHeader}\n${tail}\n`
    applyMut.mutate({ patch, what: t('hunkStage.wholeHunk') })
  }

  return {
    // queries / data
    diffQuery,
    file,
    hunks,
    // line selection (re-export)
    selected: sel.selected,
    isSelected: sel.isSelected,
    toggleLine: sel.toggleLine,
    selectAllLines: sel.selectAllLines,
    clearLines: sel.clearLines,
    totalSelected: sel.totalSelected,
    // mutations
    applyMut,
    restoreWtMut,
    // actions
    applyHunk,
    applySelectedLines,
    restoreHunkToWorktree,
    applyAllHunks,
  }
}

export type { DiffFileWithHunks, DiffHunk }
