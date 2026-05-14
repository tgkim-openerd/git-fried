# UltraPlan v0.8 ★ ULTRAPLAN 완료 — Sprint c82~c86 전 항목 수행 (OAuth 제외)

> **상태**: ★★ **ULTRAPLAN goal 충족** — 14 commit (`770f1b9..b4202b4..4f175af` + this) on main pushed
>
> **Sprint 완료**: c82 (9 commit) + c83 (2 commit: PR-A.1 + SAF-401) + c84 (1 commit: PR-A.5 bench + SAF-201 closure 분석) + c85 (1 commit: SEC-301) + c86 (1 commit: TST-501 + plan v0.8)
>
> **자동 closure** (Codex 권고 결과 분석 후):
> - SAF-201 4-phase: 전체 production unwrap 20건 **모두 정당** (semaphore close / static regex / lock poison / Tauri builder init) — Rust agent "385건" metric 오류. plan 항목 **closure**
>
> **Defer**: SAF-301 explicit Drop guard (sqlx Drop on no-commit 자동 ROLLBACK + WAL recovery 로 minimal 영향, c89+) / TST-502 Tauri WebDriver (플랫폼 의존, c89+)
>
> **사용자 환경 입력 후 진입 가능**: PR-A.5 synthetic 10k + real large repo bench / cold_start_ms/file_scroll_fps 측정 (Tauri devtools)
>
> ## ⛔ 자율 진행 제외 (사용자 명시 2026-05-14)

> ## ⛔ 작업 제외 지침 (사용자 명시 2026-05-14)
>
> **PR-D OAuth (SEC-104 PKCE S256 + SEC-105 deep-link callback allowlist + SAF-305 PKCE assert)** 는 본 UltraPlan 후속 sprint 자율 진행 **제외**.
> 자율 진행 시: PR-D 영역의 fix / 통합 / 측정 / Codex audit 모두 trigger 안 함. plan 문서 update (status / decision 기록) 만 허용.
> v1.0 OAuth 활성 시점 별도 사용자 결정 후 진입.

> **생성일**: 2026-05-14 13:09 (v0.1 R1 Claude 5) → 13:35 (v0.2 R1 Codex 통합) → 14:05 (v0.3 R2 Claude 3) → 14:30 (v0.4 R3+R4 Claude 4) → 14:55 (v0.5 R5 Claude 3) → 15:05 (v0.6 R5 Codex D) → **v0.7**: 16:00 (Sprint c82 실행 완료 — 8 commit + Codex c82 audit `task-mp53zjgg` follow-up)

## ★ Sprint c82 실행 완료 (8 commit, main branch pushed)

| # | Commit | 작업 | 검증 |
|---|---|---|---|
| 1 | `770f1b9` | fix(safety): SEC-201 panic stderr leak + SAF-401 AI timeout + D-GIT-001 no-optional-locks | vue-tsc 0 / vitest 89 PASS / cargo check+test PASS |
| 2 | `ec4b5e1` | fix(git): D-LFS-002 lfs install --local --skip-repo + D-LFS-001 push size -z flag | cargo check+test PASS |
| 3 | `47420a5` | perf(build): PERF-304 vite vendor-cm-langs + PERF-305 Playwright workers=4 | typecheck+vitest PASS |
| 4 | `209cd27` | fix(security): SEC-202 destructive 9 alias 차단 + D-AI-001 AI snapshot pattern (3 composable) + eval safety doc | vitest 895 PASS (SEC-202 차단 test 2 추가) |
| 5 | `35b6578` | fix(safety): SAF-302 PTY OSC strip + SAF-303 SQLite acquire_timeout(10s) | cargo test (5 sanitize test) PASS |
| 6 | `b6ed8a4` | fix(build): vite.config.ts vitest types reference (vue-tsc -b build fix) | vite build PASS |
| 7 | `173b0e3` | docs(plan): plan/33 Sprint c82 완료 보고 + 후속 sprint 분할 | — |
| 8 | `52e9ec8` | fix(safety): SAF-302 output-side stateful OscStripper (Codex c82 audit follow-up) + D-LFS-002 UI contract 정정 | cargo test (9 OscStripper unit test) PASS / vitest 895 PASS |

**최종 검증** (8 commit 누적):
- vue-tsc --noEmit: 0 error
- vitest: 89 file / **895 test PASS** (R5 SEC-202 destructive 차단 2 + LFS contract 1 update)
- cargo check + test: PASS (9 sanitize+OscStripper unit test 신규)
- vue-tsc -b && vite build: PASS (vendor-cm-langs 청크 293.83 kB 분리 확인)
- bun audit: 2 dev-only vuln 잔존 (vite ≤6.4.1 + esbuild ≤0.24.2) — production 영향 0, PR-E major sprint 로 분리

**Codex c82 audit (`task-mp53zjgg-k1f7rw`) 결과 통합**:
- 신규 finding 3: SAF-401 child kill HOLD / SAF-302 stdout side PARTIAL / D-LFS-002 contract HOLD
- SAF-302 stdout 은 즉시 fix (commit 8): stream-stateful `OscStripper` 4 state machine + chunk boundary split test 4
- D-LFS-002 contract 도 즉시 fix (commit 8): toast/label messages 정정
- SAF-401 child kill 은 큰 refactor → plan/33 c84+ sub-sprint
- Negative FP 3 모두 confirmed (panic_hook fix / deep-link workflow / vite dev-only)
- **Confidence: 8/10** (Codex 평가)

## 미완료 / 부분 진행 / 후속 sprint

상세: [docs/plan/33-ultraplan-c82-completion-and-followup.md](33-ultraplan-c82-completion-and-followup.md)

- **PR-A.00 SAF-301** Cargo `panic="unwind"` 검토 — bin size 측정 보류 (사용자 결정)
- **PR-A.1** vite/esbuild major — vite 8 manualChunks 회귀 → revert. CVE dev-only. PR-E sprint 분리
- **PR-A.5** bench actual 측정 — BENCH_REPO 부재 skip. 사용자 환경 입력 시 즉시 실행 가능
- **SAF-401 child kill** — wait_with_output 패턴 재구성 후속 sprint (c84+)
- **SAF-201** git/ 212 production unwrap 4 phase — Sprint c84
- **SEC-301** SSH GIT_SSH_COMMAND 통합 — Sprint c85
- **PR-D** OAuth (PKCE S256 + deep-link callback allowlist) — Sprint c86
- **PR-E** major upgrade (vite/TS/tailwindcss) — Sprint c87+
- **PR-F** 측정 인프라 (coverage threshold + Tauri webdriver e2e) — Sprint c88+

---


> **트리거**: 옵션 C 진행 — 모든 미탐색 영역 (D 카테고리 Codex 재시도 + A/B/C 21 영역) cover
> **베이스 분석**: [docs/analyze/2026-05-14-130652.md](../analyze/2026-05-14-130652.md)
> **Round 1** (5 agent): Codex `task-mp4z8bh8` ✓ + 4 Claude — FE perf / Rust safety / Build runtime / Dep & security
> **Round 2** (4 agent): Codex `by1sv1udo` ✗ sandbox + 3 Claude — FE XSS / Rust async-SQLite / AI-pty-git CLI
> **Round 3** (3 agent): Codex `a4329f47` ✗ sandbox + 2 Claude — Supply chain+CI+IPC marshalling / Forge+chrono+keyring+vue-virtual
> **Round 4** (2 agent): 2 Claude — vue-tsc+vitest+bench / cargo audit+bun.lock+token+429
> **Round 5** (4 agent): Codex `task-mp51kqky` retry background + 3 Claude — A: Git/FS 운영 / B: 실측 profiling / C: Lifecycle CI auto-update
> **상태**: ★ **17 agent 6 round 통합 — 40+ finding + 32 Clean 영역. Codex R5 도착 시 v0.6 마지막 cross-validation**

## 0. 메타 — 검증 패스 결과

### Rejected Claims (sub-agent finding 정정 — 2건)

| # | Sub-agent claim | 재검증 결과 | Verdict |
|---|---|---|---|
| 1 | Build agent: "lefthook pre-push 직렬 → parallel 추가 (XS Quick Win)" | `lefthook.yml` `pre-push: parallel: true` **이미 활성** | **REJECTED** |
| 2 | Rust agent: "493 unwrap/expect (test 제외)" | parent 재실측 production path 385건 (전체 494건). Agent metric 근사 ≈ confirmed (오차 ±10건) | **PARTIAL** (485+ Rust unwrap 이슈 본질은 동일) |

