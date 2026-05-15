# UltraPlan v0.1 — Phase B Automation (Tauri 2 LLM-자동 검증 전략)

> **작성일**: 2026-05-15 (sprint c89-B 후속)
> **트리거**: 사용자 명시 "B 를 LLM 환경에서 직접 테스트 — 여러방면 탐색 → Codex 상의하며 Plan화"
> **베이스**: [plan/35 v0.2](35-full-app-audit-hybrid.md) (Codex audit `task-mp6agi61` 반영)
> **목표**: Phase B "수동 IPC audit" 의 가능한 한 큰 비율을 **LLM 100% 자동** 으로 전환

## 0. 배경 + 발견 (sprint c89-B 탐색 결과)

### 0.1 sprint c89-B 직전 가정 (v0.1 plan/35 §2)

> Phase B = 사용자 직접 `tauri:dev` 조작 + Claude/Codex 가 로그/Rust 코드 cross-audit

가정에 깔린 전제: Tauri webview 의 실 IPC 검증이 LLM 자동 영역 밖 — webview 진입 자동화 도구 부재 / Windows tauri-driver 안정성 한계.

### 0.2 탐색 결과 — 가정 부분 REJECTED

| 영역 | 가정 (v0.1) | 실측 (v0.2) | 결론 |
|---|---|---|---|
| Rust 측 IPC handler logic | "사용자 수동" | **238 cargo test 이미 존재** (`pty/secret_mask/storage/git/forge/ai/auth/error/alias`) | 자동 가능 (70%+) |
| `git/tests.rs` 한글 round-trip | "수동" | **582 LOC tempfile + git init + git commit + NFC** | 자동 OK |
| `storage::db::tests` migration | "수동" | **7 migration test (cascade / korean name / pin toggle)** | 자동 OK |
| `pty::sanitize_tests` OSC strip | "수동" | **OSC strip 4 state machine 검증** | 자동 OK |
| `ai::runner::tests` Korean prompt | "수동" | **build_args_korean_prompt_passthrough 자동** | 자동 OK |
| `#[tauri::command]` 통합 invoke path | "수동" | 미커버 (cargo test 가 inner logic 만) | **Option B Tauri test feature 도입 시 가능** |
| Vue state + visual + dark + IME | "수동" | Playwright MCP (vite dev) — Tauri IPC mock | **Option C WebView2 CDP enable 시 가능** |
| OS deep-link / keyring 실 호출 | "수동" | OS env 필요 | 수동 유지 |

→ 결론: **Phase B의 70-80% 가 사실 자동 가능**. 가정의 일부 (사용자 수동) 가 잘못 — 본 plan v1.0 의 목표는 자동 영역 분할 + 실 구현.

## 1. 옵션 enumerate (6 옵션 + 평가)

| # | 옵션 | LLM 자동 | 검증 영역 | 셋업 비용 | 성공 가능성 | ROI |
|---|---|---|---|---|---|---|
| **A** | **cargo test 확장 (기존 238 test 패턴)** | 100% | IPC fault / worktree / httpmock forge / panic subprocess / Rust 측 모든 추가 영역 | 0 | certain | ★★★★★ |
| **B** | **`tauri = { features = ["test"] }` MockRuntime** | 100% | `#[tauri::command]` handler 통합 invoke path + AppState mock | 적음 (Cargo.toml 1줄 + 패턴 학습) | likely | ★★★★★ |
| **C** | **WebView2 CDP attach + Playwright connectOverCDP (Windows)** | 가능성 큼 | 실 Tauri IPC + Vue state + visual + dark + a11y all-in-one | 중간 (env var enable + MCP 지원 검증) | uncertain (Playwright MCP 의 connectOverCDP 지원 검증 필요) | ★★★★ if 성공 / ★★ if 부분 |
| **D** | **tauri-driver + selenium-webdriver (TST-502 활성화)** | 부분 (Windows 안정성 한계) | 실 webview e2e | 큼 (cargo install + Edge WebDriver + selenium-webdriver dep) | likely (skeleton 이미 존재) | ★★ |
| **E** | **tauri:dev spawn + tracing log capture** | 반자동 | log / panic stderr / 사용자 수동 GUI | 0 | certain | ★★ (사용자 시간 의존) |
| **F** | **Codex sandbox 실행** | 불가능 | — (Codex sandbox 에서 GUI launch 어려움) | — | uncertain | — |

