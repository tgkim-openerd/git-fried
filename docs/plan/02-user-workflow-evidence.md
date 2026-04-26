# 02. 사용자 Git 사용 패턴 — 실측 증거

본 문서는 사용자(tgkim) 의 실제 작업 디렉토리(`D:\01.Work\08.rf` + `D:\01.Work\01.Projects`) 를 분석한 데이터다. 가설이 아니라 측정값이다. 모든 기능 결정의 근거가 된다.

## 1. 분석 표본

- 개인(GitHub) 7개 + 회사(Gitea) 13개 sub-repo, 총 20개 레포
- 누적 커밋 ~5,500개
- 분석 기준일: 2026-04-26

## 2. 사용자 프로필

| 축 | 측정값 | 시사점 |
|---|---|---|
| 회사 vs 개인 비율 (코드량) | **8 : 2** | 회사 워크플로우가 메인 페르소나 |
| 주력 스택 | Nuxt 3 / Vue + Bun + TS, gRPC + OpenAPI | JS/TS 친화 GUI 가산점 |
| 듀얼 레포 패턴 | `frontend` + `frontend-admin` (peeloff/ankentrip/airian/cellreturn) | **multi-repo 사이드바 필수** |
| Conventional Commits 비율 | 회사 80%, 개인 90%+ | `feat:/fix:/...` prefix 빌더 가치 큼 |
| 한글 커밋 비율 | 회사 55~72%, 개인 0~35% | **UTF-8 안전 입력 필수**. CP949 mangle 차단. |
| 작업 시간대 | 14~18시 집중, 야간 burst 거의 없음 | 워킹아워 1인 개발자 |
| GPG signing | global `commit.gpgsign=true`인데 회사 PR merge commit 미서명 | **서명 상태 인디케이터 필요** |
| AI 사용 흔적 | Claude Code trailer 870회+, `claude/*`, `worktree-agent-*` 브랜치 prefix | **AI 워크플로우 + worktree 1급 시민** |

## 3. 핵심 워크플로우 Top 5 (실측 기반)

### W1. `feat|fix|chore|issue/<slug>` → PR(Gitea) → traditional merge → main
- 회사 레포의 머지 커밋 비율: peeloff 4%, ankentrip 22%, ptcorp-eosikahair 21%, catholic-erp 16%
- **squash/rebase merge 안 씀** — traditional merge 가 디폴트
- → 우리 앱은 squash 강제 UI 가 아니라 **merge strategy 선택 라디오**, 디폴트는 traditional

### W2. Worktree 병렬 작업 (AI 에이전트와 함께)
- **8개 동시 worktree** 발견: gist-broadcenter, ptcorp-eosikahair
- 브랜치명 `worktree-agent-<hex>` → AI 에이전트가 자동 worktree 생성
- → **Worktree 매니저 1급 UI** (생성/삭제/스위치 + 디스크 사용량 + 어떤 에이전트가 점유 중인지)

### W3. Template 동기화 (cross-repo cherry-pick)
- 거의 모든 회사 레포에 `chore/sync-template`, `chore/sync-template-infra`, `chore/sync-template-backport` 브랜치
- `27.template_work-dir` 가 SoT, 다른 프로젝트로 cherry-pick / merge 전파
- → **다중 레포 동시 cherry-pick UI** (한 commit을 N개 레포에 동시 적용)

### W4. Submodule + LFS 풀스택
- 회사 sub-repo **6/6 모두 submodules + LFS** 보유 (proto 정의, design assets)
- GitKraken 의 submodule UX 약점 + LFS 2-10x 슬로우다운이 결정적
- → **Submodule 매니저 1급 UI** (init/update/diff/sync, 부모 레포 status 와 통합 표시)

### W5. Release-please 자동 PR + 시맨틱 태그
- mock-fried `v1.0.2 ~ v1.5.0` 15개 태그, release-please bot 이 PR 생성
- → **봇 PR 그룹핑 + 태그·릴리즈 노트 보기**

## 4. 절대 빼먹으면 안 되는 기능 Top 10

| # | 기능 | 근거 | v 우선순위 |
|---|---|---|---|
| 1 | **Submodule init/update/diff 1-click** | 회사 6/6 사용 | v0.1 |
| 2 | **Worktree 매니저** | 8개 동시 사용 흔적 | v0.2 |
| 3 | **Conventional Commits 빌더** | 80% 일관 사용 | v0.1 |
| 4 | **한글 커밋 안전 입력 (UTF-8 file-based)** | CP949 영구 mangle 사례 | v0.1 |
| 5 | **Multi-repo 사이드바 (듀얼 레포)** | frontend+admin 패턴 | v0.1 |
| 6 | **GPG signing 상태 + 토글** | 회사 PR merge 미서명 이슈 | v0.2 |
| 7 | **lefthook/husky pre-commit 결과 패널** | lint-staged 실패 가시화 | v0.2 |
| 8 | **PR 생성 (Gitea + GitHub 동시)** | gh CLI + Gitea API | v0.1 |
| 9 | **Stash 매니저 with diff preview** | 회사 레포당 1~5개 stash | v0.1 |
| 10 | **Sync-template / 다중 레포 cherry-pick** | 회사의 핵심 운영 패턴 | v0.3 |

