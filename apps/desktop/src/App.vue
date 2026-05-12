<script setup lang="ts">
// 최상위 레이아웃: 사이드바(좌) + 본문(우, file-routing 페이지) + 헤더 (Profiles / Theme / Settings).
import { computed } from 'vue'
import Sidebar from './components/Sidebar.vue'
import RepoTabBar from './components/RepoTabBar.vue'
import CommandPalette from './components/CommandPalette.vue'
import ProfileSwitcher from './components/ProfileSwitcher.vue'
import SyncTemplateModal from './components/SyncTemplateModal.vue'
import BisectModal from './components/BisectModal.vue'
import ReflogModal from './components/ReflogModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import LongRunningBanner from './components/LongRunningBanner.vue'
import CommitSearchModal from './components/CommitSearchModal.vue'
import RepoSwitcherModal from './components/RepoSwitcherModal.vue'
import CreatePrModal from './components/CreatePrModal.vue'
import HelpModal from './components/HelpModal.vue'
import CompareModal from './components/CompareModal.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
// Sprint c38 / plan/29 E5 — window.prompt 대체 (a11y + 한글 IME 안전).
import PromptDialog from './components/PromptDialog.vue'
import StatusBar from './components/StatusBar.vue'
import { useTheme } from '@/composables/useTheme'
import { useShortcut } from '@/composables/useShortcuts'
import { useUiState } from '@/composables/useUiState'
import { useDeepLink } from '@/composables/useDeepLink'
import { useMenuListener } from '@/composables/useMenuListener'
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
// Sprint c75-B — god comp 회귀 해소 (modal state + window hooks + onboarding detect).
import { useAppModals } from '@/composables/useAppModals'
import { useAppWindowHooks } from '@/composables/useAppWindowHooks'
import { useOnboardingDetect } from '@/composables/useOnboardingDetect'
import { useI18n } from 'vue-i18n'
import { useUiSettingsStore } from '@/composables/useUserSettings'
import { useAutoFetch } from '@/composables/useAutoFetch'
import { useReposStore } from '@/stores/repos'
import { openInExplorer } from '@/api/git'
import { useToast } from '@/composables/useToast'
import { describeError } from '@/api/errors'
import { RouterLink, useRouter } from 'vue-router'

const { theme, toggle } = useTheme()
const { t } = useI18n()
const reposStore = useReposStore()
const ui = useUiState()
const uiSettings = useUiSettingsStore()
const router = useRouter()
useDeepLink(router)
useAutoFetch()

// Sprint c75-B — modal 9개 state + open helper + closeAllModals 를 useAppModals 로 분리.
const {
  syncTemplateOpen,
  syncTemplateInitialSha,
  openSyncTemplate,
  bisectOpen,
  reflogOpen,
  repoSwitcherOpen,
  createPrOpen,
  helpOpen,
  commitSearchOpen,
  compareOpen,
  compareInitialRef1,
  compareInitialRef2,
  compareInitialMode,
  openCompare,
  closeAllModals,
} = useAppModals()

// ⌘⇧P 빠른 레포 전환 단축키 (Command Palette ⌘P 와 다름).
// ⌘⇧F Commit message 검색 modal (Sprint F-P5).
function onKeydown(e: KeyboardEvent) {
  const meta = e.metaKey || e.ctrlKey
  if (meta && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    repoSwitcherOpen.value = !repoSwitcherOpen.value
  } else if (meta && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    commitSearchOpen.value = !commitSearchOpen.value
  }
}
window.addEventListener('keydown', onKeydown)

// 추가 단축키
useShortcut('newPr', () => {
  if (reposStore.activeRepoId != null) createPrOpen.value = true
})
useShortcut('help', () => (helpOpen.value = true))

// Sprint B5 — UI 단축키
useShortcut('zoomIn', ui.zoomIn)
useShortcut('zoomOut', ui.zoomOut)
useShortcut('zoomReset', ui.zoomReset)
useShortcut('toggleSidebar', ui.toggleSidebar)
useShortcut('newTab', () => {
  // ⌘T = Repo Switcher (⌘⇧P alias)
  repoSwitcherOpen.value = !repoSwitcherOpen.value
})

// Sprint c75-B — closeAllModals 는 useAppModals 에서 노출.
useShortcut('closeModal', closeAllModals)

// Sprint F4 — ⌥O OS 파일 매니저로 활성 레포 열기.
const toast = useToast()
useShortcut('openInExplorer', () => {
  if (reposStore.activeRepoId == null) {
    toast.warning(t('errors.noRepo'), t('errors.noRepoBody'))
    return
  }
  void openInExplorer(reposStore.activeRepoId).catch((e) => {
    toast.error(t('errors.fileMgrOpenFailed'), describeError(e))
  })
})

// Sprint G — Tab 시스템 단축키.
useShortcut('nextTab', reposStore.nextTab)
useShortcut('prevTab', reposStore.prevTab)
useShortcut('closeTab', () => {
  if (reposStore.activeRepoId != null) {
    reposStore.closeTab(reposStore.activeRepoId)
  }
})

// Sprint c75-B — Onboarding GitKrakenImport detect 는 useOnboardingDetect 에 분리.
useOnboardingDetect()

// Sprint 22-4 V-6 보강: ReflogModal 의 showDiff emit → CommitDiffModal 트리거.
// pages/index.vue 가 onMounted 시 window.gitFriedShowDiff 등록.
function onReflogShowDiff(sha: string) {
  reflogOpen.value = false
  window.gitFriedShowDiff?.(sha)
}

