// Sprint c40 god comp 분리 — BranchPanel.vue 의 drag-drop (branch↔branch /
// commit→branch) 영역 외부화 (/analyze 후속 — BranchPanel 518 LOC).
//
// 책임:
//   - dragOverIdx ref + DT_BRANCH/DT_COMMIT MIME 상수
//   - onDragStartBranch / onDragOverRow / onDragLeaveRow
//   - onDropOnBranch (commit→branch cherry-pick / branch→branch merge|rebase)
//
// 사용:
//   const { dragOverIdx, onDragStartBranch, onDragOverRow, onDragLeaveRow,
//           onDropOnBranch } = useBranchDragDrop({
//     repoId: () => props.repoId,
//     localName,
//     switchAsync: (id, name) => switchMut.mutateAsync({ id, name }),
//   })
//
// LOC 절감: BranchPanel 173-279 (107 LOC) + import 정리 ≈ 110 LOC 절감.
import { ref } from 'vue'
import type { BranchInfo } from '@/api/git'
import { cherryPickSha, mergeBranch, rebaseBranch } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useI18n } from 'vue-i18n'
import { confirmDialog, promptDialog } from '@/composables/useConfirm'
// Plan #42 M-1.2 squashByDefault wire (Sprint c98 Codex 7차 audit MED) —
// drag-drop merge path 도 commitSquashByDefault 적용.
import { useGeneralSettings } from '@/composables/useUserSettings'

const DT_BRANCH = 'application/x-git-fried-branch'
const DT_COMMIT = 'application/x-git-fried-commit'

export interface UseBranchDragDropOptions {
  repoId: () => number | null
  localName: (name: string) => string
  switchAsync: (id: number, name: string) => Promise<unknown>
}

export function useBranchDragDrop(opts: UseBranchDragDropOptions) {
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()
  const { t } = useI18n()
  // Plan #42 M-1.2 wire (Codex 7차 audit MED) — drag-drop merge 도 squash 적용.
  const general = useGeneralSettings()

  const dragOverIdx = ref<number | null>(null)

  function onDragStartBranch(b: BranchInfo, ev: DragEvent) {
    if (!ev.dataTransfer) return
    ev.dataTransfer.setData(DT_BRANCH, b.name)
    ev.dataTransfer.effectAllowed = 'move'
  }

  function onDragOverRow(idx: number, ev: DragEvent) {
    if (!ev.dataTransfer) return
    const types = ev.dataTransfer.types
    if (types.includes(DT_BRANCH) || types.includes(DT_COMMIT)) {
      ev.preventDefault()
      dragOverIdx.value = idx
    }
  }

  function onDragLeaveRow(idx: number) {
    if (dragOverIdx.value === idx) dragOverIdx.value = null
  }

  async function onDropOnBranch(target: BranchInfo, ev: DragEvent) {
    ev.preventDefault()
    dragOverIdx.value = null
    const repoId = opts.repoId()
    if (!ev.dataTransfer || repoId == null) return
    const branchName = ev.dataTransfer.getData(DT_BRANCH)
    const commitSha = ev.dataTransfer.getData(DT_COMMIT)

    if (commitSha) {
      // commit → branch (cherry-pick onto branch).
      const ok = await confirmDialog({
        title: t('confirm.cherryPickTitle'),
        message: t('confirm.cherryPickMessage', {
          sha: commitSha.slice(0, 7),
          branch: target.name,
        }),
      })
      if (!ok) return
      try {
        const r = await cherryPickSha(repoId, commitSha, opts.localName(target.name))
        if (r.success) {
          toast.success('Cherry-pick 완료', target.name)
          invalidate(repoId)
        } else if (r.conflicted) {
          toast.error(t('errors.conflictOccurred'), t('errors.conflictBody'))
          invalidate(repoId)
        } else {
          toast.error('Cherry-pick 실패', r.stderr.slice(0, 200))
        }
      } catch (e) {
        toast.error('Cherry-pick 호출 실패', describeError(e))
      }
      return
    }

    if (branchName && branchName !== target.name) {
      // branch (source) → branch (target). GitKraken UX: drop A onto B = target B 위로.
      // Sprint c40 후속 review SEC-011/TYPE-002: window.prompt → promptDialog
      // (a11y / 한글 IME / 일관된 dialog UI).
      const action = await promptDialog({
        title: t('branchDragDrop.actionTitle'),
        message: t('branchDragDrop.actionMessage', {
          source: branchName,
          target: target.name,
        }),
        defaultValue: 'm',
        placeholder: 'm | r | cancel',
      })
      if (!action) return
      const a = action.trim().toLowerCase()
      try {
        if (a === 'm' || a === 'merge') {
          await opts.switchAsync(repoId, opts.localName(target.name))
          // Plan #42 M-1.2 wire — Settings.commitSquashByDefault 적용.
          const useSquash = general.value.commitSquashByDefault
          const r = await mergeBranch(
            repoId,
            opts.localName(branchName),
            !useSquash, // noFf: squash 시 false (--squash 가 no-ff 자동)
            false,
            useSquash,
          )
          if (r.success) {
            toast.success(
              useSquash ? t('branchActions.toastMergeSquashSuccess') : 'Merge 완료',
              `${branchName} → ${target.name}`,
            )
          } else if (r.conflicted) {
            toast.error('Merge 충돌', '변경 패널에서 해결')
          } else {
            toast.error('Merge 실패', r.stderr.slice(0, 200))
          }
          invalidate(repoId)
        } else if (a === 'r' || a === 'rebase') {
          await opts.switchAsync(repoId, opts.localName(branchName))
          const r = await rebaseBranch(repoId, opts.localName(target.name))
          if (r.success) {
            toast.success('Rebase 완료', `${branchName} onto ${target.name}`)
          } else if (r.conflicted) {
            toast.error('Rebase 충돌', '변경 패널에서 해결 후 --continue')
          } else {
            toast.error('Rebase 실패', r.stderr.slice(0, 200))
          }
          invalidate(repoId)
        }
      } catch (e) {
        toast.error(t('errors.callFailed'), describeError(e))
      }
    }
  }

  return {
    dragOverIdx,
    onDragStartBranch,
    onDragOverRow,
    onDragLeaveRow,
    onDropOnBranch,
  }
}
