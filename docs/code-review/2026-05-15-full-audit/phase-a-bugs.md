# Phase A — Full UI/UX Audit Bug Log

> Sprint c89-B 진입. vite dev (1420) + Playwright MCP 자동 audit.
> Codex audit (`task-mp6agi61-c3yrk0`) 병렬 진행 중.

## Wave A-1 — index page

### BUG-A1-001 — vue-i18n linked syntax 충돌 (`stash@{idx}` / `HEAD@{1}`)

- **Severity**: HIGH
- **Axis**: i18n
- **Panel**: 전역 (i18n init 시점)
- **Repro**: `bun run dev` → http://localhost:1420 → 콘솔 에러
  > `SyntaxError: Message compilation error: Invalid linked format`
  > `1 |  stash@{idx} 메뉴`
- **Root cause**: vue-i18n 의 `@{...}` 는 linked message syntax. `stash@{idx}` 가 `@{idx}` linked ref 로 해석 → lexer fail.
- **Affected**: 16 occurrences (ko 8 / en 8) — `stash@{idx}` 14건 + `HEAD@{1}` 2건 (undoMessage 의 reflog 설명 텍스트)
- **Fix**: single-quote escape `{'@'}` 적용 — `stash@{idx}` → `stash{'@'}{idx}`, `HEAD@{1}` → `HEAD{'@'}{1}`
- **Files**: `apps/desktop/src/locales/ko.json`, `apps/desktop/src/locales/en.json`
- **Status**: ✅ **FIXED** (page reload 후 console error 0)
- **Related**: [docs/solutions/vue-i18n-at-token-lexer-conflict.md](../../solutions/vue-i18n-at-token-lexer-conflict.md) — c47-mini 후속 잔존분
- **Prevention**: 본 audit 종료 시 lefthook `pre-commit` 또는 `i18n:count` 에 `grep -nE '"[^"]*@[{]'` 검사 추가 권장

### BUG-A1-002 — `useMenuListener` Tauri IPC 가드 누락 (vite dev TypeError)

- **Severity**: HIGH
- **Axis**: dev-mode robustness
- **Panel**: App.vue mount 시점 전역
- **Repro**: `bun run dev` → http://localhost:1420 → 콘솔 에러
  > `TypeError: Cannot read properties of undefined (reading 'transformCallback')`
  > `at listen` (`@tauri-apps/api/event`)
  > `at attach` (`useMenuListener.ts:66`)
- **Root cause**: Tauri `listen()` API 가 internal `__TAURI_IPC__.transformCallback` 의존 — vite dev (Chromium) 환경에서 stub 부재. `useMenuListener.attach()` 가 `isMockEnabled()` 가드 없이 바로 `listen()` 호출.
- **Affected**: vite dev mode 전체 (Tauri webview 외 — Playwright e2e, dogfood-by-browser)
- **Fix**: `attach()` 진입 시 `if (isMockEnabled()) return` early-out 추가 + 주석.
- **Files**: `apps/desktop/src/composables/useMenuListener.ts`
- **Status**: ✅ **FIXED** (page reload 후 TypeError 0)
- **Prevention**: 향후 Tauri API 직접 호출 composable 작성 시 `isMockEnabled()` 가드 표준 패턴 정착. solution 작성 후보 (compound 영역).
