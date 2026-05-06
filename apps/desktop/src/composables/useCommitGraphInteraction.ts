// Sprint c48 Wave B-2 — CommitGraph.vue script 분리 2/2.
//
// row 상호작용 핸들러 + date 포맷 통합:
//   - onRowDblClick (showDiff emit)
//   - onRowContextMenu (ContextMenu open + commitActions buildItems)
//   - formatDate (localized, 단축 형식)
//
// SFC 의 emit + ctxMenu / commitActions / selectedSha 를 인자로 받아 핸들러 반환.
import type { ShallowRef } from 'vue'
import type { GraphRow } from '@/api/git'
import { formatDateLocalized } from '@/composables/useUserSettings'
import type { ContextMenuExpose, ContextMenuItem } from '@/composables/useContextMenu'

interface CommitActionsLike {
  buildItems: (
    sha: string,
    handlers: {
      onShowDiff: (sha: string) => void
      onCompare: (sha: string) => void
      onExplainAi: (sha: string) => void
      onOpenInForge: (sha: string) => void
    },
  ) => ContextMenuItem[]
}

interface UseCommitGraphInteractionArgs {
  selectedSha: { value: string | null }
  ctxMenu: Readonly<ShallowRef<ContextMenuExpose | null>>
  commitActions: CommitActionsLike
  emit: {
    (event: 'selectCommit', sha: string): void
    (event: 'showDiff', sha: string): void
    (event: 'compareWith', sha: string): void
    (event: 'explainAi', sha: string): void
    (event: 'openInForge', sha: string): void
  }
}

export function useCommitGraphInteraction({
  selectedSha,
  ctxMenu,
  commitActions,
  emit,
}: UseCommitGraphInteractionArgs) {
  // Sprint 22-3 V-1: row 더블클릭 → CommitDiffModal auto-open.
  function onRowDblClick(row: GraphRow | undefined) {
    if (!row) return
    selectedSha.value = row.commit.sha
    emit('selectCommit', row.commit.sha)
    emit('showDiff', row.commit.sha)
  }

  // Sprint 22-2 CM-1: row 우클릭 → ContextMenu open with commit-action items.
  function onRowContextMenu(ev: MouseEvent, row: GraphRow | undefined) {
    if (!row) return
    ev.preventDefault()
    const sha = row.commit.sha
    selectedSha.value = sha
    emit('selectCommit', sha)
    ctxMenu.value?.openAt(
      ev,
      commitActions.buildItems(sha, {
        onShowDiff: (s) => emit('showDiff', s),
        onCompare: (s) => emit('compareWith', s),
        onExplainAi: (s) => emit('explainAi', s),
        onOpenInForge: (s) => emit('openInForge', s),
      }),
    )
  }

  function formatDate(unix: number): string {
    return formatDateLocalized(unix, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return { onRowDblClick, onRowContextMenu, formatDate }
}
