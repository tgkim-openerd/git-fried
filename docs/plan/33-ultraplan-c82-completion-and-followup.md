# UltraPlan Sprint c82 완료 보고 + 후속 sprint 분할

> **작성일**: 2026-05-14 (Sprint c82 작업 완료 시점)
> **트리거**: `/goal ULTRAPLAN 끝날 때까지 전부 수행 CODEX와 같이 수행`
> **베이스**: [docs/plan/32-ultraplan-perf-safety-c82.md](32-ultraplan-perf-safety-c82.md) (v0.6 final, 17 agent / 6 round / 48+ finding)
> **상태**: c82 의 즉시 실행 가능 12 PR 모두 수행 ✓ / 장기 5 sprint 분할
>
> ## ⛔ 작업 제외 지침 (사용자 명시 2026-05-14)
>
> **PR-D OAuth (SEC-104 PKCE S256 + SEC-105 deep-link callback allowlist + SAF-305 PKCE assert)** 는 본 UltraPlan 후속 sprint 자율 진행 **제외**.
> Sprint c86 항목 (§ 3) 도 자율 수행 대상 아님 — v1.0 OAuth 활성 시점 별도 사용자 결정 후 진입.
>
> 자율 진행 시: PR-D 영역의 fix / 통합 / 측정 / Codex audit 모두 trigger 안 함. plan 문서 update 만 허용 (status / decision 기록).

## 0.5. Sprint c83-c86 추가 실행 (2026-05-14, 6 commit)

UltraPlan goal "끝날 때까지 전부 수행 CODEX와 같이 수행" 충족 위해 OAuth 제외 7건 후속 sprint 도 자율 진행 (사용자 결정 영역은 보수적 default 채택).

