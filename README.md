# git-fried

> **GitHub 개인 + Gitea 회사를 동시에 다루는 한국 풀스택 개발자를 위한, GitKraken 보다 가볍고 정확한 데스크탑 Git 클라이언트.**

상태: **v0.3 release prep** — 76 commits / 153 파일 / 4 SQLite migrations / Cargo test 79+ pass / TypeScript 0 errors / ESLint v9 flat config 0. v1.0 핵심 기능 + GitKraken 12.0 catalog 95% 흡수 완료.

→ [REVIEW.md](REVIEW.md) (현재 진행 현황) / [CHANGELOG.md](CHANGELOG.md)

## 차별화 4축

1. **Gitea = 1급 시민** — PR / Workspaces / Launchpad / Issues 모두 Gitea 1순위 지원 (GitKraken 5년째 미해결)
2. **한글 안전** — UTF-8 강제 파이프, file-based commit body, CP949 mangle 차단
3. **Tauri 2 + Rust** — Electron 1/8 메모리 (idle ~50MB 목표, baseline 측정은 [`docs/plan/20`](docs/plan/20-performance-benchmark.md))
4. **회사 워크플로우 직격** — Multi-repo 탭 + Submodule + LFS, Worktree 매니저, Profiles (회사/개인 1-click), 한국식 dual-forge 지원

## 핵심 기능 (v1.0 + GitKraken catalog)

- **Multi-repo** — Workspaces, Tab 시스템 (⌃Tab/⌃⇧Tab + drag-drop 재정렬), Sidebar 레포 필터 (⌘⌥F)
- **Commit Graph** — pvigier straight-line lane (Canvas 2D), Hide/Solo branches, 컬럼 토글/재정렬, lane drag-resize
- **Diff** — Hunk / Inline / Split 3-mode + **Hunk-level + Line-level stage** (`HunkStageModal`)
- **Stash** — push / apply / pop / drop / show + **AI 메시지** + **파일별 부분 apply**
- **Branch / Merge / Rebase** — drag-drop merge/rebase/cherry-pick + **Interactive rebase (drag-drop drop/reword/squash/fixup)**
- **3-way merge editor** + **AI Auto-resolve**
- **Forge** (Gitea + GitHub) — PR list / detail / 리뷰 (Approve / Request changes / 머지 / 닫기) / Issue / Release / Launchpad (Pin / Snooze / Saved Views)
- **AI** (Claude/Codex CLI subprocess) — commit message / PR body / merge resolve / **Explain commit·branch / Stash msg / Commit Composer (multi-commit 재작성)** / **Conflict 미리해결**
- **Compare branches/commits** (`docs/plan/14 §A1` — ahead/behind + commit list + diff)
- **Status bar** — Conflict Prediction (target merge-tree dry-run) + ✨ AI 미리해결 + Launchpad badge
- **Bisect + Reflog + LFS + Submodule + Worktree (Lock/Unlock + Agent 모드)**
- **Custom theme JSON** export/import + **Deep linking** `git-fried://`
- **Profiles** (회사/개인 1-click, 무료 — GitKraken 유료 lock)
- **단축키 30+** (`docs/plan/11 §27` 흡수 95%) — Vim nav `J/K/H/L`, `S/U` 단일 stage, `⌘⇧S/U` 전체, `⌘⇧Enter` stage+commit, `⌘⇧M` focus message, `⌘D` diff, `⌘W` close, `⌘=/-/0` zoom, `⌘J/⌘K` 패널, `⌘⌥F` 필터, `⌥O` 파일매니저, `F11` 전체화면, `⌘⇧H` file history, `?` 도움말

## 기술 스택

| 항목 | 선택 |
| ---- | ---- |
| 앱 셸 | Tauri 2 (Windows 우선, macOS/Linux v1.x) |
| 백엔드 | Rust (`git2-rs` + git CLI hybrid) |
| 프론트 | Vue 3 + Vite + Pinia + Vue Query + Tailwind |
| 에디터 | CodeMirror 6 (+ merge view) |
| DB | SQLite (`sqlx`) |
| 인증 | OS keychain (`tauri-plugin-keyring`) |
| 그래프 | Canvas 2D + pvigier "straight-line lane" |
| AI | **Claude CLI / Codex CLI subprocess** (자체 LLM 인프라 없음, BYOK 거부) |
| 라이선스 | MIT (잠정, 수익 모델 v1.x 검토) |

## 빠른 시작 (개발자)

```bash
git clone https://github.com/tgkim/git-fried
cd git-fried
bun install
bun run tauri:dev   # 개발 (HMR ~1s)
bun run tauri:build # 프로덕션 (Windows MSI / NSIS)
```

