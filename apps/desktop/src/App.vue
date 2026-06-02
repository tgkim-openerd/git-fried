<script setup lang="ts">
// 최상위 레이아웃: 사이드바(좌) + 본문(우, file-routing 페이지) + 헤더 (Profiles / Theme / Settings).
import { computed } from 'vue'
import Sidebar from './components/Sidebar.vue'
// UltraPlan v0.4 SB-001 — sidebar resize handle (drag to adjust width, localStorage 영속).
import SidebarResizeHandle from './components/SidebarResizeHandle.vue'
import { useSidebarWidth } from '@/composables/useSidebarWidth'
import RepoTabBar from './components/RepoTabBar.vue'
import CommandPalette from './components/CommandPalette.vue'
import ProfileSwitcher from './components/ProfileSwitcher.vue'
import SyncTemplateModal from './components/SyncTemplateModal.vue'
import BisectModal from './components/BisectModal.vue'
import ReflogModal from './components/ReflogModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import LongRunningBanner from './components/LongRunningBanner.vue'
import CommitSearchModal from './components/CommitSearchModal.vue'
import GlobalSearchModal from './components/GlobalSearchModal.vue'
import RepoSwitcherModal from './components/RepoSwitcherModal.vue'
import CreatePrModal from './components/CreatePrModal.vue'
import HelpModal from './components/HelpModal.vue'
import CompareModal from './components/CompareModal.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
// v0.4 #2 (UltraPlan plan/31 §9 Q1 절충) — First-run 3-step wizard.
import FirstRunWizard from './components/FirstRunWizard.vue'
// Sprint c38 / plan/29 E5 — window.prompt 대체 (a11y + 한글 IME 안전).
import PromptDialog from './components/PromptDialog.vue'
// UXF-10 — 다중 옵션 action sheet (branch drag merge/rebase 선택 등).
import ChooseDialog from './components/ChooseDialog.vue'
import StatusBar from './components/StatusBar.vue'
import { useTheme } from '@/composables/useTheme'
import { useUiState } from '@/composables/useUiState'
import { useDeepLink } from '@/composables/useDeepLink'
import { useMenuListener } from '@/composables/useMenuListener'
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
// Sprint c75-B — god comp 회귀 해소 (modal state + window hooks + onboarding detect).
import { useAppModals } from '@/composables/useAppModals'
import { useAppWindowHooks } from '@/composables/useAppWindowHooks'
import { useOnboardingDetect } from '@/composables/useOnboardingDetect'
// Sprint c80-3 — 14 useShortcut + ⌘⇧P/F window keydown + onReflogShowDiff 통합.
import { useAppShortcuts } from '@/composables/useAppShortcuts'
import { useI18n } from 'vue-i18n'
import { useUiSettingsStore } from '@/composables/useUserSettings'
import { useAutoFetch } from '@/composables/useAutoFetch'
// R5-005 — 진행 중 작업 있을 때 앱 종료 가드.
import { useAppExitGuard } from '@/composables/useAppExitGuard'
// B4-09 — 페이지 렌더 에러 시 blank screen 회피 (component-level fallback).
import ErrorBoundary from './components/ErrorBoundary.vue'
import { useReposStore } from '@/stores/repos'
import { RouterLink, useRouter } from 'vue-router'

const { theme, toggle } = useTheme()
const { t } = useI18n()
const reposStore = useReposStore()
const ui = useUiState()
const uiSettings = useUiSettingsStore()
const router = useRouter()
useDeepLink(router)
useAutoFetch()
useAppExitGuard()

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

// c80-3 — 14 useShortcut + ⌘⇧P/F window keydown + onReflogShowDiff 통합.
const { onReflogShowDiff } = useAppShortcuts({
  repoSwitcherOpen,
  commitSearchOpen,
  createPrOpen,
  helpOpen,
  reflogOpen,
  closeAllModals,
})

// Sprint c75-B — Onboarding GitKrakenImport detect 는 useOnboardingDetect 에 분리.
useOnboardingDetect()

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
// UltraPlan v0.4 SB-001 — sidebar 사용자 drag 너비 (180-400px, localStorage 영속, default 220).
const sidebarWidth = useSidebarWidth()
const gridCols = computed(() => {
  if (!sidebarShown.value) return '1fr'
  // sidebar width + 4px (resize handle) + 1fr (main)
  return `${sidebarWidth.value}px 4px 1fr`
})

// Phase 10-6 — 네이티브 메뉴 (Tauri menu) bridge. toggleTheme 은 useAppWindowHooks 가 등록.
useMenuListener()
</script>

<template>
  <div
    class="grid h-screen overflow-hidden"
    :style="{ gridTemplateColumns: gridCols }"
  >
    <Sidebar v-if="sidebarShown" />
    <SidebarResizeHandle v-if="sidebarShown" />
    <main class="flex flex-col overflow-hidden">
      <!-- Phase 13-3 (GitKraken parity) — 헤더 row 제거. nav 를 RepoTabBar 의 trailing slot 으로 통합.
           기존 36px 헤더 row 절약 → vertical 공간 확보. -->
      <RepoTabBar @open-switcher="repoSwitcherOpen = true">
        <template #trailing>
          <div class="flex items-center gap-2 px-2 text-2xs">
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
              class="ml-1 rounded border border-input px-1.5 py-0.5 text-3xs hover:bg-accent"
              :title="theme === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark')"
              :aria-label="t('nav.themeAriaLabel')"
              @click="toggle"
            >
              {{ theme === 'dark' ? '☾' : '☀' }}
            </button>
          </div>
        </template>
      </RepoTabBar>
      <ErrorBoundary :label="t('errorBoundary.page')">
        <RouterView class="flex-1 min-h-0 overflow-hidden" />
      </ErrorBoundary>
      <StatusBar />
    </main>
    <CommandPalette />
    <SyncTemplateModal
      :open="syncTemplateOpen"
      :initial-sha="syncTemplateInitialSha"
      @close="syncTemplateOpen = false"
    />
    <BisectModal :open="bisectOpen" @close="bisectOpen = false" />
    <ReflogModal :open="reflogOpen" @close="reflogOpen = false" @show-diff="onReflogShowDiff" />
    <CompareModal
      :open="compareOpen"
      :repo-id="reposStore.activeRepoId"
      :initial-ref1="compareInitialRef1"
      :initial-ref2="compareInitialRef2"
      :initial-mode="compareInitialMode"
      @close="compareOpen = false"
    />
    <RepoSwitcherModal :open="repoSwitcherOpen" @close="repoSwitcherOpen = false" />
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
    <!-- plan #44 E1 — Global unified search (self-contained: 자체 open + ⌘⇧K + window hook). -->
    <GlobalSearchModal />
    <ConfirmDialog />
    <PromptDialog />
    <ChooseDialog />
    <!-- v0.4 #2 (UltraPlan plan/31 §9 Q1 절충) — First-run 3-step wizard. -->
    <FirstRunWizard />
  </div>
</template>