// Sprint I — Sidebar 가 숨겨져 있을 때도 ⌘⌥F 동작하도록 wrap.
useShortcut('filterRepos', () => {
  if (!ui.sidebarVisible.value) {
    ui.sidebarVisible.value = true
    // 다음 tick 후 Sidebar mount 완료 대기.
    setTimeout(() => {
      window.gitFriedFocusRepoFilter?.()
    }, 80)
  }
  // visible 일 때는 Sidebar 가 자체적으로 focusRepoFilter 처리.
})

// Sprint F5 — F11 / ⌃⌘F Fullscreen 토글.
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

// Sprint c75-B — Window 트리거 등록 5건을 useAppWindowHooks (lifecycle 포함) 로 분리.
useAppWindowHooks({
  openSyncTemplate,
  openBisect: () => (bisectOpen.value = true),
  openReflog: () => (reflogOpen.value = true),
  openCompare,
  toggleTheme: toggle,
})

// Phase 14-3 — fullscreen diff 진입 시 좌측 sidebar 자동 hide (GitKraken Diff View 동등).
//   ui.sidebarVisible localStorage 는 보존 — grid-cols 조건에 fullscreenActive 직접 결합.
const fsDiff = useFullscreenDiff()
const fullscreenActive = computed(() => fsDiff.current.value != null)
const sidebarShown = computed(() => ui.sidebarVisible.value && !fullscreenActive.value)

// Phase 10-6 — 네이티브 메뉴 (Tauri menu) bridge. toggleTheme 은 useAppWindowHooks 가 등록.
useMenuListener()
</script>

<template>
  <div
    class="grid h-screen overflow-hidden"
    :class="
      sidebarShown
        ? 'grid-cols-[220px_1fr] xl:grid-cols-[280px_1fr]'
        : 'grid-cols-[0_1fr]'
    "
  >
    <Sidebar v-if="sidebarShown" />
    <div v-else />
    <main class="flex flex-col overflow-hidden">
      <!-- Phase 13-3 (GitKraken parity) — 헤더 row 제거. nav 를 RepoTabBar 의 trailing slot 으로 통합.
           기존 36px 헤더 row 절약 → vertical 공간 확보. -->
      <RepoTabBar @open-switcher="repoSwitcherOpen = true">
        <template #trailing>
          <div class="flex items-center gap-2 px-2 text-[11px]">
            <ProfileSwitcher />
            <span class="mx-0.5 text-muted-foreground">·</span>
            <RouterLink
              to="/"
              class="text-muted-foreground hover:text-foreground border-b-2 border-transparent pb-0.5"
              active-class="!text-foreground font-semibold !border-emerald-500"
            >
              {{ t('nav.home') }}
            </RouterLink>
            <RouterLink
              to="/repositories"
              class="text-muted-foreground hover:text-foreground border-b-2 border-transparent pb-0.5"
              active-class="!text-foreground font-semibold !border-emerald-500"
              :title="t('nav.reposTitle')"
            >
              {{ t('nav.repos') }}
            </RouterLink>
            <RouterLink
              v-if="!uiSettings.hideLaunchpad"
              to="/launchpad"
              class="text-muted-foreground hover:text-foreground border-b-2 border-transparent pb-0.5"
              active-class="!text-foreground font-semibold !border-emerald-500"
            >
              {{ t('nav.launchpad') }}
            </RouterLink>
            <RouterLink
              to="/settings"
              class="text-muted-foreground hover:text-foreground border-b-2 border-transparent pb-0.5"
              active-class="!text-foreground font-semibold !border-emerald-500"
            >
              {{ t('nav.settings') }}
            </RouterLink>
            <button
              type="button"
              class="ml-1 rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent"
              :title="theme === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark')"
              :aria-label="t('nav.themeAriaLabel')"
              @click="toggle"
            >
              {{ theme === 'dark' ? '☾' : '☀' }}
            </button>
          </div>
        </template>
      </RepoTabBar>
      <RouterView class="flex-1 min-h-0 overflow-hidden" />
      <StatusBar />
    </main>
    <CommandPalette />
    <SyncTemplateModal
      :open="syncTemplateOpen"
      :initial-sha="syncTemplateInitialSha"
      @close="syncTemplateOpen = false"
    />
    <BisectModal :open="bisectOpen" @close="bisectOpen = false" />
    <ReflogModal
      :open="reflogOpen"
      @close="reflogOpen = false"
      @show-diff="onReflogShowDiff"
    />
    <CompareModal
      :open="compareOpen"
      :repo-id="reposStore.activeRepoId"
      :initial-ref1="compareInitialRef1"
      :initial-ref2="compareInitialRef2"
      :initial-mode="compareInitialMode"
      @close="compareOpen = false"
    />
    <RepoSwitcherModal
      :open="repoSwitcherOpen"
      @close="repoSwitcherOpen = false"
    />
    <CreatePrModal
      :repo-id="reposStore.activeRepoId"
      :open="createPrOpen"
      initial-base="main"
      @close="createPrOpen = false"
    />
    <HelpModal :open="helpOpen" @close="helpOpen = false" />
    <ToastContainer />
    <LongRunningBanner />
    <CommitSearchModal :open="commitSearchOpen" @close="commitSearchOpen = false" />
    <ConfirmDialog />
    <PromptDialog />
  </div>
</template>
