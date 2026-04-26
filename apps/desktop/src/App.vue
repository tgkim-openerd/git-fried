<script setup lang="ts">
// 최상위 레이아웃: 사이드바(좌) + 본문(우, file-routing 페이지) + 헤더 (Theme / Settings).
import Sidebar from './components/Sidebar.vue'
import { useTheme } from '@/composables/useTheme'
import { RouterLink } from 'vue-router'

const { theme, toggle } = useTheme()
</script>

<template>
  <div class="grid h-screen grid-cols-[280px_1fr] overflow-hidden">
    <Sidebar />
    <main class="flex flex-col overflow-hidden">
      <!-- 상단 헤더 (간단 — Theme / Settings) -->
      <div
        class="flex h-9 items-center justify-end gap-2 border-b border-border bg-card px-3 text-xs"
      >
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
  </div>
</template>
