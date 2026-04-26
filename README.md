# git-fried

> **GitHub 개인 + Gitea 회사를 동시에 다루는 한국 풀스택 개발자를 위한, GitKraken 보다 가볍고 정확한 데스크탑 Git 클라이언트.**

상태: **v0.2-stretch (검증 대기)** — v0.0 + v0.1 (5 sprint) + v0.2 stretch 4개 작성 완료. **사용자 Windows 환경에서 빌드/dogfood 필요**. → [REVIEW.md](REVIEW.md) / [DOGFOOD.md](DOGFOOD.md)

## 차별화 4축

1. **Gitea = 1급 시민** — PR / Workspaces / Launchpad / Issues 모두 Gitea 1순위 지원 (GitKraken 5년째 미해결)
2. **한글 안전** — UTF-8 강제 파이프, file-based commit body, CP949 mangle 차단
3. **Tauri 2 + Rust** — Electron 1/8 메모리 (~50MB idle), GitButler 동급 검증된 스택
4. **회사 워크플로우 직격** — Multi-repo 사이드바, Submodule + LFS, Worktree 매니저, Conventional Commits

## 종합 기획서 (8개 문서)

| # | 문서 | 내용 |
| - | ---- | ---- |
| 00 | [overview](./docs/plan/00-overview.md) | 30초 요약 + 인덱스 |
| 01 | [why-and-positioning](./docs/plan/01-why-and-positioning.md) | 왜 만드는가 / 시장 위치 |
| 02 | [user-workflow-evidence](./docs/plan/02-user-workflow-evidence.md) | 사용자 Git 사용 패턴 실측 (20 레포 / 5,500 커밋) |
| 03 | [feature-matrix](./docs/plan/03-feature-matrix.md) | 기능 매트릭스 (must / nice / skip) |
| 04 | [tech-architecture](./docs/plan/04-tech-architecture.md) | Tauri 2 + Rust + React 19 |
| 05 | [roadmap-v0.1-v1.0](./docs/plan/05-roadmap-v0.1-v1.0.md) | 18개월 마일스톤 |
| 06 | [risks-and-pitfalls](./docs/plan/06-risks-and-pitfalls.md) | 위험 + 완화 |
| 07 | [design-decisions](./docs/plan/07-design-decisions.md) | UX / 단축키 / 레이아웃 |
| 08 | [references](./docs/plan/08-references.md) | 참고 자료 |

## 빠른 결정 표

| 항목 | 선택 |
| ---- | ---- |
| 앱 셸 | Tauri 2 (Windows 우선) |
| 백엔드 | Rust (`git2-rs` + git CLI hybrid) — **Claude/Codex 페어 작성** |
| 프론트 | **Vue 3 + Vite + shadcn-vue + Pinia + Vue Query** |
| 에디터 | CodeMirror 6 (+ merge view) |
| DB | SQLite + FTS5 (`sqlx`) |
| 인증 | OS keychain (`tauri-plugin-keyring`) |
| 그래프 | Canvas 2D + pvigier "straight-line lane" |
| API codegen | `@hey-api/openapi-ts` (Gitea), `@octokit/types` (GitHub) |
| **AI 통합** | **Claude CLI / Codex CLI subprocess** (자체 LLM 인프라 없음) |
| 플랫폼 | **Windows 우선 (v0.x ~ v1.0)** / macOS / Linux v1.x |
| 라이선스 | MIT (잠정, 수익 모델은 v1.x 검토) |

## 18개월 한눈에

- **v0.0 (M0~M1, 5주)** — Tauri 2 + Vue 3 셸 + 한 레포 log 표시 (Windows-only)
- **v0.1 (M2~M6)** — 일상 워크플로우 70% (commit/branch/diff/stash/multi-repo/submodule/Gitea+GitHub PR)
- **v0.2 (M7~M9)** — Power user + AI 페어 통합 (rebase / 3-way merge / worktree / **Claude/Codex CLI commit msg + PR body**)
- **v0.3 (M10~M12)** — Profiles / FTS5 검색 / sync-template / Issues / Releases
- **v1.0 (M13~M18)** — Pre-commit / PR 리뷰 / Launchpad / AI merge resolve / EV 서명 / 안정화
- **v1.x (M19+)** — macOS / Linux / OAuth / 수익 모델 검토

## 결정 완료 (2026-04-26)

| # | 항목 | 결정 |
| - | --- | --- |
| 1 | Rust 경험 | 없음 → Claude/Codex 페어 프로그래밍 |
| 2 | 플랫폼 우선순위 | Windows 우선, macOS/Linux v1.x |
| 3 | 수익 모델 | v1.x 검토 (현재 무료 OSS) |
| 4 | AI 통합 | Claude CLI / Codex CLI subprocess 위임 |
| 5 | 이름 | git-fried 최종 |

## 라이선스

MIT (잠정).
