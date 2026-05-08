// Branch row 우클릭 액션 (`docs/plan/22 §3 CM-5`).
//
// BranchPanel 의 우클릭 메뉴 11 액션 빌더 + IPC 호출 + toast.
// useCommitActions 패턴 재사용.

import type { ContextMenuItem } from '@/components/ContextMenu.vue'
import { describeError } from '@/api/errors'
import {
  addWorktree,
  cherryPickSha,
  createBranch,
  createTag,
  deleteBranch,
  mergeBranch,
  push,
  rebaseBranch,
  renameBranch,
  reset,
  type ResetMode,
  switchBranch,
  type BranchInfo,
} from '@/api/git'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { confirmDialog, promptDialog } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

const t = i18n.global.t

/**
 * Sprint c54+++ ARCH-c54+++-003 — visibility / compare callbacks.
 *
 * `isHidden / isSolo / onToggleHide / onToggleSolo` 4건은 required — caller (BranchPanel /
 * useBranchInteraction wrapper) 가 항상 주입해야 메뉴에 visibility/compare 항목이 정상 동작.
 * 미주입 default 시 silent disable (회색 노출) 안 됨 — disabled 노출 = "기능 있다" 신호인데
 * 미작동 시 사용자 혼란.
 *
 * `onCompare` 만 optional — Mini sidebar 와 BranchPanel 의 compare 지원 차이 (Mini 는 미지원 OK).
 * onCompare 미주입 시 buildItems 가 해당 항목만 disabled 처리.
 */
export interface BranchActionCallbacks {
  isHidden: (name: string) => boolean
  isSolo: (name: string) => boolean
  onToggleHide: (branch: BranchInfo) => void
  onToggleSolo: (branch: BranchInfo) => void
  onCompare?: (branch: BranchInfo) => void
}

// "origin/foo" → "foo" (remote 브랜치 작업 시)
export function localBranchName(name: string): string {
  const parts = name.split('/')
  if (parts.length > 1) return parts.slice(1).join('/')
  return name
}

