# Contributing to git-fried

기여를 환영합니다. **1인 개발 + AI pair (Claude Opus 4.7 1M context)** 모델로 운영되므로 응답 시간은 1주 이상 소요됩니다.

## 개발 환경

| 항목 | 요구 |
| --- | --- |
| OS | Windows 11 (현재 1순위, macOS/Linux 는 [`docs/plan/17 §4-5`](docs/plan/17-v1.x-roadmap.md)) |
| 런타임 | Bun ≥ 1.1.0 |
| Rust | ≥ 1.77 (rustup stable) |
| Tauri | 2.x |

## 빌드

```bash
git clone https://github.com/tgkim/git-fried
cd git-fried
bun install
bunx lefthook install  # git hooks (pre-commit lint/format + pre-push typecheck/test + commit-msg conventional)
bun run tauri:dev      # 개발 (HMR ~1s)
bun run tauri:build    # 프로덕션 MSI / NSIS
```

> `lefthook` 가 commit/push 전에 자동으로 lint·format·typecheck·test 를 돌립니다. 긴급 시 `git commit --no-verify` / `git push --no-verify` 로 우회할 수 있으나 원인을 찾아 수정하는 것을 권장합니다.

## 코드 스타일

| 영역 | 룰 |
| --- | --- |
| TypeScript | ESLint v9 flat config (`apps/desktop/eslint.config.js`) — `bun run lint` 통과 필수 |
| Rust | `cargo fmt --check` + `cargo clippy --all-targets -- -D warnings` 통과 필수 |
| Vue | 3.x SFC, `<script setup lang="ts">` |
| 커밋 메시지 | 한국어 또는 영어. **Conventional Commits** 권장 (`feat:`/`fix:`/`docs:`/`chore:`/`test:` 등) |
| 한글 메시지 | HEREDOC + `'EOF'` 사용 (단일 라인 `-m "..."` 한글 전달 금지 — bash escaping 으로 바이트 손상 가능) |

## 한글 안전 약속

모든 PR 은 **한글 round-trip 회귀 테스트** 를 통과해야 합니다 ([`docs/plan/06 §회귀 차단`](docs/plan/06-risks-and-pitfalls.md)).

- 한글 commit message → log 파싱 → 정확히 같은 한글
- 한글 파일명 stage → diff 표시
- 한글 PR body POST → GET round-trip
- chcp 949 / 65001 양쪽에서 통과

## 보안 패턴 (Security Patterns) — Sprint c95+ Wave 1~5 (2026-05-26)

새 git CLI shell-out 또는 IPC handler 를 추가할 때 다음 3단 가드 필수:

### 1. CWE-88 (Argument Injection) — git CLI argv

사용자 입력(branch/remote/sha/ref/path 등)을 git argv 에 push 하기 전 **반드시**:

```rust
use crate::git::path::reject_dash_prefix;

// dash prefix 거부 (`--upload-pack=evil`, `-D` 차단 — CVE-2017-1000117 류)
let safe_ref = reject_dash_prefix(user_ref, "ref")?;

// argv 구성 시 `--end-of-options` 로 positional 분리 (git 2.24+)
git_run(repo, &["log", "--pretty=%H", "--end-of-options", safe_ref], &opts).await?;
```

**예외**: `git reset` 의 mode option (`--soft/--mixed/--hard`) 은 git 이 sub-command 처럼 parser 처리 → `--end-of-options` 와 충돌(`option '--end-of-options' must come before non-option arguments`). 이런 명령은 `reject_dash_prefix` 단독으로만 가드. 같은 패턴: `git branch -D/-d` 류.

**적용 영역**: fetch/pull/push/rebase/merge/cherry_pick/diff/compare/blame/remote/stash/tag/reflog/worktree/lfs/reset/revert/ai_commands (17+).

### 2. CWE-22 (Path Traversal) — repo-relative path

repo 내부 파일을 읽거나 쓸 때:

```rust
use crate::git::path::validate_repo_relative_path;

// 4단 가드 통합: empty / `..` / absolute (POSIX `/`, Windows `C:\`) / `/`·`\\` prefix
// + 파일 존재 시 canonicalize 후 repo prefix 확인 (심볼릭 링크 탈출 방어)
let abs = validate_repo_relative_path(repo, user_path)?;
std::fs::read(&abs)?;
```

**적용 영역**: `read_file` / `merge.rs` (read_conflicted / write_resolved / take_side) / `stash::apply_stash_file`.

### 3. CWE-94 (Code Injection) — line-based grammar

rebase todo 같은 line-based 파일에 사용자 입력 기입 시 newline/control char strip:

```rust
fn sanitize_subject(subject: &str) -> String {
    // \n, \r, \t, control char → space. trim 후 empty 면 "(no subject)" fallback.
}

fn validate_sha(sha: &str) -> AppResult<()> {
    // hex 7~64자 — git abbreviation 부터 SHA-256 full 까지 cover
}
```

### Sibling-pattern audit 의무

새 git command 추가 시 `git/` 디렉토리의 같은 동작 (예: 새 commit-ref 다루는 함수) 모두 위 3단 가드 적용 여부 확인. PR 본문에 "sibling audit: {file:line} cover" 명시.

### Codex 자율 fix 시 검증 게이트

Codex CLI 를 통한 자율 fix commit 후 반드시:

- `bun run test:rust` (cargo test) — **`cargo check` 만으로는 회귀 검출 불가**
- 프로젝트별 frontend test runner (`bun run test`)

근거: Sprint c95+ Wave 5 (commit `53fdb7b`) 에서 Codex 가 `cargo check + fmt` 만 검증하고 commit → reset.rs 의 `--end-of-options` mode 충돌 회귀 발생 (다음 commit `9c46cf3` 에서 부모가 fix).

## PR 절차

1. fork → 새 branch (예: `fix/foo`, `feat/bar`)
2. 변경 + 회귀 테스트 (cargo unit / Vitest) 추가
3. 검증:
   - `bun run typecheck` — 0 에러
   - `bun run lint` — 0 에러
   - `cargo test --lib` — 모두 pass
   - `cargo clippy --all-targets -- -D warnings` — 통과
4. PR 작성 (한국어 또는 영어, 템플릿 채움)
5. CI 자동 검증 통과 후 review

## ⚠️ 절대 금지 (commit / PR / Issue body)

CLAUDE.md 글로벌 룰 정합:

- `Co-Authored-By: Claude ...` trailer (어떤 모델명/이메일이든 전부 금지)
- `🤖 Generated with [Claude Code](https://claude.com/claude-code)` 푸터
- 기타 Claude / Anthropic / 자동 생성 표시 일체

자동 생성 도구 (`/commit`, `gh pr create`) 의 기본 템플릿에 위 항목이 있어도 **수동 제거** 후 작성하세요.

## 이슈 / 기능 요청 / 보안

- **버그**: [GitHub Issues](https://github.com/tgkim/git-fried/issues) `bug` 라벨 (재현 단계 + OS + git-fried 버전 필수)
- **기능 요청**: [GitHub Discussions](https://github.com/tgkim/git-fried/discussions) `Ideas` (사용 시나리오 + GitKraken 비교)
- **보안 취약점**: [SECURITY.md](SECURITY.md) 참조 (공개 이슈 금지)

## 명시적 거부 (PR 받지 않음)

[`docs/plan/01 §5`](docs/plan/01-why-and-positioning.md) 정합:

- Cloud Workspace / Cloud Patches / Browser Extension / GitLens 통합
- 자체 LLM 호스팅 / BYOK API key router (Claude/Codex CLI subprocess 위임만)
- Issue 트래커 풀 통합 (Jira/Trello/Linear) — Gitea/GitHub Issues 만 1급
- 모바일 앱 / 웹앱