본 plan 의 핵심 결정: **A + B + C 진입, D/E 는 fallback**.

## 2. 옵션 A — cargo test 확장 (즉시 가능)

### 2.1 추가 test cluster (4 영역)

본 sprint 안에 작성 가능한 추가 unit test enumeration. 각 cell 의 `[ ]` 가 test 1건 단위.

#### 2.1.1 IPC fault injection

- [ ] `error::tests` — `AppError::RateLimit { provider, retry_after }` serialize → frontend `humanizeGitError` 매핑 검증
- [ ] `error::tests` — `AppError::AuthExpired { provider }` serialize → 토스트 메시지
- [ ] `error::tests` — `AppError::Db("acquire timeout")` serialize → DB timeout UX
- [ ] `auth::tests` — keyring NoEntry / Locked / OtherError → Ok(None) fallback 검증
- [ ] `forge::tests` — 401 응답 → `AuthExpired`, 403 → message 정상 변환
- [ ] `forge::tests` — 429 응답 + Retry-After header → `RateLimit::retry_after` 파싱

#### 2.1.2 Forge API httpmock 통합

- 새 dev-dep: `httpmock = "0.7"` 또는 `wiremock = "0.6"`
- [ ] `forge::github::tests` — `client.get_pull_request(...)` → 200 happy / 401 / 403 / 429 + Retry-After / network reset
- [ ] `forge::gitea::tests` — 동일 4 case + base URL trailing slash strip
- [ ] `forge::tests` — rate-limit-header 파싱 (`X-RateLimit-Remaining`, `Retry-After` 정수/HTTP-date)

#### 2.1.3 Worktree lifecycle (Codex audit Finding A)

- [ ] `git::worktree::tests` — `add_worktree(path, branch)` happy path (tempfile)
- [ ] `git::worktree::tests` — `list_worktrees()` → main + 추가된 worktree 반환
- [ ] `git::worktree::tests` — `remove_worktree(path)` happy + locked 시 reject
- [ ] `git::worktree::tests` — `lock_worktree(path, reason)` + `unlock_worktree(path)` 라운드트립
- [ ] `git::worktree::tests` — `prune_worktrees()` → stale path 정리
- [ ] `git::worktree::tests` — 한글 worktree path → NFC normalize

#### 2.1.4 panic subprocess + WAL recovery

- 새 integration test 디렉토리: `apps/desktop/src-tauri/tests/`
- [ ] `tests/panic_wal_recovery.rs` — subprocess spawn (`cargo run --example panic_trigger`) → SIGABRT → 다음 process 가 SQLite WAL open → dirty pages auto-rollback 검증
- 핵심 deps: `std::process::Command`, `tempfile`, `sqlx`
- panic="abort" 정책 (SAF-301) 의 실용적 cleanup 경로 evidence

### 2.2 Done criteria (Option A)

- [ ] cargo test count: 238 → 270+ (+32 신규)
- [ ] 새 cluster 별 commit 1개씩 (4 commits)
- [ ] `phase-b-bugs.md` 시작 — 각 fault path 별 happy/error matrix entry
- [ ] regression spec evidence: plan/35 §5.1 의 Critical/High 만족

## 3. 옵션 B — Tauri test feature POC

### 3.1 도입 절차

```toml
# Cargo.toml dev-dependencies 추가
[dev-dependencies]
tauri = { version = "2.1", features = ["test"] }
```

