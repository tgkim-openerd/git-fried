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

## Wave A-2/3/4 — launchpad / repositories / settings

### BUG-A4-001 — `gitkrakenImport` namespace JSON duplicate key (silent drop)

- **Severity**: HIGH (i18n silent regression — 13 leaf keys 누락)
- **Axis**: i18n
- **Panel**: settings (gitkrakenImport.title 호출 시점) + GitKrakenImportModal 전체
- **Repro**: `bun run dev` → http://localhost:1420/settings → 콘솔 warning
  > `[intlify] Not found 'gitkrakenImport.title' key in 'ko' locale messages`
- **Root cause**: `gitkrakenImport` namespace 가 ko.json + en.json 양쪽 **2번 정의** (line 907 + 1055). JSON.parse() duplicate key 시 last-write-wins — 두번째 block (6 keys: pin/activeTab/success/failure/skip/tabRestore) 가 첫번째 block (13 keys: title/detectFailed/preview/workspaces/repos/favorites/tabs/skipped/importButton/importing/successHeader/tabRestoreNote/redetect) 을 덮음. 결과 title 등 13 key silent 잃음.
- **Affected**: ko + en 양쪽 동일 drift. GitKrakenImport modal / settings sub 의 모든 첫 block 키 호출이 missing key warning. **i18n leaf 카운트 silent drop 13**.
- **Fix**: 첫 block 끝에 두번째 block 의 6 key 추가 → 두번째 block 삭제. 19 unique key 단일 namespace 통합.
- **Files**: `apps/desktop/src/locales/ko.json`, `apps/desktop/src/locales/en.json`
- **Status**: ✅ **FIXED** (leaf 1298→1311, warning 0)
- **Prevention**: `i18n-leaf-count.mjs` 또는 lefthook 에 duplicate top-level key 검사 추가 권장 — `python -c "import re, collections; ..."` 패턴. 본 audit 종료 시 별도 commit 으로 추가.

## Phase A-2 / A-3 (launchpad / repositories) — bug 0

console error 0, console warning 0, 시각 정상, 한글 표시 OK, 3-panel 레이아웃 OK.

스크린샷:
- `screenshots/A2-01-launchpad.png`
- `screenshots/A3-01-repositories.png`
