// Sprint c64-B — RepoTabBar god comp 추출 (Pattern 9 sister, small 변형).
//
// RepoTabBar.vue script 204 LOC 중 2 ContextMenu builder (onTabContextMenu,
// onProjectContextMenu) + moveTab + Close all confirm + Close group confirm 추출.
//
// 책임:
//   - moveTab (left/right delta)
//   - onTabContextMenu (6 items: Close / Close others / Close all (confirm) / divider /
//     Move left / Move right)
//   - onProjectContextMenu (1 item: Close all in group (confirm if >1))
//
// SFC 잔여:
//   - reposQuery / repoMap / projectGroups / activeGroup (state)
//   - tabLabel / tabSubtitle / tabLabelClass (helper)
//   - activate / onActivateProject / close / onMiddleClick (단순 handler)
//   - template + watch scrollIntoView (DOM)
import type { ContextMenuItem } from '@/components/ContextMenu.vue'
import type { ProjectGroup } from '@/composables/useTabGroups'
import { useReposStore } from '@/stores/repos'
import { confirmDialog } from '@/composables/useConfirm'
import { useI18n } from 'vue-i18n'

export interface RepoTabContextMenuCallbacks {
  /** ContextMenu 인스턴스의 openAt 호출 — SFC 의 useTemplateRef 결과 위임. */
  openMenu: (ev: MouseEvent, items: ContextMenuItem[]) => void
}

export function useRepoTabContextMenu(callbacks: RepoTabContextMenuCallbacks) {
  const store = useReposStore()
  const { t } = useI18n()

  function moveTab(id: number, delta: -1 | 1) {
    const idx = store.tabs.indexOf(id)
    if (idx < 0) return
    const target = idx + delta
    if (target < 0 || target >= store.tabs.length) return
    const next = [...store.tabs]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    store.reorderTabs(next)
  }

  function onTabContextMenu(ev: MouseEvent, id: number) {
    ev.preventDefault()
    ev.stopPropagation()
    const idx = store.tabs.indexOf(id)
    const total = store.tabs.length
    const items: ContextMenuItem[] = [
      { label: 'Close', icon: '✕', shortcut: 'Mid', action: () => store.closeTab(id) },
      {
        label: 'Close others',
        icon: '⊘',
        disabled: total <= 1,
        action: () => store.closeOthers(id),
      },
      {
        label: 'Close all',
        icon: '✕✕',
        destructive: true,
        action: () => {
          void (async () => {
            const ok = await confirmDialog({
              title: t('confirm.closeAllTabsTitle'),
              message: t('confirm.closeAllTabsMessage', { n: total }),
              danger: true,
            })
            if (ok) store.closeAll()
          })()
        },
      },
      { divider: true },
      {
        label: 'Move left',
        icon: '←',
        disabled: idx <= 0,
        action: () => moveTab(id, -1),
      },
      {
        label: 'Move right',
        icon: '→',
        disabled: idx < 0 || idx >= total - 1,
        action: () => moveTab(id, 1),
      },
    ]
    callbacks.openMenu(ev, items)
  }

  function onProjectContextMenu(ev: MouseEvent, g: ProjectGroup) {
    ev.preventDefault()
    ev.stopPropagation()
    const items: ContextMenuItem[] = [
      {
        label: `Close all in '${g.label}' (${g.tabIds.length})`,
        icon: '✕',
        destructive: g.tabIds.length > 1,
        action: () => {
          void (async () => {
            if (g.tabIds.length > 1) {
              const ok = await confirmDialog({
                title: t('confirm.closeGroupTabsTitle'),
                message: t('confirm.closeGroupTabsMessage', {
                  n: g.tabIds.length,
                  label: g.label,
                }),
                danger: true,
              })
              if (!ok) return
            }
            for (const id of g.tabIds) store.closeTab(id)
          })()
        },
      },
    ]
    callbacks.openMenu(ev, items)
  }

  return { moveTab, onTabContextMenu, onProjectContextMenu }
}
