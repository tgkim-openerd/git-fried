# Changelog

All notable changes to git-fried will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sprint 22-4 — P1 ContextMenu 6 + P1 viewer 3 (`docs/plan/22 §22-4`, V-5 이월):
  - **CM-6 Sidebar repo row** — Open in Explorer / Copy path / Set as active / Fetch only this / Pin / Set alias / Run gc (submenu: gc, gc --aggressive ⚠) / Remove from workspace (destructive)
  - **CM-7 RepoTabBar tab** — Close / Close others / Close all (destructive) / Move left / Move right (`store.reorderTabs` 활용)
  - **CM-8 TagPanel tag row** — Push to origin / Checkout (detached HEAD) / Create branch from / Copy commit SHA / Delete local / Delete remote (destructive)
  - **CM-9 PrPanel PR row** — Open detail / Open in browser / Pin (useLaunchpadMeta) / Snooze submenu (1h/1d/1w/1m, 또는 해제) / Copy URL / Copy PR # / Copy branch
  - **CM-10 ReflogModal entry** — Show diff (emit) / Restore HEAD here (reset --mixed, destructive) / Copy SHA / Create branch here
  - **CM-11 WorktreePanel row** — Open in Explorer / Switch / Lock·Unlock toggle / Remove (destructive, main 불가)
  - **V-3 CommitDiffModal header action group** — 🍒 Cherry-pick / ↩ Revert / Reset (mode dropdown soft·mixed·hard ⚠), `useCommitActions` 재사용
  - **V-4 TagPanel tag click → inline annotated viewer** — row click 으로 expand 영역 (annotated/lightweight 뱃지 + full SHA + subject `<pre>` + 우클릭 안내)
  - **V-6 ReflogModal row click + dblclick + 우클릭** — selectedSha highlight + `emit('showDiff', sha)` (App.vue listen 은 차후) + CM-10 메뉴
  - V-5 (StatusPanel file detail side-panel) 은 22-7 또는 별도 sprint 로 이월 — 우측 detail 영역 점유 정책 결정 필요 (focusMode 와 충돌 가능성)
  - 검증: typecheck 0 / lint 0 / vitest 13 pass
- Sprint 22-3 — UI Polish v2 깊은 메뉴 + Viewer (`docs/plan/22 §22-3` ✅):
  - **CM-5 BranchPanel 우클릭 11 액션** — Checkout / Create from / Rename / Delete (destructive) / Merge into HEAD / Rebase HEAD onto / Hide / Solo / Compare / Push / Set upstream
    - 신규 `apps/desktop/src/composables/useBranchActions.ts` (`useCommitActions` 패턴 + `localBranchName` helper export)
    - `BranchPanel.vue` `@contextmenu` + `<ContextMenu>` 통합. hide/solo/compare 는 callback (useHiddenRefs / `window.gitFriedOpenCompare`)
  - **V-1 CommitGraph + CommitTable row dblclick → CommitDiffModal** auto-open. ⌘D 단축키와 동일 액션 (`emit('show-diff', sha)` → pages/index.vue `onShowDiff`)
  - **V-2 PrDetailModal Files Changed tab** —
    - Backend: `forge::PrFile` 모델 + `ForgeClient::list_pr_files` trait + GitHub/Gitea 구현 (`GET /repos/{o}/{r}/pulls/{n}/files` per_page=100)
    - IPC: `list_pr_files` command (lib.rs invoke_handler 등록 → 156 commands)
    - Frontend: `listPrFiles` API + Conversation/Files tab + 파일별 status 뱃지 (A/M/D/R/C) + +/- 카운트 + DiffViewer (CodeMirror unified diff) per-file expand/collapse + Expand all / Collapse all + binary/large file 안내
  - 검증: typecheck 0 / lint 0 / vitest 13 pass (cargo check 는 환경 base64ct edition 2024 이슈로 보류 — CI 검증 권장)