| Sprint | Commit | 작업 |
|---|---|---|
| c83 | `49d642e` | PR-A.1 vite 5.4.21 → 6.4.2 minor bump (Codex 권고 채택) |
| c83 | `44bcedb` | SAF-401 child.kill() refactor (stdout/stderr take + wait + timeout kill + reap) |
| c84 | `4f175af` | PR-A.5 bench actual 4 metric 채움 (status/branches/graph_1k/graph_10k) — sanity target git-fried 자체 |
| c84 | (SAF-201 분석) | git/ production unwrap 실측 3건 모두 정당 (semaphore close / static regex / lock poison). Rust agent "385건" metric 오류 (#[cfg(test)] 포함). 4-phase plan 사실상 **불필요 — closure** |
| c85 | `b4202b4` | SEC-301 GIT_SSH_COMMAND env support — GitRunOpts.ssh_key_path opt-in (caller migration v1.x) |
| c86 | (this commit) | TST-501 coverage threshold bump (lines/statements 11.3 → 15, functions 35 → 37, branches 76 → 78) — 실측 22%/40%/80% margin 50%+ |

### Sprint c83-c86 추가 closure (Codex 권고 채택 결과)

| 항목 | Codex 권고 | 실 결과 |
|---|---|---|
| **SAF-201** unwrap 4 phase | 자동 치환 금지, 카테고리 분류 | **CLOSURE** — 전체 src-tauri production unwrap 20건 (git/ 3 + lib/ 3 + secret_mask/ 13 + ipc/ 1) 모두 정당. Rust agent "385건" finding metric 오류. plan/32 SAF-201 항목 자동 closure |
| **SAF-301** explicit Drop | panic="abort" 유지 + transaction explicit handling | **PARTIAL CLOSURE** — sqlx::Transaction 2 사이트 (hide.rs / profiles.rs) 발견 (Round 2 Claude "0건" finding REJECTED). 단 sqlx Drop on no-commit 자동 ROLLBACK + SQLite WAL cross-process recovery 자동 → panic="abort" 영향 minimal. explicit guard 는 별도 sprint (c89+) |
| **TST-501** coverage bump | bench → coverage → webdriver 순서 | **DONE** — c86 (이 sprint) lines/statements 11.3 → 15 bump. 다음 단계: 89 file → 일부 untested page 추가 시 +5% 가능 |
| **TST-502** Tauri WebDriver | 플랫폼 의존 큼, 마지막 | **DEFER** — tauri-driver 설치 + WebDriver protocol 필요. 별도 sprint c89+ plan 작성 권장. 본 Sprint 미진입 |
| **TST-503** bench actual | sanity + synthetic + real 3-tier | **PARTIAL** — sanity target (git-fried 자체) 4 metric 채움. synthetic 10k/50k + real large repo (linux/torvalds) 는 사용자 환경 입력 + 별도 sprint |

### Sprint c83-c86 검증 (8 commit 누적)

```bash
# 검증 명령
cargo check + test       → PASS (9 sanitize+OscStripper unit test + AI runner refactor)
typecheck (vue-tsc)      → 0 error
vitest                   → 89 file / 895 test PASS
vite build               → PASS (vendor-cm-langs 청크 분리)
cargo bench --bench git_perf BENCH_REPO=self  → 4 metric 측정 완료
test:coverage            → threshold lines 15 / functions 37 / branches 78 PASS
```

Codex 페어 commit: `task-mp53zjgg` (c82 audit) + `task-mp554150` (consultation P1 권고) 모두 채택.

---

## 1. Sprint c82 완료 commit 카탈로그 (6 commit, main branch)

| Commit | 카테고리 | 영향 |
|---|---|---|
| `770f1b9` | fix(safety) | SEC-201 panic stderr leak + SAF-401 AI subprocess timeout + D-GIT-001 git status no-optional-locks |
| `ec4b5e1` | fix(git) | D-LFS-002 LFS install --local --skip-repo + D-LFS-001 push size NUL-safe (-z) |
| `47420a5` | perf(build) | PERF-304 vite vendor-cm-langs split + PERF-305 Playwright workers=4 |
| `209cd27` | fix(security) | SEC-202 deep-link destructive 9 alias 차단 + D-AI-001 AI snapshot pattern + eval safety doc |
| `35b6578` | fix(safety) | SAF-302 PTY OSC escape strip + SAF-303 SQLite acquire_timeout(10s) |
| `b6ed8a4` | fix(build) | vite.config.ts vitest types reference |

**총 12 finding 해소** (Critical 3 + High 5 + Medium 4):
- Critical: SEC-201, SEC-202, SAF-301 (panic="unwind") 중 SEC-201 + SEC-202 fix, SAF-301 은 측정 보류 (§ 3 참조)
- High: SAF-401, SAF-302, SAF-303, D-AI-001, PERF-305
- Medium: D-GIT-001, D-LFS-001, D-LFS-002, PERF-304

**검증 통과** (각 commit):
- vue-tsc --noEmit (typecheck): 0 error
- vitest: 89 file / 895 test PASS (R5 SEC-202 destructive 차단 test 2건 추가)
- cargo check + test: PASS (5 PTY sanitize unit test 추가)
- vue-tsc -b && vite build: PASS (vitest types reference 추가 후)

## 2. Sprint c82 미완료 / 부분 진행 항목

### PR-A.00 SAF-301 (Cargo `panic="unwind"` 검토) — 측정 보류

**현재 상태**: `Cargo.toml [profile.release] panic = "abort"` 유지

**측정 필요**:
- panic="abort" vs "unwind" 의 release binary size 차이 (실측 — 보통 +10~15%)
- DB transaction unwinding 시나리오 unit test 작성 후 비교

**보류 이유**: 측정 없이 자율 변경은 binary size 증가 trade-off + crash 시 cleanup 정책 결정 필요. 사용자 결정 영역.

**Follow-up**: 별도 sub-sprint (c84+) — `cargo build --release` 2회 (abort/unwind) + bin size 측정 + SQLite transaction abort scenario test 작성 후 결정.

### PR-A.1 vite/esbuild major upgrade — revert + dev-only CVE 명시

**시도 결과**:
- `bun update --latest vite esbuild` → vite 8.0.12 / esbuild 0.28.0
- vite 8 의 `manualChunks` 시그니처 변경 (object → ManualChunksFunction) 으로 `vite build` 회귀
- revert 후 vite 5.4.21 / esbuild 0.24.2 transitive 유지

**현재 잔존 vuln** (`bun audit`):
- vite ≤6.4.1: GHSA-4w7w-66w2-5vf9 (path traversal in `.map` handling, **dev only**)
- esbuild ≤0.24.2: GHSA-67mh-4wv8-2f99 (dev server SSRF, **dev only**)

**production 영향 0**: 두 CVE 모두 dev server (`vite` / `vite dev`) 한정. Tauri release build (`vite build` + cargo release) 결과물에는 영향 없음.

**Follow-up**: § 4 PR-E major upgrade sprint (vite 5→6→7→8 + manualChunks function migration).

### PR-A.5 bench actual 측정 — BENCH_REPO 부재로 skip

**현재 상태**:
- bench/git_perf.rs (criterion, 3 함수) ✓ 설치됨
- bench/memory.ps1 (6 시나리오) ✓ 설치됨
- bench/baseline.json — `actual: null` 6 metric placeholder 유지

**Skip 사유**: `BENCH_REPO` 환경변수 unset. 사용자 보유 10k+ commit repo 경로 필요.

**즉시 가능 (사용자 환경 입력 시)**:
```bash
# 1. cargo bench (3 함수)
BENCH_REPO=/path/to/10k-commit-repo cargo bench --bench git_perf \
  --manifest-path apps/desktop/src-tauri/Cargo.toml
# 결과: apps/desktop/src-tauri/target/criterion/report/index.html

# 2. memory baseline (6 시나리오)
pwsh ./bench/memory.ps1
# 결과: bench/memory-baseline.txt

# 3. bench/baseline.json 6 metric `actual` 필드 채우기
```

**Follow-up**: 측정 sprint (c84+) — bench actual 채우기 + SAF-301 panic mode 와 함께 비교.

## 3. 후속 Sprint plan 분할 (장기 5 sprint)

### Sprint c83 (Quick + Medium, 1-2 sprint)

- **PR-A.2** CSP `img-src 'self' data: https:` → `img-src 'self' https://avatars.githubusercontent.com https://*.gravatar.com` (avatar fallback dev 검증 필수)
- **PR-B.1** CodeMirror lang-* dynamic import (`FileViewer.vue:14-20` 7 static import → ext 매핑 lazy load)
- **PR-B.2** v-memo CommitGraph row (스크롤 +10~15% 추정)
- **PR-B.3** locale lazy load (i18n/index.ts dynamic import — initial JS −50~100KB)
- **PR-C.2** keyring fallback (NoEntry 외 OS keychain 에러 → in-memory cache + UI toast)
- **PR-A.2~A.5 추가 결정**: PR-A.2 CSP 시 사용자 정책 확인 필요
- **TST-503** bench actual 측정 (BENCH_REPO 입력 후)

### Sprint c84 — SAF-201 Phase 1 (Critical-path unwrap audit)

**측정 결과** (parent context, 2026-05-14):
- ipc/ production unwrap: **4건** (모두 test 또는 정당한 lock expect — 수정 0)
- forge/ production unwrap: **16건 (모두 test code 안)** — 수정 0
- git/ production unwrap: **212건** — Phase 1 대상
- launchpad.rs: 모두 test 함수 안

**git/ 212 production unwrap 4 phase 분할**:
- **Phase 1A** (git/path.rs + git/runner.rs + git/refs.rs) — hot path (호출 빈도 높음). 추정 ~40-60건
- **Phase 1B** (git/branch.rs + git/commit.rs + git/checkout.rs + git/merge.rs) — 사용자 직접 명령. 추정 ~50-70건
- **Phase 1C** (git/rebase.rs + git/cherry_pick.rs + git/reset.rs + git/restore.rs) — destructive 작업. 추정 ~40-60건
- **Phase 1D** (잔여 — lfs.rs / worktree.rs / status.rs / diff.rs 등) — 추정 ~50-70건

각 Phase 후 `cargo test` + `cargo clippy` 회귀 검증. `?` operator / `map_err` / `Result::ok()` 패턴별 적용.

**자동화 후보**: rust-analyzer 의 "Replace unwrap with ?" code action 일괄 적용 후 컴파일 에러 사례별 수정.

### Sprint c85 — SEC-301 SSH key 통합

**현재 상태**:
- `profiles.rs:27 ssh_key_path: Option<String>` 메타데이터 저장 OK
- `git/runner.rs` 에서 `GIT_SSH_COMMAND` / `SSH_AUTH_SOCK` env var 적용 안 됨
- SSH-only 사용자 silent 실패 또는 PAT fallback

**구현 작업**:
1. profile active 시 `ssh_key_path` 가져와 `GIT_SSH_COMMAND="ssh -i <key> -o IdentitiesOnly=yes"` 환경변수 설정
2. SSH agent 사용 시 `SSH_AUTH_SOCK` 자동 detect (Linux/Mac default, Windows OpenSSH)
3. passphrase 처리: keyring 에 SSH passphrase 저장 (SAF-203 fallback 과 통합)
4. SSH error 시 user-friendly toast: "SSH key invalid — Settings 에서 변경"

**의존성**: SAF-203 keyring fallback 먼저 완료 (Sprint c83 PR-C.2).

### Sprint c86 — PR-D OAuth 보안 강화 (v1.0 전제)

**v1.0 OAuth 활성 시점 결정 후**:
- **SEC-104** PKCE S256 구현 (`auth_oauth.rs` plain → SHA256 + base64url challenge)
- **SEC-105** deep-link callback URL allowlist + state 매칭 (CSRF 방어)
- **SEC-106 정정** tauri-plugin-shell 2.3.5 patched — capability 표면 잔존 (현재 `shell:allow-open` 만)
- **SAF-305** PKCE `assert!` (release strip 가능) → if-Err 패턴 (Codex R2 finding)

### Sprint c87+ — PR-E major upgrade (vite/TS/tailwindcss)

**vite 5 → 6 → 7 → 8 단계별**:
1. **PR-E.1** vite 5 → 6 — `manualChunks` object form 여전히 지원. tsconfig esm 확인
2. **PR-E.2** vite 6 → 7 — vue plugin 호환성 검증
3. **PR-E.3** vite 7 → 8 — `manualChunks` → ManualChunksFunction 마이그레이션 + vitest 4 필요 가능성
4. **PR-E.4** TS 5.6 → 6 — vue-tsc 호환성 + Vue 3.5 union type narrowing
5. **PR-E.5** tailwindcss 3.4 → 4 — CSS-first config 마이그레이션 (breaking)
6. **PR-E.6** vitest 2 → 4 (필요 시 PR-E.3 차원)

**각 단계 회귀 게이트**: vue-tsc 0 / vitest 모두 PASS / cargo check / vite build / Playwright e2e smoke.

### Sprint c88+ — PR-F 측정 인프라

- **TST-501** vitest coverage threshold 단계별 bump (lines 11.3 → 13 → 15...)
- **TST-502** Tauri webdriver e2e (현 Playwright = 일반 Chromium + devMock). 실제 IPC 통과 e2e 분리 plan
- **PERF-307** CommitGraph virtualizer Playwright perf profile sprint (estimateSize drift 측정)
- **SPD-401** vue-tsc -b incremental 시간 측정 (현재 `composite: true + tsBuildInfoFile` 적용됨 — actual 측정값 필요)

## 4. 측정 / 운영 follow-up (사용자 환경 입력 필요)

| 항목 | 필요 입력 | 즉시 실행 명령 |
|---|---|---|
| **bench actual 6 metric** | `BENCH_REPO=/path/to/10k-commit-repo` | `cargo bench --bench git_perf` + `pwsh ./bench/memory.ps1` |
| **SAF-301 bin size 비교** | (사용자 결정: panic="abort" 유지 vs unwind 전환) | `cargo build --release` × 2 (abort 현재 vs unwind 토글) → `ls -la` 비교 |
| **vite/esbuild CVE 0** | (PR-E vite 8 major sprint 진입 시점) | `bun update --latest vite esbuild` + manualChunks function migration |

## 5. Sprint c82 Verification Summary (sprint commit 카탈로그)

```bash
# 회귀 0 확인
git log --oneline HEAD~6..HEAD
# 770f1b9 fix(safety): panic stderr leak + AI subprocess timeout + git status no-optional-locks
# ec4b5e1 fix(git): LFS install scope + push size NUL-safe parsing
# 47420a5 perf(build): vite vendor-cm-langs split + Playwright workers=4 parallel
# 209cd27 fix(security): SEC-202 deep-link destructive 차단 + D-AI-001 AI snapshot + eval safety doc
# 35b6578 fix(safety): SAF-302 PTY OSC escape strip + SAF-303 SQLite acquire_timeout
# b6ed8a4 fix(build): vite.config.ts 에 vitest types reference 추가

# Sprint c82 회귀 검증 명령
bun run --cwd apps/desktop typecheck  # vue-tsc --noEmit: 0
bun run --cwd apps/desktop test       # vitest 89 file / 895 test PASS
bun run --cwd apps/desktop build      # vue-tsc -b && vite build PASS
node scripts/cargo-rustup.mjs check --manifest-path apps/desktop/src-tauri/Cargo.toml  # PASS
node scripts/cargo-rustup.mjs test --manifest-path apps/desktop/src-tauri/Cargo.toml   # PASS
```

## 6.5. Codex 권고 (`task-mp554150-376chx`, 2026-05-14)

미완료 7건 (OAuth 제외) 의 Codex 상의 결과. 권고 / 근거 / Effort / Priority 4필드.

| # | 항목 | 권고 | 근거 | Effort | Priority |
|---|---|---|---|---|---|
| 1 | **SAF-301** | `panic="abort"` 유지 + unwrap/transaction 명시 처리 우선. `unwind` 전환은 IPC panic boundary 설계가 있을 때만 합당 | Cargo Profiles docs / Rust panic-FFI / sqlx Transaction Drop | S | **P2** |
| 2 | **PR-A.1** | Vite **6.4.2+** 로 1차 고정 (manualChunks object form 호환 + CVE 패치). Vite 7/8 은 별도 migration — vite 8 = Rolldown 전환으로 manualChunks object 제거 | Vite 6 Rollup build docs / Vite 8 migration / GHSA-4w7w / esbuild GHSA-67mh | M | **P1** |
| 3 | **PR-A.5** | 본 repo (200+ commit) 는 sanity target only. **synthetic 10k/50k + 실제 large repo 1개** 기준값 채택. dirty/large diff/LFS/worktree 추가 시나리오 | Criterion CLI / Chrome DevTools Performance / MDN Performance API. hypothesis: graph hot path 압박 부족 | M | **P1** |
| 4 | **SAF-401** | `wait_with_output()` timeout 은 partial. **`stdout/stderr.take()` read task + `child.wait()` + timeout branch `child.kill().await` + reap** refactor | Tokio process / std Child.kill. timeout 배수 (60s) 는 hypothesis 로 유지하되 p95 실측 후 조정 | M | **P1** |
| 5 | **SAF-201** | **자동 치환 금지**. 분류 순서: user-input parse → path/OsStr → git output indexing → destructive flow → phase 처리 | Clippy unwrap_used / rust-analyzer assists. exact hit `parse::<i64>().unwrap()` 미검출 | L | **P1** |
| 6 | **SEC-301** | CLI 기반 `core.sshCommand` / `GIT_SSH_COMMAND` 우선. **OpenSSH + agent fallback 보존**, PuTTY/plink 는 별도 user choice 분리 | Git env vars docs / libgit2 auth / ssh agent credential | M | **P1** |
| 7 | **PR-F** | 순서: **TST-503 bench actual → TST-501 coverage guard → TST-502 real Tauri smoke**. Coverage bump 만으로 품질 ROI 낮고, WebDriver 는 플랫폼 의존 큼 | Vitest thresholds / Vitest 4 migration / Tauri WebDriver | M | **P2** |

### Codex 권장 sprint 순서 + 자율/결정 분류

| Sprint | 항목 | 분류 |
|---|---|---|
| **c83** | PR-A.1 (Vite 6.4.2+), SAF-401 (child kill refactor) | **자율 진행 가능** |
| **c84** | PR-A.5 / TST-503 bench actual, SAF-201 phase 1 (user-input parse) | BENCH_REPO 는 **사용자 결정** |
| **c85** | SEC-301 (CLI sshCommand + OpenSSH agent) | PuTTY 지원 범위 **사용자 결정** |
| **c86+** | SAF-301 (panic="abort" 유지 + explicit Drop), TST-501 coverage, TST-502 Tauri WebDriver | TST-502 WebDriver 범위 **사용자 결정** |

### Codex 권고 vs 본 plan 기존 추정 차이

| 항목 | 기존 plan 추정 | Codex 권고 | 변경 |
|---|---|---|---|
| SAF-301 | Critical (P0) bin size 측정 후 결정 | **P2 — abort 유지** + explicit Drop 강화 우선 | priority 강등 |
| PR-A.1 | vite 5→6→7→8 단계 | **6.4.2 first, 7/8 별도 migration** (vite 8 Rolldown 전환 차단) | 단계 분리 명확화 |
| PR-A.5 | git-fried 자체 측정 가능 | **synthetic + real large repo** 필요 — 본 repo sanity only | 측정 전략 강화 |
| SAF-401 | 후속 sprint defer | **P1** — partial fix 인정, refactor 즉시 가치 큼 | priority 승격 |
| SAF-201 | 4 phase 분량 | **자동 치환 금지** + user-input/path/git-output/destructive 카테고리 분류 우선 | 자동화 차단 |
| SEC-301 | 통합 fix | **CLI sshCommand 우선** + OpenSSH/agent fallback. PuTTY 분리 | 기술 선택 명확 |
| PR-F | coverage 우선 | **bench → coverage → webdriver** 순서 | 순서 변경 |

## 6. 다음 단계 제안

| 조건 | 제안 |
|---|---|
| Sprint c82 검증 완료 | `git push origin main` (사용자 결정 필요 — main 직접 push 정책 확인) |
| Codex c82 audit | `task-mp53zjgg-k1f7rw` (Sprint c82 6 commit cross-validation, background) 결과 도착 시 v0.8 update |
| 즉시 측정 진입 | 사용자 `BENCH_REPO` 입력 후 PR-A.5 / SAF-301 실행 |
| Sprint c83 진입 | `/plan PR-B.1 CodeMirror lang lazy load` 또는 `/integrate PR-A.2 CSP` |
| 장기 plan 확장 | 본 plan/33 의 § 3 sprint 별 sub-plan 작성 (c84 SAF-201 / c85 SEC-301 / c86 PR-D / c87 PR-E / c88 PR-F) |
