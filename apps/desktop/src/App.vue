<script setup lang="ts">
// 최상위 레이아웃: 사이드바(좌) + 본문(우, file-routing 페이지) + 헤더 (Profiles / Theme / Settings).
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import CommandPalette from './components/CommandPalette.vue'
import ProfileSwitcher from './components/ProfileSwitcher.vue'
import SyncTemplateModal from './components/SyncTemplateModal.vue'
import { useTheme } from '@/composables/useTheme'
import { RouterLink } from 'vue-router'

const { theme, toggle } = useTheme()

// Sync-template Modal — Command Palette / 추후 우클릭 메뉴에서 trigger.
const syncTemplateOpen = ref(false)
const syncTemplateInitialSha = ref<string | null>(null)
function openSyncTemplate(sha?: string) {
  syncTemplateInitialSha.value = sha ?? null
  syncTemplateOpen.value = true
}
;(
  window as unknown as { gitFriedOpenSyncTemplate?: typeof openSyncTemplate }
).gitFriedOpenSyncTemplate = openSyncTemplate
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
  </div>
</template>