요구사항: Windows 11 (현재 1순위), Bun ≥ 1.1.0, Rust ≥ 1.77.

## 다운로드 (사용자)

v1.0 첫 public release 준비 중 (`docs/plan/19`). EV 인증서 + GitHub Actions release workflow 구성 후 출시.

## 알려진 한계

- Windows-only (v1.x 에서 macOS / Linux 추가, [`docs/plan/17 §4-5`](docs/plan/17-v1.x-roadmap.md))
- AI 기능은 `claude` 또는 `codex` CLI 별도 설치 + 인증 필요
- BYO Cloud 미지원 — Cloud Workspace / Cloud Patches / Browser Extension / GitLens 모두 의도적 거부 ([`docs/plan/01 §5`](docs/plan/01-why-and-positioning.md))

## Plan / 문서

| # | 문서 | 내용 |
| - | ---- | ---- |
| 00 | [overview](./docs/plan/00-overview.md) | 30초 요약 + 인덱스 |
| 01 | [why-and-positioning](./docs/plan/01-why-and-positioning.md) | 왜 만드는가 / GitKraken 4 약점 |
| 02 | [user-workflow-evidence](./docs/plan/02-user-workflow-evidence.md) | 사용자 Git 사용 패턴 실측 |
| 03 | [feature-matrix](./docs/plan/03-feature-matrix.md) | must / nice / skip |
| 04 | [tech-architecture](./docs/plan/04-tech-architecture.md) | Tauri 2 + Rust + Vue |
| 05 | [roadmap](./docs/plan/05-roadmap-v0.1-v1.0.md) | 18개월 마일스톤 |
| 06 | [risks](./docs/plan/06-risks-and-pitfalls.md) | 위험 + 완화 |
| 07 | [design-decisions](./docs/plan/07-design-decisions.md) | UX / 단축키 / 레이아웃 |
| 08 | [references](./docs/plan/08-references.md) | 참고 자료 |
| 09 | [interactive-rebase](./docs/plan/09-interactive-rebase.md) | drag-drop drop/reword/squash/fixup ✅ |
| 10 | [integrated-terminal](./docs/plan/10-integrated-terminal.md) | xterm.js + pwsh ✅ |
| 11 | [gitkraken-benchmark](./docs/plan/11-gitkraken-benchmark.md) | GitKraken 12.0 UI/UX 분해 + 흡수 catalog (95% ✅) |
| 12 | [ui-improvement-plan](./docs/plan/12-ui-improvement-plan.md) | Sprint A~M 작업계획 (43 항목 완료) |
| 13 | [implementation-vs-plan-diff](./docs/plan/13-implementation-vs-plan-diff.md) | 구현 vs 계획 정밀 diff |
| 14 | [additional-gitkraken-gaps](./docs/plan/14-additional-gitkraken-gaps.md) | 잔여 catalog 22 항목 (Sprint A14 ✅) |
| 15 | [quality-cleanup](./docs/plan/15-quality-cleanup.md) | 품질 cleanup (Sprint 1 P0 ✅) |
| 16 | [line-stage-v2](./docs/plan/16-line-stage-v2.md) | Line-level stage v2 ✅ |
| 17 | [v1.x-roadmap](./docs/plan/17-v1.x-roadmap.md) | EV / Sentry / macOS / Linux / OAuth / 수익 |
| 18 | [dogfood-feedback](./docs/plan/18-dogfood-feedback.md) | dogfood template |
| 19 | [v0.3-release-prep](./docs/plan/19-v0.3-release-prep.md) | release 준비 (현재 진행) |
| 20 | [performance-benchmark](./docs/plan/20-performance-benchmark.md) | baseline 측정 |

## 기여 / 이슈 / 보안

- **버그**: [GitHub Issues](https://github.com/tgkim/git-fried/issues) `bug` 라벨
- **기능 요청**: [GitHub Discussions](https://github.com/tgkim/git-fried/discussions) `Ideas`
- **보안 취약점**: [SECURITY.md](SECURITY.md) 참조 (공개 이슈 금지)
- **PR**: [CONTRIBUTING.md](CONTRIBUTING.md) — 한글 round-trip 회귀 테스트 통과 필수, `Co-Authored-By: Claude` trailer 금지

1인 개발 + AI pair (Claude Opus 4.7 1M context) 모델로 운영 — 응답 시간 1주 이상 소요.

## 라이선스

[MIT](LICENSE) (잠정, v1.6 에서 Fair Source 또는 Solo 무료 + Team 유료 Pro tier 검토).
