// Commit row 우클릭 액션 (`docs/plan/22 §3 CM-1/CM-2`).
//
// CommitGraph + CommitTable 양쪽에서 같은 액션 메뉴 재사용.
// ContextMenuItem[] 빌더 + 실제 IPC 호출 + toast.

import type { ContextMenuItem } from '@/components/ContextMenu.vue'
import { describeError } from '@/api/errors'
import {
  cherryPickSha,
  createBranch,
  createTag,
  reset as ipcReset,
  revert as ipcRevert,
  type ResetMode,
} from '@/api/git'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'

export function useCommitActions(getRepoId: () => number | null) {
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

  async function copySha(sha: string) {
    try {
      await navigator.clipboard.writeText(sha)
      toast.success('SHA 복사', sha.slice(0, 8))
    } catch (e) {
      toast.error('복사 실패', describeError(e))
    }
  }

  async function cherryPick(sha: string) {
    const id = repoIdOrToast()
    if (id == null) return
    if (!window.confirm(`현재 HEAD 에 cherry-pick: ${sha.slice(0, 8)}?`)) return
    try {
      await cherryPickSha(id, sha)
      toast.success('Cherry-pick 완료', sha.slice(0, 8))
      invalidate(id)
    } catch (e) {
      toast.error('Cherry-pick 실패', describeError(e))
    }
  }

  async function revert(sha: string) {
    const id = repoIdOrToast()
    if (id == null) return
    if (!window.confirm(`Revert commit (새 commit 생성): ${sha.slice(0, 8)}?`))
      return
    try {
      await ipcRevert(id, sha, false)
      toast.success('Revert 완료', sha.slice(0, 8))
      invalidate(id)
    } catch (e) {
      toast.error('Revert 실패', describeError(e))
    }
  }

  async function reset(sha: string, mode: ResetMode) {
    const id = repoIdOrToast()
    if (id == null) return
    // SEC-003 fix — hard 모드는 type-to-confirm (working tree 영구 손실 방지).
    if (mode === 'hard') {
      const expected = `reset --hard ${sha.slice(0, 8)}`
      const input = window.prompt(
        `⚠ HARD reset — working tree + index 영구 손실\n\n` +
          `진행하려면 다음 정확히 입력:\n\n${expected}`,
      )
      if (input?.trim() !== expected) {
        toast.info('Reset 취소', '입력이 일치하지 않아 취소됨')
        return
      }
    } else {
      // soft / mixed / keep — 단순 confirm 으로 충분 (working tree 보존).
      if (!window.confirm(`Reset --${mode} → ${sha.slice(0, 8)}?`)) return
    }
    try {
      await ipcReset(id, mode, sha)
      toast.success(`Reset --${mode} 완료`, sha.slice(0, 8))
      invalidate(id)
    } catch (e) {
      toast.error(`Reset --${mode} 실패`, describeError(e))
    }
  }

  async function createBranchFrom(sha: string) {
    const id = repoIdOrToast()
    if (id == null) return
    const name = window.prompt(`새 브랜치 이름 (from ${sha.slice(0, 8)}):`)
    if (!name?.trim()) return
    try {
      await createBranch(id, name.trim(), sha)
      toast.success('브랜치 생성', `${name.trim()} from ${sha.slice(0, 8)}`)
      invalidate(id)
    } catch (e) {
      toast.error('브랜치 생성 실패', describeError(e))
    }
  }

  async function createTagFrom(sha: string) {
    const id = repoIdOrToast()
    if (id == null) return
    const name = window.prompt(`새 tag 이름 (from ${sha.slice(0, 8)}):`)
    if (!name?.trim()) return
    const message = window.prompt('annotated 메시지 (비우면 lightweight):') ?? ''
    try {
      await createTag(id, name.trim(), sha, message.trim() || null)
      toast.success('Tag 생성', `${name.trim()} from ${sha.slice(0, 8)}`)
      invalidate(id)
    } catch (e) {
      toast.error('Tag 생성 실패', describeError(e))
    }
  }

  /**
   * Commit row 우클릭 메뉴 항목 빌더.
   * onShowDiff / onCompare / onExplainAi 는 parent 에서 modal 트리거 위해 callback.
   */
  function buildItems(
    sha: string,
    callbacks: {
      onShowDiff?: (sha: string) => void
      onCompare?: (sha: string) => void
      onExplainAi?: (sha: string) => void
      onOpenInForge?: (sha: string) => void
    } = {},
  ): ContextMenuItem[] {
    return [
      {
        label: 'Show diff',
        shortcut: '⌘D',
        icon: '👁',
        action: () => callbacks.onShowDiff?.(sha),
        disabled: !callbacks.onShowDiff,
      },
      { label: 'Copy SHA', icon: '📋', action: () => void copySha(sha) },
      { divider: true },
      {
        label: 'Cherry-pick to HEAD',
        icon: '🍒',
        action: () => void cherryPick(sha),
      },
      { label: 'Revert', icon: '↩', action: () => void revert(sha) },
      {
        label: 'Reset',
        icon: '⏮',
        submenu: [
          { label: '--soft (HEAD only)', action: () => void reset(sha, 'soft') },
          { label: '--mixed (default)', action: () => void reset(sha, 'mixed') },
          {
            label: '--hard ⚠ (working tree 손실)',
            destructive: true,
            action: () => void reset(sha, 'hard'),
          },
        ],
      },
      { divider: true },
      {
        label: 'Create branch from...',
        icon: '🌿',
        action: () => void createBranchFrom(sha),
      },
      {
        label: 'Create tag from...',
        icon: '🏷',
        action: () => void createTagFrom(sha),
      },
      {
        label: 'Compare with...',
        icon: '⚖',
        action: () => callbacks.onCompare?.(sha),
        disabled: !callbacks.onCompare,
      },
      { divider: true },
      {
        label: 'Explain (AI)',
        icon: '✨',
        action: () => callbacks.onExplainAi?.(sha),
        disabled: !callbacks.onExplainAi,
      },
      {
        label: 'Open in forge',
        icon: '🔗',
        action: () => callbacks.onOpenInForge?.(sha),
        disabled: !callbacks.onOpenInForge,
      },
    ]
  }

  return { buildItems, copySha, cherryPick, revert, reset, createBranchFrom, createTagFrom }
}
