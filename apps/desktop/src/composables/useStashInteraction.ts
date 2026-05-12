// Sprint c74 — Stash GitKraken parity 통합.
// MiniStashList 의 hover 시 2-버튼 (apply/pop) UX 를 ⋯ ContextMenu 로 표준화 + drop 액션 추가.
//
// Pattern 9 sister (small) — c52 useTagInteraction / c54+++ useBranchInteraction 정착.
// caller-decision:
//   - composable: confirm/clipboard/UX side-effect 흡수
//   - caller: vue-query mutation 객체 (apply/pop/drop) 보유 + mutate 콜백 노출

import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StashEntry } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'
import type { ContextMenuExpose, ContextMenuItem } from '@/components/ContextMenu.vue'

interface UseStashInteractionOpts {
  /** repoId getter (`() => store.activeRepoId`) — null 시 noop */
  repoId: () => number | null
  /** ContextMenu 컴포넌트 ref */
  ctxMenu: Ref<ContextMenuExpose | null>
  /** apply (비파괴, working tree 적용) — confirm 없음 */
  onApply: (idx: number) => void
  /** pop (apply + 제거) — composable 안에서 confirm 후 호출 */
  onPop: (idx: number) => void
  /** drop (영구 제거) — composable 안에서 confirm 후 호출 */
  onDrop: (idx: number) => void
}

export function useStashInteraction(opts: UseStashInteractionOpts) {
  const { t } = useI18n()
  const toast = useToast()

  async function popStash(idx: number) {
    const ok = await confirmDialog({
      title: t('confirm.popStashTitle'),
      message: t('confirm.popStashMessage', { idx }),
      danger: true,
    })
    if (!ok) return
    opts.onPop(idx)
  }

  async function dropStash(idx: number) {
    const ok = await confirmDialog({
      title: t('confirm.dropStashTitle'),
      message: t('confirm.dropStashMessage', { idx }),
      danger: true,
    })
    if (!ok) return
    opts.onDrop(idx)
  }

  async function copyStashSha(stash: StashEntry) {
    if (!stash.sha) return
    try {
      await navigator.clipboard.writeText(stash.sha)
      toast.success(t('stashActions.toastShaCopied'), stash.sha.slice(0, 8))
    } catch (e) {
      toast.error(t('stashActions.toastShaCopyFailed'), describeError(e))
    }
  }

  function onStashContextMenu(ev: MouseEvent, stash: StashEntry) {
    ev.preventDefault()
    ev.stopPropagation()
    const items: ContextMenuItem[] = [
      {
        label: t('stashActions.cmApply'),
        icon: '✓',
        action: () => opts.onApply(stash.index),
      },
      {
        label: t('stashActions.cmPop'),
        icon: '⬇',
        action: () => void popStash(stash.index),
      },
      { divider: true },
      {
        label: t('stashActions.cmCopySha'),
        icon: '📋',
        disabled: !stash.sha,
        action: () => void copyStashSha(stash),
      },
      { divider: true },
      {
        label: t('stashActions.cmDrop'),
        icon: '🗑',
        destructive: true,
        action: () => void dropStash(stash.index),
      },
    ]
    opts.ctxMenu.value?.openAt(ev, items)
  }

  return { popStash, dropStash, copyStashSha, onStashContextMenu }
}