export function useBranchActions(getRepoId: () => number | null) {
  const toast = useToast()
  const invalidate = useInvalidateRepoQueries()

  function repoIdOrToast(): number | null {
    const id = getRepoId()
    if (id == null) {
      toast.warning(t('errors.noRepo'), t('errors.noRepoBody'))
      return null
    }
    return id
  }

  async function checkout(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.isHead) {
      toast.success(t('branchActions.alreadyHead'), branch.name)
      return
    }
    try {
      await switchBranch(id, localBranchName(branch.name), false)
      toast.success(t('branchActions.toastCheckoutSuccess'), branch.name)
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastCheckoutFail'), describeError(e))
    }
  }

  async function createFrom(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    const name = await promptDialog({
      title: t('branchActions.createFromTitle'),
      message: t('branchActions.createFromMessage', { from: branch.name }),
      defaultValue: `${localBranchName(branch.name)}-copy`,
    })
    if (!name?.trim()) return
    try {
      // start = remote 면 remote ref, local 이면 그대로 (git CLI 가 알아서 처리)
      await createBranch(id, name.trim(), branch.name)
      toast.success(t('toast.branchCreated'), `${name.trim()} from ${branch.name}`)
      invalidate(id)
    } catch (e) {
      toast.error(t('errors.branchCreateFailed'), describeError(e))
    }
  }

  async function rename(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.kind === 'remote') {
      toast.warning(
        t('branchActions.toastRenameFail'),
        t('branchActions.toastRenameRemoteForbidden'),
      )
      return
    }
    const next = await promptDialog({
      title: t('branchActions.renameTitle'),
      message: t('branchActions.renameMessage', { name: branch.name }),
      defaultValue: branch.name,
    })
    if (!next?.trim() || next.trim() === branch.name) return
    try {
      await renameBranch(id, branch.name, next.trim())
      toast.success(t('branchActions.toastRenameSuccess'), `${branch.name} → ${next.trim()}`)
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastRenameFail'), describeError(e))
    }
  }

  async function deleteBr(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.isHead) {
      toast.warning(t('branchActions.toastDeleteFail'), t('branchActions.toastDeleteHeadForbidden'))
      return
    }
    const force = branch.ahead > 0
    const ok = await confirmDialog({
      title: t('confirm.deleteBranchTitle'),
      message:
        t('confirm.deleteBranchMessage', { name: branch.name }) +
        (force ? '\n⚠ ' + t('confirm.deleteBranchForceHint') : ''),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteBranch(id, localBranchName(branch.name), force)
      toast.success(t('branchActions.toastDeleteSuccess'), branch.name)
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastDeleteFail'), describeError(e))
    }
  }

  async function mergeIntoHead(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.isHead) {
      toast.warning(t('branchActions.toastMergeFail'), t('branchActions.toastMergeSelfForbidden'))
      return
    }
    const ok = await confirmDialog({
      title: t('confirm.mergeIntoHeadTitle'),
      message: t('confirm.mergeIntoHeadMessage', { name: branch.name }),
      danger: true,
    })
    if (!ok) return
    try {
      const r = await mergeBranch(id, localBranchName(branch.name), true, false)
      if (r.success) {
        toast.success(t('branchActions.toastMergeSuccess'), `${branch.name} → HEAD`)
      } else if (r.conflicted) {
        toast.error(
          t('branchActions.toastMergeConflict'),
          t('branchActions.toastMergeConflictBody'),
        )
      } else {
        toast.error(t('branchActions.toastMergeFail'), r.stderr.slice(0, 200))
      }
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastMergeCallFail'), describeError(e))
    }
  }

  async function rebaseOnto(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.isHead) {
      toast.warning(t('branchActions.toastRebaseFail'), t('branchActions.toastRebaseSelfForbidden'))
      return
    }
    const ok = await confirmDialog({
      title: t('confirm.rebaseOntoTitle'),
      message: t('confirm.rebaseOntoMessage', { name: branch.name }),
      danger: true,
    })
    if (!ok) return
    try {
      const r = await rebaseBranch(id, localBranchName(branch.name))
      if (r.success) {
        toast.success(t('branchActions.toastRebaseSuccess'), `HEAD onto ${branch.name}`)
      } else if (r.conflicted) {
        toast.error(
          t('branchActions.toastRebaseConflict'),
          t('branchActions.toastRebaseConflictBody'),
        )
      } else {
        toast.error(t('branchActions.toastRebaseFail'), r.stderr.slice(0, 200))
      }
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastRebaseCallFail'), describeError(e))
    }
  }

  async function pushBranch(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.kind === 'remote') {
      toast.warning(t('branchActions.toastPushFail'), t('branchActions.toastPushRemoteForbidden'))
      return
    }
    try {
      const r = await push({
        repoId: id,
        branch: localBranchName(branch.name),
        setUpstream: false,
      })
      if (r.success) {
        toast.success(t('branchActions.toastPushSuccess'), branch.name)
      } else {
        toast.error(t('branchActions.toastPushFail'), r.stderr.slice(0, 200))
      }
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastPushCallFail'), describeError(e))
    }
  }

  // === Sprint c54+++ — GitKraken parity 9 신규 액션 ===
  // Copy 4 / Worktree create / Cherry pick / Reset (sub) / Tag create 2

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(
        t('toast.copied'),
        `${label}: ${text.slice(0, 40)}${text.length > 40 ? '…' : ''}`,
      )
    } catch (e) {
      toast.error(t('toast.copyFailed'), describeError(e))
    }
  }

  async function copyBranchName(branch: BranchInfo) {
    await copyText(branch.name, 'branch name')
  }

  async function copyCommitSha(branch: BranchInfo) {
    if (!branch.lastCommitSha) {
      toast.warning(
        t('branchActions.toastShaMissing'),
        t('branchActions.toastShaMissingBody', { name: branch.name }),
      )
      return
    }
    await copyText(branch.lastCommitSha, 'commit SHA')
  }

  // Forge URL — v1 단순 (브랜치 이름 + remote prefix 만). 실제 forge profile 통합은 c55+ TODO.
  // GitKraken 의 "Copy link to branch: origin/..." 와 비슷한 텍스트 (사용자가 PR/issue 에 붙여넣기).
  async function copyBranchLink(branch: BranchInfo) {
    // TODO(c55+): forge profile lookup → https://gitea.example/{owner}/{repo}/src/branch/{name}
    const linkText = branch.kind === 'remote' ? branch.name : `refs/heads/${branch.name}`
    await copyText(linkText, 'branch ref link')
  }

  async function copyCommitLinkOnRemote(branch: BranchInfo) {
    if (!branch.lastCommitSha) {
      toast.warning(
        t('branchActions.toastShaMissing'),
        t('branchActions.toastShaMissingBody', { name: branch.name }),
      )
      return
    }
    // TODO(c55+): forge profile → https://gitea.example/{owner}/{repo}/commit/{sha}
    const linkText = `${branch.lastCommitSha} (${branch.name})`
    await copyText(linkText, 'commit ref link')
  }

  async function createWorktreeFromBranch(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    const path = await promptDialog({
      title: t('branchActions.promptWorktreeTitle'),
      message: t('branchActions.promptWorktreeMessage', { branch: branch.name }),
      defaultValue: `../${localBranchName(branch.name)}-wt`,
    })
    if (!path?.trim()) return
    try {
      // remote 면 그 ref 그대로 startPoint, local 이면 그 branch
      await addWorktree({
        repoId: id,
        path: path.trim(),
        branch: branch.kind === 'local' ? branch.name : undefined,
        startPoint: branch.kind === 'remote' ? branch.name : undefined,
        createBranch: branch.kind === 'remote' ? localBranchName(branch.name) : undefined,
      })
      toast.success(t('branchActions.toastWorktreeSuccess'), `${path.trim()} from ${branch.name}`)
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastWorktreeFail'), describeError(e))
    }
  }

  async function cherryPickTip(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (!branch.lastCommitSha) {
      toast.warning(
        t('branchActions.toastCherryForbidden'),
        t('branchActions.toastShaMissingBody', { name: branch.name }),
      )
      return
    }
    const sha7 = branch.lastCommitSha.slice(0, 7)
    const ok = await confirmDialog({
      title: t('branchActions.confirmCherryTitle'),
      message: t('branchActions.confirmCherryMessage', { branch: branch.name, sha: sha7 }),
      danger: true,
    })
    if (!ok) return
    try {
      const r = await cherryPickSha(id, branch.lastCommitSha)
      if (r.success) toast.success(t('branchActions.toastCherrySuccess'), sha7)
      else if (r.conflicted)
        toast.error(
          t('branchActions.toastCherryConflict'),
          t('branchActions.toastMergeConflictBody'),
        )
      else toast.error(t('branchActions.toastCherryFail'), r.stderr.slice(0, 200))
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastCherryCallFail'), describeError(e))
    }
  }

  async function resetToBranch(branch: BranchInfo, mode: ResetMode) {
    const id = repoIdOrToast()
    if (id == null) return
    if (!branch.lastCommitSha) {
      toast.warning(
        t('branchActions.toastResetForbidden'),
        t('branchActions.toastShaMissingBody', { name: branch.name }),
      )
      return
    }
    const sha7 = branch.lastCommitSha.slice(0, 7)
    const isDestructive = mode === 'hard'
    const ok = await confirmDialog({
      title: t('branchActions.confirmResetTitle', { mode }),
      message:
        t('branchActions.confirmResetMessage', { branch: branch.name, sha: sha7, mode }) +
        (isDestructive ? '\n' + t('branchActions.confirmResetHardWarning') : ''),
      danger: isDestructive,
    })
    if (!ok) return
    try {
      await reset(id, mode, branch.lastCommitSha)
      toast.success(t('branchActions.toastResetSuccess', { mode }), sha7)
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastResetFail', { mode }), describeError(e))
    }
  }

  async function createTagAtBranch(branch: BranchInfo, annotated: boolean) {
    const id = repoIdOrToast()
    if (id == null) return
    if (!branch.lastCommitSha) {
      toast.warning(
        t('branchActions.toastTagForbidden'),
        t('branchActions.toastShaMissingBody', { name: branch.name }),
      )
      return
    }
    const tagName = await promptDialog({
      title: annotated
        ? t('branchActions.promptTagAnnotatedTitle')
        : t('branchActions.promptTagLightTitle'),
      message: t('branchActions.promptTagNameMessage', {
        branch: branch.name,
        sha: branch.lastCommitSha.slice(0, 7),
      }),
      defaultValue: '',
    })
    if (!tagName?.trim()) return
    let message: string | null = null
    if (annotated) {
      const m = await promptDialog({
        title: t('branchActions.promptTagAnnotationTitle'),
        message: t('branchActions.promptTagAnnotationMessage'),
        defaultValue: '',
      })
      if (!m?.trim()) return
      message = m.trim()
    }
    try {
      await createTag(id, tagName.trim(), branch.lastCommitSha, message)
      toast.success(
        t('branchActions.toastTagSuccess'),
        `${tagName.trim()} → ${branch.lastCommitSha.slice(0, 7)}`,
      )
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastTagFail'), describeError(e))
    }
  }

  async function setUpstream(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.kind === 'remote') {
      toast.warning(
        t('branchActions.toastUpstreamFail'),
        t('branchActions.toastUpstreamRemoteForbidden'),
      )
      return
    }
    try {
      const r = await push({
        repoId: id,
        branch: localBranchName(branch.name),
        setUpstream: true,
      })
      if (r.success) {
        toast.success(
          t('branchActions.toastUpstreamSuccess'),
          `${branch.name} → origin/${localBranchName(branch.name)}`,
        )
      } else {
        toast.error(t('branchActions.toastUpstreamFail'), r.stderr.slice(0, 200))
      }
      invalidate(id)
    } catch (e) {
      toast.error(t('branchActions.toastUpstreamFail'), describeError(e))
    }
  }

  /**
   * Branch row 우클릭 메뉴 항목 빌더 (11 액션).
   *
   * 액션 순서 (GitKraken 패턴):
   *   1. Checkout
   *   2. Create branch from...
   *   3. Rename (local 만)
   *   4. Delete (destructive)
   *   --
   *   5. Merge into HEAD
   *   6. Rebase HEAD onto this
   *   --
   *   7. Hide / Show (toggle)
   *   8. Solo / Unsolo (toggle)
   *   9. Compare with...
   *   --
   *  10. Push (local 만)
   *  11. Set upstream (local 만)
   */
  function buildItems(branch: BranchInfo, callbacks: BranchActionCallbacks): ContextMenuItem[] {
    const isRemote = branch.kind === 'remote'
    const hidden = callbacks.isHidden(branch.name)
    const solo = callbacks.isSolo(branch.name)

    return [
      {
        label: branch.isHead ? t('branchActions.cmCheckoutHead') : t('branchActions.cmCheckout'),
        icon: '✓',
        shortcut: '2×',
        disabled: branch.isHead,
        action: () => void checkout(branch),
      },
      {
        label: t('branchActions.cmCreateFrom'),
        icon: '🌿',
        action: () => void createFrom(branch),
      },
      {
        label: t('branchActions.cmRename'),
        icon: '✏',
        disabled: isRemote,
        action: () => void rename(branch),
      },
      {
        label: t('branchActions.cmDelete'),
        icon: '🗑',
        destructive: true,
        disabled: branch.isHead,
        action: () => void deleteBr(branch),
      },
      { divider: true },
      {
        label: t('branchActions.cmMergeIntoHead'),
        icon: '⇲',
        disabled: branch.isHead,
        action: () => void mergeIntoHead(branch),
      },
      {
        label: t('branchActions.cmRebaseOnto'),
        icon: '⇡',
        disabled: branch.isHead,
        action: () => void rebaseOnto(branch),
      },
      { divider: true },
      {
        label: hidden ? t('branchActions.cmShowInGraph') : t('branchActions.cmHideFromGraph'),
        icon: hidden ? '👁' : '🙈',
        action: () => callbacks.onToggleHide(branch),
      },
      {
        label: solo ? t('branchActions.cmExitSolo') : t('branchActions.cmSolo'),
        icon: '◉',
        action: () => callbacks.onToggleSolo(branch),
      },
      {
        label: t('branchActions.cmCompareWith'),
        icon: '⚖',
        disabled: !callbacks.onCompare,
        action: () => callbacks.onCompare?.(branch),
      },
      { divider: true },
      // === Sprint c54+++ — GitKraken parity 신규 9 액션 ===
      {
        label: t('branchActions.cmCreateWorktreeFrom'),
        icon: '🌳',
        action: () => void createWorktreeFromBranch(branch),
      },
      {
        label: t('branchActions.cmCherryPickTip'),
        icon: '🍒',
        disabled: !branch.lastCommitSha || branch.isHead,
        action: () => void cherryPickTip(branch),
      },
      {
        label: t('branchActions.cmResetHead'),
        icon: '⤺',
        disabled: !branch.lastCommitSha,
        submenu: [
          {
            label: t('branchActions.cmResetSoft'),
            action: () => void resetToBranch(branch, 'soft'),
          },
          {
            label: t('branchActions.cmResetMixed'),
            action: () => void resetToBranch(branch, 'mixed'),
          },
          {
            label: t('branchActions.cmResetHard'),
            destructive: true,
            action: () => void resetToBranch(branch, 'hard'),
          },
        ],
      },
      { divider: true },
      {
        label: t('branchActions.cmCreateTagLight'),
        icon: '🏷',
        disabled: !branch.lastCommitSha,
        action: () => void createTagAtBranch(branch, false),
      },
      {
        label: t('branchActions.cmCreateTagAnnotated'),
        icon: '🏷',
        disabled: !branch.lastCommitSha,
        action: () => void createTagAtBranch(branch, true),
      },
      { divider: true },
      {
        label: t('branchActions.cmPush'),
        icon: '⬆',
        disabled: isRemote,
        action: () => void pushBranch(branch),
      },
      {
        label: t('branchActions.cmSetUpstream'),
        icon: '🔗',
        disabled: isRemote || !!branch.upstream,
        action: () => void setUpstream(branch),
      },
      { divider: true },
      // Copy 4 (GitKraken parity)
      {
        label: t('branchActions.cmCopyName'),
        icon: '📋',
        action: () => void copyBranchName(branch),
      },
      {
        label: t('branchActions.cmCopySha'),
        icon: '📋',
        disabled: !branch.lastCommitSha,
        action: () => void copyCommitSha(branch),
      },
      {
        label: t('branchActions.cmCopyLink'),
        icon: '🔗',
        action: () => void copyBranchLink(branch),
      },
      {
        label: t('branchActions.cmCopyCommitLink'),
        icon: '🔗',
        disabled: !branch.lastCommitSha,
        action: () => void copyCommitLinkOnRemote(branch),
      },
    ]
  }

  return {
    buildItems,
    checkout,
    createFrom,
    rename,
    deleteBr,
    mergeIntoHead,
    rebaseOnto,
    pushBranch,
    setUpstream,
  }
}
