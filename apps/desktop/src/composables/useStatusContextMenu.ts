// StatusPanel 의 file row 우클릭 메뉴 builder 추출 — Sprint c38 fix MED-2.
//
// c37 god comp 분리 (-202 LOC) 직후 c38 E1 의 4 restore 액션 추가로 +62 회귀.
// Context menu builder 를 별도 composable 로 분리해 StatusPanel.vue LOC 다이어트.
//
// 의존성: i18n + useRestore + 5 mutation/action callback + 2 modal opener + copyPath.
//
// 반환: `buildItems(path, isStaged): ContextMenuItem[]` — 호출처 (StatusPanel) 가
// `ctxMenu.openAt(ev, items)` 로 표시.
import { useI18n } from 'vue-i18n'
import type { ContextMenuItem } from '@/components/ContextMenu.vue'
import { promptDialog } from '@/composables/useConfirm'
import type { useRestore } from '@/composables/useRestore'

export interface StatusContextMenuDeps {
  selectPath: (path: string) => void
  onStageOne: (path: string) => void
  onUnstageOne: (path: string) => void
  onDiscardOne: (path: string) => void
  restore: ReturnType<typeof useRestore>
  openHunk: (path: string, staged: boolean) => void
  openHistory: (path: string) => void
  copyPath: (path: string) => Promise<void>
}

export function useStatusContextMenu(deps: StatusContextMenuDeps) {
  const { t } = useI18n()

  /** 4. 특정 커밋 기준 복원 — source 입력 받기 (Sprint c38 fix HIGH-1: promptDialog). */
  async function onRestoreFromCommit(path: string): Promise<void> {
    const source = await promptDialog({
      title: t('restore.promptCommitTitle'),
      message: t('restore.promptCommitMessage'),
      placeholder: t('restore.promptCommitPlaceholder'),
      defaultValue: t('restore.promptCommitDefault'),
    })
    if (source === null) return
    const trimmed = source.trim()
    if (!trimmed) return
    await deps.restore.restoreFromCommit([path], trimmed)
  }

  /**
   * Sprint c38 / plan/29 E1 — file row 우클릭 메뉴 (staged / unstaged 분기).
   *
   * staged 에는 "인덱스 복원 (= unstage)" / "HEAD 기준 복원" / "특정 커밋 기준 복원".
   * unstaged 에는 "워킹트리 복원 (인덱스 보존)" / "HEAD 기준 복원" / "특정 커밋 기준 복원".
   * 기존 ctxDiscard/ctxUnstage 는 호환 유지 — restore 메뉴는 그 아래 별도 그룹.
   */
  function buildItems(path: string, isStaged: boolean): ContextMenuItem[] {
    deps.selectPath(path)
    return isStaged
      ? [
          { label: t('status.ctxUnstage'), icon: '−', action: () => deps.onUnstageOne(path) },
          { divider: true },
          {
            label: t('status.ctxHunkUnstage'),
            icon: '✂',
            action: () => deps.openHunk(path, true),
          },
          { divider: true },
          {
            label: t('status.ctxRestoreStaged'),
            icon: '↩',
            action: () => void deps.restore.restoreStaged([path]),
          },
          {
            label: t('status.ctxRestoreFromHead'),
            icon: '⏮',
            destructive: true,
            action: () => void deps.restore.restoreFromHead([path]),
          },
          {
            label: t('status.ctxRestoreFromCommit'),
            icon: '⏪',
            destructive: true,
            action: () => void onRestoreFromCommit(path),
          },
          { divider: true },
          {
            label: t('status.ctxFileHistory'),
            icon: '📜',
            action: () => deps.openHistory(path),
          },
          { label: t('status.ctxCopyPath'), icon: '📋', action: () => void deps.copyPath(path) },
        ]
      : [
          { label: t('status.ctxStage'), icon: '+', action: () => deps.onStageOne(path) },
          {
            label: t('status.ctxDiscard'),
            icon: '⤺',
            destructive: true,
            action: () => deps.onDiscardOne(path),
          },
          { divider: true },
          {
            label: t('status.ctxHunkStage'),
            icon: '✂',
            action: () => deps.openHunk(path, false),
          },
          { divider: true },
          {
            label: t('status.ctxRestoreWorktree'),
            icon: '↩',
            destructive: true,
            action: () => void deps.restore.restoreWorktree([path]),
          },
          {
            label: t('status.ctxRestoreFromHead'),
            icon: '⏮',
            destructive: true,
            action: () => void deps.restore.restoreFromHead([path]),
          },
          {
            label: t('status.ctxRestoreFromCommit'),
            icon: '⏪',
            destructive: true,
            action: () => void onRestoreFromCommit(path),
          },
          { divider: true },
          {
            label: t('status.ctxFileHistory'),
            icon: '📜',
            action: () => deps.openHistory(path),
          },
          { label: t('status.ctxCopyPath'), icon: '📋', action: () => void deps.copyPath(path) },
        ]
  }

  return { buildItems }
}