```rust
// tests/ipc_handler_smoke.rs (integration test)
use tauri::test::{mock_builder, MockRuntime};
use git_fried_lib::ipc::{list_repos, list_workspaces}; // example

#[tokio::test]
async fn test_invoke_list_repos_happy_path() {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![list_repos, list_workspaces])
        .build(tauri::generate_context!())
        .expect("mock_app");

    let response = tauri::test::get_ipc_response(
        &app.get_webview_window("main").unwrap(),
        tauri::webview::InvokeRequest {
            cmd: "list_repos".into(),
            // ...
        },
    ).await;

    assert!(response.is_ok());
    // assert response shape
}
```

### 3.2 POC 단계

- [ ] Cargo.toml dev-dep 추가 + cargo check 빌드 통과
- [ ] tests/ipc_handler_smoke.rs 1 sample test 작성
- [ ] cargo test 실행 → 성공/실패 확인
- [ ] 실패 시 — Tauri 2.x 의 정확한 mock API 검증 (docs / GitHub issue tracker)
- [ ] 성공 시 — 173 handler 중 high-traffic 10개 (list_repos / get_status / get_log / get_graph / list_branches / commit / fetch / pull / push / clone_repo) test 작성

### 3.3 Done criteria (Option B POC)

- [ ] tauri test feature dev-dep 통과 cargo build
- [ ] 1 sample test 통과 → 가능성 입증
- [ ] 10 high-traffic handler 통합 test → plan v1.0 도입 가치 정량화

### 3.4 실패 시 Fallback

- Tauri 2.x test feature 가 unstable 또는 미완 → 옵션 D (tauri-driver) 또는 옵션 E (수동) 로 후퇴
- 별도 sprint 로 진입

## 4. 옵션 C — WebView2 CDP attach (가능성 검증)

### 4.1 가설

Windows 의 Tauri 2 webview = **WebView2 (Edge Chromium)**. Chrome DevTools Protocol 지원.

Enable 방법 (3 후보):

1. **env var 전역**: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`
2. **Tauri 2 config**: `tauri.conf.json` 의 `app.webviewArgs` (지원 여부 검증 필요)
3. **Rust 코드**: `WebviewWindowBuilder::additional_browser_args("--remote-debugging-port=9222")`

Playwright 측:

- Playwright `chromium.connectOverCDP({ endpointURL: 'http://localhost:9222' })` 로 attach
- 또는 Playwright MCP `browser_navigate` 가 `http://localhost:9222/...` 받을 수 있는지 검증

### 4.2 POC 단계

- [ ] WebView2 CDP enable 코드 1줄 추가 (Tauri 2 `WebviewWindowBuilder::additional_browser_args`)
- [ ] `bun run tauri:dev` background spawn
- [ ] `curl http://localhost:9222/json` 으로 CDP endpoint 응답 확인
- [ ] Playwright MCP `browser_navigate` 시도 (DevTools page 접근)
- [ ] 실 IPC 통과 page 에 `browser_evaluate` 호출 → `window.__TAURI_INTERNALS__` 존재 확인 (Tauri webview 라는 증거)

### 4.3 Done criteria (Option C POC)

- [ ] CDP endpoint 응답 (json list, 1+ tab) — 1ist Tauri webview 의 debugger URL 표시
- [ ] Playwright MCP attach 성공 → `browser_snapshot` 으로 DOM 정상 추출
- [ ] `browser_evaluate(() => invoke('list_repos'))` 결과 — 실 Rust handler 응답 받음 (devMock 아닌!)

### 4.4 실패 risk + fallback

risk:
- WebView2 CDP enable env var 적용 안 됨 (Tauri 2 가 webview args 전달 안 함)
- Playwright MCP 의 launcher 가 spawn 만 지원, connectOverCDP 미지원
- WebView2 의 CDP 가 일부 method 만 지원 (full Chrome DevTools 안 됨)

fallback:
- 옵션 D (tauri-driver) 진입
- 또는 webview-side 만 옵션 E (수동) 로 남김

### 4.5 보안 영향

CDP enable = arbitrary JS execution + 모든 webview state 노출. **dev only**:

- `cfg(debug_assertions)` 또는 `#[cfg(feature = "audit")]` 으로 release build 제외
- 사용자 명시 audit 빌드 만 enable