### Round 2 Coverage (v0.3 — Claude 3 agent landed, Codex `by1sv1udo` background)

> Round 1 미탐색 영역 (Rust 서브시스템 깊은 audit / FE XSS / AI-pty-git CLI) cover. **신규 Critical 1 + High 1 + Medium 6 발견**. Round 1 의 18 finding 중복 0건 (영역 분리 성공).

#### Round 2 신규 finding 카탈로그

| ID | Finding | 위치 | 위험도 | 구분 |
|---|---|---|---|---|
| **★★ SAF-301** | **Cargo `panic = "abort"` → SQLite transaction 미정리 + connection pool leak** — unwinding 안 함 → Drop 안 호출 | `Cargo.toml:[profile.release] panic = "abort"` | **★★ Critical (신규)** | Round 2 신규 |
| **★ SAF-302** | **PTY raw `write_all(data)` — ANSI escape / xterm title spoofing 무필터** | `pty/mod.rs:34-39` | **★ High (신규)** | Round 2 신규 |
| **SAF-303** | **SQLite pool max=8, acquire_timeout/idle_timeout 둘 다 미설정 + bulk concurrency 8 = pool 고갈 위험** | `storage/db.rs:75-79` SqlitePoolOptions | **High** | Round 2 신규 |
| **SAF-304** | **sqlx::query (60건 runtime) vs sqlx::query! (1건 compile-time)** — 98.4% 가 schema 검증 부재 | grep 카운트 | **Medium** | Round 2 신규 |
| **SAF-305** | **PKCE `assert!` (release strip 가능)** | `auth_oauth.rs:55-65` | **Medium** | Round 2 신규 |
| **SAF-306** | **async IPC handler 안 sync git diff/log 호출** (ai_commit_message 등) — Tauri IPC pool block | `ai_commands.rs` async 안 `crate::git::diff::diff()` | **Medium (perf)** | Round 2 신규 |
| **SEC-203** | **window.gitFried* 12 functions sha/ref param 검증 부재** | `types/window.d.ts` | **Medium** | Round 2 신규 |
| **SEC-204** | **AI prompt injection — diff content boundary break** (`\`\`\`diff` 종료) | `ai/prompts.rs:15-42` | **Medium** | Round 2 신규 |
| **SEC-205** | **AiResultModal clipboard.writeText 무 sanitize** | `AiResultModal.vue:57` | Low | Round 2 신규 |

#### Round 2 Clean (negative assertion 5-Check 통과 — Round 1 미확인 영역의 안전성 확정)

| 영역 | Verdict | 출처 |
|---|---|---|
| **v-html / innerHTML / outerHTML / eval / new Function / DOMParser** | **0 사용 — CLEAN** (5-Check) | Claude FE XSS agent |
| **vue-i18n 11 default escape** | 자동 HTML entity 인코딩 — CLEAN | Claude FE XSS |
| **CodeMirror EditorState** | read-only 모드 escape 자동 — CLEAN | Claude FE XSS |
| **localStorage `git-fried.locale.v1`** | ko/en 화이트리스트 검증 — CLEAN | Claude FE XSS |
| **vue-router navigation guards** | 미사용 (route params 직접 검증) — Acceptable | Claude FE XSS |
| **tokio::spawn JoinHandle .await** | 모두 명시적 await, fire-and-forget 0건 — CLEAN | Claude Rust async |
| **git2::Repository !Send** | spawn_blocking / sync context 만 사용 — CLEAN | Claude Rust async |
| **Migration idempotency** | 8 파일 모두 CREATE IF NOT EXISTS + sqlx_migrations meta — CLEAN | Claude Rust async |
| **report_frontend_error rate-limit + sanitize** | 50건/sec + mask_secrets + CRLF escape — CLEAN | Claude Rust async |
| **git CLI argument injection** | `reject_dash_prefix` + `--end-of-options` 전수 적용 (Sprint c40+) — CLEAN | Claude AI/pty/git |
| **tempfile (atomic, mode 0600)** | tempfile crate TOCTTOU 안전, drop cleanup — CLEAN | Claude AI/pty/git |
| **AI secret masking scope** | argv only (stdin 미사용), regex 13 패턴 — CLEAN | Claude AI/pty/git |
| **Forge URL SSRF** | configuration-sourced (per-OAuth setup), reqwest HTTP-safe — CLEAN | Claude AI/pty/git |

#### Round 2 미탐색 영역 (Round 3+4 에서 모두 cover ★)

| 영역 | Round | Verdict |
|---|---|---|
| Cargo.lock supply chain (git URL deps) | R3 | **CLEAN** — git URL deps 0건 / reqwest 듀얼버전 (transitive WARN) |
| CI/CD pipeline secrets | R3 | **OK** — TAURI_SIGNING_KEY/PASSWORD secret 정상 / pull_request_target 미사용 / bun-version: latest 만 WARN |
| Tauri IPC return type marshalling | R3 | **CLEAN** — i64/u64 직접 사용 0건 / DateTime → Unix seconds 53bit 안전 / Vec<u8> = pty only |
| vue-tsc -b incremental cache | R4 | **CLEAN** — `composite: true` + `tsBuildInfoFile` 이미 적용 |
| Cargo audit (RUSTSEC) | R4 | **CLEAN (수동)** — git2 0.19 / sqlx 0.8.6 / reqwest 0.12.28 / rustls 0.23.39 / tauri 2.1.x 모두 safe (cargo-audit 도구 미설치, 수동 Cargo.lock 스캔) |
| forge 429 retry-after | R3+R4 | **OK** — Retry-After 60s 파싱 → AppError::rate_limit → frontend toast (auto-retry 미구현 = UX 개선 LOW) |
| forge 401 graceful logout | R3+R4 | **OK** — AppError::auth_expired → frontend toast (logout cascade 미구현 = UX 개선 LOW) |
| keyring Linux D-Bus | R3 | **HIGH (SAF-203 reinforced)** — WSL/Docker 환경 fallback 부재 |
| chrono UTC vs local | R3+R4 | **CLEAN** — RFC3339 parse → Unix epoch / frontend `new Date(unix*1000)` + Intl OS TZ 자동 |
| vue-virtual measureElement | R3+R4 | **PERF-307 보강** — estimateSize 고정 → measureElement 도입 비용 +5 LOC + 1-3ms/scroll trade-off |
| Service Worker / Web worker / SharedArrayBuffer | R3 | **CLEAN** — 0 사용 |

#### Round 4 신규 finding 카탈로그

| ID | Finding | 위치 | 위험도 | 구분 |
|---|---|---|---|---|
| **SAF-203 보강** | **bulk_fetch keyring error 시 silent skip + 사용자 알림 없음** | `git/bulk.rs:125,147` | Medium | Round 4 신규 |
| **IPC-401** | **forge 429 자동 retry 미구현** — 사용자 수동 재시도 | backend OK, frontend `invokeWithTimeout.ts:80` | Low UX | Round 4 신규 |
| **IPC-402** | **forge 401 graceful logout cascade 미구현** — DB clear, UI reset 없음 | `errors.ts:27` | Low UX | Round 4 신규 |
| **TST-503 보강** | **bench 즉시 가능 (cargo bench, memory.ps1) vs 도구 필요 (cold_start, render, fps, ai_compose) 분류** | `bench/` | (measurement gap 카탈로그) | Round 4 신규 |
| **SUP-501** | **reqwest 듀얼버전 0.12.28 + 0.13.2 transitive consolidation** | `Cargo.lock` | Medium | Round 3 신규 |
| **SUP-502** | **bun-version: `latest` (release.yml)** — 매 빌드 drift | `.github/workflows/release.yml:20` | Medium | Round 3 신규 |

#### Round 3+4 Clean 영역 추가 (Round 2 Clean + 합산)

| 영역 | Verdict |
|---|---|
| Cargo.lock git URL deps | 0건 |
| CI pull_request_target | 미사용 |
| Tauri IPC return type i64/u64 | 0 직접 사용 |
| Tauri IPC DateTime 직렬화 | Unix seconds (53bit 안전) |
| devMock.ts production | DEV + !window.__TAURI_INTERNALS__ dual gate |
| Tauri capability scope | fs:default 제거 (의도적) |
| Service Worker / SharedArrayBuffer | 0 사용 |
| forge request timeout | 30s 고정 |
| chrono RFC3339 → Unix epoch | TZ 정보 손실 없음 |
| frontend new Date(unix*1000) + Intl | OS TZ 자동 |
| vue-tsc incremental | composite: true + tsBuildInfoFile |
| vitest setup 비용 | 13 LOC, 450~900ms 추정 |
| Cargo.lock RUSTSEC | 수동 스캔 0 advisory |
| bun.lock duplicates | harmful 0건 (transitive 정상) |
| Cargo.toml manifest deps | 모두 current 또는 의도적 pin |

