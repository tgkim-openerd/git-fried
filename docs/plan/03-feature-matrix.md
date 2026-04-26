# 03. 기능 매트릭스 — must / nice / skip

GitKraken 의 모든 기능을 우리가 구현할지 / 미룰지 / 버릴지 매핑. 결정 근거 포함.

## 표기

- **must (M)**: v0.1 이전 필수
- **next (N)**: v0.2~0.3
- **late (L)**: v1.0+
- **skip (S)**: 영구 제외 또는 OS / 외부 도구로 위임

## 1. 코어 Git 기능

| 기능 | GitKraken | 우리 | 결정 근거 |
|---|---|---|---|
| Repo add / clone | ✅ | **M** | 기본 |
| Status / Stage hunk / Commit | ✅ | **M** | 기본 |
| Push / Pull / Fetch | ✅ | **M** | 기본 |
| Branch list / switch / create / delete | ✅ | **M** | 기본 |
| Commit graph (lane) | ✅ 최상급 | **M** | pvigier straight-line 알고리즘 |
| Diff viewer (side-by-side / inline) | ✅ | **M** | CodeMirror 6 |
| File history | ✅ | **N** | v0.2 |
| Blame (inline + 패널) | ✅ | **N** | v0.2 |
| Stash list / apply / drop / show diff | ✅ | **M** | 사용자 자주 사용 |
| Tag / Release | ✅ | **N** | release-please 봇과 통합 |
| Reset / Revert | ✅ | **M** (단순) / **N** (interactive) | 단순 reset 은 v0.1 |
| Cherry-pick (단일) | ✅ | **N** | v0.2 |
| Cherry-pick (멀티 레포 동시) | ❌ | **N+** | 우리 차별화, v0.3 |
| Interactive rebase (drag-drop) | ✅ | **N** | v0.2, GitKraken 베끼기 |
| Merge | ✅ | **M** (수동) / **N** (3-way editor) | conflict editor v0.2 |
| 3-way merge conflict editor | ✅ | **N** | CodeMirror merge view |
| Submodule init/update/diff | ✅ (약함) | **M** | 사용자 6/6 사용 |
| Worktree 매니저 | ❌ (CLI만) | **N** | 사용자 8개 동시 사용 |
| LFS (track / fetch) | ✅ (느림) | **N** | git-lfs 직접 호출 |
| GPG / SSH commit signing | ✅ | **N** | 토글 + 상태 인디케이터 |
| Hooks (pre-commit 결과 표시) | △ | **N** | lefthook/husky 결과 패널 |
| Bisect | ✅ | **L** | 사용자 안 씀 |
| Reflog | ✅ | **L** | 사용자 안 씀 |
| Patch (format / apply) | ✅ | **L** | 정직히 외부 |

## 2. 멀티 레포 / 워크스페이스

| 기능 | GitKraken | 우리 | 결정 근거 |
|---|---|---|---|
| Multi-repo 사이드바 | ✅ Cloud Workspace | **M** (로컬 우선) | 회사 50+ 레포 시나리오 |
| 듀얼 레포 동시 표시 (`frontend` + `frontend-admin`) | △ | **M** | 사용자 패턴 직접 지원 |
| 일괄 fetch / pull / status | ✅ | **M** | 멀티 레포 핵심 가치 |
| Launchpad (모든 레포 PR 통합) | ✅ | **N** | 회사 PR 가시성 |
| 레포 그룹 / 태그 | ✅ | **N** | rf vs 01.Projects 구분 |
| 클라우드 동기화 (Cloud Workspace) | ✅ | **S** | 보안정책 / 신뢰 이유로 명시 거부 |
| 공유 워크스페이스 (팀 설정) | ✅ (Business+) | **L** | v1.0+ 유료 기능 후보 |

## 3. Forge 통합 (Gitea / GitHub / GitLab)

| 기능 | GitKraken Gitea | 우리 Gitea | 우리 GitHub |
|---|---|---|---|
| PR list (read) | ❌ | **M** | **M** |
| PR detail + diff | ❌ | **M** | **M** |
| PR 생성 | ❌ | **M** | **M** |
| PR 코멘트 / Review (Approve/Request) | ❌ | **N** | **N** |
| PR 머지 (앱에서) | ❌ | **N** | **N** |
| Issue list / detail | ❌ | **N** | **N** |
| Issue 생성 (브랜치명에서 자동) | ❌ | **N** | **N** |
| Releases | ❌ | **N** | **N** |
| Webhook / CI 상태 표시 | ❌ | **N** | **N** |
| Bot PR 그룹핑 (release-please / dependabot) | ❌ | **N** | **N** |
| OAuth 로그인 | △ | **L** (PAT 우선) | **L** (PAT 우선) |

