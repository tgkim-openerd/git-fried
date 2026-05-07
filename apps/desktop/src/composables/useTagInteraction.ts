// Sprint c52 / c48 보류 후속 — TagPanel.vue script 227 LOC → 200 임계 미달.
//
// 책임 (TagPanel context menu 영역만):
//   - 3 액션 (checkoutTag / createBranchFromTag / copyTagSha) — confirm/prompt + invalidate
//   - onTagContextMenu — 7항목 context menu items 빌드 + ctxMenu.openAt
//
// 추출 범위 결정 (c48 useCommitGraphInteraction 패턴과 동일):
//   - 4 mutations (create/delete/push/deleteRemote) 는 잔존 — vue-query useMutation 의 invalidate
//     queryClient access 가 component scope 자연스러움. composable 로 옮기면 callback 누적
//   - context menu + actions 는 confirmDialog/promptDialog/clipboard/router 등 외부 의존성 묶음
//     → 별도 composable 로 분리 시 component 가독성 ↑
//
// 사용 예시:
//   const { onTagContextMenu, checkoutTag, createBranchFromTag, copyTagSha } = useTagInteraction({
//     repoId: () => props.repoId,
//     ctxMenu,
//     pushMut,
//     onDelete,
//     onDeleteRemote,
//   })
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createBranch, switchBranch, type TagInfo } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { confirmDialog, promptDialog } from '@/composables/useConfirm'
import type { ContextMenuExpose, ContextMenuItem } from '@/components/ContextMenu.vue'

interface UseTagInteractionOpts {
  /** repoId getter (`() => props.repoId`) — null 시 noop */
  repoId: () => number | null
  /** ContextMenu 컴포넌트 ref (template ref) */
  ctxMenu: Ref<ContextMenuExpose | null>
  /** pushMut.mutate(name) — caller 가 직접 vue-query mutation 보유 */
  pushMut: { mutate: (name: string) => void }
  /** onDelete(name) — caller side confirm + mutate (local tag 삭제) */
  onDelete: (name: string) => void | Promise<void>
  /** onDeleteRemote(name) — caller side confirm + mutate (remote tag 삭제) */
  onDeleteRemote: (name: string) => void | Promise<void>
}

export function useTagInteraction(opts: UseTagInteractionOpts) {
  const { t } = useI18n()
  const toast = useToast()
  const invalidateAll = useInvalidateRepoQueries()

  async function checkoutTag(tag: TagInfo) {
    const id = opts.repoId()
    if (id == null) return
    const ok = await confirmDialog({
      title: t('confirm.checkoutTagTitle'),
      message: t('confirm.checkoutTagMessage', { name: tag.name }),
    })
    if (!ok) return
    try {
      await switchBranch(id, tag.name, false)
      toast.success(t('tag.toastCheckout'), tag.name)
      invalidateAll(id)
    } catch (e) {
      toast.error(t('tag.toastCheckoutFailed'), describeError(e))
    }
  }

  async function createBranchFromTag(tag: TagInfo) {
    const id = opts.repoId()
    if (id == null) return
    const name = await promptDialog({
      title: t('tagActions.createBranchTitle'),
      message: t('tagActions.createBranchMessage', { name: tag.name }),
      defaultValue: tag.name + '-branch',
    })
    if (!name?.trim()) return
    try {
      await createBranch(id, name.trim(), tag.name)
      toast.success(t('tagActions.toastBranchCreated'), `${name.trim()} from ${tag.name}`)
      invalidateAll(id)
    } catch (e) {
      toast.error(t('tagActions.toastBranchFailed'), describeError(e))
    }
  }

  async function copyTagSha(tag: TagInfo) {
    const sha = tag.commitSha
    if (!sha) return
    try {
      await navigator.clipboard.writeText(sha)
      toast.success(t('tagActions.toastShaCopied'), sha.slice(0, 8))
    } catch (e) {
      toast.error(t('tagActions.toastShaCopyFailed'), describeError(e))
    }
  }

  function onTagContextMenu(ev: MouseEvent, tag: TagInfo) {
    ev.preventDefault()
    ev.stopPropagation()
    const items: ContextMenuItem[] = [
      {
        label: t('tagActions.cmPushOrigin'),
        icon: '⬆',
        action: () => opts.pushMut.mutate(tag.name),
      },
      { label: t('tagActions.cmCheckout'), icon: '✓', action: () => void checkoutTag(tag) },
      {
        label: t('tagActions.cmCreateBranch'),
        icon: '🌿',
        action: () => void createBranchFromTag(tag),
      },
      { divider: true },
      {
        label: t('tagActions.cmCopySha'),
        icon: '📋',
        disabled: !tag.commitSha,
        action: () => void copyTagSha(tag),
      },
      { divider: true },
      {
        label: t('tagActions.cmDeleteLocal'),
        icon: '🗑',
        destructive: true,
        action: () => void opts.onDelete(tag.name),
      },
      {
        label: t('tagActions.cmDeleteRemote'),
        icon: '🗑',
        destructive: true,
        action: () => void opts.onDeleteRemote(tag.name),
      },
    ]
    opts.ctxMenu.value?.openAt(ev, items)
  }

  return { checkoutTag, createBranchFromTag, copyTagSha, onTagContextMenu }
}
