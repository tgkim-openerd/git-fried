# POC Plan — vite 7→8 (Rolldown) + tailwindcss 3.4→4 (CSS-first)

> **작성일**: 2026-05-15 (sprint c89 자율 진행)
> **트리거**: 사용자 명시 "3순위까지 자율진행" — auto classifier 차단 영역 사용자 승인
> **베이스**: [plan/33-ultraplan-c82-completion-and-followup.md](33-ultraplan-c82-completion-and-followup.md) § 3.5 trigger 매트릭스
> **상태**: **POC plan 작성 단계** — 실 migration 은 사용자 직접 시각 검증 동반 POC branch 에서 진행
>
> ## ⛔ 자율 in-place migration 차단 사유
>
> 본 sprint 에서 in-place migration 시도 후 **POC plan 으로 전환** — 이유:
>
> 1. **시각 회귀 검증 불가**: vitest happy-dom 은 CSS 레이아웃 / 색상 매칭 / dark mode toggle 검증 못함. desktop git client 의 핵심 가치 = GUI 정확성.
> 2. **30+ color token 변형 영향**: shadcn-vue 표준 + 디자인 토큰 + Status semantic + Elevation + Z-index + 도메인 semantic colors 가 main.css + tailwind.config.ts 양쪽에 분산. CSS-first 이주 시 1개 token 오타로 invisible (transparent) 되는 위험.
> 3. **main 직접 commit 정책 + 개인 프로젝트**: 회귀 시 사용자가 즉시 자기 git workflow 에서 영향받음.
> 4. **POC branch required (CLAUDE.md)**: 본래 15+ 파일 변경 시 POC branch 필수. 본 migration 은 < 15 파일이지만 visual surface 가 크므로 동일 정책 적용 권고.

## 1. vite 7 → 8 (Rolldown + manualChunks fn migration)

### 1.1 현재 상태

