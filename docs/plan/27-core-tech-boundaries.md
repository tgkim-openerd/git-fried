# Plan 27 — Core tech 경계 정리 + publish 가능성 분석

작성: 2026-04-30 (Sprint c34 Phase 4, plan/26 의 sub-doc)

> **목적**: plan/26 §3 Phase 4 의 "core tech 분리" 질문에 답한다 — git-fried 의 어느 모듈이 별도 crate / library 로 publish 할 가치가 있고, 어느 것은 도메인 한정인가? 코드 변경은 0 — 분석만. 결과는 [plan/17 v1.x roadmap](17-v1.x-roadmap.md) 으로 흡수.
>
> **연계**: plan/26 (3 constraints 정체성) §3 Phase 4 — "v1.x 시점에 한글 normalization + AI CLI subprocess 를 별도 crate 추출 가능성 평가".

---

## 1. 후보 4개 정리

| # | 모듈 | LOC | 위치 | 외부 가치 |
| -: | ---- | ----: | ---- | ---- |
| 1 | **한글 normalization** | ~200 (산재) | `git/runner.rs` + `git/read_file.rs` + `git/status.rs` + `git/path.rs` | ★★★ |
| 2 | **AI CLI subprocess** | 614 | `ai/{mod,prompts,runner}.rs` | ★★★ |
| 3 | **Multi-forge profile** | 1,453 | `forge/{mod,model,gitea,github}.rs` | ★ |
| 4 | **Reflog-based undo** | (산재) | `git/*.rs` (별도 모듈 X) | ★★ |

---

## 2. 후보 1: 한글 normalization (★★★ ROI 가장 큼)

### 현재 위치

- `git/runner.rs` (204 LOC) — encoding_rs 3건 (UTF_8 강제 파이프)
- `git/read_file.rs` — 파일 읽기 시 NFC normalization
- `git/status.rs` — 파일 경로 normalization
- `git/path.rs` — path 변환 helper

### 무엇이 외부에 가치 있나

다른 git tool / 한국어 개발 도구가 동일한 문제를 가짐:
- Windows git CLI 기본 출력 = CP949 → UTF-8 해석 시 깨짐
- macOS HFS+ NFD vs Linux/Windows NFC 불일치
- file-based commit body 강제 (단일 라인 `-m "..."` 시 bash escaping 손실)

### Crate 추출 시 시그니처 (가설)

```rust
// crate: git-korean-safe
pub struct KoreanSafeRunner {
    repo_path: PathBuf,
}

impl KoreanSafeRunner {
    pub fn run_git(&self, args: &[&str]) -> Result<RunOutput>;
    pub fn read_file_safe(&self, path: &Path) -> Result<String>;
    pub fn commit_with_body(&self, message: &str) -> Result<()>;
}

pub fn normalize_path(p: &Path) -> PathBuf;
pub fn decode_git_output(bytes: &[u8]) -> String;  // CP949 fallback + UTF-8 우선
```

### 비용

- 분리 작업: 200 LOC scattered → 단일 crate 약 350 LOC (test 포함)
- git2 의존 제거 (선택) — 순수 git CLI wrapper 만
- 의존: `encoding_rs` + `unicode-normalization` (이미 사용 중)
- 작업 size: 1 sprint (~5 commits)

### 결정

**v1.x 후보** — v0.x 단계는 라이브러리 publish 보류. v1.0 release 후 dogfood 가 있으면 추출 검토. 이름 후보: `git-korean-safe` 또는 `kgit-runner`.

### 단기 액션 (v0.x 가능)

- [ ] `git/path.rs` 확장 — encoding 관련 helper 통합 (현재 산재된 3 파일)
- [ ] 테스트 분리 — `git/path.rs::tests::korean_*` 6+ test
- [ ] 문서 — `docs/plan/27-core-tech-boundaries.md` (본 문서) 의 §2.4 단기 액션 항목

---

## 3. 후보 2: AI CLI subprocess (★★★ ROI)

### 현재 위치

`ai/mod.rs` (18) + `ai/prompts.rs` (472) + `ai/runner.rs` (124) = 614 LOC.

```rust
// ai/runner.rs (요약)
pub enum AiCli { Claude, Codex }

pub async fn run_ai(
    cli: AiCli,
    prompt: &str,
    timeout: Duration,
) -> Result<AiResult>;
```

### 무엇이 외부에 가치 있나

자체 LLM 인프라 없이 **로컬 CLI 도구** (Claude / Codex) 만 호출하는 패턴 — 회사 보안정책 환경에서 매력. git 외 도메인 도구 (linter / formatter / docs gen / IDE plugin) 가 차용 가능.

핵심 가치:
1. **외부 LLM 송출 명시 confirm** — Sprint c33 ConfirmDialog 패턴
2. **multi-CLI fallback** — Claude > Codex 우선순위 자동
3. **timeout / cancel** — 5min 차등 timeout + Tauri channel cancel
4. **Korean prompt** — `prompts.rs` 의 한국어 prompt 472 LOC 가 사용자 환경 직격

### Crate 추출 시 시그니처 (가설)

```rust
// crate: local-ai-cli
pub trait AiCli {
    async fn run(prompt: &str) -> Result<AiResult>;
}

pub struct ClaudeCli;
pub struct CodexCli;

pub async fn detect() -> Vec<AiProbe>;  // 설치 + 인증 자동 감지
pub async fn run_with_fallback(
    prompts: &[&str],
    preferred: AiCli,
) -> Result<AiResult>;
```

### 비용