> **핵심**: GitKraken 이 Gitea 에서 0점인 줄에 우리는 전부 채워 넣는다. 이게 1차 차별 가치 전부.

## 4. UX / 생산성

| 기능 | GitKraken | 우리 |
|---|---|---|
| Command Palette (⌘P) | ✅ | **N** (v0.2) |
| 풍부한 단축키 | ✅ | **M** (GitKraken 기본 베끼기) |
| Theme (light / dark / 사용자) | ✅ | **M** (light/dark만 v0.1, 사용자 v1) |
| Profiles (개인↔회사 1-click) | ✅ (유료) | **N** (v0.3, 무료) |
| Search (commit / file / branch) | ✅ | **N** (SQLite FTS5, v0.3) |
| Notification / Toast | ✅ | **M** (Tauri notification) |
| Command line / 통합 터미널 | ✅ | **L** (OS 터미널 위임 우선) |

## 5. AI / 부가 기능

| 기능 | GitKraken | 우리 |
|---|---|---|
| AI commit message | ✅ (Gemini 기본) | **N** (Claude CLI / Codex CLI subprocess, v0.2) |
| AI merge conflict 추천 | ✅ | **L** (v1.0, Claude/Codex CLI) |
| AI PR 본문 생성 | ✅ | **N** (Claude CLI / Codex CLI, v0.2) |
| AI 코드 설명 / 리뷰 | ✅ | **L** (v1.0, Claude/Codex CLI) |
| AI 자체 LLM 인프라 (BYOK API / Ollama 통합) | ✅ | **S** — 사용자 CLI 위임으로 대체 |
| Cloud Patches (공유 패치) | ✅ | **S** (`git format-patch` 면 충분) |
| Issue 트래커 통합 (Jira/Trello) | ✅ | **S** (Gitea/GitHub Issues 만 1급) |
| GitKraken CLI (`gk`) 연동 | ✅ | **S** |
| Agent Session Management (병렬 코딩) | ✅ (11.x) | **S** (스코프 폭발) |
| Diagram (FigJam-like) | ✅ (Cloud) | **S** |

## 6. 인프라 / 운영

| 기능 | 우리 결정 |
|---|---|
| 자동 업데이트 | **M** (Tauri updater + GitHub Releases) |
| 코드 서명 (Win) | OV 인증서 v0.x → EV v1+ |
| 코드 서명 (Mac) | Apple Developer 가입 — v1.x 출시 시점 |
| 텔레메트리 / 크래시 리포트 | opt-in only, Sentry self-hosted 검토 |
| 설정 동기화 | **L** (OS file sync 위임) |
| 다국어 (i18n) | **N** (한 → 영, v0.3) |
| 접근성 (a11y) | **M** (WAI-ARIA 기본 준수) |

## 7. 결정 정리 (v0.1 ~ v1.0)

### v0.1 must-have (M) 합산 — 6개월 안에 끝낼 것
- Repo add/clone
- Status/Stage hunk/Commit (한글 file-based)
- Push/Pull/Fetch
- Branch list/switch/create/delete
- Commit graph (straight-line lane)
- Diff viewer (side-by-side)
- Stash 매니저
- Submodule init/update/diff
- Reset (단순)
- Multi-repo 사이드바 (듀얼 레포 포함)
- 일괄 fetch/pull/status
- Gitea PR list/detail/생성
- GitHub PR list/detail/생성
- Theme (light/dark)
- 단축키 + 토스트
- 자동 업데이트

→ **약 16개 기능 그룹**. 1인 6개월에 빠듯하지만 가능.

### v0.2 next (N) — M7~M9
- Interactive rebase (drag-drop)
- 3-way merge editor
- File history / Blame
- Worktree 매니저
- Cherry-pick (단일)
- Command Palette
- GPG signing 토글
- Pre-commit 결과 패널
- Tag/Release 보기
- Launchpad (모든 PR 한눈에)
- 레포 그룹/태그
- PR 코멘트/리뷰

### v0.3 next+ (N+) — M10~M12
- Profiles
- AI commit message (BYOK)
- 멀티 레포 동시 cherry-pick
- SQLite FTS5 검색
- Issues
- Releases
- Bot PR 그룹핑
- macOS 베타
- i18n (한/영)

### v1.0 late (L) — M13~M18
- Linux
- 팀 워크스페이스 (유료)
- AI merge conflict 도움
- OAuth (Gitea / GitHub)
- LFS 안정화
- 통합 터미널 (옵션)

---

다음 문서 → [04-tech-architecture.md](./04-tech-architecture.md)