- Sprint 23 — Design System Extraction (`docs/plan/23` + `docs/design-context/` + Playwright 자동 캡처):
  - `docs/plan/23-design-system-extraction.md` 신규 — Phase 1 (4 병렬 에이전트: Token/Component/Flow/Codex Intent) → Phase 2 (6 문서 통합) → Phase 3 (Handoff A/B/C 옵션) 절차서
  - **Phase 3 옵션 B 완료** — Playwright 자동 캡처 36 화면 (`docs/design-context/screenshots/*.png`):
    - `apps/desktop/src/api/devMock.ts` 신규 — 25+ command fixture (한글 commit, 듀얼 워크스페이스, ahead-behind, conflict). `import.meta.env.DEV` AND `window.__TAURI_INTERNALS__` 부재 시만 활성 (production / 실 Tauri 자동 우회)
    - `apps/desktop/src/api/invokeWithTimeout.ts` 에 `isMockEnabled()` 가드 dev-only mock branch 추가
    - `bun add -D playwright` + Chromium 설치
    - `scripts/capture-screens.ts` 신규 — 1440×900 ko-KR, light/dark, sidebar 첫 레포 자동 활성, 단축키 dispatch (⌘P / ⌘N / ⌘⇧H / ⌘⇧P / ⌘D / ⌘B / ⌘3 / ?) + palette fuzzy search (bisect / 비교 / reflog / rebase / template) + 탭 클릭 (Sub / LFS / WT / Tag / Issue / Release) + Settings nav 8 카테고리
    - **36 PNG** 카테고리:
      - 페이지 3 × light/dark = 6장 (메인 / launchpad / settings)
      - 우측 메인 탭 패널 6장 (BranchPanel / StashPanel / PR / Submodule / LFS / Worktree)
      - ForgePanel sub-tab 3장 (Tag / Issue / Release)
      - Settings 카테고리 8장 light (Profiles 외 forge / general / ui / editor / repo-specific / 유지보수 / 마이그레이션 / about)
      - Modal 11장 (CommandPalette / HelpModal / CommitDiffModal Inline + Split / CreatePr / FileHistory / RepoSwitcher / Bisect / Compare / Reflog / Rebase / SyncTemplate / CloneRepo)
    - `03-screens-and-flows.md` § 0 스크린샷 인덱스 + § 1·2·3 인라인 임베드 / `README.md` 캡처 환경 + 36 화면 인덱스 추가
  - `docs/design-context/` 신규 7 문서 패키지:
    - `00-product-brief.md` — 제품 정체성 / 페르소나 (회사 Gitea + 개인 GitHub 듀얼 포지) / 톤앤매너 (dense·calm·professional·instrumented)
    - `01-design-tokens.md` — `tailwind.config.ts` + `src/styles/main.css` 1:1 추출 + W3C Design Tokens JSON + secondary/muted/accent 동일 HSL 결함 식별
    - `02-component-inventory.md` — 48 컴포넌트 + 18 모달 카탈로그 + BaseModal/useFocusTrap/aria-modal/reka-ui Dialog 부재 5필드 검증
    - `03-screens-and-flows.md` — 3 페이지 layout + 18 모달 entry/state/exit + 37 CommandPalette + 17 ContextMenu (P0 5/P1 6/P2 3) + 15 Click→Detail
    - `04-interaction-patterns.md` — 키보드 modifier 표기 / 한글 visual width (CJK=2, 36자=72) / drag&drop / skeleton / a11y / IPC 5min progress
    - `05-figma-handoff-brief.md` — Claude Design 작업 의뢰 prompt + 5 sprint × 27 deliverable (D25~D27 추가: Layout extensibility audit / Plugin slot / 미구현 placeholder) + 8 결정 필요 Q&A
    - `06-gitkraken-feature-parity.md` — GitKraken 기능 ≈87 catalog (✅52 구현 / ⚠️10 부분 / 🔜15 v0.4~v1.0 예정 / ❌10 의도적 skip) + 4 design hard constraint (Layout extensibility / Density 강제 / Plugin slot / 미구현 placeholder 정책). plan/03 + plan/14 + plan/22 합본
    - `00-product-brief.md` § 4-2 "Feature Parity Ambition" + § 8 Anti-Goals 보강 (minimal-leaning / GitKraken visual 모방 / 고정 카운트 가정)
    - `README.md` — 인덱스 + 권장 읽기 순서 + Handoff 옵션 (A 문서만 / B 스크린샷 / C Figma MCP)
- Sprint A14 (`docs/plan/14`):
  - `⌘⇧H` File history search 단축키 (StatusPanel)
  - Stash 단일 파일 apply (`git/stash.rs::apply_stash_file` + `StashPanel.vue` 미리보기에 파일별 row + "이 파일만 apply")
  - Compare branches/commits (`git/compare.rs` + `CompareModal.vue` + Command Palette "Compare — 두 ref 비교")
