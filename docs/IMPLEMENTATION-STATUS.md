# 구현 현황 인벤토리 (Implementation Status)

작성: 2026-04-30 / 갱신: 2026-05-12 누적 c31~c46 + **c46+** + **c47-mini** + **c48** + **c49+c50+c51** + **c52** + **c53-c54+++** + **c55-A/B + c56 + c57-A/B + c58** + **c59~c73 자율 15 sprint** + **c74 GitKraken parity wave (5 commits `2d9be61..0d4507b`)** + **c74-doc-sync `05be2a7`** + **c75 god comp 추출 3건 (3 commits `7cbf4ee..a570920`)** = **209 commits**. **★ c75 핵심** (`/analyze` HIGH-2 자율 진행): **god comp ≥200 LOC 전체 0 도달** — c75-A CommitGraph 217→**197** (-20, useGraphInfiniteScroll + useCommitGraphSelection 추출, Pattern 9 caller-decision) / c75-B App.vue 220→**174** (-46, useAppModals + useAppWindowHooks + useOnboardingDetect) / c75-C pages/index.vue 269→**153** (-116, useCommitSelection [WIP_SHA + handlers + ESC + auto-default watch + window.gitFriedShowDiff] + useInlineDiffPersist [visible/maximized localStorage]). 신규 composable **7건**. c67 마일스톤이 components/ 한정이었던 결함 해소 — App.vue/pages/index 포함한 전체 god comp 0. **★ c74 핵심** (`/analyze` Recommendations 자율 진행): BranchPanel 트리화 + Stash/Submodule Mini GitKraken parity (Pattern 9 sister small **5→7**, useStashInteraction + useSubmoduleInteraction 신규) + ContextMenu native webview 메뉴 차단 + scrollbar layout chain 5단 fix + CommitGraph 무한 스크롤 (STEP 500/CAP 5000) + 폰트 pretendard → @fontsource Roboto Flex variable + Noto Sans KR + i18n 1201→**1250** (+49) + lefthook `i18n-symmetry` pre-commit hook 신설 + `.gitignore` `vite.config.*` 산출물 패턴 추가. window.gitFried* +1 (`gitFriedSelectCommit(sha): boolean` — Mini list 클릭 진입점). vitest **83/884 PASS** (회귀 0) / typecheck 0. **★ c59~c73 핵심 마일스톤**: **god comp 0 달성** (모든 .vue script <200 LOC, c52~c67 누적 6 컴포넌트 추출) / Pattern 9 sister 4→7 (small 6: useStatus/Remote/Branch/Tag/RepoTabInteraction + useCommitExplain / large 1: useInteractiveRebaseFlow) / vitest 71/735 → **83/884** (+12 files / +149 tests) / i18n 1102 → **1201 leaf-keys** (+99) / Rust tracing 12 → **58 calls** (+46, 14 module path) / Tested critical composable 5/13 → **10/13** / vite.config esbuild.pure + chunkSizeWarningLimit + `scripts/i18n-leaf-count.mjs` SoT / `/code-review` High 3건 자율 fix (c73 ARCH-001/002/003) + `/teach` toolkit Pattern 17/18 (vue3-composable-extraction skill 1177→1193 LOC). / **c55~c58 트리거**: 7-Round UI/UX 평가 (`docs/ux-eval/2026-05-08-ux-eval-report.md` 854 LOC + 99 PNG) 결과로 작성된 `docs/plan/30-ux-comprehensive-c55-batch.md` (775 LOC, 16 섹션) 기반 25+ commit 자율 진행. 핵심 결과: Nielsen 87→**~92** / a11y 7→**9** (WCAG 2.4.7 box-shadow ring + 2.1.1 drag handle keyboard) / 반응형 8→**9** (1024 graceful + xl:flex hint) / i18n 6→**9** (Settings sub-pages ProfilesSection·ForgeSetup·nav items + Launchpad headers + time.* 86 신규 키) / 차별점 9.95 (유지) / **GitKraken 대체 가능성 8.4 → 9.2+**. vitest 68/708 → **71/735** (+3 files / +27 tests — formatRelativeTime / UserAvatar / enCoverage 회귀 보호). c58 audit 후속 보정 9건 (P3-3 EN i18n / P3-3 적용 확장 / P1-1 footer 1024 / P1-8 Settings sub i18n / P0-1 box-shadow / P3-5 avatar fit / P2-4 View cycler / 회귀 테스트 3 / doc-sync). REJECTED 3건: P0-2 AI confirm (이미 정상) / R2-P0-1 IRR (Ctrl+P 작동) / P3-1 Canvas DPR (이미 구현). / **c53-c54+++ 트리거**: **c53-c54+++ 트리거**: c52 종료 후 사용자 5 sub-sprint 통합 push (`8d8d170`) — c53 useRemoteInteraction Pattern 9 sister + c54 사용자 보고 3 issue (스크롤/skeleton/BRANCH-TAG chip) + c54+ /code-review ARCH 자율 4건 + c54++ 우측 사이드바 깨짐 fix + c54+++ GitKraken parity (Mini 우클릭 메뉴 + useBranchActions 9 액션 / 11→20 / Worktree·Cherry·Reset▶·Tag·Copy 4) + i18n batch 80건 (ko/en 964→1044 +80) + Issue 1 untracked diff fallback + Issue 2 split view (DiffViewerMerge MergeView + useFullscreenDiffSplitQuery a=base/b=current) + StatusInlineDiff 우측 panel 사용 제거 + Pattern 5 TDZ wrapper-of-wrapper trap fix + ARCH-003 BranchActionCallbacks 4 callback required. 누적: c31~c46 + c46+ + c47-mini + c48 + c49+c50+c51 + c52 + c53-c54+++ = 144 + 1 = 145 commit / **c46+ 트리거**: c46 종료 직후 사용자 "전부 자율 진행" → /analyze HIGH 2 + /code-review 16 + 사전 결함 1 = 19건 자율 (3 main commits) → main push (`1ec88d2..3a0d79d`, 24 commits 누적) + toolkit /teach 3 skill + /compound 2 solution. c46+ 핵심: vue-query 5.59→5.100.9 / FE `registerGlobalErrorHandler` (Vue 3 standalone 전역 funnel) / Rust `ipc/diagnostic_commands.rs` (secret_mask + CRLF escape + OnceLock rate-limit) / `secret_mask.rs` env-var-secret 패턴 (사전 결함 `test_mask_env_pattern` 동시 해소) — vitest 675→682 / cargo test ~215+1fail → **225/225** / i18n ko/en 919→921. **c47-mini** (`b296113..4e7a9f9`, 2 commits): vue-i18n 11 lexer 충돌 해소 (`stash@{0}` → `stash{'@'}0` 5 키 × ko/en) + e2e UI text assertion drift 6건 정리 → **e2e 50/50 ALL PASS** + helpers.ts(`navigateToSettings`) 도입. **c48** (`5d33389..3caf93d`, 5 commits): 23건 리팩토링 카탈로그 (4 axis 병렬 분석) 자율 wave 진행 — Wave A i18n+utils 정리 (useCommandCatalog 60 명령 cmd.* namespace / registerGlobalErrorHandler→utils/) / Wave B god comp 4건 (ContextMenu 316→35 / CommitGraph 227→144 / HunkStageModal 235→121 / TerminalPanel 211→25) + 5 신규 composable / Wave C-3 useRepositoryQuery factory (7 micro wrapper 통합) / Wave D-4 v02_commands worktree+merge 분리 (435→254 + 2 신규 ipc 모듈, lib.rs path `pub use` 보존) / Wave E-3 WipBanner.vue dead 제거 (5-Check certain). 잔여 보류: C-2/C-4 large + D-1/D-2/D-3/D-5 (cargo env: rustc 1.95 + cargo 1.95 check-cfg 호환 깨짐 — 차후 toolchain 정리 후 재검증 + Rust refactor 재개) + E-1/E-2/E-4. vitest 682/682 + ko/en 921→992 (cmd.* +71). **c49** (`59665ba`): GitKraken parity 4 UX 통합 — 헤더 탭 클릭→홈(/) 자동 복귀 / RepoSwitcher 검색 팝업 폴더 그룹화 + 폴더 row Enter→그룹 multi-add / Repository Management Collapse/Expand all + 그룹 hover ⊕ 모두 열기 + /code-review HIGH/LOW 처리 (ARCH-001 신규 한글 13건 i18n / ARCH-007 selected race 가드). **c50** (`8622c2b..3c2e9a7`, 4 commits): /teach 3 패턴 toolkit 정착 (vue3-composable-extraction Pattern 8 useNavigateHome / Pattern 9 caller-decision API design / Pattern 10 useGroupCollapse + Pitfall 5→8, skill 482→723 LOC) → git-fried 도입 (composables/useNavigateHome.ts + composables/useGroupCollapse.ts + stores/repos.ts:openRepoGroup) + 회귀 보호 vitest +15 + design-verify Critical 1 (그룹 ▼/▶ 화살표 복원 — `<summary>` flex 안 native marker 가려짐 quirk) + cosmetic LOW 3 + batch i18n 28 키 (repos.* 23 + tabs.* 5). **c51** (`5a40b47`): CommitGraph 정밀 GitKraken parity — commit type 별 노드 시각 (merge donut + 흰 inner dot / tag violet ring r=6 / signed green ring r=5.5) / ref-pill type 색 분기 (branch sky / remote emerald / tag violet / stash amber) / author column avatar prefix (16px initial-letter + 8 stable color hash) / message body 첫 줄 회색 inline. vitest **65 files / 697 tests** + ko/en **954 leaf-keys 대칭** (913→954 +41). **c52** (`d69e9ee..d912896`, 7 commits + toolkit 4): c51 보류 #5 + c48 보류 M1d + checkpoint 후속 + c48~c51 toolchain 잠복 해소 + 두 차례 /code-review 자율 ARCH fix — (1) branch chip column sticky-left (Approach A overlay column ~110 LOC) (2) dev:cleanup helper (Windows vite child detach 영구 해소) (3) **chocolatey rustc PATH 우선 함정 진단 + 3 layer 해법** (rust-toolchain.toml + scripts/cargo-rustup.mjs wrapper + package.json scripts 통합) → cargo test **225 PASS 회복** (4) **TagPanel god comp 추출** (M1d 임계 해소, 227→146 LOC, useTagInteraction.ts ~120 LOC + i18n tagActions.* +10) (5) **/code-review 1차 ARCH 자율 fix 2건** (`24b5b00`): ARCH-001+006 Pattern 9 caller-decision uniformity 60%→100% (composable 5 callback 모두 mutate fn, confirm/prompt/clipboard 모두 흡수, deleteLocal/deleteRemote 신규) + ARCH-002 BRANCH_CHIP_STICKY_WIDTH SOT 통합 (useCommitColumns.ALL_COLUMNS 의 widthPx 단일 출처) (6) **/code-review 2차 ARCH 자율 fix 3건** (`d912896`): ARCH-008 Pattern 13 SOT derive fallback drift 회피 (BRANCH_TAG_DEFAULT_WIDTH_PX named export) + ARCH-009 inner ghost divider 매직넘버 → 계산식 (INNER_DIVIDER_LEFT) + ARCH-010 Pattern 14 도메인 prefix (deleteLocal → deleteTagLocal) (7) **toolkit 4 commits**: vue3-composable-extraction skill 723→~960 LOC (Pattern 11 uniformity + Pattern 12 no-confirm exception + Pattern 13 SOT fallback + Pattern 14 도메인 prefix) + cargo-rustc-path-shadowing 옵션 4 보강 + tailwind-class-px-magic-sync solution 신설 (143→144 solutions). vitest **67 files / 704 tests** (+2/+7) + ko/en 954→**964 leaf-keys** (+10) + i18n/index.ts:36 stale 주석 (606) → 954 leaf-keys 정정. **c53-c54+++** (`8d8d170`, 1 unified commit + toolkit 1 `d503410`): 5 sub-sprint 통합 push — c53 useRemoteInteraction Pattern 9 sister (RemoteManageModal 201→170, removeRemoteSafely Pattern 14 qualifier) + Cargo plan/04 reservation 누적 주석 / c54 사용자 보고 Issue 1·2·3 fix (branchTagSticky 강제 false c52 sticky overlay 폐기 + Mini* 8/8 skeleton 정착 + CommitDetailSidebar file changes skeleton) / c54+ /code-review ARCH 4건 (Mini sister 3 마이그 + data-testid 8 + dead 주석 + Submodule length 통일) / c54++ 우측 사이드바 360→420 + ChangeCountBadge truncate / c54+++ 7 sub-feature 통합 (StatusInlineDiff 제거 + Mini 우클릭 메뉴 useBranchInteraction Pattern 9 delegate sister + useBranchActions 11→20 액션 + i18n batch 80 ko/en 964→1044 + DiffViewerMerge MergeView Split view + useFullscreenDiffSplitQuery + useFullscreenDiffQuery untracked fallback + BranchActionCallbacks required + Pattern 5 TDZ wrapper-of-wrapper fix). vitest 67→**68 files / 708 tests** (+1/+4) + cargo **225 PASS** (회귀 0) + skill 1001→**1121 LOC** (Pattern 5 sub-rule + Pattern 9 delegate sister + Pattern 14 family 확장). / **c46+ 트리거**: c46 종료 직후 사용자 "전부 자율 진행" → /analyze HIGH 2 + /code-review 16 + 사전 결함 1 = 19건 자율 (3 main commits) → main push (`1ec88d2..3a0d79d`, 24 commits 누적) + toolkit /teach 3 skill + /compound 2 solution. c46+ 핵심: vue-query 5.59→5.100.9 / FE `registerGlobalErrorHandler` (Vue 3 standalone 전역 funnel) / Rust `ipc/diagnostic_commands.rs` (secret_mask + CRLF escape + OnceLock rate-limit) / `secret_mask.rs` env-var-secret 패턴 (사전 결함 `test_mask_env_pattern` 동시 해소) — vitest 675→682 / cargo test ~215+1fail → **225/225** / i18n ko/en 919→921. **c47-mini** (`b296113..4e7a9f9`, 2 commits): vue-i18n 11 lexer 충돌 해소 (`stash@{0}` → `stash{'@'}0` 5 키 × ko/en) + e2e UI text assertion drift 6건 정리 → **e2e 50/50 ALL PASS** + helpers.ts(`navigateToSettings`) 도입. **c48** (`5d33389..3caf93d`, 5 commits): 23건 리팩토링 카탈로그 (4 axis 병렬 분석) 자율 wave 진행 — Wave A i18n+utils 정리 (useCommandCatalog 60 명령 cmd.* namespace / registerGlobalErrorHandler→utils/) / Wave B god comp 4건 (ContextMenu 316→35 / CommitGraph 227→144 / HunkStageModal 235→121 / TerminalPanel 211→25) + 5 신규 composable / Wave C-3 useRepositoryQuery factory (7 micro wrapper 통합) / Wave D-4 v02_commands worktree+merge 분리 (435→254 + 2 신규 ipc 모듈, lib.rs path `pub use` 보존) / Wave E-3 WipBanner.vue dead 제거 (5-Check certain). 잔여 보류: C-2/C-4 large + D-1/D-2/D-3/D-5 (cargo env: rustc 1.95 + cargo 1.95 check-cfg 호환 깨짐 — 차후 toolchain 정리 후 재검증 + Rust refactor 재개) + E-1/E-2/E-4. vitest 682/682 + ko/en 921→992 (cmd.* +71). **c49** (`59665ba`): GitKraken parity 4 UX 통합 — 헤더 탭 클릭→홈(/) 자동 복귀 / RepoSwitcher 검색 팝업 폴더 그룹화 + 폴더 row Enter→그룹 multi-add / Repository Management Collapse/Expand all + 그룹 hover ⊕ 모두 열기 + /code-review HIGH/LOW 처리 (ARCH-001 신규 한글 13건 i18n / ARCH-007 selected race 가드). **c50** (`8622c2b..3c2e9a7`, 4 commits): /teach 3 패턴 toolkit 정착 (vue3-composable-extraction Pattern 8 useNavigateHome / Pattern 9 caller-decision API design / Pattern 10 useGroupCollapse + Pitfall 5→8, skill 482→723 LOC) → git-fried 도입 (composables/useNavigateHome.ts + composables/useGroupCollapse.ts + stores/repos.ts:openRepoGroup) + 회귀 보호 vitest +15 + design-verify Critical 1 (그룹 ▼/▶ 화살표 복원 — `<summary>` flex 안 native marker 가려짐 quirk) + cosmetic LOW 3 + batch i18n 28 키 (repos.* 23 + tabs.* 5). **c51** (`5a40b47`): CommitGraph 정밀 GitKraken parity — commit type 별 노드 시각 (merge donut + 흰 inner dot / tag violet ring r=6 / signed green ring r=5.5) / ref-pill type 색 분기 (branch sky / remote emerald / tag violet / stash amber) / author column avatar prefix (16px initial-letter + 8 stable color hash) / message body 첫 줄 회색 inline. vitest **65 files / 697 tests** + ko/en **954 leaf-keys 대칭** (913→954 +41). **c52** (`d69e9ee..d912896`, 7 commits + toolkit 4): c51 보류 #5 + c48 보류 M1d + checkpoint 후속 + c48~c51 toolchain 잠복 해소 + 두 차례 /code-review 자율 ARCH fix — (1) branch chip column sticky-left (Approach A overlay column ~110 LOC) (2) dev:cleanup helper (Windows vite child detach 영구 해소) (3) **chocolatey rustc PATH 우선 함정 진단 + 3 layer 해법** (rust-toolchain.toml + scripts/cargo-rustup.mjs wrapper + package.json scripts 통합) → cargo test **225 PASS 회복** (4) **TagPanel god comp 추출** (M1d 임계 해소, 227→146 LOC, useTagInteraction.ts ~120 LOC + i18n tagActions.* +10) (5) **/code-review 1차 ARCH 자율 fix 2건** (`24b5b00`): ARCH-001+006 Pattern 9 caller-decision uniformity 60%→100% (composable 5 callback 모두 mutate fn, confirm/prompt/clipboard 모두 흡수, deleteLocal/deleteRemote 신규) + ARCH-002 BRANCH_CHIP_STICKY_WIDTH SOT 통합 (useCommitColumns.ALL_COLUMNS 의 widthPx 단일 출처) (6) **/code-review 2차 ARCH 자율 fix 3건** (`d912896`): ARCH-008 Pattern 13 SOT derive fallback drift 회피 (BRANCH_TAG_DEFAULT_WIDTH_PX named export) + ARCH-009 inner ghost divider 매직넘버 → 계산식 (INNER_DIVIDER_LEFT) + ARCH-010 Pattern 14 도메인 prefix (deleteLocal → deleteTagLocal) (7) **toolkit 4 commits**: vue3-composable-extraction skill 723→~960 LOC (Pattern 11 uniformity + Pattern 12 no-confirm exception + Pattern 13 SOT fallback + Pattern 14 도메인 prefix) + cargo-rustc-path-shadowing 옵션 4 보강 + tailwind-class-px-magic-sync solution 신설 (143→144 solutions). vitest **67 files / 704 tests** (+2/+7) + ko/en 954→**964 leaf-keys** (+10) + i18n/index.ts:36 stale 주석 (606) → 954 leaf-keys 정정.