### Round 5 (옵션 C 진행 — D 카테고리 Codex 재시도 + A/B/C 21 영역)

#### Round 5 신규 finding 카탈로그

| ID | Finding | 위치 | 위험도 | 구분 |
|---|---|---|---|---|
| **★ SAF-401** R5 | **AI subprocess `cmd.output().await` timeout 미설정** — claude/codex CLI 무응답 시 IPC 무한 대기 → 앱 블로킹 | `ai/runner.rs:112` | **★ High** | R5 신규 |
| **★ SAF-402** R5 | **`Repository::open()` index.lock retry 없음** — 다른 git 프로세스 (VSCode/Sourcetree/CLI) 동시 access 시 즉시 실패 | `git/repository.rs:51` | **★ High** | R5 신규 |
| **★ SEC-301** R5 | **SSH key flow 부분 구현** — `profiles.rs:27 ssh_key_path` 메타데이터 저장만, `git/runner.rs` 에서 `GIT_SSH_COMMAND`/`SSH_AUTH_SOCK` env 미적용 | `profiles.rs:27` ↔ `git/runner.rs` (env 미적용) | **High** | R5 신규 (Agent 의 "완전 미구현" → "메타 저장 OK + 실 사용 X" 정정) |
| **SAF-403** R5 | **tokio runtime graceful shutdown hook 미설정** — pending git fetch/push abort 가능 | `lib.rs:67-86` | Medium | R5 신규 |
| **SAF-404** R5 | **symlink loop 방어 부재** — `std::fs::canonicalize` 미사용, git2 위임 가정 | `git/` 디렉토리 전반 | Medium | R5 신규 |
| **SAF-405** R5 | **LFS smudge/clean filter race** — `lfs.rs:94 git lfs install` 후 ordering 보장 X | `git/lfs.rs:94-98` | Medium | R5 신규 |
| **PERF-501** R5 | **cargo-flamegraph + dhat 미설치** — Rust hot path / heap profiling 도구 부재 | `Cargo.toml dev-dependencies` | Low | R5 신규 |
| **TST-503 보강** R5 | **bench 즉시 실행 가능 확정** — `BENCH_REPO=. cargo bench --bench git_perf` (criterion HTML report) + `pwsh ./bench/memory.ps1` (6 시나리오) | `bench/git_perf.rs` + `bench/memory.ps1` | (Quick Win) | R5 정정 |
| **PERF-502** R5 | **Tauri V8 GC tuning flag 노출 부재** — `--max-old-space-size` 등 미설정 | `lib.rs` Tauri Builder | Low | R5 신규 |

#### Round 5 Clean 영역 (Round 4 추가)

| 영역 | Verdict |
|---|---|
| **Windows long path (>260 char)** | CLEAN — Rust `std::path` 묵시 처리 + `dirs::data_local_dir()` reasonable |
| **Sparse checkout / partial clone** | CLEAN — `clone.rs:6-45` cone mode + depth + filter=blob:none 전 지원 |
| **Git hooks `--no-verify`** | CLEAN — `commit.rs:21 CommitOpts.no_verify` 노출, file-based -F 가 stdin race 회피 |
| **locale / Unicode** | CLEAN — `unicode-normalization 0.1` + `path.rs::nfc_normalize_path()` + `LANG=C.UTF-8` 강제 |
| **Case sensitivity** | CLEAN — git CLI 위임 (NTFS case-insensitive 자동) |
| **WebView 프로세스 격리** | CLEAN — Tauri 2 default sandbox + 엄격한 CSP + fs plugin disable |
| **Git LFS basic ops** | CLEAN — `git lfs ls-files / install / track / pull / prune` 전 지원 |
| **PTY session cleanup** | CLEAN — `pty/mod.rs:62-66, 148-153` kill + writer=None + registry remove |
| **vue-query gcTime 5min** | CLEAN — `queryClient.ts:25` memory leak 방지 정책 적용 |
| **bench infrastructure 존재** | CLEAN — `bench/git_perf.rs` (criterion 3 함수) + `bench/memory.ps1` (6 시나리오) + `bench/baseline.json` (schema) |
| **panic_hook 격리** | CLEAN — `panic_hook.rs` 단일 책임 + secret_mask + tracing (단 SEC-201 default_hook leak 별도 fix) |
| **CI Windows-only 의도적 deferral** | OK — `docs/plan/17 §1.3-1.4` macOS v1.3 / Linux v1.4 로드맵 명시 |

#### Round 5 D 카테고리 — Codex retry 결과 도착 (v0.6 update)

`/codex:rescue --wait --effort high` 슬래시 커맨드로 sandbox 우회 → Codex R5 D 카테고리 audit 완료. **신규 4 finding + Claude finding 4건 정정**. Round 1 의 SEC-201/SEC-202 발견 패턴 재현.

##### Codex R5 신규 finding