- Sprint 2 quality (`docs/plan/15 §5`):
  - `STALE_TIME` 3-tier 정책 (REALTIME 2s / NORMAL 30s / STATIC 60s) — `api/queryClient.ts` 상수 + 6 composable 명시 적용 + 기본값 NORMAL
  - 11 mutation 에 `onError → toast.error + describeError` 통합 (useHiddenRefs 5 / useLaunchpadMeta 2 / useSavedViews 2 / useRepoAliases 2)
  - `src/types/window.d.ts` 신규 — `window.gitFried*` augmentation, 8건의 `as unknown as` 제거 (App / Sidebar / CommandPalette / InteractiveRebaseModal / pages/index)
  - `tsconfig.json` `noUnusedLocals / noUnusedParameters` true 활성화 + 위반 3건 정리
- Performance bench 도구 (`docs/plan/20 §3`):
  - `apps/desktop/src-tauri/benches/git_perf.rs` — criterion bench (read_status / list_branches / compute_graph 1k+10k), `BENCH_REPO` 환경변수로 대상 repo 지정
  - Cargo.toml `[dev-dependencies] criterion 0.5` + `[[bench]] name = "git_perf"`
  - `bench/memory.ps1` — Windows RSS / Private / Handles 6 시나리오 snapshot
  - `bench/baseline.json` — schema (memory / graph / ipc / ai / bulk + regression_threshold_pct=20), null placeholder
  - `bench/README.md` — 도구 사용법
  - `release.yml` 에 optional `cargo bench` step (BENCH_REPO secret 있을 때만 실행, 없으면 자동 skip)
- Sprint 22-2: ContextMenu 공용 + CM-1~4 (`docs/plan/22 §3`):
  - 신규 `ContextMenu.vue` 공용 컴포넌트 — Teleport + 키보드 nav (↑↓ Enter Esc, ← submenu 닫기, → submenu 진입) + submenu 1 depth + viewport edge 회피 + outside-click close + destructive 색상 분리
  - 신규 `useCommitActions` composable — copySha / cherryPick / revert / reset(soft/mixed/hard) / createBranchFrom / createTagFrom + buildItems(callbacks) (CM-1+CM-2 공유)
  - **CM-1 CommitGraph row** 우클릭 메뉴 (10 액션: Show diff / Copy SHA / Cherry-pick / Revert / Reset submenu / Create branch / Create tag / Compare / Explain AI / Open in forge)
  - **CM-2 CommitTable row** 우클릭 메뉴 (동일, useCommitActions 재사용)
  - **CM-3 StatusPanel file row** 우클릭 — staged: Unstage / Hunk-unstage / File history / Copy path. unstaged: Stage / Discard (destructive) / Hunk-stage / File history / Copy path
  - **CM-4 HunkStageModal hunk row** 우클릭 — Hunk stage/unstage / 선택 라인만 / 접기·펼치기
- STALE_TIME 정책 13 위치 마이그레이션 (`docs/plan/22 §1 HIGH-1`):
  - hardcoded `staleTime: 1_000` / `30_000` / `60_000` → `STALE_TIME.REALTIME / NORMAL / STATIC`
  - 13 컴포넌트 (BisectModal / CommitDiffModal / CommitMessageInput / CompareModal / CreatePrModal / LfsPanel × 2 / MergeEditorModal / PrDetailModal / RepoSwitcherModal / RepoTabBar / StatusBar / launchpad)
  - HunkStageModal `staleTime: 0` 의도 명시 주석 (always-fresh patch)
- bench/baseline.json `$schema` 라인 제거 (실파일 없음, plan/22 §1 LOW-7)
- Sprint 22-1 R-2A (CRITICAL 5건, `docs/plan/22 §2`):
  - **C1 bulk fetch 결과 절단** — `useBulkFetchResult` singleton + `BulkFetchResultModal.vue` 신규 + Sidebar 헤더에 📡 결과 버튼 (실패 N개 badge). 159 레포 환경에서 7+ 실패 시 toast 잘려서 어느 레포 실패한지 못 보던 friction 해소
  - **C2 한글 commit subject visual width** — `CommitMessageInput.vue::visualWidth(s)` (ASCII=1, CJK/Hangul/emoji=2 cell). 한글 36자 = 영문 72자 기준으로 amber warning. 이전엔 한글로만 작성 시 100자+ 까지도 통과
  - **C3 hunk-stage 진입점 visible** — StatusPanel ✂ 버튼 → "✂ hunk" 텍스트 + opacity-60 (group-hover-only 해제). 신규 사용자가 hunk-stage 기능 자체를 발견 못하던 문제 해소
  - **C4 IPC timeout wrapper** — `api/invokeWithTimeout.ts` 신규 + `api/git.ts` 가 wrapper 사용. 일반 30s, long-running prefix (bulk_/clone_/fetch_/push/pull/ai_/maintenance_/import_gitkraken_apply) 5min. timeout 시 reject → useToast onError 자동 표시. 이전엔 IPC hang 시 UI 무응답
  - **C5 conflict marker commit 거부 가이드** — CommitMessageInput onSuccess 에서 stderr 의 `<<<<<<< HEAD` / "needs merge" / "unmerged paths" / "conflicting files" / "you have unmerged files" 5 패턴 감지 → toast.warning 으로 StatusPanel "Conflicted" 섹션 안내