## 5. 무시해도 되는 기능 Top 5

| # | 기능 | 근거 |
|---|---|---|
| 1 | GitFlow / develop·release 브랜치 시각화 | 사용자 거의 안 씀 (47.nobletrip 예외) |
| 2 | Interactive rebase GUI | 흔적 거의 없음 |
| 3 | Bisect UI | 표본 0개 |
| 4 | Reflog 시각화 | 표본 0개 |
| 5 | Commit graph "Pretty mode" 대형 시각화 | 60% 머지율 → 어차피 거미줄, 평면 리스트가 더 유용 |

> **단**, 위 5개 중 Interactive rebase / Reflog 는 GitKraken 사용자 마이그레이션 유인책으로 v0.2~0.3 에 추가 검토.

## 6. 한글 / Windows 특수성 Risk Top 3

### R1. Git Bash CP949 mangle (영구 손상)
- 글로벌 `core.quotepath=false`, `core.precomposeunicode=true` 설정에도 PR merge title 에 `���` 출력 사례
- gist-broadcenter `#40` PR — force-push 금지로 영구 손상

**완화 (앱 레벨)**:
- 시스템 Git Bash 우회, 자체 libgit2 + UTF-8 stdout 파이프 디폴트
- 커밋 메시지 / PR body 입력 모두 **file-based** (`git commit -F file`) 디폴트
- child process spawn 시 `LANG=C.UTF-8`, `PYTHONIOENCODING=utf-8` 강제 환경변수
- Rust 측에서 `encoding_rs` 로 명시 디코딩, 절대 OS 기본 인코딩 신뢰 안 함

### R2. `safe.directory` 지옥
- 분석 중 `lootbox`, `git-fried` 등 다수 레포가 `unsafe repository (owned by someone else)` 거부
- Windows 멀티유저 + 외장 D: 드라이브 + Git 2.35+ 정책 충돌

**완화 (앱 레벨)**:
- 워크스페이스 추가 시 자동 `git config --global --add safe.directory <path>` (사용자 동의 후)
- 대안: 앱 내부 git 호출은 `-c safe.directory=*` 플래그 사전 주입

### R3. Credential 평문 누수
- `git remote -v` 에 `https://ghp_...@github.com/...` 토큰 노출 (potluck-invite, itruck-dev `insteadof`)
- Gitea 토큰은 `~/.bashrc` 에 평문

**완화 (앱 레벨)**:
- remote URL 표시 시 토큰 마스킹 (`https://***@github.com/...`)
- OS keychain (Windows Credential Manager) 사용 권장 알림
- `credential.helper=store` (평문) 감지 시 경고 표시
- 앱 내부 토큰은 `tauri-plugin-keyring` 으로 OS keychain 저장

## 7. 측정 데이터 부록

| 레포 | 커밋 | 머지% | conv% | 한글% | stash | branches | worktree |
|---|---|---|---|---|---|---|---|
| ankentrip/frontend | 276 | 22% | 77% | 67% | 1 | 5+ | 1 |
| ankentrip/frontend-admin | 503 | 21% | 78% | 73% | 1 | 10+ | 1 |
| ptcorp-eosikahair/frontend | 675 | 21% | 78% | 59% | 3 | 10+ | **8** |
| catholic-erp/frontend | 657 | 16% | 83% | 72% | 5 | 9+ | 1 |
| peeloff/frontend | 344 | 4% | 87% | 38% | 4 | 8+ | 1 |
| airian/frontend-runnerx-app | 538 | 13% | - | - | 1 | 10+ | 1 |
| gist-broadcenter/frontend | 397 | 23% | - | - | 4 | 10+ | **8** |
| nobletrip/frontend | 123 | 32% | - | - | 0 | 8 | 1 |
| template_work-dir | 227 | 7% | - | - | 1 | 10+ | 1 |
| mock-fried (개인) | 122 | 7% | 92% | **0%** | 0 | 6 | 1 |
| mcp-code-mode-starter | 122 | 4% | 94% | 35% | **3** | 8+ | 1 |
| web-analysis | 168 | 2% | - | - | 0 | 10+ | 1 |
| potluck-invite | 48 | 0% | - | - | 0 | 5 | **3** |

## 8. 핵심 인사이트 (한 줄)

> **회사 모드** = 머지 많음, 한글, submodule + LFS, 듀얼 레포, worktree 8개.
> **개인 모드** = 깨끗한 conventional, 영문, 빠른 OSS 패턴.
>
> 우리 앱은 한 사용자가 두 모드를 매끄럽게 오가는 것이 GitKraken 대비 가장 큰 차별 포인트다. **Profiles** 기능 (1-click 토글)이 핵심.

---

다음 문서 → [03-feature-matrix.md](./03-feature-matrix.md)
