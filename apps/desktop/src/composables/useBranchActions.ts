// Branch row 우클릭 액션 (`docs/plan/22 §3 CM-5`).
//
// BranchPanel 의 우클릭 메뉴 11 액션 빌더 + IPC 호출 + toast.
// useCommitActions 패턴 재사용.

import type { ContextMenuItem } from '@/components/ContextMenu.vue'
import { describeError } from '@/api/errors'
import {
  createBranch,
  deleteBranch,
  mergeBranch,
  push,
  rebaseBranch,
  renameBranch,
  switchBranch,
  type BranchInfo,
} from '@/api/git'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'

export interface BranchActionCallbacks {
  onCompare?: (branch: BranchInfo) => void
  onToggleHide?: (branch: BranchInfo) => void
  onToggleSolo?: (branch: BranchInfo) => void
  isHidden?: (name: string) => boolean
  isSolo?: (name: string) => boolean
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
      toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
      return null
    }
    return id
  }

  async function checkout(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.isHead) {
      toast.success('이미 HEAD', branch.name)
      return
    }
    try {
      await switchBranch(id, localBranchName(branch.name), false)
      toast.success('Checkout', branch.name)
      invalidate(id)
    } catch (e) {
      toast.error('Checkout 실패', describeError(e))
    }
  }

  async function createFrom(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    const name = window.prompt(
      `새 브랜치 이름 (from ${branch.name}):`,
      `${localBranchName(branch.name)}-copy`,
    )
    if (!name?.trim()) return
    try {
      // start = remote 면 remote ref, local 이면 그대로 (git CLI 가 알아서 처리)
      await createBranch(id, name.trim(), branch.name)
      toast.success('브랜치 생성', `${name.trim()} from ${branch.name}`)
      invalidate(id)
    } catch (e) {
      toast.error('브랜치 생성 실패', describeError(e))
    }
  }

  async function rename(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.kind === 'remote') {
      toast.warning('Rename 불가', 'remote 브랜치는 rename 미지원')
      return
    }
    const next = window.prompt(
      `'${branch.name}' 새 이름:`,
      branch.name,
    )
    if (!next?.trim() || next.trim() === branch.name) return
    try {
      await renameBranch(id, branch.name, next.trim())
      toast.success('Rename', `${branch.name} → ${next.trim()}`)
      invalidate(id)
    } catch (e) {
      toast.error('Rename 실패', describeError(e))
    }
  }

  async function deleteBr(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.isHead) {
      toast.warning('Delete 불가', 'HEAD 브랜치는 삭제 불가')
      return
    }
    const force = branch.ahead > 0
    const msg =
      `브랜치 '${branch.name}' 삭제?` +
      (force ? '\n⚠ 머지되지 않은 커밋이 있어 강제 삭제 -D 합니다.' : '')
    if (!window.confirm(msg)) return
    try {
      await deleteBranch(id, localBranchName(branch.name), force)
      toast.success('Delete', branch.name)
      invalidate(id)
    } catch (e) {
      toast.error('Delete 실패', describeError(e))
    }
  }

  async function mergeIntoHead(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.isHead) {
      toast.warning('Merge 불가', '자기 자신 merge 불가')
      return
    }
    if (!window.confirm(`현재 HEAD 에 '${branch.name}' 머지?`)) return
    try {
      const r = await mergeBranch(id, localBranchName(branch.name), true, false)
      if (r.success) {
        toast.success('Merge 완료', `${branch.name} → HEAD`)
      } else if (r.conflicted) {
        toast.error('Merge 충돌', '변경 패널에서 해결')
      } else {
        toast.error('Merge 실패', r.stderr.slice(0, 200))
      }
      invalidate(id)
    } catch (e) {
      toast.error('Merge 호출 실패', describeError(e))
    }
  }

  async function rebaseOnto(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.isHead) {
      toast.warning('Rebase 불가', '자기 자신 rebase 불가')
      return
    }
    if (
      !window.confirm(
        `현재 HEAD 를 '${branch.name}' 위로 rebase?\n⚠ 충돌 시 --continue 필요.`,
      )
    )
      return
    try {
      const r = await rebaseBranch(id, localBranchName(branch.name))
      if (r.success) {
        toast.success('Rebase 완료', `HEAD onto ${branch.name}`)
      } else if (r.conflicted) {
        toast.error('Rebase 충돌', '변경 패널에서 해결 후 --continue')
      } else {
        toast.error('Rebase 실패', r.stderr.slice(0, 200))
      }
      invalidate(id)
    } catch (e) {
      toast.error('Rebase 호출 실패', describeError(e))
    }
  }

  async function pushBranch(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.kind === 'remote') {
      toast.warning('Push 불가', 'remote 브랜치는 push 대상 아님')
      return
    }
    try {
      const r = await push({
        repoId: id,
        branch: localBranchName(branch.name),
        setUpstream: false,
      })
      if (r.success) {
        toast.success('Push 완료', branch.name)
      } else {
        toast.error('Push 실패', r.stderr.slice(0, 200))
      }
      invalidate(id)
    } catch (e) {
      toast.error('Push 호출 실패', describeError(e))
    }
  }

  async function setUpstream(branch: BranchInfo) {
    const id = repoIdOrToast()
    if (id == null) return
    if (branch.kind === 'remote') {
      toast.warning('Set upstream 불가', 'remote 브랜치')
      return
    }
    try {
      const r = await push({
        repoId: id,
        branch: localBranchName(branch.name),
        setUpstream: true,
      })
      if (r.success) {
        toast.success('upstream 설정', `${branch.name} → origin/${localBranchName(branch.name)}`)
      } else {
        toast.error('Set upstream 실패', r.stderr.slice(0, 200))
      }
      invalidate(id)
    } catch (e) {
      toast.error('Set upstream 호출 실패', describeError(e))
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
  function buildItems(
    branch: BranchInfo,
    callbacks: BranchActionCallbacks = {},
  ): ContextMenuItem[] {
    const isRemote = branch.kind === 'remote'
    const hidden = callbacks.isHidden?.(branch.name) ?? false
    const solo = callbacks.isSolo?.(branch.name) ?? false

    return [
      {
        label: branch.isHead ? 'Checkout (이미 HEAD)' : 'Checkout',
        icon: '✓',
        shortcut: '2×',
        disabled: branch.isHead,
        action: () => void checkout(branch),
      },
      {
        label: 'Create branch from...',
        icon: '🌿',
        action: () => void createFrom(branch),
      },
      {
        label: 'Rename',
        icon: '✏',
        disabled: isRemote,
        action: () => void rename(branch),
      },
      {
        label: 'Delete',
        icon: '🗑',
        destructive: true,
        disabled: branch.isHead,
        action: () => void deleteBr(branch),
      },
      { divider: true },
      {
        label: 'Merge into HEAD',
        icon: '⇲',
        disabled: branch.isHead,
        action: () => void mergeIntoHead(branch),
      },
      {
        label: 'Rebase HEAD onto this',
        icon: '⇡',
        disabled: branch.isHead,
        action: () => void rebaseOnto(branch),
      },
      { divider: true },
      {
        label: hidden ? 'Show in graph' : 'Hide from graph',
        icon: hidden ? '👁' : '🙈',
        disabled: !callbacks.onToggleHide,
        action: () => callbacks.onToggleHide?.(branch),
      },
      {
        label: solo ? 'Exit solo' : 'Solo (이 브랜치만 표시)',
        icon: '◉',
        disabled: !callbacks.onToggleSolo,
        action: () => callbacks.onToggleSolo?.(branch),
      },
      {
        label: 'Compare with...',
        icon: '⚖',
        disabled: !callbacks.onCompare,
        action: () => callbacks.onCompare?.(branch),
      },
      { divider: true },
      {
        label: 'Push',
        icon: '⬆',
        disabled: isRemote,
        action: () => void pushBranch(branch),
      },
      {
        label: 'Set upstream',
        icon: '🔗',
        disabled: isRemote || !!branch.upstream,
        action: () => void setUpstream(branch),
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
