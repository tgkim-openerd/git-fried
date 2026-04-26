# 05. 로드맵 — v0.0 / v0.1 / v0.2 / v0.3 / v1.0

전제: 1인 개발자, 본업 병행, 주 ~15시간, Rust 경험 약간. (시간 가정 변경 시 비례 조정)

## 마일스톤 한눈에

```
M0   M1   M2   M3   M4   M5   M6   M7   M8   M9   M10  M11  M12  M13~M18
│    │    │    │    │    │    │    │    │    │    │    │    │    │
v0.0      ━━━━ v0.1 (read + 일상 워크플로우) ━━━━━│    │    │    │
                                                  │ v0.2 (power user)│
                                                       │ v0.3 (AI/검색/Profiles)│
                                                                       │ v1.0 (안정화/Linux/팀)│
```

---

## v0.0 — Hello World (M0~M1, **5주**, Windows-only)

**목표**: 프로젝트 골격이 동작. "한 레포 add → log 표 → diff 표시" 만 됨.

**전제**: 사용자 Rust 경험 0 → Claude Code / Codex CLI 페어 프로그래밍으로 진행. 별도 학습 sprint 없음. (원래 8주 계획에서 Rust 학습 3주 제거 = 5주)

| 작업 | 시간 | 산출물 |
| --- | --- | --- |
| Tauri 2 + Vue 3 + Vite + Tailwind v4 + shadcn-vue 셋업 | 2일 | `bun create tauri-app --template vue-ts` + shadcn-vue init |
| unplugin auto-import / vue-components / vue-router 셋업 | 0.5일 | `vite.config.ts` |
| Pinia + Vue Query (TanStack) 셋업 | 0.5일 | `stores/`, `api/queryClient.ts` |
| GitHub remote 연결 + MIT 라이선스 + README | 0.5일 | `git@github.com:tgkim/git-fried` |
| GitHub Actions CI (**Windows-only** matrix, macOS/Linux 는 v1.x) | 0.5일 | `.github/workflows/ci.yml` |
| Claude/Codex 페어 프로그래밍 워크플로우 셋업 | 0.5일 | `04 §10` 의 분업 모델 확립 |
| `git2-rs` "Hello Repo" — Repository::open + log 100개 | 2일 | `git/repository.rs` (AI 페어로) |
| sqlite + sqlx 연결, repos 테이블 init | 1일 | `storage/db.rs` |
| Tauri command "add_repo" "list_repos" "get_log" | 2일 | IPC 표준 패턴 확립 |
| Vue 사이드바 (레포 리스트) + 본문 (commit 표) | 3일 | 첫 화면 |
| 한글 인코딩 spawn 표준 함수 + 단위 테스트 | 2일 | 회귀 차단 |
| `safe.directory` 자동 처리 + Windows 환경변수 검증 | 0.5일 | 사용자 13개 레포 dogfood OK |
| README + 스크린샷 + Roadmap 공개 | 0.5일 | OSS 시작 신호 |

**v0.0 done = "내 PC에서 한 레포 등록하고 커밋 log 100개 한글 안 깨지고 보임"**

---

## v0.1 — 일상 워크플로우 (M2~M6, 5개월)

**목표**: GitKraken 일상 사용 70%를 대체. 사용자 본인이 회사 + 개인 50+ 레포를 매일 쓸 수 있음.

### Sprint 1 (M2) — Status + Commit + Push/Pull
| 작업 | 시간 |
|---|---|
| status (working/staged/untracked) 표시 | 3일 |
| stage / unstage / discard (file 단위) | 2일 |
| stage hunk (diff 청크 단위) | 4일 |
| commit (file-based message, 한글 안전) | 2일 |
| push / pull / fetch (CLI shell-out) | 3일 |
| 진행 상황 표시 (push/pull progress) | 2일 |
| Conventional commit 빌더 (prefix + scope picker) | 2일 |

### Sprint 2 (M3) — Branch + Diff + Stash
| 작업 | 시간 |
|---|---|
| branch list / switch / create / delete | 3일 |
| diff viewer side-by-side (CodeMirror 6) | 5일 |
| 파일 트리 (변경 파일 목록) | 2일 |
| stash list / apply / drop / show diff | 2일 |
| reset (mixed/soft/hard 옵션) | 2일 |
| 토스트 / 에러 핸들링 표준 | 2일 |

### Sprint 3 (M4) — Commit Graph
| 작업 | 시간 |
|---|---|
| pvigier straight-line lane 알고리즘 구현 | 6일 |
| Canvas 2D 렌더 + 가상 스크롤 | 5일 |
| 행 클릭 → 커밋 상세 (diff + 파일 트리) | 2일 |
| 검색 (글자만, 인덱스는 v0.3) | 1일 |