- vite: **7.3.3** (apps/desktop/package.json#L74)
- bundler: rollup (vite 5/6/7 default)
- `manualChunks` 형태: **object** (6 vendor chunks, [vite.config.ts:95-115](../apps/desktop/vite.config.ts#L95-L115))

```ts
manualChunks: {
  'vendor-vue':    ['vue', 'vue-router', 'pinia', 'vue-i18n'],
  'vendor-query':  ['@tanstack/vue-query', '@tanstack/vue-virtual'],
  'vendor-ui':     ['reka-ui', 'vue-draggable-plus'],
  'vendor-codemirror': ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@codemirror/merge'],
  'vendor-cm-langs':   ['@codemirror/lang-javascript', '@codemirror/lang-vue', '@codemirror/lang-rust',
                        '@codemirror/lang-css', '@codemirror/lang-html', '@codemirror/lang-json',
                        '@codemirror/lang-markdown'],
}
```

### 1.2 vite 8 breaking changes (Rolldown 전환)

vite 8 = Rolldown (Rust 기반 번들러) 디폴트. rollup API 일부 비호환:

1. **`manualChunks` object 폐기** → `function (id: string, { getModuleInfo }) => string | null` 만 지원
2. **`Rolldown` plugin API**: 일부 rollup plugin 비호환 (대부분 신규 wrap 필요)
3. **`build.rollupOptions.output` API**: 일부 옵션명 변경 (`hashCharacters` 등)
4. **HMR fast-refresh**: vite plugin 자동 호환되나, custom plugin 수정 필요 가능

### 1.3 git-fried 영향 진단

- `manualChunks` 객체 → 함수 마이그레이션 필요 (아래 코드 참조)
- 사용 중 plugin: `@vitejs/plugin-vue`, `unplugin-vue-router`, `unplugin-auto-import`, `unplugin-vue-components` — 모두 Rolldown 호환 release 확인 필요 (vite 8 stable release notes 통독)
- esbuild config (line 79-84) → Rolldown 의 esbuild integration 유지 여부 확인
- `vitest/config` import (line 3) — vitest 4 가 vite 8 호환되는지 확인 (vitest 5 가 vite 8 first-class 가능성)

### 1.4 manualChunks function 형태 (proposed)

```ts
manualChunks(id) {
  if (!id.includes('node_modules')) return undefined
  if (/[\\/]node_modules[\\/](vue|vue-router|pinia|vue-i18n)[\\/]/.test(id)) return 'vendor-vue'
  if (/[\\/]@tanstack[\\/](vue-query|vue-virtual)[\\/]/.test(id)) return 'vendor-query'
  if (/[\\/]node_modules[\\/](reka-ui|vue-draggable-plus)[\\/]/.test(id)) return 'vendor-ui'
  if (/[\\/]@codemirror[\\/]lang-/.test(id)) return 'vendor-cm-langs'
  if (/[\\/]@codemirror[\\/]/.test(id)) return 'vendor-codemirror'
  return undefined
}
```

위 패턴은 Windows path (`\\`) + Unix path (`/`) 양쪽 호환. `node_modules` deep nested (`@scope/pkg`) 대응 정규식. 단 vite 8 Rolldown 의 module id 형식이 동일한지 verify 필요 — 일부는 `\x00` virtual prefix 가 붙음.

### 1.5 POC 실행 절차

```bash
# POC branch
git checkout -b poc/vite-8-rolldown

# 1. install vite 8
bun add -d vite@^8 vitest@^5 @vitejs/plugin-vue@latest  # vitest 5 도 동반 가능

# 2. vite.config.ts manualChunks → function 변환 (위 코드)

# 3. dev server test
bun run --cwd apps/desktop dev
# 검증: 1420 포트 서버 기동 / HMR 동작 / 모든 라우트 진입

# 4. build test
bun run --cwd apps/desktop build
# 검증: 0 error / chunk size 차이 측정 / vendor-* 청크 모두 생성

# 5. vitest test
bun run --cwd apps/desktop test
# 검증: 901 test PASS 유지

# 6. tauri build (실 desktop bundle)
bun run --cwd apps/desktop tauri build
# 검증: msi/dmg/AppImage 생성 + 실행 verify

# 7. 사용자 직접 시각 검증 — 다음 항목 panel 별 screenshot 비교
#   - CommitGraph + WIP row + branchTag sticky overlay
#   - StatusPanel + diff add/delete/rename 색
#   - PrDetailModal
#   - FileViewer + CodeMirror lazy lang
#   - Settings (4 sub)
#   - launchpad + repositories tab
```

### 1.6 Rollback criteria

다음 중 1개라도 발생 시 즉시 `git checkout main && git branch -D poc/vite-8-rolldown`:

- vue-tsc 0 error 미달
- vite build 실패 또는 vendor-* 청크 손실
- vitest 901 test 회귀
- tauri build 실패
- 사용자 시각 검증 시 색상 / 레이아웃 회귀 보고

## 2. tailwindcss 3.4 → 4 (CSS-first config)

### 2.1 현재 상태

- tailwindcss: **3.4.19** (apps/desktop/package.json)
- 설정: [apps/desktop/tailwind.config.ts](../apps/desktop/tailwind.config.ts) (135 LOC)
  - darkMode: `['class']`
  - content: index.html + src/**/*.{ts,vue}
  - theme.extend: 30+ color tokens (CSS var 매핑), borderRadius / boxShadow / zIndex / fontFamily
  - plugins: 빈 배열
- CSS entry: [apps/desktop/src/styles/main.css](../apps/desktop/src/styles/main.css) (323 LOC)
  - `@tailwind base/components/utilities` (line 10-12)
  - `@layer base` (line 22-323) — `:root` / `.dark` CSS vars + global selectors + scrollbar + reduced-motion
  - `@apply` 사용 **단 2건** (line 148 `border-border`, line 162 `bg-background text-foreground`)
- postcss.config.js: `tailwindcss` + `autoprefixer`

### 2.2 tailwindcss 4 breaking changes

1. **CSS-first config**: `tailwind.config.ts` 폐기 → CSS `@theme { ... }` 블록
2. **Import 변경**: `@tailwind base/components/utilities` → `@import "tailwindcss";`
3. **PostCSS plugin 변경**: `tailwindcss` → `@tailwindcss/postcss` (또는 `@tailwindcss/vite` 권장)
4. **darkMode 변경**: `class` 기반 → `@custom-variant dark (&:where(.dark, .dark *))` 명시
5. **`@apply` 사용**: Vue SFC scoped style block 안에서 사용 시 `@reference "tailwindcss";` 선두 필요 (현 git-fried 는 main.css `@layer base` 안만 사용 — 안전)
6. **Container utility 폐기**: `container: { center: true, padding: '1rem' }` → 직접 `mx-auto p-4` 또는 custom utility
7. **`<alpha-value>` placeholder 폐기**: `hsl(var(--diff-add) / <alpha-value>)` → tailwind 4 는 `oklch()` / `hsl()` 의 modern syntax 직접 지원 (alpha modifier 는 자동)

### 2.3 git-fried 영향 진단

- **container** 사용 여부 grep 필요 (사용 0건이면 무시 가능)
- **`<alpha-value>` 폐기 영향**: 6개 도메인 color (`diff-add` / `diff-delete` / `diff-rename` / `ai-violet` / `warning-amber` / `danger-rose`) 가 placeholder 사용 — modern hsl 으로 재작성 필요
- **dark mode**: 현재 `:root` / `.dark` selector + `darkMode: ['class']` — v4 `@custom-variant dark` 명시화 필요
- **@apply 안전 권역**: main.css 안만 사용 (Vue SFC 안 사용 없음)
- **font-family chain**: 18 entry CJK fallback chain — `@theme { --font-sans: ...; }` 로 그대로 이주

### 2.4 CSS-first @theme proposal

```css
/* main.css 상단 (font-imports 다음, @import "tailwindcss" 다음) */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* color tokens — :root / .dark 의 hsl(var(...)) 매핑 그대로 */
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  /* ... secondary / muted / accent / card / popover / destructive ... */
  --color-success: hsl(var(--success));
  --color-success-foreground: hsl(var(--success-foreground));
  /* ... warning / info ... */
  --color-diff-add: hsl(var(--diff-add));
  --color-diff-delete: hsl(var(--diff-delete));
  --color-diff-rename: hsl(var(--diff-rename));
  --color-ai-violet: hsl(var(--ai-violet));
  --color-warning-amber: hsl(var(--warning-amber));
  --color-danger-rose: hsl(var(--danger-rose));

  /* radius / shadow / z-index — 그대로 이주 */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
  --shadow-popover: var(--shadow-popover);
  --shadow-modal: var(--shadow-modal);
  --shadow-toast: var(--shadow-toast);

  /* font — 18 entry CJK chain */
  --font-sans: 'Roboto Flex Variable', Roboto, 'Noto Sans KR', 'Noto Sans CJK KR',
    'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', Meiryo, 'Noto Sans CJK SC',
    'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK TC', 'PingFang TC',
    'Microsoft JhengHei', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', D2Coding, 'Cascadia Code', Consolas, monospace;

  /* zIndex (10/20/30/40/50/60 layer) — v4 는 spacing utility 가 임의값 직접 지원
   * (z-[10] 형태). custom token 으로 정의해도 OK. */
  --z-10: 10;
  --z-20: 20;
  --z-30: 30;
  --z-40: 40;
  --z-50: 50;
  --z-60: 60;
}
```

### 2.5 vite.config.ts 변경

```ts
import tailwindcss from '@tailwindcss/vite'  // 신규 import

export default defineConfig({
  plugins: [
    VueRouter({ ... }),
    vue(),
    tailwindcss(),  // 신규 — Vue 보다 뒤, AutoImport 보다 앞
    AutoImport({ ... }),
    Components({ ... }),
  ],
  // ... 나머지 동일
})
```

### 2.6 postcss.config.js 변경

```js
export default {
  plugins: {
    // tailwindcss 제거 — @tailwindcss/vite 가 담당
    autoprefixer: {},
  },
}
```

### 2.7 tailwind.config.ts 처리

**Option A (권장)**: 완전 삭제 — v4 는 CSS-first 만 사용
**Option B**: `content` paths 만 유지 (`@source` directive 로 CSS 에 이주 가능)

```css
/* main.css */
@source "./index.html";
@source "./src/**/*.{ts,vue}";
```

### 2.8 POC 실행 절차

```bash
git checkout -b poc/tailwindcss-4

# 1. install
bun remove tailwindcss
bun add -d tailwindcss@^4 @tailwindcss/vite@^4

# 2. main.css 재작성 (위 @theme block 적용)
# 3. vite.config.ts plugins 배열에 tailwindcss() 추가
# 4. postcss.config.js 에서 tailwindcss 제거
# 5. tailwind.config.ts 삭제 (또는 비움)

# 6. build test
bun run --cwd apps/desktop build
# 검증: 0 error / CSS bundle 생성

# 7. dev server + visual 검증
bun run --cwd apps/desktop dev
# 검증: light / dark toggle / 색상 매칭 / scrollbar / focus ring

# 8. tauri build + 실 desktop 시각 검증 (사용자 직접)
```

### 2.9 Rollback criteria

- vite build 실패
- vitest 901 test 회귀
- 사용자 시각 검증 시 다음 중 1개 발생:
  - light/dark toggle 동작 안 함
  - 색상 invisible (transparent)
  - scrollbar 스타일 손실
  - focus ring 위치 변경
  - font fallback chain 깨짐 (CJK fallback 미동작)

## 3. 두 migration 순서 권고

권장 순서 (**tailwindcss 4 먼저, vite 8 나중**):

1. **POC #1**: `poc/tailwindcss-4` branch — 시각 검증 우선 (vite 7 환경 유지)
2. **POC #1 통과 후 main merge** → tailwindcss 4 안정화
3. **POC #2**: `poc/vite-8-rolldown` branch — Rolldown 안정 + plugin 호환 확인
4. **POC #2 통과 후 main merge**

이유:
- tailwindcss 4 는 visual surface 가 크므로 vite 환경 안정 (7 stable) 에서 분리 verify
- vite 8 Rolldown 은 vitest 5 동반 가능 — vitest 4 환경에서 결합 시 회귀 원인 추적 어려움
- 동시 진행 시 회귀 원인이 어느 쪽인지 식별 곤란

## 4. plan/33 §3.5 trigger 매트릭스 충족 확인

| 항목 | trigger | 본 plan 충족 |
|---|---|---|
| PR-E.3 vite 7→8 | manualChunks → ManualChunksFunction 마이그레이션 design 문서 작성 후 | ✓ § 1.4 코드 포함 |
| PR-E.5 tailwindcss 3→4 | CSS-first config migration plan 작성 후 + 기존 @apply 사용처 grep audit | ✓ § 2.3 (audit 결과: @apply 2건, main.css 만) + § 2.4 @theme 코드 |

## 5. 다음 액션

| 시나리오 | 추천 |
|---|---|
| 사용자 직접 POC verify 가능 | `git checkout -b poc/tailwindcss-4` → § 2.8 절차 → 시각 검증 |
| 사용자 시간 부족 | POC plan 문서 보존, 후속 sprint 사용자 환경 입력 시 진입 |
| 자율 진행 우선 | Codex P2 consultation `/codex:rescue --wait "vite 8 Rolldown plugin 호환성 verify"` 로 보조 |

본 plan 작성으로 **§3.5 trigger 매트릭스 충족 + 자율 진행 가치 보존**. 실 in-place migration 은 사용자 시각 검증 동반 POC branch 에서.