- prompts.rs 의 한글 prompt 472 LOC 는 git-fried 도메인 종속 → 분리 후 별도 crate (예: `git-fried-prompts`)
- runner.rs 124 LOC + AiResult struct 만 추출 → ~200 LOC crate
- 의존: `tokio` + `which` (CLI binary 검색)
- 작업 size: 1 sprint (~3 commits)

### 결정

**v1.x 후보 + 우선순위 ★** — Claude / Codex 외 추가 CLI (Gemini / Cody / Cursor CLI) 통합 시점에 자연 분리. v1.x 시점에 plan 갱신.

### 단기 액션 (v0.x 가능)

- [ ] `ai/runner.rs` 의 `AiCli` enum → trait object 변환 (확장성 ↑) — Sprint c34/c35 후보
- [ ] `ai/prompts.rs` 의 한국어 prompt 카탈로그를 별도 mod 로 (현재 단일 파일 472 LOC)

---

## 4. 후보 3: Multi-forge profile (★ ROI 낮음)

### 현재 위치

`forge/mod.rs` (126) + `forge/model.rs` (145) + `forge/gitea.rs` (587) + `forge/github.rs` (595) = 1,453 LOC.

### 무엇이 외부에 가치 있나

git tool 한정. 일반 라이브러리 가치 낮음 — Octocrab (GitHub) + Gitea SDK 가 이미 존재. git-fried 의 차별점은 **단일 Profile 추상화** (하나의 사용자가 Gitea + GitHub 동시 인증 + 1-click 토글).

### 결정

**Publish 보류** — 추출 ROI 낮음. 내부 mod 경계만 명확히 (이미 양호).

### 단기 액션

- [ ] `forge/model.rs` 의 `ForgeAccount` / `ForgeAuthor` struct → 공용 타입 명시 (이미 명확)
- [ ] `forge/{gitea,github}.rs` 의 587 / 595 LOC 가 거의 비슷 — `Trait ForgeApi { list_pulls, ... }` 추상화 가능. ROI 평가 후 sprint 결정 (god module 분리)

---

## 5. 후보 4: Reflog-based undo/redo (★★ ROI)

### 현재 위치

별도 모듈 없음. `git/*.rs` 의 reset / commit / branch 명령 + GitKrakenToolbar 의 undoMut / redoMut 에 산재.

### 무엇이 외부에 가치 있나

git GUI 가 채용하기 좋은 패턴 — "마지막 작업 되돌리기" 를 reflog 기반으로 구현. GitKraken 도 비슷, 그러나 multi-step 한계.

git-fried 의 차별: **commit / amend 만 자동 처리, 다른 액션은 reflog modal 안내** — 안전성과 명확성 양립.

### 결정

**Publish 후보 — 단 모듈 분리 선행 필요**. 현재 산재라 추출 비용 큼. v1.x 시점 separate `git/reflog_undo.rs` 모듈 작성 → 이후 crate 추출.

### 단기 액션

- [ ] `git/reflog.rs` 신규 모듈 (현재 listReflog 외 단일 함수만 — undoLastCommit / redoLastUndo / classifyReflogAction 통합)
- [ ] 작업 size: 1 sprint, ~150 LOC

---

## 6. 종합 우선순위

| Phase | 작업 | LOC 영향 | sprint |
| ---- | ---- | ----: | ---- |
| **단기 (v0.x, ★ ROI)** | path.rs 확장 (한글 helper 통합) | +50 | 1 sprint |
| **단기 (v0.x, ★)** | ai/runner.rs trait 변환 | ~+30 | 1 sprint |
| **단기 (v0.x, ★)** | git/reflog.rs 모듈 분리 | +150 | 1 sprint |
| **중기 (v1.0 후, ★★)** | `git-korean-safe` crate 추출 | ~350 LOC crate | 2 sprint |
| **중기 (v1.0 후, ★★)** | `local-ai-cli` crate 추출 | ~200 LOC crate | 1 sprint |
| **중기 (v1.0 후, ★)** | git/forge trait 추상화 | -200 (중복 제거) | 1 sprint |
| **장기 (v1.x)** | reflog-undo crate 추출 | ~250 LOC crate | 1 sprint |

---

## 7. 비판 self-check

| 위험 | 대응 |
| ---- | ---- |
| **Premature abstraction** — 사용처 1개 (git-fried) 인 채로 crate 추출하면 인터페이스 잘못 설계 가능 | v1.0 release 후 6 개월 dogfood + 2nd 사용처 (외부 contributor 또는 사용자) 등장 시점에 추출 |
| **유지보수 부담** — crate 분리 시 git-fried 측에서 외부 dependency 로 변경 필요, 버전 동기 비용 | git-fried 자체 monorepo 유지 (workspace) — `apps/desktop` + `crates/git-korean-safe` 같이 |
| **이름 충돌** — `git-korean-safe` 같은 이름이 crates.io 에 있을 가능성 | v1.x publish 시점에 검색 후 결정. 현재 plan 보류 |
| **사용자 1인 dogfood** — 외부 가치 검증 없음 | DOGFOOD.md + plan/18 dogfood feedback 으로 신호 수집 |

---

## 8. 결론

**v0.x 단계에서 publish 안 함.** 단기 액션 3가지 (path.rs 확장 / ai trait / reflog 모듈) 만 진행. 이는 **"core tech 가 publish 가능한 형태로 준비됨"** 을 보장하는 것이지 publish 자체는 아님.

v1.0 release 후 dogfood 데이터 (한글 mangle 차단 횟수 / AI CLI 호출 횟수 / forge profile 토글 횟수) 가 누적되면, 외부 publish 의 가치 평가가 가능. 그 시점에 plan/17 v1.x roadmap 갱신.

> 이 plan 은 분석 문서. 코드 변경 0. plan/26 §3 Phase 4 충족.
