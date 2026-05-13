# /analyze Recommendations — 심층 탐색 & 문서화

- **Generated**: 2026-05-13 15:53:59
- **Base HEAD**: `87221b5` (c77-fix-2 — scroll system 9 fix)
- **Source report**: 직전 `/analyze` 출력 (Recommendations HIGH 2 / MEDIUM 4 / LOW 3 / User Decision 1)
- **목적**: 각 Recommendation 의 (a) 증거 deep verify (b) 실 액션 단계 (c) 위험·effort 평가 (d) confidence 보정

---

## Executive Summary

총 10 항목 중:

- **CONFIRMED actionable (HIGH)** : 2 건 — Rust panic hook + secret_mask 통합 / CommitGraph.vue 200 LOC 경계 회귀
- **CONFIRMED actionable (MEDIUM)** : 2 건 — 잠복 god component ≥150 LOC 17 건 (이전 보고서 14건 → 정확 카운트 17건) / Updatable major 14건
- **REJECTED (Agent 3 false positive)** : 2 건 — "e2e Playwright 미설정" REJECTED (실 9 spec + helpers + playwright.config.ts 존재) / "빈 catch 61건" REJECTED (실 빈 catch 0건, catch 블록 73건 모두 본문 있음)
- **CONFIRMED but already-resolved**: 1 건 — MEDIUM-3 invokeWithTimeout panic sanitize 는 HIGH-1 해소 시 자동 해소 (별도 액션 없음)
- **LOW**: 1 건 (reka-ui 1 import 만 → 의존성 ROI 평가)
- **User Decision**: 2 건 — notify crate / useCommandCatalog 682 LOC SoT 의도 유지

**MEMORY drift 발견**: MEMORY.md 의 c78 sprint 항목에 "panic hook + tracing::error! + secret_mask" 통합 commit 기록이 있으나 — `git log --all` 검색 결과 panic_hook 관련 commit 0건, `set_hook` 매치 0건. **MEMORY c78~c80 항목은 실 main HEAD 에 반영되지 않음** (별도 worktree 또는 누락). 이는 HIGH-1 권고의 정당성을 강화.

---

## Verification Re-pass (REJECTED claims)

