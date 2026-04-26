import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router/auto'
import { routes } from 'vue-router/auto-routes'
import { VueQueryPlugin } from '@tanstack/vue-query'

import App from './App.vue'
import { queryClient } from './api/queryClient'
import './styles/main.css'

// Tauri 데스크탑 앱은 SPA 모드로만 동작 (SSR / hydration 없음).
// 라우터는 webHistory + 자동 routes 생성 (unplugin-vue-router).
const router = createRouter({
  history: createWebHistory(),
  routes,
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')