> **목적**: 26개 plan 문서 + CHANGELOG Unreleased + lib.rs invoke_handler + 5 SQLite migrations + 169 IPC + 191 frontend 파일 / 83 Rust 파일을 한 문서에 매핑. 신규 개발자 / 다음 세션 entry / dogfood 시점에 "어디까지 됐고 어디 남았나" 단일 진실원천.
>
> **연계**: [docs/plan/13-implementation-vs-plan-diff.md](plan/13-implementation-vs-plan-diff.md) (76 commits 시점 95% 흡수 검증), [CHANGELOG.md](../CHANGELOG.md) (Sprint c25~c30 Phase 10 누적), [docs/plan/INDEX.md](plan/) (없음 — `ls docs/plan/` 으로 26 문서 인덱스 대체).
>
> **검증 SoT**: `apps/desktop/src-tauri/src/lib.rs` invoke_handler (169 IPC, 자동 카탈로그는 `bun scripts/generate-tauri-commands-index.mjs` → `docs/api/tauri-commands.md`), `apps/desktop/src-tauri/src/storage/migrations/` (5 migration), CHANGELOG `[Unreleased]`, plan/13 + plan/14 + plan/16 + plan/22 + plan/25 의 자체 self-check 표.

---

## 1. 30초 요약

| 영역 | 상태 | 근거 |
| ---- | ---- | ---- |
| **GitKraken 11 catalog** | ✅ **95% + 14 잔여 100%** | plan/13 §1 / plan/14 §12 |
| **GitKraken 12 layout (Sprint c25)** | ✅ **PR #1 머지 완료** (`ae0cafe`) | plan/25 §7, CHANGELOG |
| **Tauri IPC** | ✅ **169 등록 / 26 파일 / 66 카테고리** (자동 카탈로그 SoT — `docs/api/tauri-commands.md`, `bun scripts/generate-tauri-commands-index.mjs` 재생성) | c38 +6 commands. c39: ipc/ 9→12 파일. c40: 13 (workspace 시범). c40 후속: 16 (branch/stash/repo). c40 후속 (전체): 24 파일 — commands.rs **1387 → 40 LOC** (-1,347, get_app_info 1 만 잔존). 신규 9 모듈. cargo check + cargo test 185/185 검증 ✓. **c40+ /analyze 2차**: ipc/ 24→25 파일 — `ai_commands.rs` 441 LOC / 9 commands (ai_detect_clis / commit_message / resolve_conflict / code_review / pr_body / explain_commit / explain_branch / stash_message / composer_plan) 분리, `v02_commands.rs` 862→435 (-427), `pub use crate::ipc::ai_commands::*;` re-export 으로 lib.rs path 보존. **c46+ /analyze 재집계**: ipc/ 25→26 파일 + 168→169 등록 (`diagnostic_commands.rs` 모듈 신규 — `report_frontend_error` IPC 1건 추가, c727bbf). 자동 카탈로그 동기화. |
| **Frontend 코어** | ✅ Vue 3 + Pinia + TanStack Query + Tailwind + CodeMirror + xterm | `apps/desktop/package.json` |
| **Rust 백엔드** | ✅ ~16,800 LOC / 13 top-level mod / git/ **36 sub** (+restore +range_diff) | c38 신규 2 모듈: `git/restore.rs` 196 / `git/range_diff.rs` 318 |
| **테스트** | ✅ **vitest 60 / 660 tests** / cargo test **210/210** / **E2E 10 spec / 신규 15 tests** / bench compile | **c42 cargo +2** (storage migration smoke — `test_5_migrations_apply_expected_schema` 10 테이블 + 2 INDEX 검증, `test_migrations_idempotent_on_reopen` 멱등성). c41 cargo +13 (forge/model 4 + forge/github 3 + forge/gitea 3 + storage/db 3). c40 review-fix +10. c40 후속 (전체): e2e/settings.spec.ts (6). c40 후속: e2e/repositories.spec.ts (3). c40: stash + worktree (3+3). c38 +16 / c39 +7 / c37 +48 누적 |
| **보안 표준 (c38 → c40 review-fix)** | ✅ **dash-prefix 거부 + `--end-of-options` 일관 적용** + URL allowlist + path canonicalize | helper `git/path.rs::reject_dash_prefix` (CWE-88). 적용처: branch 7 (switch/create/delete/rename/merge/rebase/cherry_pick) + remote 4 (add/remove/rename/set_url) + clone (url/target/sparse_paths) + config_local (set_one value). importer/gitkraken.rs `ensure_trusted_profile_dir` (`%APPDATA%/.gitkraken/profiles/` canonical 자손 검증). repo_commands.rs add_repo / clone_repo `Path::canonicalize`. clone URL allowlist (`https`/`http`/`ssh`/`git`/SCP-like, `file://` / `ext::` / SCP dash-path 거부). tauri capability `fs:default` 제거 (frontend plugin-fs 미사용). dev deps happy-dom ^15 → ^20 (critical RCE) |
| **CI/Release 인프라** | 🟡 **95%** (workflow 완비, EV/updater secret 미등록) | `.github/workflows/{ci,release}.yml` |
| **GitHub repo public** | 🟡 **97%** — version 0.3.0 통합 완료. `git tag v0.3.0` push 만 잔여 | tauri.conf.json + Cargo.toml + 3 package.json 모두 0.3.0 (Sprint c31 PR-B) |
| **i18n 기초 인프라** | ✅ **활성화** (vue-i18n **11.4.0** + **ko/en 856 line 완전 대칭** + 60+ 컴포넌트·composable 활용) | **c43 +18 신규 키 (themeIO 3 / statusSelection 1 / branchActions.alreadyHead 1 / aiResult 3 / issues 1 + 9 from c43-1)** — c43-1 9 파일 / 25+ 위치 (composables 잔여 + useBranchActions/useCommitActions 잔여), c43-2 4건 template (AiResultModal/IssuesPanel). c42 +33 키 (generic errors/toast 그룹 도입, 21 파일 / 37+ 위치). c41 +67 키 (6 컴포넌트). c40+ +18 (window.prompt). c40: vue-i18n ^9→^11. c38 +64 키 |
| **BaseTooltip primitive** | ✅ **26 위치 활용** | StatusInlineDiff 7 + GitKrakenToolbar 11 + SyncBar 3 + RepoTabBar 2 + ProfileSwitcher 1 + StatusPanel 토글 2 = 26 (kbd hint 노출 / hover delay / a11y) |
| **God component 분리** | 🟡 **35 컴포넌트 / -2,642 LOC (-46%) + c40 review-fix +3 composable (-155 LOC) — c46+ 회귀 1건** | Sprint c37 +4. c39 +3. c40 +6. c40 후속 (전체) +5 sub-component (settings 689 → 248). **c40 review-fix +3 composable**: useCommitGraphHeader (header menu + column reorder, 87 LOC) + useGraphRefVisibility (hide/solo + refKindOf, 53 LOC) + useHunkLineSelection (shift-click range + per-hunk Set, 86 LOC). CommitGraph 623 → 564 / HunkStageModal 418 → 370. **god ≥400 LOC 잔여 0**. **script-only ≥200 LOC 임계 c46+ 재측정**: CommitGraph.vue script=**227** (total 595, c45/c46 graph handle 정밀도 + UX-10 추가분이 c40 564 → 595로 회귀). 후속 plan: useCommitGraphLayout / useCommitGraphInteraction 추가 추출 후보 — 다음 sprint 권장 (HIGH-1) |
| **a11y 보강 (c31, c37)** | ✅ **6 + DOM focus 동기화** | c31: PrFilesTab 3 + ContextMenu 3 (role + aria-orientation + aria-haspopup). c37-7: ContextMenu **keyboard nav DOM focus 동기화** — focusVisibleMenuItem/focusSubMenuItem (visual highlight ≠ DOM focus 갭 해소, WCAG 2.1.1 + ARIA menu 패턴) |
| **UX 7원칙 검토 (Sprint c33)** | ✅ **P0 갭 1건 완전 해소** | window.confirm() 44곳 → ConfirmDialog (Von Restorff + i18n + Jakob's Law 동시 위반 해소). 6 원칙 ✓ |
| **plan/29 deep-research 5 에픽 (c38)** | ✅ **5/5 완료** | E1 Restore Center (4축 git restore 의미론) / E3 Smart Stash (`-S` + `stash branch`) / E4 Clone Wizard Presets (4 + custom + `--filter`) / E2 Range Diff Panel (CompareModal 모드 토글) / E5 Worktree Polish (is_dirty + open_path_in_explorer + PromptDialog) |
| **window.prompt 잔여 (c38 E5 → c40+ 완료)** | ✅ **9곳 → 0** | c38: WorktreePanel + StashPanel 일부. c40+ /analyze 2차: 9 잔존 호출 일괄 마이그 — BranchPanel.vue (1) + useBranchActions.ts (2) + useCommitActions.ts (4) + ReflogModal.vue (1) + TagPanel.vue (1). i18n 18 신규 키. **c41**: 6 컴포넌트 i18n 100% 마이그 — TagPanel/BranchPanel toast/tooltip + InteractiveRebaseModal/CommitDetailSidebar/CommitMessageInput/CommitDiffModal 한글 63건 / 67 신규 키. ko·en 803 line 대칭 |
| **Light theme 가독성 (c33~c35)** | ✅ **인프라 완성** | c34 시범 5곳 + **c35 옵션 C 인프라** (tailwind.config.ts + main.css 6 semantic colors: diff-add/diff-delete/diff-rename/ai-violet/warning-amber/danger-rose) + PrFilesTab/ConventionalCommitBuilder 적용 |
| **차별점 패널 (c35+c36)** | ✅ **IdentityCard.vue dogfood 통계 활성화** | c35: 3 카드 (한글 🇰🇷 / Gitea 🦊 / AI ✨) 노출. c36: AI 호출 카운터 wiring (notifyAiDone 통합) + 한글 commit IPC (count_hangul_commits 실측 비율). plan/26 Phase 2 완료 |
| **Light theme 누적 (c33~c37)** | ✅ **44 컴포넌트 / 순수 hardcoded 0** | c34 시범 5 + c35 인프라 + 2 컴포넌트 + c36 5 컴포넌트 29 위치 + **c37-1 11 + c37-2 28 컴포넌트 + tailwind alpha modifier 호환** (`hsl(var(--X) / <alpha-value>)` 형식). 잔존 25 grep 매치는 모두 c36/c37 dark variant 패턴 (`text-X-700 dark:text-X-500`, light/dark 가독성 OK) |
| **plan/27 단기 액션 (c34~c35)** | ✅ **3/3 완료** | 1: git/path.rs 한글 helper (c34) / 2: ai/runner.rs build_args + decode 위임 (c35) / 3: git/reflog.rs 단일 진입점 (c35) — v1.x crate 추출 형태 정비 |
| **신규 진입점 (c34)** | ✅ **docs/QUICK_START.md** | 5분 onboarding (3 불편 / 5 차별점 / 첫 commit 흐름 / 단축키 10) — README 1순위 링크 |
| **Core tech 경계 (plan/27)** | ✅ **분석 완료** (코드 0) | 4 후보: 한글 normalization (★★★ v1.x crate) / AI subprocess (★★★) / multi-forge (★ 보류) / reflog-undo (★★). path.rs 통합 완료 (단기 액션 1) |
| **plan/20 baseline 측정** | ⏸️ **외부 의존** (절차 완비) | bench/README.md 완전 — `BENCH_REPO=/path cargo bench --bench git_perf` + `pwsh ./bench/memory.ps1` 실행 (사용자 환경) → baseline.json null 채움 |
| **AI commit / PR / conflict** | ✅ Claude/Codex CLI subprocess | `src-tauri/src/ai/runner.rs::AiCli` |
| **macOS / Linux** | ❌ Windows-only (plan/17 v1.3/v1.4) | `.github/workflows/ci.yml:1` "Windows-only matrix" |
| **Line-level stage v2** | ✅ **완료** (이전 세션) | plan/16 §0 self-check |
| **plan/24 Sprint B~F (visual refactor 코드 적용)** | 🟡 **design 100%, code 적용 보류** (사용자 결정) | plan/24 §11 |

---

## 2. 5 SQLite Migrations

| 파일 | 내용 |
| ---- | ---- |
| `0001_initial.sql` | 기본 — repos / workspaces / settings KV |
| `0002_hide_solo_branches.sql` | Sprint A1 + K — hidden refs 영속 |
| `0003_launchpad_pr_meta.sql` | Sprint A4 — pin / snooze / saved_views |
| `0004_repo_alias.sql` | Sprint B4 — per-profile + per-repo 별칭 |
| `0005_commits_lookup_index.sql` | log 페이지네이션 성능 INDEX |

> Repository-Specific 설정은 별도 migration 없이 `.git/config` 직접 read/write (`git/config_local.rs`, plan/14 §3 결정 1).

---

## 3. 170 IPC 분포 (lib.rs 직접 카운트, c38 +6)

> **c39 분해 후**: ipc/ 9 → 12 파일. 함수 수 자체는 170 보존 (re-export). 카탈로그 자동 생성: [docs/api/tauri-commands.md](api/tauri-commands.md)

| 모듈 | 개수 | 대표 명령 |
| ---- | ----: | ---- |
| `commands.rs` | **73** | get_log, get_status, stage_paths, commit, push/pull/fetch_all, list_branches/switch/create/delete/rename, list_stash + 6 stash ops, compare_refs, reset/revert, undo/redo_last_action, get_graph, search_commits_by_message, list_submodules + 3 ops, bulk_fetch/status/quick_status/list_prs, 5 remote ops, maintenance_gc/fsck, read/apply_repo_config, 5 tag ops, clone_repo, 3 import_gitkraken_* |
| `forge_commands.rs` | **17** | forge_save_token, list/get/create/merge/close/reopen_pr, list_pr_files, list_pr_comments, add_pr_comment, **add_review_comment** (line suggestion), submit_pr_review, list_issues, list_releases |
| `v02_commands.rs` | **44** | 6 worktree, 3 conflict (read/write/take_side), launch_mergetool, open_in_explorer, 4 bisect, list_reflog, **9 LFS** (status/list/install/track/untrack/fetch/pull/prune/push_size), file_history/blame, **9 AI** (detect_clis/commit_message/pr_body/resolve_conflict/code_review/explain_commit/explain_branch/stash_message/composer_plan), predict_target_conflict, 6 rebase (prepare_todo/run/status/continue/abort/skip) |
| `pty_commands.rs` | 4 | pty_open/write/resize/close (portable-pty + xterm.js) |
| `hide_commands.rs` | 6 | list/hide/unhide/bulk/by_kind/all |
| `launchpad_commands.rs` | 8 | list_active/for_repo/set_pinned/snooze/cleanup_defaults/list_views/save_view/delete_view |
| `alias_commands.rs` | 4 | list_all/resolve/set/unset |
| `profile_commands.rs` | 5 | list/create/update/delete/activate |

> **v02_commands.rs 는 "legacy" 가 아님** — 이전 `/analyze` Recommendation MEDIUM-1 ("v02_commands legacy 정리") 는 **REJECTED**. 모든 44 IPC 가 `lib.rs` invoke_handler 에 등록되어 active. 이름이 v0.2 phase 의 IPC 모음을 의미할 뿐 dead code 아님.

---

## 4. Frontend 카탈로그 (191 파일)

| 영역 | 개수 | 비고 |
| ---- | ----: | ---- |
| Pages | 4 | index / launchpad / repositories / settings (unplugin-vue-router 자동) |
| Components | 84 | (test 제외, c39 시점 직접 카운트) — God comp 분리 누적: **StatusPanel 943→715** / **CommandPalette 802→198** ★ / **PrDetailModal 762→589** / **GitKrakenToolbar 606→503** / **CommitMessageInput 545→439** / **CommitGraph 859→737** / **BranchPanel 545→518**. 신규 추출 컴포넌트 4: StatusInlineDiff / PrFilesTab / ConventionalCommitBuilder / BaseTooltip |
| Composables | 70 (non-test) + 44 test = **114** | c39 신규 3: useMaintenanceActions / useThemeIO / useLaunchpadRows. useToast 48회 import / describeError 47회 / stores/repos 31회 / queryClient 26회 / useInvalidateRepoQueries 17회 |
| Pinia stores | 2 | repos.ts 단 1개 store + repos.test.ts |
| API wrapper | `api/git.ts` 161 invoke / `api/forge.ts` 등 | invokeWithTimeout (devMock 지원, 30s/5min 분기) |
| AI 통합 | `ai/` | useAiCli (probe 1회 캐시) + Claude/Codex CLI subprocess |
| Vitest 단위 | 44 | utils 6 / composables 30 / components 4 / api 3 / stores 1 |
| Playwright E2E | 6 | smoke / commit / status / actions / shortcuts / gitkraken-parity |

---

## 5. Rust 백엔드 카탈로그 (66 파일 / 15,423 LOC)

### 5-1. Top-level (13 mod, 1,830 LOC)

| 모듈 | LOC | 역할 |
| ---- | ----: | ---- |
| `lib.rs` | 244 | tauri Builder + AppState + 161 IPC 등록 |
| `error.rs` | 252 | AppError thiserror + 14 variant + AppResult<T> |
| `auth.rs` | 45 | OS keyring — `git-fried:{forge}|{base_url}|{user}` |
| `menu.rs` | 217 | OS native 메뉴 (File/Edit/View/Repo/History/Help, c30 Phase 10) |
| `profiles.rs` | 319 | 회사/개인 1-click 토글 (user.name/email/signing_key/SSH/forge) |
| `alias.rs` | 285 | per-profile + per-repo 별칭 |
| `launchpad.rs` | 468 | PR 통합 보드 + Pin/Snooze/Saved Views |
| `ai/` (3 file) | — | runner.rs (Claude/Codex CLI subprocess), prompts.rs, mod.rs |
| `pty/mod.rs` | — | portable-pty + xterm.js |
| `importer/gitkraken.rs` | — | %APPDATA%/.gitkraken/profiles/ 자동 탐지 + 3 JSON parse + dry-run + apply |
| `forge/` (4 file) | — | gitea.rs (Bearer + reqwest) + github.rs + model.rs + mod.rs |
| `storage/` | — | sqlx + 5 migrations |
| `git/` (30 sub) | 8,046 LOC | 아래 §5-2 |

### 5-2. git/ 30 서브모듈 (8,046 LOC)

repository / status / stage / commit / branch / merge / rebase / cherry_pick / reset / revert (`commands::revert` IPC) / stash / tag / worktree / submodule / sync / lfs / bisect / reflog / read_file / file_history / config_local / bulk / remote / clone / compare / hide / conflict_prediction / graph / runner (한글 spawn 표준) / tests (582 LOC)

상위 5: rebase 483 / reset 396 / hide 390 / repository 384 / graph 337.

---

## 6. Plan 흡수 매트릭스

### 6-1. Plan별 상태 (26 문서)

| # | 제목 | 상태 |
| --: | ---- | ---- |
| 00 | overview | reference 유지 |
| 01 | why-and-positioning | reference 유지 |
| 02 | user-workflow-evidence | reference 유지 |
| 03 | feature-matrix (must/next/late/skip) | ✅ M16 v0.1 must = 100% / N v0.2 = 100% / N+ v0.3 = 95% (i18n 만 미진입) |
| 04 | tech-architecture | ✅ 100% (Tauri 2 + Vue 3 + Pinia + TanStack Query + git2/CLI 하이브리드) |
| 05 | roadmap-v0.1-v1.0 | ✅ v0.0~v0.3 진입 / v1.0~v1.6 미진입 |
| 06 | risks-and-pitfalls | ✅ R1~R12 reference (R7 SmartScreen / R8-R9 macOS-Linux 는 v1.x) |
| 07 | design-decisions | reference 유지 |
| 08 | references | reference 유지 |
| 09 | interactive-rebase (Option A) | ✅ **100%** (drop/reword/squash/fixup + drag-drop) |
| 10 | integrated-terminal (Option A) | ✅ **100%** (xterm + portable-pty + pwsh + drag-drop file→terminal) |
| 11 | gitkraken-benchmark | ✅ **95%** (단축키 ⌘⇧H 등 1 누락은 plan/14 H1 에서 보강) |
| 12 | ui-improvement-plan v3 | ✅ **100%** (21 row 모두 commit hash 매핑) |
| 13 | implementation-vs-plan-diff | ✅ self-check |
| 14 | additional-gitkraken-gaps | ✅ **22/22 = 100%** (A14 + B14-1/2/3 + C14-1/2/3) |
| 15 | quality-cleanup | ✅ STALE_TIME 3-tier / 11 mutation onError / window.d.ts / noUnused* / SkeletonBlock / Q-7 HSL 검증 |
| 16 | line-stage-v2 | ✅ **완료** (이전 세션, plan/16 §0 self-check) |
| 17 | v1.x-roadmap (EV/Sentry/macOS/Linux/OAuth/수익) | ❌ **6 마일스톤 모두 미진입** |
| 18 | dogfood-feedback (template) | template 형식 — 채울 항목 0 (D-001~D-006 양식 예시만) |
| 19 | v0.3-release-prep | 🟡 **95%** (workflow / 6 문서 / Issue 템플릿 모두 완비, version + tag + EV 발급만 잔여) |
| 20 | performance-benchmark | 🟡 도구만 완비 (criterion bench / memory.ps1 / baseline.json placeholder) — 실 측정 미수행 |
| 21 | gitkraken-migration | ✅ **100%** (importer/gitkraken.rs + GitKrakenImportModal + Settings 마이그레이션 카테고리) |
| 22 | ui-polish-v2 | ✅ **22-1 ~ 22-21 모두 완료** (CRITICAL 5 + ContextMenu 14/14 + Modal BaseModal 18/18 + aria-label 47/47 + Skeleton 8 panel + Q-3/4/5/6/7 + F-P3 + F-P5 + ★Playwright MCP) |
| 23 | design-system-extraction | ✅ Phase 1/2/3 옵션 B 완료 (36 PNG + 7 design-context 문서 + Figma file 7 page / 60+ artboard) |
| 24 | visual-refactor (Sprint A~F) | 🟡 **Sprint A 완료, B~F 코드 적용 보류** (사용자 결정 — design 100% / code 점진) |
| 25 | gitkraken-layout-migration (Sprint c25) | ✅ **PR #1 머지** `ae0cafe` (22 commits / +2900 LOC / 83 tests) — c25-1~4.5 + c26-1~3 + c25-review Phase 1/2/3 + c27 |

### 6-2. v0.0 ~ v0.3 (plan/05 기준)

- **v0.0** Hello World ✅ 100%
- **v0.1** must (16 기능 그룹) ✅ 100%
- **v0.2** next (Power user + AI 페어) ✅ 100%
- **v0.3** next+ (Profiles/Search/AI/i18n) ✅ **95%** — 잔여: i18n 한↔영
- **v1.0** late ❌ 미진입 (Pre-commit panel / PR review / Launchpad ✅ / AI conflict ✅ / AI code review ✅ / LFS ✅ / Bisect ✅ / Reflog ✅ / EV 서명 / Sentry / 통합 터미널 ✅ — 부분 진입, 단일 v1.0 출시 미발표)

---

## 7. 미진입 / 잔여 (5-Check 통과 후만 기록)

### 7-1. v1.x 인프라 (plan/17, 6 마일스톤 미진입)

> 5-Check: tauri-plugin-updater Cargo.toml + package.json grep miss / EV_THUMBPRINT secret 미등록 / `version: "0.0.0"` 유지 / `git tag v*` 0개. confidence: certain.

| # | 영역 | 작업량 (AI pair) | 외부 의존 |
| ---- | ---- | ---- | ---- |
| v1.1 | EV 인증서 + tauri-plugin-updater | ~12.5h | EV 발급 1~2주, HSM eToken |
| v1.2 | Sentry self-hosted (opt-in) | ~11h | VPS Hetzner $10/mo |
| v1.3 | macOS 베타 (universal binary + notarization) | ~18h | Apple Developer $99/yr |
| v1.4 | Linux 베타 (AppImage + flatpak) | ~14h | flathub 검토 1~3주 |
| v1.5 | OAuth (Custom URL scheme — deep-link 재사용) | ~18h | — |
| v1.6 | 수익 모델 (Solo 무료 + Team Pro) | ~5주 | Stripe/Lemon Squeezy |

### 7-2. plan/19 GitHub repo public (95% 완료)

잔여 5-Check (모두 confidence: certain):
- `tauri.conf.json:4` `"version": "0.0.0"` → 0.3.0 변경
- `git tag v0.3.0` + push (없음)
- EV 인증서 발급 → `EV_THUMBPRINT` secret 등록 (release.yml `if: env.EV_THUMBPRINT != ''` 자동 wired)
- TAURI_SIGNING_PRIVATE_KEY secret 등록 (Tauri 자체 서명용)
- README 스크린샷 갱신 (현재 캡처 36 PNG 활용 가능)

### 7-3. plan/24 Sprint B~F (디자인 100% / 코드 적용 보류)

> 5-Check: Figma file `git-fried Design System.html` 7 페이지 / 60+ artboard 산출물 보존 / `apps/desktop/src/components/` 에 reka-ui 미설치 (`grep "reka-ui" package.json` empty) / pretendard self-host 만 적용 (Sprint A) / Tooltip primitive 부재. confidence: certain.

| Sprint | 내용 | 코드 적용 |
| ---- | ---- | ---- |
| A | Foundation 토큰 | ✅ pretendard / Q2 색 / Status semantic / Elevation 3 / Z-index 6 |
| B | Primitives + reka-ui | ❌ Tooltip / ContextMenu reka 래핑 미적용 |
| C | Hub Screens 코드 적용 | 🟡 부분 (Tab overflow / Settings 2-level 6 그룹 / Sidebar Integrations slot 은 Sprint 22-12/14/15 에서 흡수) |
| D | Modal Audit | 🟡 BaseModal 18/18 마이그레이션은 Sprint 22 에서 완료, 미캡처 5 신규 (MergeEditor/HunkStage/RemoteManage/AiResult/GitKrakenImport) 흡수 일부 |
| E | UX Polish | 🟡 부분 (Skeleton 8/4 / EmptyState 4 / aria-label 47/47 / Motion 12 prefers-reduced 일부) |
| F | 검증 (Lighthouse a11y ≥90 + visual diff ≥95%) | ❌ 미진입 |

> 사용자 결정: Sprint 22 의 점진 흡수로 Sprint B~F 의 ~70% 가 자연 흡수됨. 잔여는 reka-ui 도입 트리거 발생 시 진입.

### 7-4. v0.3 잔여 (plan/05)

- **i18n 한↔영** — 미진입 (한국어만 1급)
- **외부 출시 (HackerNews/r/git/한국 community)** — 미진입 (개인 dogfood만)

---

## 8. 의존성 / 외부 통합 현황

### 8-1. Tauri 2 plugin (5)

deep-link / dialog / fs / notification / shell. capabilities/default.json 에 권한 명시. **deep-link `git-fried://` scheme 완전 통합** (composables/useDeepLink.ts:115 `onOpenUrl` listener).

### 8-2. Forge 통합

| 측면 | Gitea | GitHub |
| ---- | ---- | ---- |
| PAT 저장 | OS keyring | OS keyring |
| PR list/detail/create | ✅ | ✅ |
| PR merge/close/reopen | ✅ | ✅ |
| PR 코멘트 | ✅ list_pr_comments / add_pr_comment / **add_review_comment (line suggestion)** | ✅ 동일 |
| PR review submit | ✅ submit_pr_review | ✅ 동일 |
| PR files | ✅ list_pr_files (page=100) | ✅ 동일 |
| Issues / Releases | ✅ list | ✅ list |
| OAuth | ❌ (PAT 만, plan/17 v1.5) | ❌ (PAT 만) |

### 8-3. AI 통합 (9 IPC)

`ai/runner.rs::AiCli { Claude, Codex }` enum + `Command::new(bin)` subprocess. probe 결과 useAiCli 1회 캐시.

| IPC | 입력 | 산출 |
| ---- | ---- | ---- |
| ai_detect_clis | — | { claude: installed, codex: installed } |
| ai_commit_message | staged diff | conventional commit 한국어 |
| ai_pr_body | branch commits + diff stat | 한국어 PR body (CLAUDE.md trailer 금지 자동) |
| ai_resolve_conflict | conflict 청크 | 추천 + 근거 |
| ai_code_review | branch diff | 인라인 코멘트 후보 |
| ai_explain_commit | commit sha | 한국어 요약 |
| ai_explain_branch | branch | 한국어 요약 |
| ai_stash_message | working tree | "// WIP {topic}" |
| ai_composer_plan | 요청 | conventional commit body 후보 |

`predict_target_conflict` IPC = AI 사전 충돌 예측 (StatusBar ✨ 미리해결).

### 8-4. AI Provider Cloud BYO

- **자체 LLM 인프라 = 없음** (plan/03 §5 — 사용자 CLI 위임으로 대체. Cloud Patches / Cloud Workspace / Diagram / Agent Session = `S` 영구 거부)

---

## 9. 보안 / 한글 / 회귀 차단 표준

| 표준 | 위치 |
| ---- | ---- |
| OS keyring (keyring crate 3.4) | `auth.rs:14-15` Entry::new + `git-fried:{forge}|{url}|{user}` |
| 한글 NFC 정규화 | `api/git.ts` 의 toNFC() 10+ 호출 — IPC 직전 모든 입력 |
| 한글 spawn 표준 | `git/runner.rs::git_run` (Sprint v0.0 표준 함수) |
| 한글 commit body file-based | `commands::commit` HEREDOC 등가 — `--data-binary @file` 패턴 |
| visualWidth (CJK=2) | `utils/visualWidth.ts` (RepoTabBar 한글 tab 보정 / CommitMessageInput amber warning) |
| Conventional Commits 검증 | `scripts/lefthook-commit-msg.sh` |
| Claude attribution 차단 | `scripts/lefthook-commit-msg.sh` (CLAUDE.md 글로벌 정합) |
| try/catch + describeError + toast | composables 표준 (47 import) |
| silent failure 0건 | 표본 5 catch 블록 모두 명시 처리 |
| IPC 5분 timeout (long-running prefix) | `api/invokeWithTimeout.ts` — bulk_/clone_/fetch_/push/pull/ai_/maintenance_/import_gitkraken_apply |
| reduced-motion media query | `main.css` `@media (prefers-reduced-motion: reduce)` 전역 폴백 |
| coverage threshold | `vite.config.ts:99-104` lines/statements 11.3 / branches 76 / functions 35 |

---

## 10. 다음 진입 후보 (우선순위)

### 10-1. 즉시 (M~L)

1. **plan/19 잔여 5%** — `version` 0.3.0 + EV 인증서 + secret 등록 + `git tag v0.3.0`. **외부 의존 1~2주** (EV 발급)
2. **god component 분리 (StatusPanel 943)** — c27 의 `MiniSection.vue + 4 sub-list` 패턴 (446→120 LOC, 73% 감소) 재적용. confidence: certain (선례)
3. **Tauri 실 환경 dogfood** — c30 Phase 10 흡수 후 사용자 본인 cargo update 후 실제 앱 실행 검증

### 10-2. 트리거 발생 시

1. **plan/17 v1.1 (EV + Updater)** — plan/19 잔여 완료 후 자연 진입
2. **plan/24 Sprint B~F** — reka-ui 도입 또는 Tooltip 필요 시
3. **i18n (plan/03 §6 / v0.3 잔여)** — 글로벌 OSS 진출 결정 시

### 10-3. dogfood 누적 시

- **plan/18 §3** 양식에 D-001~ 누적 → P0 1+ 발견 시 D-fix sprint 즉시
- **plan/20 baseline 측정** — `BENCH_REPO` 환경변수로 50k commit / 큰 diff / 메모리 baseline 확보

---

## 11. 검증 SoT 명령어

| 측정 | 명령어 |
| ---- | ---- |
| IPC 161 카운트 | `grep "ipc::.*::" apps/desktop/src-tauri/src/lib.rs \| wc -l` |
| Frontend 191 / Rust 66 파일 | `find apps/desktop/src -type f \| wc -l` / `find apps/desktop/src-tauri/src -name "*.rs" \| wc -l` |
| Vitest 44 / E2E 6 | `find apps/desktop/src \( -name "*.test.ts" -o -name "*.spec.ts" \) \| wc -l` / `find e2e -name "*.spec.ts" \| wc -l` |
| Rust 15,423 LOC | `find apps/desktop/src-tauri/src -name "*.rs" \| xargs wc -l \| tail -1` |
| God component 검출 | `find apps/desktop/src/components -name "*.vue" -exec wc -l {} + \| sort -rn \| head -10` |
| @iconify/vue 사용 검증 | `grep -r "@iconify/vue\|Iconify" apps/desktop/src` (현재 0 hit, package.json 만) |

---

## 12. 결정 로그 (2026-04-30)

| # | 결정 | 근거 |
| ---- | ---- | ---- |
| 1 | **v02_commands.rs `legacy 정리` 제안 = REJECTED** | 44 IPC 모두 lib.rs invoke_handler 등록 — active code |
| 2 | **plan/24 Sprint B~F 코드 적용 = 점진 진행** | Sprint 22 가 ~70% 자연 흡수, reka-ui 도입 트리거 발생 시 잔여 진입 |
| 3 | **plan/19 v0.3.0 첫 release prep = 95% 완료** | workflow 완비, EV 발급 / version bump / tag push 만 잔여 |
| 4 | **plan/17 v1.x = 모두 미진입** | v0.x 사용자 본인 dogfood 단계 — 외부 출시 전제 |
| 5 | **i18n 한↔영 = v0.3 잔여 유일** | 한국어 1급 / 영어 2번째 (글로벌 OSS 진출 결정 시) |
| 6 | **god component 5개 분리 후속 권장** | StatusPanel 943 / CommitGraph 859 / CommandPalette 802. c27 패턴 (446→120) 재적용 가능 |

---

## 13. 다음 문서 후보

- `docs/IMPLEMENTATION-STATUS.md` (본 문서) — **새 세션 진입 시 5분 within 현황 파악용**
- `docs/plan/INDEX.md` (없음 — 작성 시 26 plan 의 1줄 요약 + status 표)
- `docs/plan/26-*.md` (다음 plan — 트리거 발생 시)