- plan/22 신규 작성 (UI Polish v2):
  - 우클릭 ContextMenu 17 위치 catalog (현재 row-level 메뉴 0/47, 모두 신규 구축 필요)
  - Click → Detail viewer 15 흐름 catalog (CommitGraph row dblclick / PrDetailModal Files tab / TagPanel annotated msg / Reflog restore 등 누락 catalog)
  - Dogfood Friction 13 항목 (CRITICAL 5 = R-2A 완료, IMPORTANT 4 + POLISH 4 대기)
  - plan/15 Sprint 3+4+5 미완 8건 흡수 (BaseModal / useFocusTrap / 한글 너비 / Spinner / Transition / Toast dedup / Custom theme 검증)
  - 신규 UI 시스템 4건 (aria-label / Tooltip / Color 일관성 / Micro-interaction spec)
  - 6 sub-sprint (22-2 ~ 22-7) 작업 분해
- Sprint C14-3 (P2 마지막, `docs/plan/14 §7 F1`): PR Code Suggestions
  - `ForgeClient::add_review_comment` trait 추가 — GitHub + Gitea 양쪽 impl
    - GitHub: `POST /pulls/{n}/comments` with `commit_id`+`path`+`line`+`side=RIGHT`. commit_id 미지정 시 PR detail 에서 head SHA 자동 조회
    - Gitea: `POST /pulls/{n}/reviews` with `event=COMMENT` + `comments=[{path, body, new_position}]` (single-comment review)
  - `add_review_comment` IPC + FE wrapper `addReviewComment`
  - PrDetailModal 에 "+ Code suggestion" 토글 + form (path / line / 새 코드 / 선택 컨텍스트). 등록 시 ` ```suggestion ` markdown 자동 wrap
  - **plan/14 22 항목 모두 ✅ (100%)**
- Sprint C14-2 (P2, `docs/plan/14 §6 + §7`): Clone with options + PR Filter syntax
  - **E1+E2 Clone with options** — `git/clone.rs` 신규 (sparse-checkout cone + `--depth` + `--shallow-since` + `--single-branch` + `--bare`) + `clone_repo` IPC (auto-register=true 면 detect_meta 후 db.add_repo 자동) + `CloneRepoModal.vue` (URL + 부모 폴더 + 폴더명 + 고급 옵션 expand) + Sidebar 의 "⬇ Clone" 버튼
  - **F2 PR Filter syntax** — Launchpad 에 검색 input + prefix helper 버튼 (`+author:` `+state:open` `+repo:` `+is:pinned` `+is:snoozed` `+is:bot`). syntax: `author:<sub>` / `state:<v>` / `repo:<sub>` / `is:<pinned|snoozed|bot>` + free-text title 매칭. 모든 token AND
- Sprint C14 (P2 일부, `docs/plan/14 §5/§8`): G2 Author filter + D2 Edit stash msg + G1 Tag panel
  - **G2 Author filter dropdown** — CommitTable header 에 unique authors dropdown (커밋 200개 기반 ko-locale 정렬). 선택 시 그 author 만 필터, "모든 작성자" 로 해제. 작가 1명 이하면 dropdown 자동 hide
  - **D2 Edit stash message** — `git/stash.rs::edit_stash_message` (rev-parse → `stash store -m` → drop 원본, SHA unreachable 위험 없음). IPC + StashPanel 의 "edit msg" 버튼 (window.prompt). 새 entry 가 stash@{0} 으로 이동
  - **G1 Tag panel** — `git/tag.rs` (list/create/delete/push/delete-remote 5 함수 + annotated/lightweight 구분 + tagger 정보 파싱) + 5 IPC + `TagPanel.vue` (create form lightweight/annotated 자동 + 각 tag push/del local/del remote) + ForgePanel 에 4번째 tab "Tag" 추가
- Sprint B14-3: Repository-Specific Preferences (`docs/plan/14 §3` B1~B4 + A3 + A4):
  - `git/config_local.rs` 신규 — 13 키 (B1 hooksPath / B2 i18n.commitEncoding+logOutputEncoding / B3 gitflow 5키 / B4 commit.gpgsign+user.signingkey+gpg.format / per-repo user.name+email) read/write via `git config --local`
  - 신규 SQLite migration **불필요** — `.git/config` 이 source of truth, 직접 read/write 가 더 단순 + 외부 git 도구와 자연 호환
  - 2 IPC: `read_repo_config` / `apply_repo_config` (snapshot 일괄)
  - FE: `useRepoConfig` composable (Vue Query NORMAL staleTime + apply mutation) + `RepoSpecificForm.vue` (4 fieldset + per-repo identity + dirty 추적 + 빈 값=unset 정규화) + Settings → "Repository-Specific" 카테고리
- Sprint B14-2: Repo Maintenance + LFS init (`docs/plan/14 §2 A2 + A5`):
  - `git/maintenance.rs` 신규 — `gc(aggressive)` + `fsck` (모두 git CLI shell-out)
  - `git/lfs.rs::install()` 추가 — `git lfs install` 호출
  - 3 IPC: `maintenance_gc` / `maintenance_fsck` / `lfs_install`
  - FE: Settings → "유지보수" 카테고리 신규 — 활성 레포 표시 + 4 버튼 (gc / aggressive gc with confirm / fsck / lfs install) + 결과 stdout/stderr/exit 표시
- Sprint B14-1: Remote 관리 GUI (`docs/plan/14 §4` C1+C2+C3):
  - `git/remote.rs` 신규 — `git remote -v` 파싱 + add / remove / rename / set-url (모두 git CLI shell-out, runner::git_run 통과 = 한글 안전)
  - 5 IPC: `list_remotes` / `add_remote` / `remove_remote` / `rename_remote` / `set_remote_url`
  - FE: `RemoteManageModal.vue` (list + add form + 각 항목 inline rename / URL 변경 / 제거 confirm) + BranchPanel 헤더에 🔗 진입 버튼
  - Vue Query `['remotes', repoId]` (NORMAL staleTime), 모든 mutation 후 `branches` + `remotes` invalidate
  - Rust unit test 3개 (parse_remote_v: 일반 / empty / 깨진 형식)
- GitKraken importer fix-up (`docs/plan/21` M14 후속):
  - `apply()` 가 `add_repo` 직전에 `repo::detect_meta(path)` 호출 → forge_kind / forge_owner / forge_repo / default_branch / default_remote 자동 백필
  - detect_meta 실패 시 graceful degradation (Unknown + warning, import 자체는 계속)
  - `ON CONFLICT(local_path) DO UPDATE` 덕에 사용자가 modal "가져오기" 재실행 시 기존 159 레포 forge_kind 도 일괄 백필됨
- GitKraken importer (`docs/plan/21` — Sprint M14):
  - `src-tauri/src/importer/gitkraken.rs` — `%APPDATA%/.gitkraken/profiles/` 자동 탐지 + 3 JSON parse (localRepoCache / profile / projectCache) + dry-run + apply
  - 매핑: 로컬 레포 159 path → `add_repo` (idempotent), Workspace `type=local` → `create_workspace` (이름 충돌 시 `(GitKraken)` suffix), 즐겨찾기 → `set_repo_pinned`, 활성 탭 → FE 측 `useReposStore.openTab`
  - syncPath prefix 매칭 = 더 긴 prefix 우선 (중첩 워크스페이스 안전)
  - PAT (httpCreds.secFile) 은 GitKraken 자체 암호화로 마이그 불가 — 사용자 재입력 안내
  - SSH/GPG 는 OS 표준이라 자동 동작
  - 3 IPC commands: `import_gitkraken_detect` / `_dry_run` / `_apply`
  - FE: `GitKrakenImportModal.vue` (탐지 → preview 4-카드 → confirm → 결과 + 탭 복원) + Settings → "마이그레이션" 카테고리 신규
  - Rust unit tests 5개 (canonical path / longest-prefix / name conflict / JSON parse 2개)

### Changed
- ESLint v9 flat config 마이그레이션 (`.eslintrc.cjs` → `eslint.config.js`)
- commits INDEX migration `0005_commits_lookup_index.sql` (log 페이지네이션 성능)
- Rust dead_code marker 4건 + unused import 4건 정리 (`#[allow(dead_code)]` 제거)

