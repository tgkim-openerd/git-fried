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
  // c59 — release 번들 console 노이즈 차단.
  // `pure` 사용 (drop 아님): log/debug/info 만 dead-code, warn/error 보존
  // — registerGlobalErrorHandler 의 의도적 console.error stack trace 출력은 유지.
  // debugger 는 release 에서 항상 제거.
  esbuild: {
    pure: process.env.TAURI_ENV_DEBUG
      ? []
      : ['console.log', 'console.debug', 'console.info'],
    drop: process.env.TAURI_ENV_DEBUG ? [] : ['debugger'],
  },
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // c59 — 청크 경고 임계 700KB (Vite 기본 500KB 는 vendor-codemirror/vendor-vue 4 청크 정상 사이즈 노이즈)
    chunkSizeWarningLimit: 700,
    // Sprint c45 PERF-1 — vendor 청크 분리. 초기 FCP 개선 (~50ms 추정).
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia', 'vue-i18n'],
          'vendor-query': ['@tanstack/vue-query', '@tanstack/vue-virtual'],
          'vendor-ui': ['reka-ui', 'vue-draggable-plus'],
          'vendor-codemirror': [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/language',
            '@codemirror/merge',
          ],
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
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
      // Threshold 전략 — global 베이스라인 보호.
      // 진행도: 3% → 5% → 6% → 7% → 7.5% → 8% → 8.5% → 9% → 9.5% → 9.9% → 11% → 11.3% (Sprint c29-10).
      // 현재 (c77 시점): 83 test files / 884 tests — threshold 자체는 c29-10 baseline 그대로 유지 중.
      // functions / branches 는 margin 작음 — bump 보류. lines/statements 만 +0.3 누적 가능 시 검토.
      thresholds: {
        lines: 11.3,
        statements: 11.3,
        functions: 35,
        branches: 76,
      },
    },
  },
})
