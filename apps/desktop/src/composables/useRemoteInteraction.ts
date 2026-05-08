// Sprint c53 — /analyze HIGH-1 — RemoteManageModal.vue script 201 → 200 임계 미달.
//
// 책임 (RemoteManageModal context menu + remove confirm):
//   - onRemoteContextMenu — 4 항목 (Fetch All / Rename / Change URL / Remove) 빌드
//   - removeRemoteSafely — confirm 흡수 후 caller mutate callback 호출
//
// Pattern 9 caller-decision uniformity (c52 useTagInteraction sister):
//   - composable: ContextMenu items 빌드 + confirmDialog 흡수 (Pattern 11)
//   - caller: vue-query mutation 객체 보유 (queryClient access scope 자연스러움) + mutate 콜백 노출
//
// 4 mutations (addMut / removeMut / renameMut / urlMut / fetchAllMut) 와 inline form state
// (renameTarget / urlTarget / addName / urlNew) 는 component scope 잔존 — template-bound.
//
// 사용 예시:
//   const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')
//   const { onRemoteContextMenu, removeRemoteSafely } = useRemoteInteraction({
//     ctxMenu,
//     onFetchAll:       () => fetchAllMut.mutate(),
//     onStartRename:    (name) => startRename(name),
//     onStartUrlChange: (r)    => startUrlChange(r),
//     onRemove:         (name) => removeMut.mutate(name),
//   })
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'
import type { RemoteInfo } from '@/api/git'
import type { ContextMenuExpose, ContextMenuItem } from '@/components/ContextMenu.vue'

interface UseRemoteInteractionOpts {
  /** ContextMenu 컴포넌트 ref (template ref) */
  ctxMenu: Ref<ContextMenuExpose | null>
  /** fetch all remotes — caller mutate (단일 remote fetch IPC 부재 → fetchAll 매핑) */
  onFetchAll: () => void
  /** rename 시작 — caller state setter (renameTarget = name, renameNew = name) */
  onStartRename: (name: string) => void
  /** URL 변경 시작 — caller state setter (urlTarget = r.name, urlNew = r.fetchUrl ?? '') */
  onStartUrlChange: (r: RemoteInfo) => void
  /** delete remote — composable 안에서 confirm 후 호출 (caller mutate) */
  onRemove: (name: string) => void
}

export function useRemoteInteraction(opts: UseRemoteInteractionOpts) {
  const { t } = useI18n()

  // Pattern 11 — confirm 흡수 후 caller mutate. caller 의 confirm 보일러플레이트 제거.
  async function removeRemoteSafely(name: string) {
    const ok = await confirmDialog({
      title: t('confirm.removeRemoteTitle'),
      message: t('confirm.removeRemoteMessage', { name }),
      danger: true,
    })
    if (!ok) return
    opts.onRemove(name)
  }

  function onRemoteContextMenu(ev: MouseEvent, r: RemoteInfo) {
    ev.preventDefault()
    ev.stopPropagation()
    const items: ContextMenuItem[] = [
      {
        // 단일 remote fetch IPC 부재 → fetchAll 일괄 매핑 (Sprint 22-10 CM-12).
        label: t('remote.ctxFetchAll'),
        icon: '⬇',
        action: () => opts.onFetchAll(),
      },
      { divider: true },
      {
        label: t('remote.ctxRename'),
        icon: '✏',
        action: () => opts.onStartRename(r.name),
      },
      {
        label: t('remote.ctxChangeUrl'),
        icon: '🔗',
        action: () => opts.onStartUrlChange(r),
      },
      { divider: true },
      {
        label: t('remote.ctxRemove'),
        icon: '🗑',
        destructive: true,
        action: () => void removeRemoteSafely(r.name),
      },
    ]
    opts.ctxMenu.value?.openAt(ev, items)
  }

  return {
    removeRemoteSafely,
    onRemoteContextMenu,
  }
}
