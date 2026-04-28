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
bun run tauri:dev    # 개발 (HMR ~1s)
bun run tauri:build  # 프로덕션 MSI / NSIS
```

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
