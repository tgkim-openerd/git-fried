// Sprint c80-3 — App.vue 176 → <100 LOC 추출.
//
// 14 useShortcut + ⌘⇧P/F window keydown + onReflogShowDiff handler 통합.
// caller-decision: modal/UI ref 모두 caller (App.vue setup) 보유, composable 은 등록만.
//
// useAppWindowHooks (c75-B) 와의 분리:
//   - useAppWindowHooks: window.gitFriedXxx 글로벌 등록 (외부 진입점 → modal open)
//   - useAppShortcuts: 키보드 단축키 → modal toggle / repo store 액션 dispatch
import { onMounted, onUnmounted, type Ref } from 'vue'
import { useShortcut } from '@/composables/useShortcuts'
import { useUiState } from '@/composables/useUiState'
import { useReposStore } from '@/stores/repos'
import { openInExplorer } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

interface UseAppShortcutsOpts {
  repoSwitcherOpen: Ref<boolean>
  commitSearchOpen: Ref<boolean>
  createPrOpen: Ref<boolean>
  helpOpen: Ref<boolean>
  reflogOpen: Ref<boolean>
  closeAllModals: () => void
}

export function useAppShortcuts(opts: UseAppShortcutsOpts): {
  onReflogShowDiff: (sha: string) => void
} {
  const { t } = useI18n()
  const toast = useToast()
  const ui = useUiState()
  const reposStore = useReposStore()

  // ⌘⇧P 빠른 레포 전환 / ⌘⇧F Commit message 검색 — useShortcut 으로 등록 안 된 raw keydown.
  function onKeydown(e: KeyboardEvent) {
    const meta = e.metaKey || e.ctrlKey
    if (meta && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      opts.repoSwitcherOpen.value = !opts.repoSwitcherOpen.value
    } else if (meta && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      opts.commitSearchOpen.value = !opts.commitSearchOpen.value
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  // === useShortcut 등록 ===
  useShortcut('newPr', () => {
    if (reposStore.activeRepoId != null) opts.createPrOpen.value = true
  })
  useShortcut('help', () => (opts.helpOpen.value = true))

  // B5 — UI 단축키
  useShortcut('zoomIn', ui.zoomIn)
  useShortcut('zoomOut', ui.zoomOut)
  useShortcut('zoomReset', ui.zoomReset)
  useShortcut('toggleSidebar', ui.toggleSidebar)
  useShortcut('newTab', () => {
    // ⌘T = Repo Switcher (⌘⇧P alias)
    opts.repoSwitcherOpen.value = !opts.repoSwitcherOpen.value
  })

  // c75-B — closeAllModals
  useShortcut('closeModal', opts.closeAllModals)

  // F4 — ⌥O OS 파일 매니저로 활성 레포 열기.
  useShortcut('openInExplorer', () => {
    if (reposStore.activeRepoId == null) {
      toast.warning(t('errors.noRepo'), t('errors.noRepoBody'))
      return
    }
    void openInExplorer(reposStore.activeRepoId).catch((e) => {
      toast.error(t('errors.fileMgrOpenFailed'), describeError(e))
    })
  })

  // G — Tab 시스템 단축키
  useShortcut('nextTab', reposStore.nextTab)
  useShortcut('prevTab', reposStore.prevTab)
  useShortcut('closeTab', () => {
    if (reposStore.activeRepoId != null) {
      reposStore.closeTab(reposStore.activeRepoId)
    }
  })

  // I — Sidebar 가 숨겨져 있을 때도 ⌘⌥F 동작.
  useShortcut('filterRepos', () => {
    if (!ui.sidebarVisible.value) {
      ui.sidebarVisible.value = true
      // 다음 tick 후 Sidebar mount 완료 대기.
      setTimeout(() => window.gitFriedFocusRepoFilter?.(), 80)
    }
    // visible 일 때는 Sidebar 자체 처리.
  })

  // F5 — F11 / ⌃⌘F Fullscreen 토글.
  useShortcut('toggleFullscreen', () => {
    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const w = getCurrentWindow()
        const next = !(await w.isFullscreen())
        await w.setFullscreen(next)
      } catch (e) {
        toast.error(t('errors.fullscreenToggleFailed'), describeError(e))
      }
    })()
  })

  // 22-4 V-6 — ReflogModal showDiff emit → CommitDiffModal 트리거.
  function onReflogShowDiff(sha: string) {
    opts.reflogOpen.value = false
    window.gitFriedShowDiff?.(sha)
  }

  return { onReflogShowDiff }
}
