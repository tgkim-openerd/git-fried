# Changelog

All notable changes to git-fried will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