### Sprint 4 (M5) — Multi-repo + Submodule
| 작업 | 시간 |
|---|---|
| Multi-repo 사이드바 (워크스페이스/그룹) | 3일 |
| 듀얼 레포 옆-옆 표시 (frontend + frontend-admin) | 3일 |
| 일괄 fetch / pull / status | 2일 |
| Submodule status/init/update + 부모 status 통합 표시 | 4일 |
| safe.directory 자동 등록 + 토큰 마스킹 | 1일 |

### Sprint 5 (M6) — Forge (Gitea + GitHub) PR
| 작업 | 시간 |
|---|---|
| Gitea OpenAPI codegen (`@hey-api/openapi-ts`) | 1일 |
| GitHub `@octokit/types` 셋업 | 0.5일 |
| ForgeClient trait + 통합 PR 모델 | 3일 |
| PR list (현재 레포) | 2일 |
| PR detail + diff (read-only) | 3일 |
| PR 생성 (HEREDOC body, 한글 안전) | 3일 |
| keyring (PAT 저장) + 첫 셋업 마법사 | 2일 |
| Theme (light/dark) + 단축키 (⌘P 제외) | 2일 |
| 자동 업데이트 (GitHub Releases) | 2일 |
| OV 코드 서명 (Win) 셋업 | 1일 |
| 베타 출시 + Discord/GitHub Issues 채널 | 1일 |

**v0.1 done = 사용자 본인이 GitKraken을 끄고 git-fried만 쓰는 게 가능. 일부 기능 빠지지만 대부분 일상 가능.**

---

## v0.2 — Power User + AI 페어 통합 (M7~M9, 3개월)

**목표**: GitKraken 의 power user UX를 따라잡음 + Claude/Codex CLI 통합으로 AI 차별화.

| 영역 | 작업 |
| --- | --- |
| **Interactive rebase** | drag-drop reorder + squash + fixup + reword. plumbing(`git rebase --interactive`) 직접 호출, 인터랙션은 GUI 화면. |
| **3-way merge editor** | CodeMirror merge view, current/incoming/result 패널. `git mergetool` 외부 호출 옵션도 제공. |
| **Worktree 매니저** | 생성/삭제/스위치, 디스크 사용량, 어떤 브랜치/AI agent 점유 중인지 표시. |
| **Cherry-pick** | 단일 커밋 cherry-pick. 멀티 레포는 v0.3. |
| **Command Palette ⌘P** | 모든 신규 액션은 palette 등록 게이트. |
| **File history / Blame** | 우클릭 메뉴, 패널 표시. blame은 git CLI 사용 (libgit2 느림). |
| **GPG signing** | 토글 + 상태 인디케이터. 회사 PR merge unsigned 경고. |
| **AI commit message** | staged diff → Claude/Codex CLI subprocess → conventional commit 한국어 제안. `04 §11` 표준 spawn 사용. |
| **AI PR body 생성** | branch commits + diff stat → CLI → 한국어 PR body. 사용자 CLAUDE.md 의 trailer 금지 룰 자동 적용. |
| **AI CLI 감지 + 셋업 마법사** | PATH 에서 `claude`/`codex` 자동 감지, 인증 상태 캐시, 미설치 시 안내. |
| **Tag/Release 보기** | 로컬 + 원격 통합. release-please 봇 PR 그룹핑. |

**v0.2 done = GitKraken에서 사용자가 그리워할 만한 것이 거의 없음 + 사용자 본인 Claude Code 환경이 commit/PR 작성에 자연스럽게 통합됨.**

---

## v0.3 — 검색 / Profiles / sync-template (M10~M12, 3개월)

**목표**: 차별화 마무리. v1.0 안정화 진입 준비.

| 영역 | 작업 |
| --- | --- |
| **Profiles** | 개인↔회사 1-click 토글. `user.name/email/signing_key/SSH 키/forge account` 묶음. 무료. |
| **Multi-repo cherry-pick** | 한 commit을 N개 레포에 동시 적용. 사용자의 sync-template 워크플로우 1급. |
| **SQLite FTS5 검색** | commit message / file path / branch. 한글 토크나이저 (`unicode61 remove_diacritics 2`). |
| **Issues** | Gitea + GitHub Issues list/detail/create. 브랜치명에서 issue 자동 링크. |
| **Releases** | 릴리즈 노트 viewer + 생성. release-please 봇과 통합. |
| **Bot PR 그룹핑** | dependabot/release-please/renovate PR을 그룹화 표시. |
| **i18n (한/영)** | UI 한국어 첫 번째, 영어 두 번째 (글로벌 OSS 진출 준비). |

**v0.3 done = 한국 시장 1급. 사용자 본인이 일상 100% git-fried 로 처리 가능.**

---

## v1.0 — 안정화 + Pre-commit + Launchpad + AI 확장 (M13~M18, 6개월, **Windows-only**)

**목표**: 안정화, 회사 워크플로우 마무리(pre-commit / Launchpad), AI 페어 확장.

