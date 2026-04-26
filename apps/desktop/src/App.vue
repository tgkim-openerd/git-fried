<script setup lang="ts">
// 최상위 레이아웃: 사이드바(좌) + 본문(우, file-routing 페이지) + 헤더 (Profiles / Theme / Settings).
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import CommandPalette from './components/CommandPalette.vue'
import ProfileSwitcher from './components/ProfileSwitcher.vue'
import SyncTemplateModal from './components/SyncTemplateModal.vue'
import BisectModal from './components/BisectModal.vue'
import ReflogModal from './components/ReflogModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import RepoSwitcherModal from './components/RepoSwitcherModal.vue'
import CreatePrModal from './components/CreatePrModal.vue'
import HelpModal from './components/HelpModal.vue'
import { useTheme } from '@/composables/useTheme'
import { useShortcut } from '@/composables/useShortcuts'
import { useReposStore } from '@/stores/repos'
import { RouterLink } from 'vue-router'

const { theme, toggle } = useTheme()
const reposStore = useReposStore()

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

interface GlobalHandles {
  gitFriedOpenSyncTemplate?: typeof openSyncTemplate
  gitFriedOpenBisect?: () => void
  gitFriedOpenReflog?: () => void
}
const w = window as unknown as GlobalHandles
w.gitFriedOpenSyncTemplate = openSyncTemplate
w.gitFriedOpenBisect = () => (bisectOpen.value = true)
w.gitFriedOpenReflog = () => (reflogOpen.value = true)
</script>

<template>
  <div class="grid h-screen grid-cols-[280px_1fr] overflow-hidden">
    <Sidebar />
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
      <RouterView class="flex-1 overflow-hidden" />
    </main>
    <CommandPalette />
    <SyncTemplateModal
      :open="syncTemplateOpen"
      :initial-sha="syncTemplateInitialSha"
      @close="syncTemplateOpen = false"
    />
    <BisectModal :open="bisectOpen" @close="bisectOpen = false" />
    <ReflogModal :open="reflogOpen" @close="reflogOpen = false" />
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
