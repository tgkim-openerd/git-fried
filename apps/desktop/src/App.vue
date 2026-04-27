<script setup lang="ts">
// 최상위 레이아웃: 사이드바(좌) + 본문(우, file-routing 페이지) + 헤더 (Profiles / Theme / Settings).
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import RepoTabBar from './components/RepoTabBar.vue'
import CommandPalette from './components/CommandPalette.vue'
import ProfileSwitcher from './components/ProfileSwitcher.vue'
import SyncTemplateModal from './components/SyncTemplateModal.vue'
import BisectModal from './components/BisectModal.vue'
import ReflogModal from './components/ReflogModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import RepoSwitcherModal from './components/RepoSwitcherModal.vue'
import CreatePrModal from './components/CreatePrModal.vue'
import HelpModal from './components/HelpModal.vue'
import CompareModal from './components/CompareModal.vue'
import StatusBar from './components/StatusBar.vue'
import { useTheme } from '@/composables/useTheme'
import { useShortcut } from '@/composables/useShortcuts'
import { useUiState } from '@/composables/useUiState'
import { useDeepLink } from '@/composables/useDeepLink'
import { useUiSettingsStore } from '@/composables/useUserSettings'
import { useAutoFetch } from '@/composables/useAutoFetch'
import { useReposStore } from '@/stores/repos'
import { openInExplorer } from '@/api/git'
import { useToast } from '@/composables/useToast'
import { describeError } from '@/api/errors'
import { RouterLink, useRouter } from 'vue-router'

const { theme, toggle } = useTheme()
const reposStore = useReposStore()
const ui = useUiState()
const uiSettings = useUiSettingsStore()
const router = useRouter()
useDeepLink(router)
useAutoFetch()

// Sync-template Modal — Command Palette / 추후 우클릭 메뉴에서 trigger.
const syncTemplateOpen = ref(false)
const syncTemplateInitialSha = ref<string | null>(null)
function openSyncTemplate(sha?: string) {
  syncTemplateInitialSha.value = sha ?? null
  syncTemplateOpen.value = true
}
const bisectOpen = ref(false)
const reflogOpen = ref(false)
const repoSwitcherOpen = ref(false)
const createPrOpen = ref(false)
const helpOpen = ref(false)
// Sprint C3 — Compare modal
const compareOpen = ref(false)
const compareInitialRef1 = ref<string | null>(null)
const compareInitialRef2 = ref<string | null>(null)
function openCompare(ref1?: string | null, ref2?: string | null) {
  compareInitialRef1.value = ref1 ?? null
  compareInitialRef2.value = ref2 ?? null
  compareOpen.value = true
}

// ⌘⇧P 빠른 레포 전환 단축키 (Command Palette ⌘P 와 다름).
function onKeydown(e: KeyboardEvent) {
  const meta = e.metaKey || e.ctrlKey
  if (meta && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    repoSwitcherOpen.value = !repoSwitcherOpen.value
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

// 활성 모달들 — ⌘W 로 일괄 닫기.
function closeAllModals() {
  syncTemplateOpen.value = false
  bisectOpen.value = false
  reflogOpen.value = false
  repoSwitcherOpen.value = false
  createPrOpen.value = false
  helpOpen.value = false
  // 외부 등록된 modal trigger 들도 close — 각자 자체 ESC 핸들링.
  // 여기서는 우리가 관리하는 6개만 처리.
}
useShortcut('closeModal', closeAllModals)

// Sprint F4 — ⌥O OS 파일 매니저로 활성 레포 열기.
const toast = useToast()
useShortcut('openInExplorer', () => {
  if (reposStore.activeRepoId == null) {
    toast.warning('레포 미선택', '먼저 레포를 선택하세요.')
    return
  }
  void openInExplorer(reposStore.activeRepoId).catch((e) => {
    toast.error('파일 매니저 열기 실패', describeError(e))
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
      toast.error('전체화면 토글 실패', describeError(e))
    }
  })()
})

// Window 트리거 등록 — `src/types/window.d.ts` 의 augmentation 으로 타입 안전.
window.gitFriedOpenSyncTemplate = openSyncTemplate
window.gitFriedOpenBisect = () => (bisectOpen.value = true)
window.gitFriedOpenReflog = () => (reflogOpen.value = true)
window.gitFriedOpenCompare = openCompare
</script>

<template>
  <div
    class="grid h-screen overflow-hidden"
    :class="ui.sidebarVisible.value ? 'grid-cols-[280px_1fr]' : 'grid-cols-[0_1fr]'"
  >
    <Sidebar v-if="ui.sidebarVisible.value" />
    <div v-else />
    <main class="flex flex-col overflow-hidden">
      <!-- 상단 헤더 — Profiles / Home / Settings / Theme -->
      <div
        class="relative flex h-9 items-center justify-end gap-2 border-b border-border bg-card px-3 text-xs"
      >
        <ProfileSwitcher />
        <span class="mx-1 text-muted-foreground">·</span>
        <RouterLink
          to="/"
          class="text-muted-foreground hover:text-foreground"
          active-class="text-foreground font-semibold"
        >
          홈
        </RouterLink>
        <RouterLink
          v-if="!uiSettings.hideLaunchpad"
          to="/launchpad"
          class="text-muted-foreground hover:text-foreground"
          active-class="text-foreground font-semibold"
        >
          Launchpad
        </RouterLink>
        <RouterLink
          to="/settings"
          class="text-muted-foreground hover:text-foreground"
          active-class="text-foreground font-semibold"
        >
          설정
        </RouterLink>
        <button
          type="button"
          class="ml-2 rounded-md border border-input px-2 py-0.5 hover:bg-accent"
          :title="theme === 'dark' ? '라이트로' : '다크로'"
          @click="toggle"
        >
          {{ theme === 'dark' ? '☾' : '☀' }}
        </button>
      </div>
      <RepoTabBar @open-switcher="repoSwitcherOpen = true" />
      <RouterView class="flex-1 overflow-hidden" />
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
  </div>
</template>
