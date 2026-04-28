import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueRouter from 'unplugin-vue-router/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { fileURLToPath, URL } from 'node:url'

const host = process.env.TAURI_DEV_HOST

// Tauri 2 디폴트 dev port = 1420 (변경 시 tauri.conf.json 의 devUrl 도 동기화)
export default defineConfig({
  plugins: [
    // 파일 기반 라우팅 (vue 자체보다 먼저 로드)
    VueRouter({
      routesFolder: 'src/pages',
      dts: 'typed-router.d.ts',
    }),
    vue(),
    // composables / Vue API auto-import
    AutoImport({
      imports: [
        'vue',
        'pinia',
        VueRouterAutoImports,
        {
          '@tanstack/vue-query': [
            'useQuery',
            'useMutation',
            'useQueryClient',
          ],
        },
      ],
      dirs: ['src/composables', 'src/stores'],
      dts: 'auto-imports.d.ts',
      vueTemplate: true,
    }),
    // 컴포넌트 auto-import (PascalCase.vue)
    Components({
      dirs: ['src/components'],
      dts: 'components.d.ts',
      extensions: ['vue'],
      deep: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Tauri 2 dev server 설정
  // - 1420 포트 고정 (tauri.conf.json 와 일치)
  // - clearScreen=false: cargo 출력 보호
  // - HMR 은 host 기반
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // Tauri release build 환경변수
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/api/devMock.ts', // dev-only mock fixtures
        'src/types/**',
        'src/main.ts',
        'src/router/**',
      ],
      // Threshold 전략 — global 베이스라인 보호 (실측 +0.4pt buffer).
      // 진행도: 3% → 5% → 6% → 7% → 7.5% → 8% (현재, 실측 8.38% lines / 73.14% branches / 57.99% functions, 29 test files / 285 tests).
      thresholds: {
        lines: 8,
        statements: 8,
        functions: 55,
        branches: 72,
      },
    },
  },
})