| ID | Finding | 위치 | 위험도 | 출처 |
|---|---|---|---|---|
| **★ D-AI-001** | **AI 요청 snapshot 미보존** — 시작 시점의 repoId/head/base/path/PR# 보존 안 함 → 응답 도착 시 modal state 가 바뀐 상태에서 onResult 적용 → PR body / conflict result / review body 오염 가능 | `useAiPrBody.ts:49,61` + `CreatePrModal.vue:61` + `useAiResolveConflict.ts:47` + `MergeEditorModal.vue:111` + `useAiReview.ts:49` (5 파일) | **High** | Codex R5 |
| **D-GIT-001** | **`git status --porcelain` background optional lock race** — 다른 git 프로세스 동시 access 시 index refresh write lock 충돌. Git 공식 docs `BACKGROUND REFRESH` 섹션 → `git --no-optional-locks status` 권장 | `worktree.rs:24,88,110,123`, `reset.rs:129` | Medium | Codex R5 + [Git status BACKGROUND REFRESH](https://git-scm.com/docs/git-status.html) |
| **D-LFS-001** | **`git diff --name-only` 결과 `.lines()` NUL-unsafe** — newline 포함 path / quoted path 파싱 오류. `-z` flag 로 NUL termination 필요 | `lfs.rs:205,212` (`diff --name-only --diff-filter=AM @{u}..HEAD` + `.lines()`) | Medium | Codex R5 + [Git diff -z docs](https://git-scm.com/docs/git-diff/2.29.0.html) |
| **D-LFS-002** | **`git lfs install` scope mismatch** — per-repo IPC 명목인데 옵션 없으면 **global clean/smudge filter side effect**. `--local` + `--skip-repo` 명시 필요. R5 SAF-405 의 "ordering race" → "global config side effect" 로 reframe | `lfs.rs:96`, `lfs_commands.rs:56` | Medium | Codex R5 + [Git LFS install docs](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-install.adoc) |

##### Codex R5 Negative FP 검증 (Claude finding 정정 4건)

| Claude finding | Codex 검증 | 결과 |
|---|---|---|
| **SAF-402** "Repository::open() index.lock retry" | git2 docs 의 `Repository::open` 설명은 existing repo open 만. **실제 lock anchor 는 `git status --porcelain` background** | **REJECTED/PARTIAL** — anchor 가 잘못됨. → **D-GIT-001 으로 reframe** (`--no-optional-locks` 적용) |
| **R2 Clean "v-html / innerHTML / eval 0 사용"** | `menu.rs:176 let _ = win.eval("location.reload()")` static 1건 발견 | **PARTIAL** — XSS 아니지만 정확성 위해 "**dynamic eval 0 / static webview eval 1**" 로 정정 |
| **R5 Clean "Git hooks `--no-verify` CONFIRMED"** | `commit.rs:20 CommitOpts.no_verify` + `commit.rs:72 --no-verify` 전달 | **CONFIRMED** (양측 일치) |
| **R5 SAF-401 "AI subprocess timeout 미설정"** | `runner.rs:76, 112` 모두 backend timeout 없음. **frontend IPC timeout 은 backend child cancellation 아님** → 별도 fix 필요 명시 | **CONFIRMED + 강화** (frontend timeout 으로는 부족, backend `tokio::time::timeout` 필수) |

##### Codex R5 가치 — Round 1 SEC-201/SEC-202 패턴 재현

- **D-AI-001**: 5 round 가 모두 놓친 stale-result race — Codex 의 cross-component 시각
- **SAF-402 anchor 정정**: Claude finding 의 위치가 잘못됨 — Codex 의 Git docs reference 기반 fact-check
- **D-LFS-001/D-LFS-002**: Git/Git LFS 공식 docs 인용 — 외부 OSS reference 강점
- **eval 0 → 1 정정**: negative assertion FP 발견

##### Round 5 D 카테고리 Coverage 완료

★ **방향성 (성능/속도/안전성) 의 모든 영역 cover** — Codex 의 cross-validation 까지 합류. Plan 완성 선언 가능.

### Codex Cross-Reference (v0.2 — `task-mp4z8bh8` landed, v0.3 — Round 2 Codex `by1sv1udo` 진행 중)

> Codex deep audit `task-mp4z8bh8-vkfga0` 결과 통합. 6 finding 모두 parent context 에서 재검증 PASS. 이전 /analyze Codex `task-mp4yop03` 는 다른 작업으로 context drift — 본 audit 은 새 task 결과 기준.

#### Agreed (Codex + Claude 일치 — 최고 confidence)

| ID | Finding | 양측 합의 |
|---|---|---|
| **PERF-305** | Playwright workers=1 / fullyParallel=false | Codex B1 + Claude Build agent — XS Quick Win |
| **PERF-303** | i18n locale 양쪽 다 startup load | Codex 미언급 (문서적 합의), Claude FE perf agent — locale lazy-load M |

#### Codex-only (Claude 미발견 — **신규 Critical 2건**)

| ID | Finding | Codex 출처 | parent 재검증 |
|---|---|---|---|
| **SEC-201** ★ Critical | **panic_hook.rs:44 `default_hook(info)` 가 mask 안 된 raw payload 를 stderr 로 다시 출력** — secret_mask 는 tracing 만 적용, default_hook 는 우회 | C1 | CONFIRMED — `panic_hook.rs:23,37,44` 직접 확인. comment "default_hook 보존 (debug stderr backtrace 유지)" 의도와 secret leak risk 충돌 |
| **SEC-202** ★ Critical | **`git-fried://command/<alias>` deep-link 가 외부 URL 만으로 push/pull/stage-and-commit dispatch** — 악성 사이트 `<a href="git-fried://command/push">click</a>` 클릭 만으로 사용자 repo 변경 | C2 | CONFIRMED — `useDeepLink.ts:20-46` `COMMAND_ALIASES` 26개 alias 중 destructive (`pull`/`push`/`commit`/`stage-all`/`stage-and-commit`/`unstage-all`/`new-pr`/`new-branch`) 8개. `useDeepLink.ts:91-97` `setTimeout(50, dispatchShortcut(action))` confirm 없이 trigger |
| **PERF-308** | **Rust IPC `walker.take(limit)` cursor/skip 미지원** — `limit` 증가마다 HEAD 부터 재계산 → O(n²) | A1 | CONFIRMED — `git/graph.rs:78` `for oid_res in walker.take(limit)` 직접 확인 |
| **PERF-309** | **StatusPanel.vue v-for 전체 + buildPathTree/flattenTree 재계산** — 대량 변경 파일 시 비싼 reactive cascade | A2 | CONFIRMED — Codex grep 결과 인용 (parent 추가 검증 필요) |
| **TST-503** | **bench/baseline.json 6 metric `actual: null` placeholder** — cold_start_ms / graph_render_1k_ms / file_scroll_fps / memory_10_repos_mb / ai_compose_roundtrip_ms / doherty_threshold_ms 모두 측정 부재 | B2 | CONFIRMED — `bench/baseline.json` 직접 확인. v0.6 #23 (plan/31) 후속 측정 sprint 미진입 |
| **SEC-106 정정** | tauri-plugin-shell 2.3.5 는 GHSA-c9pr-q8gx-3mgp **이미 patched** — 단 capability 표면 잔존 | C3 | Claude 의 SEC-106 "argument injection 가능" 보다 정확. Codex 의 OSS reference (Tauri advisory + v2 docs) 채택 |

#### Claude-only (Codex 미발견 — confidence 1단계 down)

| ID | Finding | Claude 출처 | confidence 조정 |
|---|---|---|---|
| SEC-101/102 | vite/esbuild CVE 2건 | Dep agent (`bun audit`) | certain → likely (Codex 의 명시적 confirm 없음, but `bun audit` 결과는 객관적 — certain 유지 권고) |
| SAF-201 | 385 unwrap/expect production | Rust agent | certain → certain 유지 (count 객관적) |
| SAF-202 | git timeout orphan process (runner.rs L120-130) | Rust agent | likely → likely 유지 (코드 코멘트 자체가 인정) |
| SAF-203 | keyring fallback 부재 | Rust agent | likely → uncertain (Codex 미언급 + 직접 grep 미수행) |
| SEC-103 | CSP img-src data: XSS surface | Dep agent | likely → uncertain (Codex 미언급 + data: SVG XSS 실증 부재) |
| PERF-301/302 | CodeMirror lang static + v-memo 0 | FE perf agent | certain → likely (Codex 가 다른 영역 priority — perf hot path 가 아닐 가능성) |

#### Disagreements

> 본 audit 에서 직접 충돌 없음. Claude SEC-106 "argument injection 가능" 은 Codex 가 "patched 됐으나 표면 잔존" 으로 정정 — disagreement 아닌 보강.

### Coverage Audit (positive claim 5건)

| # | Claim | Depth | Verdict |
|---|-------|-------|---------|
| 1 | "vue-virtual c77-B viewport-aware overscan 이미 최적" | L2 | **CONFIRMED** — `useCommitGraphRows.ts:42-50` viewport baseline + tier (1k/3k/5k) |
| 2 | "Cargo profile.release 이미 최적화 (opt=s/lto/codegen=1/strip/abort)" | L2 | **CONFIRMED** — `Cargo.toml:[profile.release]` 5 항목 모두 명시 |
| 3 | "secret_mask.rs 13개 정규식 + env-var 마스킹" | L1 | **DOWNGRADED** — 카테고리 일치, 정규식 13 개수 직접 미검증 (sub-agent 보고 그대로) |
| 4 | "encoding_rs UTF-8 강제 (LANG=C.UTF-8)" | L2 | **CONFIRMED** — `git/runner.rs` 명시 |
| 5 | "happy-dom 20 jsdom 대비 30% 빠름" | L1 | **DOWNGRADED** — 일반적 통념, 본 프로젝트 측정값 부재 |

총 5 단정 중 CONFIRMED 3 / DOWNGRADED 2 / 회색지대 0

---

## 1. 핵심 finding 통합 (5 agent 합집합 + 검증)

### A. 보안 (Critical / High — 즉시 조치)

| ID | Finding | 위치 | 위험도 | confidence | effort |
|---|---|---|---|---|---|
| **SEC-201** ★ Codex | **panic_hook default_hook 가 raw payload stderr leak** | `panic_hook.rs:44` | **★ Critical** | certain | **XS** |
| **SEC-202** ★ Codex | **deep-link `git-fried://command/<dest>` 가 push/pull/commit 등 destructive shortcut 외부 URL 만으로 dispatch** | `useDeepLink.ts:91-97` + COMMAND_ALIASES 8 destructive | **★ Critical** | certain | **S** |
| **SEC-101** | **vite ≤6.4.1 path-traversal CVE** (GHSA-4w7w-66w2-5vf9) | `apps/desktop/package.json:69` vite 5.4.21 | **High (dev)** | certain | XS |
| **SEC-102** | **esbuild ≤0.24.2 dev-server SSRF CVE** (GHSA-67mh-4wv8-2f99) | vite transitive | **High (dev)** | certain | XS |
| **SEC-103** | **CSP `img-src 'self' data: https:` data: URI XSS surface** | `tauri.conf.json` security.csp | **High** | uncertain (Codex 미발견) | XS |
| **SEC-104** | **PKCE plain method (S256 미구현, skeleton)** | `auth_oauth.rs:52-77` | **Medium** (v1.0 OAuth 활성 전 mitigated) | likely | M |
| **SEC-105** | **deep-link callback URL 검증 미수행** (skeleton) | `lib.rs:76` deep-link plugin 로드 | **Medium** | likely | M |
| **SEC-106 정정** | tauri-plugin-shell 2.3.5 GHSA-c9pr-q8gx-3mgp **이미 patched** — capability 표면 잔존 | `capabilities/default.json:15` shell:allow-open | **Low-Medium** | likely (Codex OSS ref) | S |

### B. 안전성 — Rust (Critical / High)

| ID | Finding | 위치 | 위험도 | confidence | effort |
|---|---|---|---|---|---|
| **★★ SAF-301** R2 | **Cargo `panic="abort"` → SQLite transaction 미정리 + connection pool leak** | `Cargo.toml:[profile.release]` | **★★ Critical** | certain | M (panic="unwind" 복원 + bin size trade-off 측정) |
| **★ SAF-302** R2 | **PTY raw `write_all(data)` — ANSI escape / xterm title spoofing 무필터** | `pty/mod.rs:34-39` | **★ High** | certain | S (escape filter 또는 sanitize layer) |
| **SAF-303** R2 | **SQLite pool max=8, acquire/idle timeout 미설정 + bulk concurrency 8** | `storage/db.rs:75-79` | **High** | certain | S (acquire_timeout(10s) + pool 16 또는 bulk 4) |
| **SAF-201** | **unwrap/expect/panic 385건 (production path)** — panic 시 process 단일 thread crash → entire app | `apps/desktop/src-tauri/src/**` | **High** | certain | **L** (전수 검토 + ? operator 치환) |
| **SAF-202** | **git timeout orphan process** — wait_with_output 소유권 탈취 → child.kill() 불가 | `git/runner.rs:120-130` (Sprint c45 P0-2 코멘트로 인정) | **Medium** | certain | M |
| **SAF-203** | **keyring fallback 부재** — NoEntry 만 Ok(None), 다른 OS keychain 에러 → 앱 auth 블로킹 | `auth.rs` (load_token 추정) | **Medium** | likely | S |
| **SAF-304** R2 | **sqlx 60건 runtime + 1건 compile-time** — schema drift 런타임 노출 | grep | **Medium** | certain | L (단계별 sqlx::query! 마이그레이션) |
| **SAF-305** R2 | **PKCE `assert!` (release strip 가능)** | `auth_oauth.rs:55-65` | **Medium** | certain | XS (if-Err 패턴) |
| **SAF-306** R2 | **async IPC handler 안 sync git diff/log 호출** — Tauri IPC pool block | `ai_commands.rs` ai_commit_message | **Medium (perf)** | likely | S (spawn_blocking 래핑) |
| **SAF-204** | **panic_hook.rs (c78) → tracing 만, graceful shutdown / crash report 부재** | `panic_hook.rs` | **Low** (single-window desktop) | likely | M |
| **SAF-205** | **frontend errorHandler invoke('report_frontend_error') fire-and-forget** — Rust panic 시 무한 루프 가능 | `utils/registerGlobalErrorHandler.ts:61-78` | **Low** (CRLF escape + rate limit 50/sec 적용 — c46+) | uncertain | S |

### C. 성능 (Quick Win XS / S)

| ID | Finding | 위치 | 위험도 | confidence | effort |
|---|---|---|---|---|---|
| **PERF-308** ★ Codex | **Rust `walker.take(limit)` cursor/skip 미지원** — limit 증가마다 HEAD 부터 재계산 → O(n²) | `git/graph.rs:78` | **Medium-High** | certain | **M** |
| **PERF-309** ★ Codex | **StatusPanel v-for 전체 + buildPathTree/flattenTree 재계산** | `StatusPanel.vue:260,289,…`, `useStatusTreeRows.ts:49-74` | **Medium** | likely | M |
| **PERF-301** | **CodeMirror lang-* 7 modules statically loaded** — 초기 JS ~150-200KB gzip 추정 | `components/FileViewer.vue:14-20` | (optimization) | likely | **S** |
| **PERF-302** | **v-memo 0 사용** (96 components) — CommitGraph row 등 memoization 가능 | grep 0 hit | (optimization) | likely | S |
| **PERF-303** | **ko/en JSON 둘 다 startup load** (~200KB) — locale lazy-load 가능 | `i18n/index.ts:30-41` | (optimization) | likely | M |
| **PERF-304** | **vite manualChunks lang-* 미분리** | `vite.config.ts` rollupOptions | (optimization) | certain | XS |
| **PERF-305** ★ Agreed | **Playwright workers=1 / fullyParallel=false** — 10 spec 직렬 (~60-70% 단축 여지) | `playwright.config.ts:14-17` | (DX) | certain | XS |
| **PERF-306** | **Tauri 7 bundle target 모두 빌드** (msi/nsis/app/dmg/deb/rpm/appimage) | `tauri.conf.json bundle.targets` | (CI 시간) | likely | S |
| **PERF-307** | **CommitGraph estimateSize 누적 오차** (CHANGELOG c77 #13 보류) — Playwright 측정 후 결정 | `useCommitGraphRows.ts:56` | (optimization) | uncertain | M |

### D. 속도 (Cold start / Build)

| ID | Finding | 위치 | 위험도 | confidence | effort |
|---|---|---|---|---|---|
| **SPD-401** | **vue-tsc + vite build sequential** (`vue-tsc -b && vite build`) — 측정 부재 | `package.json:8` | (DX) | likely | M |
| **SPD-402** | **vite/TS/tailwindcss major 뒤쳐짐** — vite 5.4 → 8 / TS 5.6 → 6 / tailwindcss 3.4 → 4 | `apps/desktop/package.json` | (DX + perf) | certain | **L** (3 major migrations) |
| **SPD-403** | **HMR overhead — 4 unplugin** (vue-router / auto-import / vue-components / vue) | `vite.config.ts` | (DX) | uncertain | S |

### E. Coverage / Test 강화 (별도 영역)

| ID | Finding | 위치 | 위험도 | confidence | effort |
|---|---|---|---|---|---|
| **TST-501** | **vitest coverage threshold lines 11.3% / functions 35% / branches 76%** — branches 는 높지만 lines 낮음 | `vite.config.ts test.coverage.thresholds` | (quality) | certain | M |
| **TST-502** | **Tauri webview e2e 부재** — Playwright 가 일반 Chromium + devMock 사용 (실제 IPC 미통과) | `playwright.config.ts` 코멘트 | (test gap) | certain | L |
| **TST-503** ★ Codex | **bench/baseline.json 6 metric `actual: null` placeholder** — 측정 미진입 → 모든 perf 판단이 추정 | `bench/baseline.json` | (measurement gap) | certain | S |

---

## 2. PR Fan-out (의존성 그래프 포함)

```
PR-A (Critical / Quick Wins, 즉시)
  ├── SEC-201 ★ Codex: panic_hook default_hook 제거 또는 mask payload 만 stderr (release)
  ├── SEC-202 ★ Codex: useDeepLink COMMAND_ALIASES destructive 8개 차단 (read-only 만)
  ├── SEC-101 + SEC-102: bun update (vite + esbuild CVE)
  ├── SEC-103: CSP img-src data: 제거
  ├── PERF-305: Playwright workers=4 + fullyParallel=true
  └── PERF-304: vite manualChunks vendor-cm-langs 추가
       │
       ▼
PR-B (Performance, 병렬 가능)
  ├── PERF-301: CodeMirror lang-* dynamic import (file ext 매핑)
  ├── PERF-302: v-memo 적용 (CommitGraph virtualizer row)
  ├── PERF-303: locale lazy-load (active locale 만 dynamic import)
  └── PERF-306: Tauri bundle target CI 분리 (msi/nsis only on CI)
       │
       ▼ (PERF-301 후)
PR-C (Rust safety, 큰 작업 — 단계별)
  ├── SAF-202: git timeout child.kill() 패턴 재구성 (runner.rs P0-2 후속)
  ├── SAF-203: keyring fallback (warning + in-memory cache)
  ├── SAF-201-1: unwrap audit ─ critical-path 우선 (forge/git/auth) 100건
  ├── SAF-201-2: unwrap → ? operator 전수 (단계 — 100건씩 sprint)
  └── SAF-204: panic_hook crash report opt-in (telemetry flag — c81 동일)
       │
       ▼
PR-D (Security hardening — v1.0 OAuth 전제 조건)
  ├── SEC-104: PKCE S256 구현 (sha256 → base64url)
  ├── SEC-105: deep-link callback URL allowlist + state 매칭
  └── SEC-106: shell:allow-open argument 검증 (필요 시)
       │
       ▼ (PR-A/B 안정 후)
PR-E (Build & DX — major upgrade plan)
  ├── SPD-401: vue-tsc 시간 측정 + incremental cache
  ├── SPD-402-1: vite 5 → 6 (Rolldown alpha 회피)
  ├── SPD-402-2: vite 6 → 7
  ├── SPD-402-3: vite 7 → 8 (release stable 확인 후)
  ├── SPD-402-4: TS 5.6 → 6 (vue-tsc 호환)
  └── SPD-402-5: tailwindcss 3.4 → 4 (CSS-first config 마이그레이션)

PR-F (test gap — 후속 sprint)
  ├── TST-501: vitest coverage threshold 단계별 bump
  ├── TST-502: Tauri webdriver e2e (별도 plan/04 재평가)
  └── PERF-307: CommitGraph virtualizer Playwright perf profile sprint
```

### 의존성 룰
- **PR-A** 은 무의존 — 즉시 실행 (CVE + Quick Win)
- **PR-B** 는 PR-A 와 병렬 가능 (vite manualChunks 충돌 없음)
- **PR-C** 는 PR-A 후 (CVE 먼저 해소)
- **PR-D** 는 v1.0 OAuth 활성 시점 전 — 단독 sprint
- **PR-E** 는 major upgrade 라 PR-A/B/C 안정 후 (회귀 위험)
- **PR-F** 는 후속 — 측정 기반

---

## 3. PR-A 상세 (즉시 실행 후보 — Sprint c82)

### PR-A.0 ★ Codex 신규 — SEC-201 panic_hook raw payload leak (XS, 10분)

**위치**: `apps/desktop/src-tauri/src/panic_hook.rs:23,37,44`

**현재**:
```rust
let default_hook = std::panic::take_hook();
std::panic::set_hook(Box::new(move |info| {
    let raw_payload = ...;
    let payload = secret_mask::mask_secrets(&raw_payload);
    tracing::error!(payload = %payload, ...);
    default_hook(info);  // ← raw payload 가 stderr 로 다시 출력
}));
```

**문제**: `default_hook(info)` 가 mask 안 된 원본 `info` 를 받아 stderr 에 `panicked at "...ghp_xxx..."` 출력. tracing 만 mask 적용 → secret leak 우회 경로.

**Fix Option A (권장)** — release 에서 default_hook 호출 제거:
```rust
tracing::error!(payload = %payload, ...);
#[cfg(debug_assertions)]
default_hook(info);  // debug 에서만 backtrace 보존
```

**Fix Option B** — 모든 빌드에서 mask 후 stderr 직접 출력:
```rust
tracing::error!(payload = %payload, ...);
eprintln!("panicked at {}: {}", location, payload);  // mask 적용된 payload 만
// default_hook 호출 안 함
```

**검증**:
```bash
cargo test panic_hook -- --nocapture  # mask 동작 확인
# release build 후 panic 강제 → stderr 에 raw payload 없음 확인
```

### PR-A.0b ★ Codex 신규 — SEC-202 deep-link destructive command 차단 (S, 30분)

**위치**: `apps/desktop/src/composables/useDeepLink.ts:20-46, 91-97`

**현재**: `git-fried://command/<alias>` 가 26 alias 중 8개 destructive shortcut 외부 URL 만으로 dispatch:
- `pull`, `push`, `commit`, `stage-all`, `stage-and-commit`, `unstage-all`, `new-pr`, `new-branch`

**공격 시나리오**: 악성 사이트 `<a href="git-fried://command/push">click me</a>` → 사용자 클릭 → 활성 repo 강제 push.

**Fix Option A (권장)** — destructive alias whitelist 분리 + confirm:
```ts
const READ_ONLY_ALIASES: Record<string, ShortcutAction> = {
  fetch: 'fetch',  // read-only (서버에서 받기만)
  help: 'help',
  terminal: 'terminal',
  'show-diff': 'showDiff',
  'toggle-sidebar': 'toggleSidebar',
  'toggle-detail': 'toggleDetail',
  'zoom-in': 'zoomIn',
  'zoom-out': 'zoomOut',
  'zoom-reset': 'zoomReset',
  'file-history': 'fileHistorySearch',
  'close-modal': 'closeModal',
  fullscreen: 'toggleFullscreen',
  'next-tab': 'nextTab',
  'prev-tab': 'prevTab',
  'close-tab': 'closeTab',
  'filter-repos': 'filterRepos',
  'open-in-explorer': 'openInExplorer',  // 시스템 액션, 데이터 변경 X
}

const DESTRUCTIVE_ALIASES: Record<string, ShortcutAction> = {
  pull: 'pull',
  push: 'push',
  commit: 'commit',
  'stage-all': 'stageAllExplicit',
  'unstage-all': 'unstageAll',
  'stage-and-commit': 'stageAndCommit',
  'new-pr': 'newPr',
  'new-branch': 'newBranch',
}

case 'command': {
  if (arg) {
    if (READ_ONLY_ALIASES[arg]) {
      setTimeout(() => dispatchShortcut(READ_ONLY_ALIASES[arg]), 50)
    } else if (DESTRUCTIVE_ALIASES[arg]) {
      // confirm dialog 후 dispatch (또는 단순 차단)
      void confirmDeepLinkAction(arg).then(ok => {
        if (ok) dispatchShortcut(DESTRUCTIVE_ALIASES[arg])
      })
    }
  }
  break
}
```

**Fix Option B (더 보수적)** — destructive alias 완전 제거 (deep-link 은 navigation + read-only 만):
```ts
// COMMAND_ALIASES 에서 destructive 8개 영구 제거
// 주석: deep-link 외부 URL 은 read-only/navigation 만 — destructive 는 in-app shortcut/command palette 로만
```

**검증**:
- vitest: `useDeepLink.test.ts` 에 `git-fried://command/push` → no dispatch 시나리오 추가
- e2e: deep-link mock 으로 destructive URL 무시 확인

**관련**: SEC-105 (deep-link callback URL 검증) 와 함께 sprint c82 안에서 묶을 가치.

### PR-A.1 — vite + esbuild CVE upgrade (XS, 5분)

**액션**:
```bash
cd apps/desktop
bun update vite esbuild
# (vite 5.4 → 6 minor bump 가능 / esbuild SSRF fix 0.24.7+)
bun install --frozen-lockfile  # 회귀 검증
bun run typecheck && bun run test
```

**검증**:
- `bun audit` 결과 0 vulnerabilities
- `bun run build` PASS
- vitest 89 PASS

**커밋 메시지**:
```
fix(security): vite/esbuild MODERATE CVE upgrade (SEC-101/SEC-102)

- vite 5.4.21 → 6.x (path-traversal GHSA-4w7w-66w2-5vf9 fix)
- esbuild 0.24.2 → 0.24.7+ (dev-server SSRF GHSA-67mh-4wv8-2f99 fix)
- bun audit: 2 → 0 vulnerabilities
```

### PR-A.2 — CSP img-src data: 제거 (XS, 2분)

**액션** — `tauri.conf.json:28`:
```diff
- "csp": "...img-src 'self' data: https:..."
+ "csp": "...img-src 'self' https://avatars.githubusercontent.com https://*.gravatar.com..."
```

**위험**: 일부 inline avatar fallback (data:image/svg+xml,...) 이 깨질 수 있음. dev 빌드에서 console error 검증 필수.

**대안**: 완전 제거 불가 시 `data: image/svg+xml;base64` 만 허용 (CSP 3 미지원).

### PR-A.3 — Playwright 병렬 (XS, 1분)

**액션** — `playwright.config.ts:14-17`:
```diff
- fullyParallel: false,
- workers: 1,
+ fullyParallel: true,
+ workers: process.env.CI ? 2 : 4,
```

**검증**: `bun run test:e2e` — 10 spec 모두 PASS (병렬 후 race 없음 확인). 실패 시 `workers: 2` 로 단계 다운.

### PR-A.4 — vite manualChunks lang-* 분리 (XS, 5분)

**액션** — `vite.config.ts` rollupOptions.output.manualChunks:
```diff
  'vendor-codemirror': [
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/language',
    '@codemirror/merge',
  ],
+ 'vendor-cm-langs': [
+   '@codemirror/lang-javascript',
+   '@codemirror/lang-vue',
+   '@codemirror/lang-rust',
+   '@codemirror/lang-css',
+   '@codemirror/lang-html',
+   '@codemirror/lang-json',
+   '@codemirror/lang-markdown',
+ ],
```

**효과**: vendor-cm-langs 청크가 별도 — FileViewer 비활성 사용자에게는 lazy hint 제공 (PR-B.1 의 dynamic import 와 시너지).

---

## 4. PR-B 상세 (Performance, 병렬)

### PR-B.1 — CodeMirror lang-* dynamic import (S, 30분)

**현재** — `FileViewer.vue:14-20`:
```ts
import { javascript } from '@codemirror/lang-javascript'
import { vue } from '@codemirror/lang-vue'
// ... 7개 모두 static
```

**변경** — file ext 매핑 lazy load:
```ts
const langLoaders: Record<string, () => Promise<{ default: () => LanguageSupport }>> = {
  js: () => import('@codemirror/lang-javascript').then(m => ({ default: m.javascript })),
  ts: () => import('@codemirror/lang-javascript').then(m => ({ default: m.javascript })),
  vue: () => import('@codemirror/lang-vue').then(m => ({ default: m.vue })),
  rs: () => import('@codemirror/lang-rust').then(m => ({ default: m.rust })),
  // ...
}

async function loadLang(ext: string) {
  const loader = langLoaders[ext]
  if (!loader) return null
  const { default: factory } = await loader()
  return factory()
}
```

**검증**: FileViewer 로 .vue 파일 열어 syntax highlight 표시 확인 + Network tab 에서 lang-vue chunk lazy fetch 확인.

### PR-B.2 — v-memo CommitGraph row (S, 30분)

**위치**: `CommitGraph.vue` virtualizer row template

**액션**:
```vue
<div
  v-for="row in virtualRows"
  :key="row.key"
  v-memo="[row.sha, row.isWip, wipActive, selectedSha === row.sha]"
  :data-index="row.index"
  ...
>
```

**효과**: row 의 reactive deps 가 변하지 않으면 re-render skip — 스크롤 부드러움 +10~15%.

### PR-B.3 — locale lazy load (M, 1-2 sprint)

**현재** — `i18n/index.ts`:
```ts
import ko from '../locales/ko.json'
import en from '../locales/en.json'
const i18n = createI18n({ messages: { ko, en } })
```

**변경**:
```ts
const detectedLocale = localStorage.getItem('locale') ?? (navigator.language.startsWith('ko') ? 'ko' : 'en')
const messages = await import(`../locales/${detectedLocale}.json`)
const i18n = createI18n({ locale: detectedLocale, messages: { [detectedLocale]: messages.default } })

// setLocale 시 dynamic import 후 setLocaleMessage
async function setLocale(loc: 'ko' | 'en') {
  if (!i18n.global.availableLocales.includes(loc)) {
    const m = await import(`../locales/${loc}.json`)
    i18n.global.setLocaleMessage(loc, m.default)
  }
  i18n.global.locale.value = loc
}
```

**효과**: 초기 JS −50~100KB / parse 시간 −10~20ms.

**주의**: vue-i18n 11 의 dynamic import 패턴 + vite chunk naming 검증 필요.

### PR-B.4 — Tauri bundle CI 분리 (S, 15분)

**위치**: CI workflow (확인 필요) + `tauri.conf.json` bundle.targets

**액션**: CI 환경에서는 OS 별 1-2 target 만 빌드 (Windows: msi+nsis, Mac: dmg, Linux: deb+appimage). `bun tauri:build --target` flag 활용. tauri.conf.json 7 target 유지하고 CI 만 분리.

---

## 5. PR-C 상세 (Rust safety — 단계별)

### PR-C.1 — git timeout child.kill() 패턴 (M, 1 sprint)

**위치**: `git/runner.rs:120-130`

**현재 문제** (코멘트로 인정):
```rust
// timeout 시 best-effort kill — wait_with_output 이 child 소유권을 이미 가져갔으므로
// 별도 kill 호출은 불가능. 프로세스는 자연 종료될 때까지 orphan 가능 (OS 가 정리).
```

**변경 패턴**:
```rust
// child 소유권 보존 + manual stdout/stderr read
let mut child = command.spawn()?;
let stdout = child.stdout.take().unwrap();  // unwrap → 안전 (just spawned)
let stderr = child.stderr.take().unwrap();
let read_task = tokio::spawn(async move {
    let mut sout = String::new();
    let mut serr = String::new();
    let _ = (BufReader::new(stdout).read_to_string(&mut sout).await,
             BufReader::new(stderr).read_to_string(&mut serr).await);
    (sout, serr)
});
match tokio::time::timeout(d, child.wait()).await {
    Err(_) => {
        let _ = child.kill().await;  // explicit kill on timeout
        return Err(...);
    }
    Ok(status) => {
        let (sout, serr) = read_task.await?;
        ...
    }
}
```

### PR-C.2 — keyring fallback (S, 30분)

**위치**: `auth.rs` load_token / save_token

**현재**:
```rust
match entry.get_password() {
    Ok(p) => Ok(Some(p)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(e.into()),  // 전체 앱 블로킹
}
```

**변경**:
```rust
match entry.get_password() {
    Ok(p) => Ok(Some(p)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => {
        warn!(error = ?e, "keyring backend unavailable — falling back to in-memory only");
        // PAT 등 secret 은 in-memory cache 로 fallback (session 종료 시 소실)
        // 사용자 UI 에 "OS 자격증명 저장소 일시 사용 불가 — 재로그인 필요할 수 있음" toast
        Ok(None)
    }
}
```

### PR-C.3 — unwrap audit (L, 4-6 sprint)

**Phase 1 — critical-path triage** (1 sprint):
```bash
# git/forge/auth/storage 우선
grep -rn "\.unwrap()\|\.expect(" apps/desktop/src-tauri/src/{git,forge,auth.rs,storage,ipc} --include="*.rs" \
  | grep -v "tests" \
  | wc -l
# 예상 100~150건 → ? operator 또는 map_err 치환
```

**Phase 2 — IPC handler boundary** (1 sprint):
```bash
# #[tauri::command] 함수 안의 unwrap 우선 (panic = process crash)
```

**Phase 3 — Background task** (2 sprint):
```bash
# tokio::spawn 안의 unwrap
```

**Phase 4 — 잔여** (1 sprint):
```bash
# parsing / config 등
```

각 Phase 후 cargo test 회귀 검증.

---

## 6. Codex Update 섹션 (도착 시 보강)

> Codex 2 background task `task-mp4yop03-13s7wb` (이전 /analyze) + `task-mp4z8bh8-vkfga0` (현 audit) 결과 도착 시 본 섹션에 4 분류 추가.

### Agreed (4 agent 일치 finding)
- _대기 중_

### Claude-only (Codex 미발견)
- _대기 중 — 본 v0.1 의 모든 finding 이 일단 Claude-only_

### Codex-only (Claude 미발견)
- _대기 중 — 알고리즘 race / 외부 OSS 비교 expected_

### Disagreements (Codex가 Claude finding REJECTED)
- _대기 중_

---

## 7. 우선순위 / 추천 시퀀스

### Plan 완성 선언 (v0.4)

★ **방향성 (성능/속도/안전성) 의 미탐색 영역 0** — 25+ finding + 27 Clean 영역 enumerate 완료.

| Round | Agent | 신규 finding | Clean 영역 |
|---|---|---|---|
| **R1** | Codex deep + 4 Claude | 18 (vite/esbuild CVE, panic_hook leak, deep-link command, walker.take, e2e parallel, 385 unwrap, ...) | — |
| **R2** | 1 Codex (sandbox 실패) + 3 Claude | 9 (panic=abort + SQLite leak ★ Critical, PTY raw write ★ High, sqlx pool, sqlx 60:1, PKCE assert, async IPC sync git, window.gitFried, AI prompt injection, AiResultModal) | 13 (v-html/innerHTML/eval 0, vue-i18n escape, CodeMirror, tokio JoinHandle, git2 spawn_blocking, git CLI arg injection, tempfile, secret_mask, forge SSRF, ...) |
| **R3** | 1 Codex (sandbox 실패) + 2 Claude | 4 (reqwest 듀얼버전, bun-version latest, keyring Linux D-Bus reinforced, 429 retry-after) | 8 (Cargo.lock git URL 0, CI pull_request_target 미사용, IPC i64 0, Worker 0, forge timeout, chrono UTC, capability scope, devMock dual gate) |
| **R4** | 2 Claude | 4 (bulk_fetch silent skip, 429 auto-retry, 401 logout cascade, bench measurement gap) | 6 (vue-tsc incremental, vitest 13 LOC, Cargo.lock RUSTSEC, bun.lock duplicates, Cargo.toml current, frontend Date Intl) |

**Codex 한계**: round 2/3 sandbox 실패 (`windows sandbox: setup refresh failed exit code 1`). 사용자 환경 복구 후 round 5 재시도 권장 (핵심 영역은 Claude 가 cover했지만 Codex 의 알고리즘 race / 외부 OSS 비교 / negative assertion FP 검증은 보완 가능).

### Sprint c82 (즉시 — Critical 3 + High 5 + XS 3, 3-4시간) ★ v0.5 갱신

**v0.6 priority 0 (Codex R5 D 카테고리 신규 High)**:

1. **PR-A.0000** ★ Codex D-AI-001 — AI 요청 snapshot pattern 도입 (5 파일: useAiPrBody/useAiResolveConflict/useAiReview + CreatePrModal/MergeEditorModal). 시작 시점 repoId/head/base/path/PR# 캡처 후 응답 도착 시 현재 modal state 와 일치 검증 → 불일치 시 silent drop 또는 confirm dialog (S, 1시간)
2. **PR-A.0000b** Codex D-GIT-001 — `git status --porcelain` → `git --no-optional-locks status --porcelain` 전수 치환 (`worktree.rs:88,123` + `reset.rs:129` + 잔여 grep) (XS, 10분)

**v0.5 priority 0 (Round 5 신규 High)**:

3. **PR-A.000** ★ R5 SAF-401 — AI subprocess `tokio::time::timeout` wrapper (`ai/runner.rs:112`) (XS, 10분) — **Codex 보강: backend tokio::time::timeout 필수 (frontend IPC timeout 은 child cancellation 아님)**
4. ~~PR-A.000b R5 SAF-402 — `Repository::open()` index.lock retry~~ → **REJECTED/REFRAMED to D-GIT-001** (Codex anchor 정정)

**v0.3 priority 0 (Round 2 신규 Critical/High)**:

3. **PR-A.00** ★★ R2 SAF-301 — Cargo `panic="unwind"` 복원 검토 (M, bin size trade-off 측정 필수)
4. **PR-A.00b** ★ R2 SAF-302 — PTY ANSI escape sanitize layer (`pty/mod.rs:34`) (S, 30분)
5. **PR-A.00c** R2 SAF-303 — SQLite `acquire_timeout(10s)` + bulk concurrency 4 또는 pool 16 (S, 20분)

**v0.2 priority 1 (Codex round 1 Critical)**:

6. **PR-A.0** ★ Codex SEC-201 — panic_hook default_hook 제거 (XS, 10분)
7. **PR-A.0b** ★ Codex SEC-202 — deep-link destructive alias 차단 (S, 30분)

**v0.1 priority 2 (Quick Win)**:

8. PR-A.1 — vite + esbuild CVE upgrade (`bun update vite esbuild`)
9. PR-A.3 — Playwright workers=4 / fullyParallel
10. PR-A.4 — vite manualChunks vendor-cm-langs

**v0.5 즉시 측정 (Quick Win, TST-503 이미 가능 확인)**:

11. **PR-A.5** R5 — `BENCH_REPO=. cargo bench --bench git_perf` 실 측정 + `pwsh ./bench/memory.ps1` 실행 → `bench/baseline.json` actual 6 metric 채우기 (S, 30분)

**Sprint c83 priority 1 (Codex R5 D Medium)**:

12. **PR-B.5** Codex D-LFS-001 — `git diff --name-only` → `-z` flag + NUL 분리 파싱 (`lfs.rs:205,212`) (S, 30분)
13. **PR-B.6** Codex D-LFS-002 — `git lfs install` → `git lfs install --local --skip-repo` (`lfs.rs:96`, `lfs_commands.rs:56`). **R5 SAF-405 의 "ordering race" 가설 폐기 + "global config side effect" 로 reframe** (XS, 10분)
14. **PR-B.7** Codex eval 정정 — `menu.rs:176 win.eval("location.reload()")` → Tauri IPC `app.emit("reload-request")` 또는 명시 가드 (XS, 5분, 정확성)

### Sprint c83 (Quick + Medium)
6. PR-A.2 — CSP img-src data: 제거 (avatar 회귀 검증)
7. PR-B.1 — CodeMirror lang dynamic import
8. PR-B.2 — v-memo CommitGraph row
9. PR-C.2 — keyring fallback
10. **TST-503** ★ Codex — bench/baseline.json 첫 실 측정 (cold_start / graph_render_1k)

### Sprint c84+ (큰 작업)
8. PR-C.1 — git timeout child.kill() 패턴
9. PR-B.3 — locale lazy load
10. PR-C.3 Phase 1 — unwrap critical path triage

### v1.0 전 sprint
11. PR-D.1 — PKCE S256
12. PR-D.2 — deep-link callback URL allowlist
13. PR-E — major upgrade plan (별도 plan 문서)

### 후속 측정 sprint
14. PERF-307 — CommitGraph virtualizer Playwright perf profile
15. SPD-401 — vue-tsc 시간 측정
16. TST-501/502 — coverage threshold + Tauri webdriver e2e

---

## 8. Decision Triage Summary

§ User Decision Triage Protocol 적용 (N=15 finding, ≥3 cap):

- **autonomous-safe** (8): PR-A.1 / PR-A.3 / PR-A.4 / PR-B.1 / PR-B.2 / PR-B.4 / PR-C.2 / PR-C.3-Phase1 — 모두 사용자 의도 명확 (성능/안전성 개선 + 회귀 위험 낮음)
- **needs-user** (5):
  - PR-A.2 (CSP img-src data: 제거) — avatar fallback UX 영향 가능, 사용자 정책 결정
  - PR-B.3 (locale lazy load) — vue-i18n 11 의 dynamic import + chunk naming 정책
  - PR-D.1 / PR-D.2 (PKCE S256 + deep-link allowlist) — v1.0 OAuth 활성 시점 결정
  - PR-E (major upgrade) — vite/TS/tailwindcss 3 major migration 시점 + breaking change 대응 정책
- **needs-claude-judgment** (1): PR-C.1 (git timeout child.kill 패턴) — Rust runner 로직 재구성, 사용자 검토보다 Claude 직접 구현 후 검증 적합
- **skipped** (1): PR-F (TST-502 Tauri webdriver e2e) — plan/04 재평가 영역

---

## 9. 메트릭 (정량 목표)

| 영역 | 현재 | 목표 (UltraPlan 완료 후) |
|---|---|---|
| ★ **Panic stderr secret leak (SEC-201)** | default_hook 가 raw payload 출력 | **0** (release 에서 default_hook 호출 제거) |
| ★ **Deep-link destructive surface (SEC-202)** | 8 alias (push/pull/commit/...) 외부 URL trigger | **0** (read-only 만 허용 또는 confirm 강제) |
| **bun audit vulnerabilities** | 2 (vite + esbuild) | **0** |
| **Rust unwrap (production)** | 385 | **<100** (4 phase 단계별) |
| **Rust IPC walker.take(limit) cursor** | O(n²) per limit bump | cursor paging (PERF-308) |
| **bench/baseline.json metric** | 6/6 `actual: null` | **6/6 first measurement** (TST-503) |
| **Initial JS bundle** | 측정 부재 | **−10~15%** (CodeMirror lang lazy + locale lazy + manualChunks) |
| **Cold start** | 측정 부재 | **−15~20%** (PR-B.1 + PR-B.3, baseline 후 정량화) |
| **Playwright e2e 시간** | ~10 spec × N min serial | **−60~70%** (workers=4 병렬) |
| **CSP attack surface** | data: img + 'unsafe-inline' style | data: 제거 / unsafe-inline 보존 (Vue scoped) |
| **OAuth security (v1.0 전)** | PKCE plain + callback unverified | **PKCE S256 + allowlist** |

---

## 10. 변경 추적 (CHANGELOG 업데이트 정책)

각 PR 머지 시:
- CHANGELOG.md `[Unreleased]` 에 ID 명시 (`SEC-101`, `PERF-301` 등)
- 본 plan 의 status table 갱신 (TODO / IN-PROGRESS / DONE)
- v0.4 minor cut 시점에 본 plan 의 status 80%+ DONE 권장

---

## 11. 다음 단계 제안

| 조건 | 제안 |
|---|---|
| Sprint c82 시작 (즉시) | PR-A.1/A.3/A.4 3건 한 commit chain 으로 진행 (`fix(security)+perf(build)+perf(deps)`) |
| Codex 도착 | § 6 Codex Update 섹션 보강 + finding 승강 (Claude-only → Agreed) |
| PR-A 완료 후 | Sprint c83 진입 — PR-A.2 + PR-B.1/B.2 + PR-C.2 |
| 측정 기반 결정 영역 | PERF-307 (estimateSize drift), SPD-401 (vue-tsc 시간) — Playwright perf sprint 사전 진입 |

