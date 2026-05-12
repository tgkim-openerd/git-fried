// Sprint c74 — Submodule GitKraken parity 통합.
// MiniSubmoduleList 의 정적(클릭 무동작) → click 으로 새 repo 탭 열기 + 우클릭 메뉴 6 액션.
//
// Pattern 9 sister (small) — c52 useTagInteraction / c54+++ useBranchInteraction / c74 useStashInteraction 정착.
// caller-decision:
//   - composable: user-facing side effect 흡수 (addRepo IPC + toast + clipboard + confirm)
//   - caller: queryClient invalidate + store.openTab 콜백 노출

import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addRepo,
  initSubmodules,
  updateSubmodules,
  syncSubmodules,
  listRepos,
  type SubmoduleEntry,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'
import type { ContextMenuExpose, ContextMenuItem } from '@/components/ContextMenu.vue'

interface UseSubmoduleInteractionOpts {
  /** ContextMenu 컴포넌트 ref */
  ctxMenu: Ref<ContextMenuExpose | null>
  /** sync/init/update 성공 후 호출 — caller 가 queryClient.invalidateQueries(['submodules', repoId]) 등 결정 */
  onInvalidate: () => void
}

export function useSubmoduleInteraction(opts: UseSubmoduleInteractionOpts) {
  const { t } = useI18n()
  const toast = useToast()
  const store = useReposStore()

  /**
   * submodule path 를 새 repo 로 등록 + 탭에서 활성화 (GitKraken "Open in new tab").
   * 1. 현재 active repo 의 localPath 조회 (listRepos client-side)
   * 2. parent/submodule path 결합 → addRepo
   * 3. store.openTab(repo.id)
   */
  async function openAsRepo(entry: SubmoduleEntry) {
    const parentId = store.activeRepoId
    if (parentId == null) return
    try {
      const all = await listRepos(store.activeWorkspaceId)
      const parent = all.find((r) => r.id === parentId)
      if (!parent) {
        toast.error(t('submoduleActions.toastOpenFailed'), t('submoduleActions.toastParentMissing'))
        return
      }
      // forward slash 결합 — Tauri Rust 백엔드 PathBuf 가 OS 별 정규화.
      const subPath = `${parent.localPath.replace(/[\\/]+$/, '')}/${entry.path}`
      const repo = await addRepo({
        localPath: subPath,
        workspaceId: parent.workspaceId,
        name: `${parent.name}/${entry.path}`,
      })
      store.openTab(repo.id)
      toast.success(t('submoduleActions.toastOpenSuccess'), repo.name)
    } catch (e) {
      toast.error(t('submoduleActions.toastOpenFailed'), describeError(e))
    }
  }

  async function initOne() {
    const id = store.activeRepoId
    if (id == null) return
    try {
      await initSubmodules(id)
      toast.success(t('submoduleActions.toastInitSuccess'), t('submoduleActions.toastInitBody'))
      opts.onInvalidate()
    } catch (e) {
      toast.error(t('submoduleActions.toastInitFailed'), describeError(e))
    }
  }

  async function updateOne() {
    const id = store.activeRepoId
    if (id == null) return
    try {
      await updateSubmodules(id, false)
      toast.success(t('submoduleActions.toastUpdateSuccess'), t('submoduleActions.toastUpdateBody'))
      opts.onInvalidate()
    } catch (e) {
      toast.error(t('submoduleActions.toastUpdateFailed'), describeError(e))
    }
  }

  async function syncOne() {
    const id = store.activeRepoId
    if (id == null) return
    try {
      await syncSubmodules(id)
      toast.success(t('submoduleActions.toastSyncSuccess'), t('submoduleActions.toastSyncBody'))
      opts.onInvalidate()
    } catch (e) {
      toast.error(t('submoduleActions.toastSyncFailed'), describeError(e))
    }
  }

  async function copyPath(entry: SubmoduleEntry) {
    try {
      await navigator.clipboard.writeText(entry.path)
      toast.success(t('submoduleActions.toastPathCopied'), entry.path)
    } catch (e) {
      toast.error(t('submoduleActions.toastPathCopyFailed'), describeError(e))
    }
  }

  async function copySha(entry: SubmoduleEntry) {
    if (!entry.sha) return
    try {
      await navigator.clipboard.writeText(entry.sha)
      toast.success(t('submoduleActions.toastShaCopied'), entry.sha.slice(0, 8))
    } catch (e) {
      toast.error(t('submoduleActions.toastShaCopyFailed'), describeError(e))
    }
  }

  function onSubmoduleContextMenu(ev: MouseEvent, entry: SubmoduleEntry) {
    ev.preventDefault()
    ev.stopPropagation()
    const items: ContextMenuItem[] = [
      {
        label: t('submoduleActions.cmOpen'),
        icon: '↗',
        action: () => void openAsRepo(entry),
      },
      { divider: true },
      {
        label: t('submoduleActions.cmInit'),
        icon: '⊕',
        disabled: entry.status === 'initialized' || entry.status === 'modified',
        action: () => void initOne(),
      },
      {
        label: t('submoduleActions.cmUpdate'),
        icon: '⬇',
        action: () => void updateOne(),
      },
      {
        label: t('submoduleActions.cmSync'),
        icon: '⟳',
        action: () => void syncOne(),
      },
      { divider: true },
      {
        label: t('submoduleActions.cmCopyPath'),
        icon: '📋',
        action: () => void copyPath(entry),
      },
      {
        label: t('submoduleActions.cmCopySha'),
        icon: '📋',
        disabled: !entry.sha,
        action: () => void copySha(entry),
      },
    ]
    opts.ctxMenu.value?.openAt(ev, items)
  }

  return {
    openAsRepo,
    initOne,
    updateOne,
    syncOne,
    copyPath,
    copySha,
    onSubmoduleContextMenu,
  }
}
