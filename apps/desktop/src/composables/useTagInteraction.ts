// Sprint c52 / c48 보류 후속 — TagPanel.vue script 227 LOC → 200 임계 미달.
//
// 책임 (TagPanel context menu + 모든 user-facing side effect):
//   - 3 액션 (checkoutTag / createBranchFromTag / copyTagSha) — confirm/prompt + invalidate
//   - 2 액션 (deleteLocal / deleteRemote) — confirm + caller mutate callback
//   - onTagContextMenu — 8항목 context menu items 빌드 + ctxMenu.openAt
//
// Pattern 9 caller-decision 원칙 (c50 정착):
//   - composable: 모든 user-facing side effect (confirmDialog / promptDialog / clipboard / API) 흡수
//   - caller: vue-query mutation 객체 보유 (queryClient access scope 자연스러움) + mutate 콜백 노출
//
// Sprint c52 ARCH-001/006 후속 (caller-decision 일관성 통일):
//   기존: pushMut 만 mutation 객체로 받고 onDelete/onDeleteRemote 는 caller 가 confirm 후 mutate
//        → 동일 mutation wrapping 방식 split + side effect uniformity 60% drift
//   현재: 5개 콜백 모두 mutate fn 만 받고 confirm/prompt 는 composable 안 — uniformity 100%
//
// 사용 예시:
//   const {
//     onTagContextMenu, checkoutTag, createBranchFromTag, copyTagSha,
//     deleteLocal, deleteRemote,
//   } = useTagInteraction({
//     repoId: () => props.repoId,
//     ctxMenu,
//     onPush:         (name) => pushMut.mutate(name),
//     onDelete:       (name) => deleteMut.mutate(name),
//     onDeleteRemote: (name) => deleteRemoteMut.mutate(name),
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
  /** push tag → origin (no confirm). caller 가 vue-query mutation 보유 */
  onPush: (name: string) => void
  /** delete local tag — composable 안에서 confirm 후 호출 */
  onDelete: (name: string) => void
  /** delete remote tag (origin) — composable 안에서 confirm 후 호출 */
  onDeleteRemote: (name: string) => void
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

  // Sprint c52 ARCH-001 — confirm 흡수 후 caller mutate callback 호출. caller 의 confirm 보일러플레이트 제거.
  async function deleteTagLocal(name: string) {
    const ok = await confirmDialog({
      title: t('confirm.deleteTagTitle'),
      message: t('confirm.deleteLocalTagMessage', { name }),
      danger: true,
    })
    if (!ok) return
    opts.onDelete(name)
  }

  async function deleteTagRemote(name: string) {
    const ok = await confirmDialog({
      title: t('confirm.deleteTagTitle'),
      message: t('confirm.deleteRemoteTagMessage', { name }),
      danger: true,
    })
    if (!ok) return
    opts.onDeleteRemote(name)
  }

  function onTagContextMenu(ev: MouseEvent, tag: TagInfo) {
    ev.preventDefault()
    ev.stopPropagation()
    const items: ContextMenuItem[] = [
      {
        label: t('tagActions.cmPushOrigin'),
        icon: '⬆',
        action: () => opts.onPush(tag.name),
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
        action: () => void deleteTagLocal(tag.name),
      },
      {
        label: t('tagActions.cmDeleteRemote'),
        icon: '🗑',
        destructive: true,
        action: () => void deleteTagRemote(tag.name),
      },
    ]
    opts.ctxMenu.value?.openAt(ev, items)
  }

  return {
    checkoutTag,
    createBranchFromTag,
    copyTagSha,
    deleteTagLocal,
    deleteTagRemote,
    onTagContextMenu,
  }
}