| 영역 | 작업 |
| --- | --- |
| **Pre-commit hook 결과 패널** | lefthook/husky 실행 결과 stream. `--no-verify` 유혹 차단 UI. |
| **PR 리뷰** | Approve / Request changes / 라인 코멘트. Gitea + GitHub. |
| **Launchpad** | 워크스페이스 모든 레포의 PR/Issue/CI 상태 한 보드. Gitea 1급. |
| **AI merge conflict 도움** | conflict 청크 → Claude/Codex CLI → 추천 + 근거 (사용자 선택). |
| **AI 코드 리뷰** | branch diff → CLI → 인라인 코멘트 후보. 보안/성능/한글/에러 처리 관점. |
| **LFS 안정화** | 진행 표시 + bandwidth 제한 옵션. |
| **Bisect / Reflog** | 사용자 본인은 안 쓰지만 GitKraken 마이그레이션 유인. |
| **EV 코드 서명 (Win)** | SmartScreen 평판 즉시 통과. |
| **Sentry self-hosted (opt-in 텔레메트리)** | 크래시 리포트. |
| **통합 터미널 (옵션)** | xterm.js, 디폴트는 OS 터미널 위임. |

**v1.0 done = Windows 한국 GUI 시장 1위 후보, 사용자 본인 회사 + 개인 100% 일상 사용, 글로벌 OSS 인지도 확보.**

---

## v1.x — 플랫폼 확장 / 수익화 검토 (M19+)

**목표**: macOS / Linux / OAuth / 수익화. v1.0 안정화 후 별도 의사결정.

| 영역 | 작업 | 판단 시점 |
| --- | --- | --- |
| **macOS** | Apple Developer 가입($99/yr), notarization, .dmg, universal-apple-darwin 빌드 | v1.0 출시 후 사용자 요청 누적 시 |
| **Linux** | AppImage + flatpak. WebKitGTK 4.1 검증 | v1.0 출시 후 |
| **OAuth (Gitea + GitHub)** | PAT 외 OAuth 로그인 옵션 | macOS 출시 시점 |
| **수익 모델 검토** | 옵션 1: 순수 OSS 유지 / 옵션 2: 팀 워크스페이스 유료 (GitButler 모델) / 옵션 3: pro 기능 유료 | v1.0 + 6개월 사용자 수 보고 |
| **공유 워크스페이스** | 회사 50+ 레포 공유 설정 (`.git-fried/team.json`), 멤버 초대 | 수익 모델 결정 후 |
| **유료 결제 (옵션)** | Stripe / 라이선스 키 발급 / 오프라인 검증 | 수익 모델 결정 후 |
| **AI Agent Session** | GitKraken 11.x 형 병렬 코딩 에이전트 통합 | 시장 검증 후 |

---

## 작업 의존성 다이어그램

```
v0.0 골격
   │
   ├─→ status/commit (S1) ─→ branch/diff/stash (S2)
   │                              │
   │                              └─→ commit graph (S3)
   │                                      │
   ├─→ multi-repo + submodule (S4) ───────┤
   │                                      │
   └─→ Gitea/GitHub PR (S5) ──────────────┴─→ v0.1 출시

v0.1 → v0.2:
   commit graph + branch ─→ rebase / cherry-pick
   diff ─────────────────→ 3-way merge editor
   sub/multi-repo ──────→ worktree manager / Launchpad

v0.2 → v0.3:
   PR + Profiles ──────→ multi-repo cherry-pick
   index 기반 ─────────→ FTS5 검색
   diff + commit ──────→ AI commit message

v0.3 → v1.0:
   Profiles + 워크스페이스 ─→ 팀 워크스페이스 (유료)
   macOS ──────────────────→ Linux
```

## 측정 가능한 목표 (각 마일스톤)

| 마일스톤 | 사용자 (자가 검증) | OSS (외부 검증) |
|---|---|---|
| v0.0 | 1 (사용자 본인) | GitHub Stars 0 |
| v0.1 | 1 (사용자가 GitKraken을 끔) | Stars 50, Issues 5 |
| v0.2 | 5~10 (한국 OSS 커뮤니티) | Stars 300, Issues 30 |
| v0.3 | 50~100 | Stars 1k, Issues 100 |
| v1.0 | 500~1000 (유료 30~50) | Stars 3k+, 첫 매출 |

> 이 숫자는 GitButler/Gitnuro 1년차 트랙 기준 보수적 추정.

## 출시 전략

- **v0.0 / v0.1**: GitHub README 공개. Reddit r/git, r/koreadevs, GeekNews 한국어 게시.
- **v0.2**: 한국 OSS 모임 (FEConf, JSConf KR) 발표 신청.
- **v0.3**: HackerNews "Show HN" + GitKraken/Gitea 커뮤니티 게시.
- **v1.0**: ProductHunt 런칭 + 한국 IT 미디어 (요즘IT, 디지털인사이트) 기고.

---

다음 문서 → [06-risks-and-pitfalls.md](./06-risks-and-pitfalls.md)
