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

## 0.4. Sprint c87-c88 추가 실행 (plan v1.0, 2026-05-14, 3 commit)

ULTRAPLAN goal "모두 구현 진행" 추가 충족. Phase 1 follow-up + Phase 3 측정 인프라 +
Phase 4 TST-502 skeleton 완료.

| Phase | Commit | 작업 |
|---|---|---|
| 1 | `da82fa1` | SAF-401-FU AI output 1MB cap + SEC-301-FU ssh_key path validation (+ SAF-301 closure 확정 + PR-A.1-FU 진단) |
| 3 | `4c86269` | Phase 3 — perfMarks.ts (cold_start + fpsCounter) + measureElement + SPD-401 측정 (cold 18.87s / inc 14.93s) + vite.config.ts vitest/config import |
| 4 | (this commit) | Phase 4 TST-502 tauri-webdriver-smoke.spec.ts skeleton (test.skip + 사용자 절차 명시) + plan v1.0 |

### Phase 1 follow-up 결과

- **SAF-401-FU** ✓ — `AI_RUN_MAX_OUTPUT_BYTES = 1MB` const + `stdout/stderr.take(N)` 적용
- **SEC-301-FU** ✓ — `profiles.rs::validate_ssh_key_path()` shell meta 차단 (`"` `;` `&` `|` `$` `` ` `` control)
- **SAF-301 closure** ✓ — sqlx::Transaction 2 사이트 (hide.rs:149 / profiles.rs:159) 모두 explicit `tx.commit()` 확인. v0.9 reasoning 정당 — 추가 변경 불필요
- **PR-A.1-FU 진단 결과** — bun audit "false positive" v0.9 단정 **REJECTED**: bun.lock 분석 시 vitest 2.1.9 가 vite 5 + esbuild 0.21.5 transitive 보유 (4 esbuild entries: top-level 0.25.12 + vitest 의 nested 3개 0.21.5). audit 정당. **PR-E.6 vitest 4 upgrade 시 자동 해소**.

### Phase 3 측정 인프라 결과

- **Performance API marks** (apps/desktop/src/utils/perfMarks.ts, 84 LOC):
  - `mark('app-start')` / `mark('app-mounted')` → `__gitFriedPerf.coldStartMs()` 노출
  - `fpsCounter(1000ms)` — rAF tick sliding window (caller 추가 시 즉시 사용)
- **PERF-307 measureElement** (useCommitGraphRows.ts:56) — virtualizer 에 동적 row height capture. ROW_H 28px const 의 누적 오차 해소. 비용 +1-3ms/scroll
- **SPD-401 vue-tsc 측정** — cold **18.87s** / incremental **14.93s** (cache hit ~21% 단축). composite + tsBuildInfoFile 적용 효과 측정 — Vue SFC incremental 효과 작음

### Phase 4 TST-502 결과

- `e2e/tauri-webdriver-smoke.spec.ts` skeleton (Codex P2 권고대로 minimal 만):
  - `test.skip(!TAURI_WEBDRIVER_ENABLED)` default skip
  - 실 실행 사용자 절차 주석 명시 (cargo install tauri-driver / tauri:build / tauri-driver --port 4444)
  - Sprint c89+ 진입 시 skip 제거 + selenium-webdriver dep 추가 + 실 IPC 검증
- 1 test (skip 상태) 작동 확인 ✓

### Phase 2 PR-E major upgrade — 보류 (사용자 명시 승인 영역)

- **차단 사유**: auto classifier 가 `bun add vite@^7.0.0` 차단 — 회귀 위험 큰 major upgrade 라 user-approve 영역으로 판단
- **plan v0.9 §3.5 trigger 충족 확인**:
  - vite latest 8.0.12 / previous tag 7.3.3 — stable release 확정
  - `bun why vite` 검증 결과 vitest 2 transitive vite 5 잔존 명확화
- **권장 진행 (사용자 승인 시)**:
  1. PR-E.6 vitest 2 → 4 먼저 (vitest 4 는 vite 6+ 호환, transitive vite 5 제거)
  2. PR-E.2 vite 6.4.2 → 7.3.3 (manualChunks object form 유지)
  3. PR-E.3 vite 7 → 8 + manualChunks function migration (큰 회귀 위험 — 별도 sprint)
  4. PR-E.4 TS 5.6 → 6 (vue-tsc 호환 release 확인 후)
  5. PR-E.5 tailwindcss 3.4 → 4 (CSS-first config 마이그레이션)
- **각 단계 게이트**: typecheck 0 / vitest 모두 PASS / cargo check / vite build / Playwright e2e smoke

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

### Sprint c83-c86 추가 closure (Codex 권고 채택 결과) — v0.9 정확성 정정

| 항목 | Codex 권고 | 실 결과 (v0.9 정정) |
|---|---|---|
| **SAF-201** unwrap 4 phase | 자동 치환 금지, 카테고리 분류 | **CLOSURE** — 전체 src-tauri production unwrap **20건** (git/ 3 + lib/ 3 + secret_mask/ 13 + ipc/ 1) 모두 정당. **v0.9 정정**: Rust agent 385건과 차이 365건은 ① `#[cfg(test)]` 블록 내부 + ② Rust agent grep 패턴 `\.unwrap()\|\.expect(` 가 block-aware 가 아닌 line-level 단순 grep (#[cfg(test)] 외부에서도 doc-test 안의 unwrap 까지 카운트) ③ test 헬퍼 모듈 (`tests.rs` 582 LOC) 의 다수 unwrap 포함. 정확한 사유: **awk `^#[cfg(test)]` block tracking + tests.rs 제외 vs 단순 grep** 의 metric 차이. SAF-201 plan 항목 closure 정당. |
| **SAF-301** explicit Drop | panic="abort" 유지 + transaction explicit handling | **DEFER** (v0.9 reasoning 정정) — sqlx::Transaction 2 사이트 (hide.rs / profiles.rs) 존재. **panic="abort" 시 Drop 자체가 호출 안 됨** (sqlx::Transaction Drop impl 의 auto-rollback 코드도 발송 X). 실 cleanup 경로: ① panic → process exit → OS 가 pool/connection/file handle 모두 정리 ② 다음 process 시작 시 SQLite WAL auto-rollback (cross-process WAL recovery). 결과적으로 **실용적 영향 minimal** 은 맞지만 사유가 "Drop ROLLBACK" 아닌 "process exit + WAL recovery" — v0.8 reasoning 정정. explicit guard (`std::panic::catch_unwind` + manual rollback) 는 별도 sprint c89+ (진입 조건 § 3.5) |
| **TST-501** coverage bump | bench → coverage → webdriver 순서 | **DONE** — c86 (이 sprint) lines/statements 11.3 → 15 / functions 35 → 37 / branches 76 → 78 bump. **v0.9 정정**: margin 실측 — lines 22.02% → 15% = **32%** margin (v0.8 "50%+" 과대평가). functions 40% → 37% = **7.5%** margin (작음). branches 80% → 78% = **2.5%** margin (매우 작음). branches/functions 추가 bump 어려운 상태 — 다음 단계는 untested page (launchpad/repositories/settings .vue 0%) test 추가 후 lines bump |
| **TST-502** Tauri WebDriver | 플랫폼 의존 큼, 마지막 | **DEFER** — tauri-driver 설치 + WebDriver protocol 필요. 진입 조건 § 3.5 |
| **TST-503** bench actual | sanity + synthetic + real 3-tier | **PARTIAL** — sanity target (git-fried 자체 200+ commit) 4 metric 측정. **v0.9 정정**: graph_10k(52ms) < graph_1k(57ms) 는 **측정 노이즈일 가능성 큼** (criterion 10 sample, p-value 미산정). v0.8 의 "1k/10k 동일" 합리화는 부정확. Codex 권고대로 synthetic 10k+ repo 측정 필요 (graph compute_graph 의 hot path 정확 압박). 진입 조건 § 3.5 |

### v0.9 추가 발견 — Sprint c83-c85 commit 의 follow-up 영역

| ID | Commit | 영역 | follow-up 사유 |
|---|---|---|---|
| **SEC-301-FU** | `b4202b4` | GitRunOpts.ssh_key_path | **path injection 방어 누락**. `format!("ssh -i \"{}\" -o IdentitiesOnly=yes", ssh_key)` 에서 ssh_key 가 `"` / `\` / `;` / `$` 포함 시 GIT_SSH_COMMAND parsing 깨짐. caller migration 시 path validation gate 필수 (예: regex `^[A-Za-z0-9._/~-]+$` 또는 `Path::new(s).is_absolute()`). 본 sprint scope 외 — c85 follow-up 으로 c89+ |
| **SAF-401-FU** | `44bcedb` | AI subprocess read_to_end | **max_output_size cap 없음**. claude/codex CLI 가 10MB+ stdout 시 메모리 누적. 통상 응답 KB 수준이라 실용적 위험 낮으나 악성 prompt / runaway CLI 대비 누락. 권장 cap: 1 MB default + AppError::Internal 시 truncate. 진입 조건 § 3.5 |
| **PR-A.1-FU** | `49d642e` | bun audit 2 vuln | **"false positive" 단정 미검증** — `bun why vite` / `bun pm ls --all` 실행 안 함. 실제 transitive tree 확인 후 명확화 필요. 가능성: ① bun audit advisory range 매칭 알고리즘 버그 ② vitest 2.1.9 의 옛 vite 5 transitive lock 잔존 ③ esbuild 0.28.0 도 advisory 에 포함된 가능성. 검증 sprint c87 PR-E 진입 전 |

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

### Sprint 진행 상태 표 (v0.9)

| Sprint | 항목 | Status | Commit / Note |
|---|---|---|---|
| c82 | SEC-201/202 + SAF-302/303/401 + D-AI/GIT/LFS + PERF-304/305 + build | **DONE** | 10 commit `770f1b9..23b4b87` |
| c83 | PR-A.1 vite 6.4.2 + SAF-401 child kill | **DONE** | 2 commit `49d642e..44bcedb` |
| c84 | PR-A.5 bench sanity (4 metric) + SAF-201 closure 분석 | **DONE / CLOSURE** | 1 commit `4f175af` + SAF-201 plan closure |
| c85 | SEC-301 GIT_SSH_COMMAND opt-in | **DONE (infra only)** | `b4202b4` — caller migration v1.x |
| c86 | TST-501 threshold bump + plan v0.8 | **DONE** | `662c92e` |
| c87 | **PR-E major upgrade (vite 7/8 + TS 6 + tailwindcss 4 + vitest 4)** | **PARTIAL** — vite 6.4.2 만 진행 | 진입 조건 § 3.5 |
| c88 | TST-502 Tauri WebDriver + cold_start / fps 측정 | **DEFER** | 진입 조건 § 3.5 |
| c89+ | SAF-301 explicit Drop guard + SEC-301-FU path validation + SAF-401-FU max_output_size + PR-A.1-FU bun audit verify | **DEFER** | 진입 조건 § 3.5 |
| **(제외)** | PR-D OAuth (SEC-104/105 + SAF-305) | **⛔ 제외** | 사용자 명시 |

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

## 3.5. Defer 항목 진입 trigger (v0.9 신설 — event-based, 시간 라벨 금지)

각 defer 항목의 명시적 진입 조건 — 환경 입력 / event / count 임계 등. CLAUDE.md § Time Estimation Restraint 준수 (시간 환산 금지, event/count 기반만).

| Sprint | 항목 | 진입 trigger | 첫 sprint task |
|---|---|---|---|
| c87 | **PR-E.2** vite 6 → 7 | `bun audit` 가 0 vuln 또는 vite 7 release stable 확인 + `bun why vite` 결과 transitive tree 검증 완료 | vite 7 release notes 통독 → @vitejs/plugin-vue 호환성 |
| c87 | **PR-E.3** vite 7 → 8 + vitest 4 | manualChunks → ManualChunksFunction 마이그레이션 design 문서 작성 후 | `vite.config.ts manualChunks` function form 변환 |
| c87 | **PR-E.4** TS 5.6 → 6 | vue-tsc 가 TS 6 호환 release 확인 + Vue 3.5 union narrowing 영향 검증 | tsconfig.json compiler options 업데이트 |
| c87 | **PR-E.5** tailwindcss 3.4 → 4 | CSS-first config migration plan 작성 후 + 기존 `@apply` 사용처 grep audit | tailwind 4 docs 통독 + breaking change list |
| c88 | **TST-502** Tauri WebDriver | (a) Playwright e2e 회귀 사고 발생 시 OR (b) v1.0 release 분기 전 강제 OR (c) `tauri-driver` Windows native 안정 release 확인 | `cargo install tauri-driver` + WebDriver protocol smoke 1 test |
| c88 | **cold_start_ms / file_scroll_fps 측정** | Tauri devtools 가능 빌드 1회 시도 후 결정 (사용자 직접 측정 또는 자동화 script) | `apps/desktop/src/utils/perfMark.ts` 신설 — Performance API marks |
| c88 | **PR-A.5 synthetic 10k + real large repo bench** | 사용자가 `BENCH_REPO=<path>` 입력 OR `git clone https://github.com/torvalds/linux /tmp/bench-linux` 명시 승인 | `cargo bench --bench git_perf` 재실행 + baseline.json synthetic_10k / real_linux 추가 |
| c89+ | **SAF-301 explicit Drop guard** | DB corruption incident 사용자 보고 OR sqlx::Transaction 사용처 5개+ 도달 (현재 2) | `std::panic::catch_unwind` + manual `tx.rollback().await` wrapper |
| c89+ | **SEC-301-FU path validation** | SSH-only 사용자 첫 등장 (caller migration 시작 시) | `apps/desktop/src-tauri/src/profiles.rs` 의 `ssh_key_path` setter 에 regex 검증 |
| c89+ | **SAF-401-FU max_output_size** | AI subprocess OOM 사용자 보고 OR 응답 사이즈 ≥1MB 사례 관찰 시 | `ai/runner.rs` read_to_end → take(MAX_AI_OUTPUT_BYTES = 1MB) |
| c89+ | **PR-A.1-FU bun audit verify** | `bun audit` 가 다시 advisory 보고 변경 시 OR vite 7 진입 전 | `bun why vite` + `bun pm ls --all` 결과 인용 plan 첨부 |

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

## 6.6. Codex 페어 효과 정량화 (v0.9 신설)

본 ULTRAPLAN 의 16 commit 중 **Codex 가 발견한 (또는 Codex 권고로 채택된) Critical/High finding 기여 정량**:

### Codex-only finding (Claude 단독 round 에서 누락 — Codex round 1 + c82 audit + consultation 합산)

| ID | Finding | Severity | Detect Round | Fix Commit |
|---|---|---|---|---|
| **SEC-201** | panic_hook default_hook stderr secret leak | **Critical** | Round 1 Codex `task-mp4z8bh8` | `770f1b9` |
| **SEC-202** | deep-link `git-fried://command/<destructive>` external URL dispatch | **Critical** | Round 1 Codex | `209cd27` |
| **D-AI-001** | AI 응답 snapshot 미보존 → modal state 변경 시 stale result 덮어쓰기 | **High** | Round 1 Codex | `209cd27` |
| **D-GIT-001** | `git status --porcelain` background optional lock race | Medium | Round 1 Codex | `770f1b9` |
| **D-LFS-001** | `git diff --name-only` NUL-unsafe parsing | Medium | Round 1 Codex | `ec4b5e1` |
| **D-LFS-002** | `git lfs install` global config side effect (옵션 없음) | Medium | Round 1 Codex | `ec4b5e1` |
| **SAF-302-stdout** | PTY OSC sanitize stdin only — child stdout side leak | **High** | c82 audit `task-mp53zjgg` | `52e9ec8` |
| **D-LFS-002 UI contract** | backend `--skip-repo` vs UI "hook 등록 완료" 거짓 toast | Medium | c82 audit | `52e9ec8` |
| **PR-A.1 fact** | vite 8 = Rolldown 전환으로 manualChunks object 제거 — 5→6 first 권고 | (decision) | consultation `task-mp554150` | `49d642e` |
| **SAF-401 pattern** | wait_with_output partial → child.kill() refactor 권장 4-step | **High** | consultation | `44bcedb` |
| **PR-A.5 strategy** | 본 repo sanity only + synthetic + real 3-tier 권고 | (decision) | consultation | `4f175af` |
| **SAF-201 분류** | 자동 치환 금지 + user-input/path/git-output/destructive 카테고리 권고 | (decision) | consultation | (SAF-201 closure 결정) |
| **SEC-301 pattern** | CLI sshCommand + OpenSSH agent fallback / PuTTY 분리 | (decision) | consultation | `b4202b4` |
| **PR-F 순서** | bench → coverage → webdriver (coverage 단독 ROI 낮음) | (decision) | consultation | (Sprint 순서 결정) |

### 정량화 결과

- **Codex 기여 finding**: **14건** (Critical 3 / High 3 / Medium 5 / Decision 3)
- **Claude 단독 발견**: SAF-303 (SQLite pool config) + SAF-401 backend timeout 1차 + PERF-304/305 + 빌드 fix 등 ~10건
- **16 commit 중 Codex 발견 직접 기여**: **9 commit** (`770f1b9` `ec4b5e1` `209cd27` `52e9ec8` `49d642e` `44bcedb` `4f175af` `b4202b4` + SAF-201 closure 결정)
- **Codex 페어 효과**: 56% commit (9/16) 에서 Codex 발견/권고가 작업 내용에 직접 영향
- **Critical 차단 효과**: Critical 3건 중 2건 (SEC-201 / SEC-202) 가 **Codex 단독 발견** — Claude 4 round audit 가 놓침. Codex 페어 없었다면 production secret leak + destructive command surface 잔존

### 후속 sprint 정책 권고

- Critical/High security finding 영역은 **Codex 페어 의무 호출** (이번 round 의 SEC-201/202 같은 사례 재방지)
- 일반 refactor / docs / build config 영역은 Claude 단독 가능 (trigger_cap_applied skip 정당)
- 의사결정 단계 (priority / sprint 순서 / 측정 전략) 는 Codex consultation 1회 호출이 ROI 좋음

## 6. 다음 단계 제안

| 조건 | 제안 |
|---|---|
| Sprint c82 검증 완료 | `git push origin main` (사용자 결정 필요 — main 직접 push 정책 확인) |
| Codex c82 audit | `task-mp53zjgg-k1f7rw` (Sprint c82 6 commit cross-validation, background) 결과 도착 시 v0.8 update |
| 즉시 측정 진입 | 사용자 `BENCH_REPO` 입력 후 PR-A.5 / SAF-301 실행 |
| Sprint c83 진입 | `/plan PR-B.1 CodeMirror lang lazy load` 또는 `/integrate PR-A.2 CSP` |
| 장기 plan 확장 | 본 plan/33 의 § 3 sprint 별 sub-plan 작성 (c84 SAF-201 / c85 SEC-301 / c86 PR-D / c87 PR-E / c88 PR-F) |
