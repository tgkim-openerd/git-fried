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
      // Threshold 전략 — global 베이스라인 보호만 (현재 3.26% 기준 약간 buffer).
      // per-file 강제는 보류 — 실측이 모듈마다 편차 큼 (useCustomTheme 33% / useToast 100% / utils 84%).
      // follow-up: 다음 sprint 마다 global +1~2pt 상승 (3 → 5 → 10 → 25 → 40).
      thresholds: {
        lines: 3,
        statements: 3,
        functions: 3,
        branches: 3,
      },
    },
  },
})
