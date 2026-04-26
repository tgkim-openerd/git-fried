<script setup lang="ts">
// 최상위 레이아웃: 사이드바(좌) + 본문(우, file-routing 페이지)
import Sidebar from './components/Sidebar.vue'
</script>

<template>
  <div class="grid h-screen grid-cols-[280px_1fr] overflow-hidden">
    <Sidebar />
    <main class="flex flex-col overflow-hidden">
      <!-- 라우터 뷰 (pages/index.vue, pages/repo/[id].vue 등) -->
      <RouterView />
    </main>
  </div>
</template>