| # | Original sub-agent claim | Re-verify | Verdict |
|---|---|---|---|
| 1 | Agent 2: `tauri-plugin-fs` unused 후보 | `grep tauri_plugin_fs apps/desktop/src-tauri/src/lib.rs` → L71 `.plugin(tauri_plugin_fs::init())` | **REJECTED** |
| 2 | Agent 3: composables 143개 | `find apps/desktop/src/composables -name '*.ts' \| wc -l` = 170 (108 src + 62 test) | **REJECTED** |
| 3 | Agent 3: panic hook 미구현 ✱ | `grep -rEn 'set_hook\|panic_hook' apps/desktop/src-tauri/src` = 0 / `git log --all --oneline \| grep -iE 'panic_hook'` = 0 | **CONFIRMED** (c77 시점) — MEMORY c78 기록과 별개로 main 미반영 |
| 4 | Agent 3: e2e Playwright 미설정 | `find . -name 'playwright.config.ts'` → root `playwright.config.ts` + `e2e/` 9 spec + helpers.ts | **REJECTED** |
| 5 | Agent 3: 빈 catch 61건 | `grep -rEn 'catch\s*\([^)]*\)\s*\{\s*\}\|} catch \{\|\.catch\(\(\)' = 0 / 단순 `catch (` 총 73건 모두 본문 있음 | **REJECTED** |
| 6 | Agent 2: useCommandCatalog 682 LOC god | `wc -l useCommandCatalog.ts` = 682 | **CONFIRMED** (단 의도적 보존 평가 유지) |
| 7 | Agent 1: god comp ≥200 1건 | top script LOC 측정 → CommitGraph 200 (경계 ≥200) | **CONFIRMED 부분** — 경계 위 1건, 이전 c75 마일스톤 197 회귀 |

> Codex negative assertion validation: **skipped** (`scope_excluded`) — 모든 finding 이 destructive follow-up (파일 삭제 / config 제거) 을 동반하지 않음. 모두 "추가 / 변경" 권고.

---

## HIGH-1 — Rust panic hook + secret_mask 통합

### 증거

- [apps/desktop/src-tauri/src/lib.rs:50-58](apps/desktop/src-tauri/src/lib.rs#L50-L58) — `pub fn run()` 진입에 `tracing_subscriber::fmt()...init()` 만 등록. `std::panic::set_hook` 호출 0건.
- 전체 `grep -rEn 'set_hook|panic_hook'` Rust src 0 매치.
- [apps/desktop/src-tauri/src/secret_mask.rs:52](apps/desktop/src-tauri/src/secret_mask.rs#L52) — `pub fn mask_secrets(input: &str) -> String` 이미 export, 11 regex (GitHub PAT / GitLab PAT / AWS / Private Key / Slack / JWT / Stripe / Anthropic / OpenAI / Google / DB URL / 한국 SSN / generic env-var) + 9 test 모두 PASS.
- `git log --all --oneline | grep -iE "panic_hook"` = 0 매치 — MEMORY 의 c78 "Rust panic hook" 기록은 실 commit 없음.

### 위험 (현재 결함)

1. Rust panic 발생 시 default hook 이 panic message + backtrace 를 raw stderr 로 출력. **시크릿 포함 가능성** (e.g. `Entry::new failed: ghp_xxx`).
2. tracing 미경유 → 사용자가 frontend 에서 "report bug" 호출해도 panic 정보 누락.
3. Tauri 환경에서 panic = process abort (release profile `panic="abort"`). silent failure 위험.

### 액션 (M effort, 단일 commit)

```rust
// apps/desktop/src-tauri/src/lib.rs::run() 진입 직후 (tracing_subscriber init 후)
let default_hook = std::panic::take_hook();
std::panic::set_hook(Box::new(move |info| {
    let raw = info.to_string();
    let masked = secret_mask::mask_secrets(&raw);
    let location = info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
        .unwrap_or_else(|| "unknown".to_string());
    let payload = info.payload();
    let msg = if let Some(s) = payload.downcast_ref::<&str>() {
        secret_mask::mask_secrets(s)
    } else if let Some(s) = payload.downcast_ref::<String>() {
        secret_mask::mask_secrets(s)
    } else {
        "<non-string panic payload>".to_string()
    };
    tracing::error!(target: "panic", location = %location, msg = %msg, "{}", masked);
    default_hook(info);
}));
```

- 옵션: 별도 `src-tauri/src/panic_hook.rs` 모듈로 분리 (MEMORY c79 ARCH-004 가 미래에 반영될 형태와 일치).
- 테스트: `#[test]` 안에서 `std::panic::catch_unwind(|| panic!("token: ghp_abc..."))` 후 hook 호출 검증은 hook 자체가 process-global 이라 test 격리 까다로움 — `mask_secrets()` unit test (이미 9건 PASS) 로 마스킹 로직 가드, hook 통합은 manual smoke 로 충분.

### confidence

**certain** — 증거 모두 file:line 직접 인용, 효과 (시크릿 누출 차단 + tracing 라우팅) 명확. 회귀 위험 거의 0 (default_hook 보존).

---

## HIGH-2 — CommitGraph.vue 200 LOC 경계 회귀

### 증거

- [apps/desktop/src/components/CommitGraph.vue](apps/desktop/src/components/CommitGraph.vue) `<script setup>` 정확히 200 LOC (L1-201, L202 가 `</script>`).
- MEMORY c75-A 가 "CommitGraph 217→197 LOC (-20, useGraphInfiniteScroll + useCommitGraphSelection)" 라고 기록 — 그러나 c75 종료 후 누적 회귀 +3.
- c75 마일스톤 "god comp 0 전체 달성" 가드: 임계 ≥200 → **현재 1건 경계 위**.
- 회귀 영향 line 식별 (해당 파일 read 분석):
  - **L190-201 (12 LOC)** — `HANDLE_WIDTH`, `INNER_DIVIDER_WIDTH`, `INNER_DIVIDER_LEFT`, `branchChipStickyWidth`, `branchChipStickyLeft` 상수+computed (Sprint c52 ARCH-009 sticky overlay)
  - **L156-171 (16 LOC)** — `onMounted` + `watch` + `resetScrollTop` (c76 추가) + `onUnmounted` lifecycle 통합
  - **L173-188 (15 LOC)** — `useCommitGraphHeader` destructure + `void headerMenuRef` 처리

### 액션 (S effort, 단일 commit)

**옵션 A (권장, 12 LOC 절감)** — sticky overlay 좌표 composable 추출:

```ts
// apps/desktop/src/composables/useCommitGraphStickyLayout.ts (신규)
import { computed, type ComputedRef } from 'vue'
import { BRANCH_TAG_DEFAULT_WIDTH_PX } from '@/composables/useCommitColumns'

const HANDLE_WIDTH = 12
const INNER_DIVIDER_WIDTH = 2
const INNER_DIVIDER_LEFT = (HANDLE_WIDTH - INNER_DIVIDER_WIDTH) / 2

export function useCommitGraphStickyLayout(opts: {
  graphWidth: ComputedRef<number>
  allColumns: ComputedRef<Array<{ id: string; widthPx?: number }>>
}) {
  const branchChipStickyWidth = computed(
    () => opts.allColumns.value.find((c) => c.id === 'branchTag')?.widthPx ?? BRANCH_TAG_DEFAULT_WIDTH_PX,
  )
  const branchChipStickyLeft = computed(() => opts.graphWidth.value + HANDLE_WIDTH)
  return {
    HANDLE_WIDTH,
    INNER_DIVIDER_WIDTH,
    INNER_DIVIDER_LEFT,
    branchChipStickyWidth,
    branchChipStickyLeft,
  }
}
```

→ CommitGraph.vue 에서 12 LOC 제거 후 1 import + destructure. **결과: 200 → 188 LOC (-12)**, 임계 미만 안전.

**옵션 B (대안)** — lifecycle 통합 hook 추출 (`useCommitGraphLifecycle`):
- onMounted/watch/onUnmounted + `window.gitFriedSelectCommit` 등록·해제 묶음
- 절감 폭: ~12 LOC
- Pattern: c79 ARCH-003 `useGlobalCommitJumpHook` (MEMORY 기록만 — 실제 commit 미반영) 와 유사

옵션 A 만 진행해도 c75 마일스톤 회복 충분.

### 회귀 가드

- prettier multi-line 자동 분해 함정 주의 (MEMORY c76-fix sprint 의 경험 — 추출 후 prettier 가 다시 풀어 LOC 가 늘어남). 명명된 const + 1줄 destructure 로 split 방지.
- vitest 회귀: CommitGraph 직접 단위 테스트 0건이라 분리 후 기존 e2e (`gitkraken-parity.spec.ts`) smoke 로 검증.

### confidence

**certain** — LOC 측정 + line range 모두 file:line 인용. 추출 후보 12 LOC 가 self-contained (반응성 의존 = graphWidth + allColumns 만).

---

## MEDIUM-1 — 잠복 god component ≥150 LOC 17건

### 증거 (실 카운트 17건, 이전 보고서 14건은 과소)

| LOC | 파일 | 분리 후보 |
|---|---|---|
| **200** | [CommitGraph.vue](apps/desktop/src/components/CommitGraph.vue) | HIGH-2 별도 처리 |
| 192 | [BranchPanel.vue](apps/desktop/src/components/BranchPanel.vue) | `useBranchPanelFilters` (검색/정렬), c79-B `useBranchPanelMutations` 추가 추출 후보 |
| 191 | [CommitMessageInput.vue](apps/desktop/src/components/CommitMessageInput.vue) | c79-C `useAmendPrefill` 이미 있음 — `useCommitMessageFormatting` (conventional builder 통합) 후보 |
| 185 | [StashPanel.vue](apps/desktop/src/components/StashPanel.vue) | c79-D `useStashPanelActions` 있음 — list filter 추가 후보 |
| 182 | [pages/repositories.vue](apps/desktop/src/pages/repositories.vue) | `useRepositoryListFilters` (검색/정렬/그룹) |
| 181 | [WorktreePanel.vue](apps/desktop/src/components/WorktreePanel.vue) | c80-2 `useWorktreePanelActions` (MEMORY 기록만) — 실 commit 검증 필요 |
| 173 | [RepoSwitcherModal.vue](apps/desktop/src/components/RepoSwitcherModal.vue) | c80-4 `useRepoSwitcherList` (MEMORY 기록만) — 실 commit 검증 필요 |
| 173 | [DiffViewer.vue](apps/desktop/src/components/DiffViewer.vue) | c80-5 `useDiffHunkNav` (MEMORY 기록만) — 실 commit 검증 필요 |
| 172 | [GitKrakenToolbar.vue](apps/desktop/src/components/GitKrakenToolbar.vue) | command palette 통합 후보 |
| 168 | [RemoteManageModal.vue](apps/desktop/src/components/RemoteManageModal.vue) | c53 `useRemoteInteraction` Pattern 9 sister 확장 후보 |
| 167 | [StatusBar.vue](apps/desktop/src/components/StatusBar.vue) | `useStatusBarSegments` (각 segment 별 computed 분리) |
| 165 | [FullscreenDiffView.vue](apps/desktop/src/components/FullscreenDiffView.vue) | `useFullscreenDiffSplitQuery` 이미 있음, lifecycle 분리 후보 |
| 163 | [StatusPanel.vue](apps/desktop/src/components/StatusPanel.vue) | `useStatusSelection` 이미 있음, mutation 분리 후보 |
| 159 | [PrPanel.vue](apps/desktop/src/components/PrPanel.vue) | `usePrPanelActions` 신규 후보 |
| 158 | [ReflogModal.vue](apps/desktop/src/components/ReflogModal.vue) | `useReflogFilter` 신규 후보 |
| 157 | [CloneRepoModal.vue](apps/desktop/src/components/CloneRepoModal.vue) | `useCloneFormState` 신규 후보 |
| 153 | [pages/index.vue](apps/desktop/src/pages/index.vue) | c75-C 이미 useCommitSelection + useInlineDiffPersist 분리, 더 추출 보류 |

### 액션 (스프린트 wave, M effort 누적)

- **Wave A (HIGH-2 동반)**: CommitGraph 200 → ~188 (12 LOC 절감)
- **Wave B (≥180 4건)**: BranchPanel / CommitMessageInput / StashPanel / repositories.vue / WorktreePanel — 각 -30~50 LOC 목표
- **Wave C (≥160 8건)**: RemoteManageModal / RepoSwitcherModal / DiffViewer / GitKrakenToolbar / StatusBar / FullscreenDiffView / StatusPanel
- **MEMORY 동기화**: c79~c80 의 sprint 기록이 실 commit 미반영 → MEMORY 정리 필요 (별도 작업)

### confidence

**certain** — LOC 카운트 정확, 분리 후보 패턴은 Pattern 9 family 누적 사례 기반. 단 c79~c80 MEMORY 가 main 미반영이라 실제 작업 부담은 보고서 추정보다 더 클 수 있음.

---

## MEDIUM-2 — e2e Playwright (Agent 3 REJECTED, 단 coverage 확장 후보)

### 증거 (REJECTED)

- [playwright.config.ts](playwright.config.ts) — root 에 존재. `testDir: './e2e'`, `baseURL: 'http://localhost:1420'`, chromium 단일 project, retry CI=2.
- `e2e/` 디렉토리에 **10 spec + helpers.ts** 존재:
  - actions.spec.ts / commit.spec.ts / gitkraken-parity.spec.ts / repositories.spec.ts / settings.spec.ts / shortcuts.spec.ts / smoke.spec.ts / stash.spec.ts / status.spec.ts / worktree.spec.ts
- Agent 3 의 `find apps/desktop -path '*/e2e/*'` query 가 root e2e/ 를 놓침.

### 잔여 갭

- **Tauri 실 webview e2e 미설정** — playwright.config.ts 주석 "Tauri webview 가 아닌 일반 Chromium 에서 동작 (devMock 활성). 실 Tauri E2E 는 별도 — webdriver 또는 manual 검증 필요". Tauri 2.x 의 `tauri-driver` (WebDriver) 또는 `cargo-tauri-driver` 도입 미수행.
- CI 통합 미수행 (`forbidOnly: !!process.env.CI` 만 설정, GitHub Actions / Gitea Actions workflow 없음).

### 액션

- **즉시 (S)**: 현재 e2e 가 9 spec / chromium / devMock 으로 동작 — coverage 충분, "미흡 권고" 자체 철회.
- **차후 (L)**: Tauri webview e2e 도입 (별도 `/plan tauri-webdriver-e2e` 권고).

### confidence

**certain** — playwright.config.ts + e2e/ 디렉토리 + spec 파일 모두 file:line 인용 가능. Agent 3 단정 완전 REJECTED.

---

## MEDIUM-3 — invokeWithTimeout panic sanitize 미통합

### 증거

- [apps/desktop/src/api/invokeWithTimeout.ts:79](apps/desktop/src/api/invokeWithTimeout.ts#L79) — "AppError serialization → kind 직접 비교" 주석
- L143 `.catch((e) =>` — IPC 에러 처리 분기 존재, 단 panic info 분리 처리 없음
- Rust 측 panic 발생 시 Tauri 가 IPC 응답을 어떻게 만드는지는 Tauri runtime 내부 — `panic="abort"` 라 보통 process abort. catch 가 실제 발화하는 케이스는 `tauri::Error::ipc(IPC error)` 류.

### 평가

- HIGH-1 (Rust 측 panic hook + mask_secrets) 적용 시 FE 측 추가 sanitize 불필요. panic 자체가 abort 이므로 IPC payload 로 panic info 가 전달되는 경로 자체가 거의 없음.
- 잔여 위험: AppError serialization 안의 stderr/stdout 필드가 시크릿 포함 가능 — 이미 c45 SEC-2 에서 `secret_mask.rs` 가 GitCli stderr 양쪽에서 사용 처리됨 (secret_mask.rs:1-4 주석 인용).

### 액션

**별도 액션 없음** — HIGH-1 종속. HIGH-1 완료 후 회귀 가드 차원에서 invokeWithTimeout 의 catch 블록에서도 `mask_secrets` 호출 fallback 추가 (FE 에서는 toast 표시 전 sanitize) 검토 가치 정도. **본 보고서에서는 권고 철회**.

### confidence

**likely** — 잔여 위험 평가는 IPC 실패 경로 실측 없이는 단정 불가.

---

## MEDIUM-4 — Updatable major 14건

### bun outdated 실 결과 (2026-05-13)

#### 안전 patch/minor (즉시 적용 가능)

| Package | Current | Latest | risk |
|---|---|---|---|
| @codemirror/view | 6.41.1 | 6.42.1 | patch |
| @tanstack/vue-query | 5.100.9 | 5.100.10 | patch |
| @tauri-apps/api | 2.10.1 | 2.11.0 | minor |
| @tauri-apps/plugin-deep-link | 2.4.8 | 2.4.9 | patch |
| @tauri-apps/plugin-dialog | 2.7.0 | 2.7.1 | patch |
| @tauri-apps/plugin-fs | 2.5.0 | 2.5.1 | patch |
| @tauri-apps/cli | 2.10.1 | 2.11.1 | minor |
| reka-ui | 2.9.6 | 2.9.7 | patch |
| vue | 3.5.33 | 3.5.34 | patch |
| @vue/test-utils | 2.4.8 | 2.4.10 | patch |
| @typescript-eslint/parser | 8.59.0 | 8.59.3 | patch |
| postcss | 8.5.10 | 8.5.14 | patch |
| vue-i18n | 11.4.0 | 11.4.2 | patch |
| @types/node | 22.19.17 | 22.19.19 | patch (major 25 별도) |

#### Major bump (검토 후 plan)

| Package | Current | Latest | risk | 권장 시기 |
|---|---|---|---|---|
| @xterm/xterm | 5.5.0 | **6.0.0** | MEDIUM (usePtyTerminal 호환성 확인) | next sprint |
| @xterm/addon-fit | 0.10.0 | 0.11.0 | LOW (xterm 6 동반) | xterm 동반 |
| @xterm/addon-web-links | 0.11.0 | 0.12.0 | LOW (xterm 6 동반) | xterm 동반 |
| pinia | 2.3.1 | **3.0.4** | HIGH (단일 store repos.ts 이라 영향 작음) | next sprint |
| vue-router | 4.6.4 | **5.0.6** | HIGH (unplugin-vue-router 호환성 확인) | follow-up |
| @iconify/vue | 4.3.0 | 5.0.1 | LOW (아이콘 렌더링 회귀 가능) | 별도 |
| @vue/tsconfig | 0.5.1 | 0.9.1 | LOW | 별도 |
| eslint | 9.39.4 | **10.3.0** | MEDIUM (flat config 재검토) | follow-up |
| eslint-plugin-vue | 9.33.0 | 10.9.1 | MEDIUM (eslint 10 동반) | eslint 동반 |
| typescript | 5.6.3 | **6.0.3** | MEDIUM (tsconfig + vue-tsc 동반) | follow-up |
| vue-tsc | 2.2.12 | 3.2.8 | MEDIUM (typescript 동반) | typescript 동반 |
| tailwindcss | 3.4.19 | **4.3.0** | HIGH (CSS 클래스 매칭 로직 변경) | major 별도 plan |
| vite | 5.4.21 | **8.0.12** | CRITICAL (HMR/build 전면 재검토) | major 별도 plan |
| @vitejs/plugin-vue | 5.2.4 | 6.0.6 | CRITICAL (vite 8 동반) | vite 동반 |
| @types/node | 22.19.17 | 25.7.0 | MEDIUM (Node 22→25 LTS 갭) | Node 환경 변경 시 |
| @vitest/coverage-v8 | 2.1.9 | 4.1.6 | HIGH (vitest 4 동반) | vitest 동반 |
| vitest | 2.1.9 | **4.1.6** | HIGH (config/coverage 마이그) | next sprint |
| unplugin-auto-import | 0.18.6 | **21.0.0** | CRITICAL (메이저 점프, plugin API 재작성) | vite 동반 |
| unplugin-vue-components | 0.27.5 | **32.0.0** | CRITICAL (메이저 점프) | vite 동반 |
| unplugin-vue-router | 0.10.9 | 0.19.2 | MEDIUM (file routing API 호환성) | vue-router 동반 |

### 액션

- **즉시 (XS, 별도 commit)**: 14개 patch/minor 일괄 적용. `bun update` → `bun.lock` 변경 → typecheck + vitest run → push. CLAUDE.md `bun + git URL 의존성 SHA bump` 룰 적용 (lockfile 동시 staging).
- **next sprint (M)**: pinia 3 / vitest 4 / xterm 6 (각 독립).
- **major plan**: vite 8 + unplugin chain (별도 `/plan vite8-unplugin-major`), tailwindcss 4 (별도 plan).

### confidence

**certain** — bun outdated 실 결과 직접 인용.

---

## LOW-1 — 빈 catch 61건 (Agent 3 REJECTED)

### 증거 (REJECTED)

- `grep -rEn '} catch \{|\.catch\(\(\) => \{\}\)|catch\s*\([^)]*\)\s*\{\s*\}' apps/desktop/src` → **0 match**
- 전체 catch 블록: `grep -rEn 'catch\s*\(' apps/desktop/src` = 73건 모두 본문 있음
- `.catch( arrow` = 19건 모두 본문 있음

### 잔여 권고 (다른 문제)

- 73건 catch + 19건 .catch arrow 의 **error swallow vs propagate** policy 일관성 audit 가치는 별도 — silent-failure-hunter-agent 적용 후보 (HIGH 도 MEDIUM 도 아닌 hygiene).

### confidence

**certain** REJECTED.

---

## LOW-2 — reka-ui 1 import 만

### 증거

- `grep -rln "from 'reka-ui'" apps/desktop/src` = 1 file ([BaseTooltip.vue:28-35](apps/desktop/src/components/BaseTooltip.vue#L28-L35))
- 사용 컴포넌트: `TooltipProvider / TooltipRoot / TooltipTrigger / TooltipPortal / TooltipContent / TooltipArrow` (6 primitive)
- ContextMenu.vue 는 reka-ui **미사용** (자체 구현) — Agent 2 의 "ContextMenu wrapper" 일부 부정확
- package.json 의 `reka-ui` 0.3MB 정도 (의존성 작음)

### 평가

- reka-ui 는 Tooltip primitive 전용. tooltip 자체가 a11y + viewport edge 회피 + keyboard focus 등 직접 구현 ROI 가 낮음 — **의도적 narrow 사용 합리적**.
- 제거 ROI: 매우 낮음. 직접 구현 시 ~150 LOC 추가 + a11y 회귀 위험.
- 확대 ROI: ContextMenu / DropdownMenu / Dialog 등 reka-ui primitive 추가 도입 가능성 있으나 현재 직접 구현이 잘 동작 중.

### 액션

**없음** — 현 상태 유지. 만약 ContextMenu 가 a11y 회귀 발견 시 reka-ui ContextMenu 도입 검토.

### confidence

**likely**

---

## LOW-3 — useCommandCatalog 682 LOC 의도적 보존 재검토

### 증거

- [useCommandCatalog.ts](apps/desktop/src/composables/useCommandCatalog.ts) 682 LOC, 단일 `export function useCommandCatalog()`
- 구조 (read 분석):
  - L1-90: import + 타입 (`Cmd`, `WindowTriggerKey`)
  - L91-105: `lbl()` / `hnt()` i18n helper
  - L107-115: composable entry — useRouter / useNavigateHome / useReposStore / useQueryClient / useUiState / useGeneralSettings / useUiSettingsStore / useCustomTheme / useToast (9개 의존)
  - L116-214: **9 toggle/cycle 함수** (cycleAutoFetch / cycleDateLocale / toggleAvatarStyle / toggleHideLaunchpad / toggleConflictDetection / toggleAutoUpdateSubmodules / toggleAutoPruneOnFetch / copyCustomThemeJson / resetCustomTheme) + `trigger()` / `callWindow()` helper + `onOff` / `showHide` 헬퍼
  - L216~: `allCommands = computed<Cmd[]>([...])` — 카테고리별 sub-array (Repo 19 / Branch / Commit / Stash / Remote / Forge / Diff / Theme / UI / Workspace / Integration)

### sub-domain 분리 후보

1. **useCommandToggleHelpers (S, ~80 LOC 추출)**:
   - 9 toggle/cycle 함수 + onOff/showHide 헬퍼 → 별도 composable
   - useCommandCatalog 에서 import 후 destructure
   - **결과: 682 → ~600 LOC**
   - 위험: helper 들이 toast/general/uiSettings 모두 의존 — props 7개 받아야 함 (cohesion 깨짐)

2. **카테고리별 builder 분리 (L, ~400 LOC 분산)**:
   - `buildRepoCommands(deps)` / `buildBranchCommands(deps)` / `buildCommitCommands(deps)` ...
   - 각 builder 가 toast/store/qc/router 의존성 args 로 받음
   - **결과: useCommandCatalog ~150 LOC + 11 builder file**
   - 위험: cross-category 의존 (trigger/callWindow shared) 으로 인한 prop drilling

### 평가

- 옵션 1 (toggle 분리) 만 ROI 적정. 의도적 보존 평가 가치 (SoT, refactor risk) 와 trade-off.
- 옵션 2 (카테고리 분리) 는 over-engineering 가능 — 의존성 args 7-9개 prop drilling 으로 인한 보일러플레이트가 단일 함수보다 가독성 떨어질 수 있음.

### 액션

- **권장**: 옵션 1 적용 후 효과 (LOC 절감 + 가독성) 평가. 결과 부족하면 옵션 2 추가 검토.
- 또는 **현 상태 유지** (MEMORY 의 기존 평가 "SoT 의도적 보존" 채택).

### confidence

**uncertain** — sub-domain 분리 ROI 가 사례 의존, 직접 측정 없이는 단정 어려움.

---

## User Decision-1 — notify crate 보존

### 증거

- [apps/desktop/src-tauri/Cargo.toml:55-60](apps/desktop/src-tauri/Cargo.toml#L55-L60):
  ```toml
  # File system watch (Phase 8 / v0.x roadmap reservation).
  # 2026-05-05 /analyze 재확인: 사용량 0 동일, 의도 보존 결정 유지 (User Decision A).
  # 2026-05-06 /analyze 재확인: 사용량 0 동일, 의도 보존 결정 유지 (User Decision A).
  # 2026-05-08 /analyze c53 재확인: 사용량 0 동일. plugin-fs 와 자매 reservation (위 21:참조).
  notify = "6.1"
  ```
- [docs/plan/04-tech-architecture.md:62-65](docs/plan/04-tech-architecture.md#L62-L65):
  ```
  │  │ Watcher / Indexer                                       │ │
  │  │  - notify-rs : file system watch                        │ │
  │  │  - 변경 감지 → status 재계산 → IPC push                 │ │
  ```
- Rust 코드 use 0건 (`grep -rn 'use notify\|notify::' apps/desktop/src-tauri/src` = 0).

### 가능 액션

1. **(권장) 보존 유지** — plan/04 reservation 명확 + Cargo.toml 주석 3회 재확인 누적. 의도적 보존.
2. **주석 강화** — Cargo.toml 에 "2026-05-13 /analyze 4회차 재확인" 추가 (단순 누적 — 정보 가치 낮음).
3. **제거 후 plan/04 reservation 발효 시 재추가** — 가능하나 미래 commit 노이즈.

### 권장

(1) 보존 유지. 별도 액션 없음. 단 Cargo.toml 주석에 "2026-05-13 c77 시점 /analyze 재확인" 한 줄 추가는 옵션.

### confidence

**certain**

---

## User Decision-2 — useCommandCatalog 682 LOC

LOW-3 참조. 의도적 보존 (옵션 1 toggle 분리만 검토 가치).

---

## 우선순위 매트릭스 (sprint c80 후보)

| # | 항목 | Tier | Size | 의존성 | 회귀 위험 |
|---|---|---|---|---|---|
| 1 | HIGH-1 Rust panic hook + mask_secrets | HIGH | M | secret_mask.rs (이미 ready) | LOW |
| 2 | HIGH-2 CommitGraph.vue 200 → 188 | HIGH | S | useCommitGraphStickyLayout 신규 | LOW |
| 3 | MEDIUM-4 patch/minor 14개 일괄 bump | MEDIUM | XS | bun.lock 동시 staging | LOW |
| 4 | MEDIUM-1 god comp wave (≥180 4건) | MEDIUM | M | Pattern 9 family | MEDIUM |
| 5 | LOW-3 useCommandCatalog toggle 분리 | LOW | S | 측정 후 결정 | MEDIUM (보존 평가와 충돌 가능) |
| 6 | MEMORY drift 정리 (c78~c80) | LOW | S | 별도 doc-sync | LOW |

### 권장 1차 sprint (c80 candidate)

- HIGH-1 + HIGH-2 + MEDIUM-4 patch 일괄 = 단일 sprint 3 commit (~1.5h, M effort) — 모두 회귀 위험 LOW + ROI 명확.
- 검증: `bun test:rust` (cargo) + `bun test:web` (vitest 89 PASS) + `bun typecheck` 회귀 0.

### 후속 sprint

- god comp wave B (180~190 LOC 4건) — c80+1
- major bump plan (vite 8 / pinia 3 / vitest 4) — 별도 `/plan major-bump-roadmap`

---

## 자기 진단 — Coverage Audit Self-check

| 항목 | depth | 단정 강도 |
|---|---|---|
| panic hook 미설정 | L2 (lib.rs raw inspection + git log all) | CERTAIN |
| CommitGraph 200 LOC | L2 (file read + line range awk) | CERTAIN |
| god comp ≥150 17건 | L2 (전수 awk script LOC) | CERTAIN |
| e2e REJECTED | L2 (playwright.config + e2e/ ls 직접) | CERTAIN |
| 빈 catch REJECTED | L2 (grep multi-pattern + sample) | CERTAIN |
| useCommandCatalog 분해 ROI | L1 (구조 read 만, 실 분리 시뮬레이션 없음) | UNCERTAIN |
| reka-ui 1 import | L2 (grep + BaseTooltip read) | CERTAIN |
| notify reservation | L2 (Cargo.toml + plan/04 인용) | CERTAIN |

전 8 단정 중 L2 7 / L1 1 (LOW-3 useCommandCatalog 만 직접 측정 부족) — 자기 진단 적색 깃발 없음.