## 5. 옵션 D — tauri-driver (TST-502 활성화, 후순위)

이미 [plan/33 TST-502](33-ultraplan-c82-completion-and-followup.md) skeleton 존재. 옵션 B/C 실패 시 fallback.

진입 절차:
- `cargo install tauri-driver --locked` (Windows: Edge WebDriver download 동반)
- `bun add -d selenium-webdriver`
- `e2e/tauri-webdriver-smoke.spec.ts` skip 제거

skip — 본 sprint scope 외.

## 6. 옵션 E — tauri:dev spawn + log capture (반자동 fallback)

옵션 B/C 모두 실패 시:
- `bun run tauri:dev` background spawn
- stdout/stderr `tracing` 로그 + panic stderr 캡처
- 사용자 직접 GUI 조작 + Claude 가 로그 분석
- regression spec 은 cargo test (옵션 A) 만 보장

## 7. 진행 순서

```
Phase 1 — 즉시 자동 (Option A 확장)
  - IPC fault injection unit test 6건
  - Forge httpmock 통합 test 6건
  - Worktree lifecycle 6건
  - panic subprocess integration test 1건
  → cargo test 238 → 257+
  → 4 commits
  → phase-b-bugs.md 의 Rust side bugs 검출/회복

Phase 2 — Option B POC
  - tauri test feature dev-dep 추가
  - 1 sample test 가능성 검증
  - 성공 시 10 handler 통합 test
  - 실패 시 옵션 D / E 결정

Phase 3 — Option C 가능성 검증
  - WebView2 CDP enable 1줄
  - bun run tauri:dev spawn
  - Playwright MCP attach 시도
  - 성공 시 Phase B 의 webview-side audit 100% 자동
  - 실패 시 옵션 E (수동) 영역만 남김

Phase 4 — 통합 + plan/35 v0.3
  - 3 옵션 결과 통합
  - plan/35 §2.2 IPC matrix 의 자동/수동 분리 명시
  - regression spec evidence 명시
  - next_session_entry.md 갱신
```

## 8. Codex 페어 호출 정책 (본 plan 진행)

UltraPlan cycle 패턴 (c82 의 7 round audit 축소):

- **Codex 1차** — plan/36 v0.1 missed scenario + 옵션 검증 method (background)
- **Codex 2차** — Phase 1 (Option A) 종료 후 cargo test 추가 cluster 가 missed scenario 추가 cover 하는지 (consultation)
- **Codex 3차** — Option C POC 결과 검토 + Tauri 2 CDP enable 의 보안/안정성 영향 평가

각 Codex 호출은 `--wait` slash 또는 background. fan-out group cap 준수.

## 9. Risk 평가

| Risk | 영향 | mitigation |
|---|---|---|
| Tauri test feature unstable / 미완 | Option B 실패 | Tauri 2.x docs / GitHub issue 확인 + 옵션 D fallback |
| WebView2 CDP enable 안 됨 | Option C 실패 | env var / Tauri config / Rust 코드 3 방법 시도 |
| Playwright MCP connectOverCDP 미지원 | Option C 실패 | raw fetch `http://localhost:9222/json` + WebSocket 시도 |
| httpmock dev-dep 추가가 release build 영향 | dev-dep 만 추가 | release feature 영향 없음 — 검증 |
| 본 plan 분량이 사용자 시간 cap 초과 | Phase 1 만 진행 후 후속 sprint | Phase 별 commit + next_session_entry.md 진행 상태 |

## 10. Done criteria (v1.0)

본 plan v1.0 final 후 진입 trigger:

- [ ] Codex 1차/2차/3차 결과 통합 → v0.x → v1.0
- [ ] 3 옵션 (A/B/C) 의 plan 절차 + done criteria 명시
- [ ] regression spec evidence 형식 결정 (plan/35 §5.1 적용)
- [ ] 사용자 명시 v1.0 승인 후 실 구현 진입

본 plan 의 실 구현은 **별도 commit + Phase 별 검증** — UltraPlan v1.0 final 까지 자율 audit cycle 만.