## [0.3.0] — TBD (첫 public release 예정)

### Added (76 commits / 153 파일 / 4 SQLite migrations / Cargo test 79+ pass)

**v0.0 골격**:
- Tauri 2 + Vue 3 + Rust 골격
- 한글 안전 spawn (`git/runner.rs::git_run` — UTF-8 강제 + LANG=C.UTF-8 + lossy 디코딩 + NFC + GBK fallback)
- 첫 화면 + Vite dev server 1초 ready

**v0.1 일상 워크플로우**:
- status / stage / commit (한글 file-based) / sync (fetch / pull / push)
- branch list / switch / create / delete
- Commit graph (pvigier "straight-line lane" + Canvas 2D)
- Diff viewer (CodeMirror 6, side-by-side / inline / hunk)
- Stash 매니저
- Multi-repo 사이드바 + Submodule + 일괄 fetch / pull / status
- Gitea + GitHub PR list / detail / 생성

**v0.2 Power user + AI 페어**:
- AI CLI subprocess (Claude / Codex) — commit message / PR body / merge resolve / code review
- Worktree 매니저
- Cherry-pick (단일 + 멀티 레포)
- Command Palette (⌘P) + 30+ 명령
- File history + Blame
- 3-way merge editor + AI Auto-resolve

**v0.3 차별화**:
- Profiles (회사 / 개인 1-click 토글, 무료)
- Issues + Releases + Bot 그룹핑
- Sync template (다중 레포 cherry-pick)
- Commit graph 검색 (⌘F)

**v1.0 핵심**:
- Launchpad (PR 통합 보드)
- PR 리뷰 (Approve / Request changes / 코멘트 / 머지 / 닫기)
- Pre-commit hook 결과 inline 패널
- Bisect + Reflog
- LFS 패널 (회사 6/6 사용 시나리오 직격)
- AI merge resolve + AI 코드 리뷰

**Sprint A~M (GitKraken catalog 95% 흡수, `docs/plan/11`)**:
- Hide / Solo branches (`docs/plan/11 §5d`)
- Vim navigation J/K/H/L + S/U 단일 stage
- 그래프 컬럼 토글 / 재정렬
- Launchpad Pin / Snooze / Saved Views
- Diff Hunk/Inline/Split + Hunk-level stage + Line-level stage
- Status bar + Conflict Prediction + ✨ AI 미리해결
- Commit Composer AI (multi-commit 재작성)
- Repo tab alias + per-profile 영속성
- 단축키 13+ (Zoom / Sidebar / Detail / ⌘D / ⌘⇧M / ⌘⇧Enter / ⌘⇧S/U / ⌘⇧H / Fullscreen)
- Command Palette 카테고리 + 30+ 명령
- AI 진입점 (Explain commit / branch / stash msg / Composer)
- Drag-drop 4종 (Branch→Branch / Commit→Branch / 컬럼 헤더 / Tab 재정렬)
- Sidebar org 그룹핑 + Workspace color
- Multi-repo Tab 시스템 + ⌃Tab/⌃⇧Tab + ⌘⇧W
- 레포 필터 ⌘⌥F
- WIP 노트 banner
- 섹션 헤더 collapse
- Drag-drop file → terminal (quotePath safe)
- Worktree Lock / Unlock
- LFS pre-push size estimation
- Section header 더블클릭 maximize
- Custom theme JSON export / import
- Lane drag-resize
- 외부 mergetool launch
- Deep linking `git-fried://`
- OS 데스크탑 알림

### Deferred (v1.x)
- macOS / Linux 빌드 (`docs/plan/17 §4-5`)
- EV 코드 서명 (`docs/plan/17 §2`)
- Sentry self-hosted (`docs/plan/17 §3`)
- OAuth (Gitea + GitHub) (`docs/plan/17 §6`)
- 수익 모델 (`docs/plan/17 §7`)

### Internal
- 4 SQLite migrations (0001 initial / 0002 hide_solo_branches / 0003 launchpad_pr_meta / 0004 repo_alias / 0005 commits_lookup_index)
- 79+ Cargo unit tests (한글 round-trip 포함)
- TypeScript typecheck 0 errors
- ESLint v9 flat config (0 errors / 0 warnings)
- Cargo clippy --all-targets -- -D warnings 통과
- 모든 commit `Co-Authored-By: Claude` / `Generated with Claude Code` 미포함 (CLAUDE.md 정합)

[Unreleased]: https://github.com/tgkim/git-fried/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/tgkim/git-fried/releases/tag/v0.3.0
