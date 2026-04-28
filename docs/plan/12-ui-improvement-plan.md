# 12. UI 개선 상세 계획 — GitKraken 흡수 Sprint A & B 통합 plan

작성: 2026-04-26 / 4 에이전트 병렬 분석 통합 / **patch v2 (2026-04-26) — A1 backend 완료** / **patch v3 (2026-04-27) — Sprint A+B 14항목 전부 완료 + Sprint C(P2) 8 + Sprint D~M(v1.x) 21 추가 흡수 = 총 43개**

> **목적**: [docs/plan/11-gitkraken-benchmark.md](./11-gitkraken-benchmark.md) 의 흡수 catalog 를 git-fried 의 현재 코드베이스에 정확히 매핑한 다음, **즉시 구현 가능한 구체 작업 계획**으로 전환. 본 문서 v3 부터는 **완료 인벤토리 + 다음 작업 (Line-level stage v2)** 역할로 전환.
>
> **🎉 patch v3 핵심 변경 (2026-04-27)**:
>
> - **Sprint A (P0 4) ✅ 완료** — A1=`8aaf1cc`, A2=`d6e1ac7`, A3=`eda980c`, A4=`b3db974`
> - **Sprint B (P1 10) ✅ 완료** — B1=`8f575da`, B2=`42c92d2`, B3=`f9a4d2b`, B4=`d0d1030`, B5=`bc99cd4`, B6=`0ce4489`, B7=`396f821`, B8=`3ae45cd`, B9=`a1aff9a`, B10=`457c3dc`
> - **Sprint C (P2 8) ✅ 완료** — 본 문서 §4 범위 외였으나 추가 흡수: C1=`f093e74` (Worktree Lock), C2=`1481c1a` (LFS size), C3=`bf95ad7` (Section maximize), C4=`1e2fc7e` (Custom theme JSON), C5=`dc2f665` (Lane resize), C6=`36eb617` (mergetool), C7=`3f19f19` (deep link), C8=`6e5debd` (OS notif)
> - **Sprint D~F (v1.x 11) ✅ 완료** — Settings store / AutoFetch / avatarStyle / Diff Split / CommandPalette 토글 / StatusBar AI / OS 파일매니저 / Fullscreen 등
> - **Sprint G~M (미시 디테일 7) ✅ 완료** — G=Multi-repo Tab, H=Hunk-level stage, I=레포 필터 ⌘⌥F, J=WIP banner, K=Branch ref hover hide, L=섹션 collapse, M=drag-drop file→terminal
> - **누적**: 76 commits / 34,343 lines / 153 파일 / 4 migrations 적용 (0001~0004) / cargo test 73 pass / 0 typecheck 오류
> - **다음 작업** (★): **Line-level stage** (Sprint H 후속 v2) — `parseDiff.ts` 가 현재 modified 상태로 작업 진행 중 추정. CodeMirror selection 또는 checkbox → 선택 라인 추출 → minimal patch 재조립 → `git apply --cached`. 자세한 내용은 §15 참조.
>
> **patch v2 (이전 변경, 그대로 유효)**:
>
> - A1 backend 실제 구현: 마이그레이션 `0002_hide_solo_branches.sql`, 테이블 `repo_ref_hidden(..., ref_kind, hidden_at)`, **Solo=세션 메모리**, IPC 6개 (`list_hidden_refs` / `hide_ref` / `unhide_ref` / `hide_refs_bulk` / `unhide_refs_by_kind` / `unhide_all_refs`) in `ipc/hide_commands.rs`, struct `HiddenRef { ref_name, ref_kind: HiddenRefKind, hidden_at }`, 보너스 `gc_stale()`
> - vue-draggable-plus `^0.6.0` 이미 설치 — `package.json#L44`
>
> **연계 문서**: [11-gitkraken-benchmark.md](./11-gitkraken-benchmark.md) (흡수 catalog), [09-interactive-rebase.md](./09-interactive-rebase.md), [10-integrated-terminal.md](./10-integrated-terminal.md), [04-tech-architecture.md](./04-tech-architecture.md), [06-risks-and-pitfalls.md](./06-risks-and-pitfalls.md).

---

## 0. 사용법 / 표기

| 단계 표기 | 의미 |
| --- | --- |
| **S** | 반나절 (≤4h) — 단일 세션 가능 |
| **M** | 1일 (4~8h) — 1 세션 또는 2 세션 |
| **L** | 2~3일 (8~24h) — 다중 세션 |

| 코드 위치 표기 |
| --- |
| `[file.vue#L42](apps/desktop/src/components/file.vue#L42)` — 정확한 줄 번호 인용 |
| `[file.rs](apps/desktop/src-tauri/src/file.rs)` — 파일 단위 |

| 의존성 표기 |
| --- |
| `→ B5` = Sprint B 의 5번 항목 완료 후 |
| `🔗 ContextMenu` = 공용 컴포넌트 의존 |
| `🗄 schema` = SQLite 마이그레이션 동반 |

---

## 1. 30초 요약

| Sprint | 항목 수 | 작업량 (1인 풀타임) | 작업량 (주 15h × git-fried 룰) | 핵심 산출 |
| --- | --- | --- | --- | --- |
| **A (P0)** | 4 | **5~7 일** | **~2 주** | 그래프 가독성 + Launchpad 일상성 |
| **B (P1)** | 10 | **15~20 일** | **~6~7 주** | UI 깊이 + AI 진입점 + Preferences |
| **A+B 합계** | 14 | **20~27 일** | **~8~10 주** | git-fried v1.x 직전 UI 완성도 |

**SQLite 마이그레이션**: 5~7개 신규 (0006~0012)
**신규 IPC**: 30~35개 (현재 89개 → ~125개)
**신규 Vue 컴포넌트**: 6~8개 (`ContextMenu`, `StatusBar`, `CommitComposerModal`, `ExplainModal`, `SnoozeModal`, `SavedViewSidebar`, `PreferencesTree`)
**신규 composable**: 4~5개 (`useRefVisibility`, `useDiffViewerMode`, `useColumnConfig`, `useLaunchpadState`, `usePreferences`)

> **핵심 의존**: Sprint A 1번 (Hide/Solo) 의 `ContextMenu.vue` 컴포넌트는 Sprint A 4번 (Launchpad pin/snooze) + Sprint B 8번 (drag-drop branch) 모두 재사용. **이 컴포넌트를 Sprint A 시작 첫날 만든다**.

---

## 2. 작업량 종합 매트릭스

| # | 항목 | Commit | 핵심 산출물 |
| - | --- | --- | --- |
| **A1** | Hide / Solo branches | `8aaf1cc` | ✅ migration `0002_hide_solo_branches.sql`, `git/hide.rs`, `ipc/hide_commands.rs`, `useHiddenRefs.ts`, BranchPanel/CommitGraph 통합 + 🙈 hover (K=`bb5bd8f`) |
| **A2** | Vim nav J/K/H/L + S/U | `d6e1ac7` | ✅ `useShortcuts.ts` 확장, CommitTable activeRow + virtualizer scrollTo, StatusPanel S/U |
| **A3** | 그래프 컬럼 토글/재정렬 | `eda980c` | ✅ `useCommitColumns.ts`, vue-draggable-plus 활용, right-click 헤더 |
| **A4** | Launchpad Pin/Snooze/SavedView | `b3db974` | ✅ migration `0003_launchpad_pr_meta.sql`, `useLaunchpadMeta.ts`, Pin/Snooze/SavedView 모두 |
| **B1** | Diff 3-mode + Hunk/Line stage | `8f575da` (3-mode) + `aef45ec` (Split) + `356ee57` (multi-file Split) + **`a0dd950` (Hunk-level stage Sprint H)** | ✅ `useDiffMode.ts`, `DiffSplitView.vue`, `HunkStageModal.vue`, `parseDiff.ts`. **Line-level v2 잔여** (다음 작업) |
| **B2** | Status bar + Conflict Prediction | `42c92d2` + `47394af` (✨ AI 미리해결) | ✅ `StatusBar.vue`, target merge-tree dry-run, ⚠ 옆 ✨ AI 버튼 |
| **B3** | Commit Composer AI | `f9a4d2b` | ✅ multi-commit 재작성 modal + AI prompt |
| **B4** | Repo tab alias + per-profile | `d0d1030` | ✅ migration `0004_repo_alias.sql`, `useRepoAliases.ts`, `useTabPerProfile.ts` |
| **B5** | 단축키 13개 (~~12~~) | `bc99cd4` | ✅ Zoom / Sidebar / Detail / ⌘D / ⌘⇧M / ⌘⇧Enter / ⌘⇧S/U + Sprint F5 (`e97be39` F11 / ⌃⌘F) + Sprint I (`7ebb257` ⌘⌥F) |
| **B6** | Command Palette 카테고리 + 30+ | `0ce4489` + `85280a7` (F1 토글 9개) | ✅ 카테고리 모델, 9 토글 + 5 탭 명령 + 필터/fullscreen |
| **B7** | AI 진입점 3개 (Explain) | `396f821` | ✅ Explain commit / branch / stash msg |
| **B8** | Drag-drop 4종 | `3ae45cd` (Branch→Branch + Commit→Branch) + Sprint G `6939441` (Tab) + Sprint M `313d2de` (file→terminal) | ✅ 4종 모두 + 보너스 file→terminal quoted path |
| **B9** | Sidebar org 그룹핑 + Color | `a1aff9a` | ✅ workspace color picker + organization grouping |
| **B10** | Preferences 카테고리 + per-profile 탭 | `457c3dc` + Sprint D1 `3ef7b26` (Settings store) | ✅ Settings 공용 store, per-profile 탭 영속, Hide Launchpad / Date locale 토글 |
| **G** | Multi-repo Tab 시스템 | `6939441` | ✅ RepoTabBar + ⌃Tab/⌃⇧Tab + ⌘⇧W + drag-drop 재정렬 + localStorage |
| **H** | Hunk-level stage | `a0dd950` | ✅ HunkStageModal + parseDiffWithHunks + buildHunkPatch (line v2 진행 중) |
| **I** | 레포 필터 ⌘⌥F | `7ebb257` | ✅ Sidebar 자동 보임 + 이름/별칭/forge owner-repo/경로 매칭 |
| **J** | WIP 노트 banner | `deaec39` | ✅ 그래프 상단 banner + stash push prefill + clear-on-push |
| **K** | Branch ref hover Hide | `bb5bd8f` | ✅ ref pill hover → 🙈 inline 버튼 |
| **L** | 섹션 헤더 collapse | `b8ebeee` | ✅ StatusPanel 4섹션 + StashPanel new form |
| **M** | Drag-drop file→terminal | `313d2de` | ✅ quotePath (pwsh + bash 안전) + ptyWrite |

---

## 3. Sprint A 상세 작업 계획 (4 항목)

### A1. Hide / Solo branches + bulk hide 섹션 헤더

**Architecture plan 은 §10 별도 섹션** (Plan agent 결과 인라인). 이 섹션은 요약.

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | Backend ✅ 완료 (다른 세션, 2026-04-26): `migrations/0002_hide_solo_branches.sql` + `git/hide.rs` + `ipc/hide_commands.rs` + `api/git.ts` wrapper 추가. Frontend ❌ 미진행 (검증: `grep "useHiddenRefs\|hiddenRefs\|ContextMenu"` → 0건, CONFIRMED+certain). [BranchPanel.vue#L130-149](apps/desktop/src/components/BranchPanel.vue#L130) 는 hover delete (`×`) 패턴만. CommitGraph dim 로직 부재 |
| **Frontend 변경 (잔여)** | (1) 신규 `composables/useHiddenRefs.ts` — Vue Query `listHiddenRefs(repoId)` 결과를 `hiddenRefs: ComputedRef<Set<string>>` 으로 derive + Hide/Unhide mutation. **Solo 는 별도 reactive ref `soloRefs: Ref<Set<string>>` (메모리만)**. (2) `BranchPanel.vue` — ref hover eye icon, 우클릭 메뉴 (Hide/Solo/Switch/Delete), 섹션 헤더 우클릭 ("Hide all Remotes/Tags/..." → `hideRefsBulk` 또는 `unhideRefsByKind`). (3) `CommitGraph.vue` — `isCommitDimmed(row)` + Canvas `globalAlpha = 0.2` + DOM `opacity-25`. (4) **신규 `components/ContextMenu.vue`** (공용 재사용 — A4/B4/B7/B8/B9 에서도 사용) |
| **Backend ✅ 완료 (실제 시그니처)** | (1) migration **`0002_hide_solo_branches.sql`** — 테이블 `repo_ref_hidden(repo_id, ref_name, ref_kind, hidden_at)` PK + 인덱스 `(repo_id, ref_kind)`. (2) `git/hide.rs` — `HiddenRefKind` enum (`Branch`/`Remote`/`Tag`/`Stash`, lowercase serde) + `HiddenRef { ref_name, ref_kind, hidden_at }` struct + 함수 7개 (`list_hidden`, `hide`, `unhide`, `hide_many`, `unhide_kind`, `unhide_all`, **`gc_stale`**). (3) **`ipc/hide_commands.rs`** (별도 모듈) — IPC 6개 (`list_hidden_refs`, `hide_ref`, `unhide_ref`, `hide_refs_bulk`, `unhide_refs_by_kind`, `unhide_all_refs`). (4) `lib.rs` invoke_handler 등록 완료. (5) `api/git.ts#L477-510` — TS wrapper 6개 (`listHiddenRefs`, `hideRef`, `unhideRef`, `hideRefsBulk`, `unhideRefsByKind`, `unhideAllRefs`). (6) cargo unit test 6개 (한글 round-trip / kind / unhide_kind / gc_stale / cascade) 작성 완료. **추가 작업 0** — frontend 만 진행 |
| **그래프 dim 알고리즘** | V1 = `primary_ref` 상속 (단순, lane 기반 propagation). V2 = `git rev-list <hidden> --not <visible>` (정확). **V1 시작** — 50k commit 에서 V2 IPC overhead 가 더 큼 |
| **Edge case** | HEAD 강제 visible / 새 브랜치 default visible / `delete_branch` 시 cascade 정리 / 한글 ref `feature/한글` round-trip / Solo 중 ref 삭제 시 `clear_ref_solo` 자동 |
| **작업량** | M (Frontend 4~6h + Backend 3h = 9h) |

### A2. Vim navigation J/K/H/L + S/U 단일 stage

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [useShortcuts.ts#L83-96](apps/desktop/src/composables/useShortcuts.ts#L83) 는 메타키 필수 매핑만 (현재 9개). J/K/H/L 매핑 0건 (검증: `grep "key.*[JKHL]" useShortcuts.ts` → 0건, CONFIRMED+certain). [StatusPanel](apps/desktop/src/components/StatusPanel.vue) 에 `activeFile` ref 부재. [CommitTable.vue](apps/desktop/src/components/CommitTable.vue) 에 `activeRow` ref 부재 |
| **Frontend 변경** | (1) `useShortcuts.ts` — `ShortcutAction` 에 `'navUp/Down/Left/Right'`, `'stageOne'`, `'unstageOne'` 추가, key matching 에 `j/k/h/l` 케이스 (메타키 OFF, input focus 체크 필수). (2) StatusPanel — `activeFile: Ref<{section, index}>` + `S/U` listener. (3) CommitTable — `activeRow: Ref<number>` + virtualizer scrollTo, `J/K` arrow 사이드 효과. (4) `useShortcuts` 의 `isInputFocused()` 정책 보강 — commit message editor focus 시 vim nav OFF |
| **Backend 변경** | 없음 (기존 stage_paths/unstage_paths IPC 재사용) |
| **충돌 검사** | 현재 13개 단축키 (fetch/pull/push/branch/newPr/commit/help/terminal/tab1-7) 와 J/K/H/L 충돌 0건 ✓ (메타키 OFF) |
| **edge case** | empty status (no files) → S/U noop. CommitTable empty → J/K noop. focus 다른 패널일 때 vim nav OFF |
| **작업량** | M (~6h) |

### A3. 그래프 컬럼 토글 / 재정렬 / right-click 헤더

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [CommitTable.vue#L52-61](apps/desktop/src/components/CommitTable.vue#L52) 헤더 5개 (SHA / 제목 / 작성자 / 날짜 / GPG) 고정. 우클릭/drag listener 0건 (검증: `grep -E "columnToggle\|drag.*header"` → 0건, CONFIRMED+certain) |
| **Frontend 변경** | (1) 신규 `composables/useColumnConfig.ts` — `visibleColumns: Set<ColKey>`, `columnOrder: ColKey[]`, mutations. (2) `CommitTable.vue` — `<thead>` 동적 렌더 (`v-for col in columnOrder.filter(...)`), tbody td 같은 순서. (3) **vue-draggable-plus 재사용** (이미 `package.json#L44` 에 `^0.6.0` 설치 완료) — `<th draggable>`, drop zone = thead. (4) 우클릭 헤더 → 🔗 `ContextMenu` (각 컬럼 체크박스 + "기본값으로") |
| **Backend 변경** | 옵션 A: 기존 `settings` KV 테이블 재사용 (key=`graph_columns_{repo_id}`, value=JSON). 옵션 B: 신규 `graph_column_configs` 테이블. **권장 A** (구조 단순) |
| **신규 IPC** | `save_graph_columns(repo_id, config)`, `load_graph_columns(repo_id)` 2개 |
| **edge case** | 컬럼 0개 선택 → 최소 1개 강제 (그래프 컬럼 hidden 불가). 새 사용자 → default 5개 |
| **작업량** | M (~6h) |

### A4. Launchpad Pin / Snooze / Saved Views

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [launchpad.vue#L14-25](apps/desktop/src/pages/launchpad.vue#L14) 는 `stateFilter` + `showBots` 메모리 ref 만. Pin/Snooze/SavedView 부재 (검증: `grep -iE "pin\|snooze\|savedView"` → 0건, CONFIRMED+certain) |
| **Frontend 변경** | (1) 신규 `composables/useLaunchpadState.ts` — `pinnedPrs: Ref<Set<string>>` (key: `${forge}/${owner}/${repo}/${prId}`), `snoozedPrs: Ref<Map<string, number>>`, `savedViews: Ref<SavedView[]>`. (2) `launchpad.vue` — Pinned 섹션 (배경 highlight), Snoozed 탭, Saved Views 사이드바 (collapsible). (3) **신규 `components/SnoozeModal.vue`** — 무기한/1일/1주/1달/custom datetime. (4) PR 행 우클릭 → 🔗 `ContextMenu` (Pin/Snooze/Open in browser). (5) Save view "+" 버튼 → 이름 input modal |
| **Backend 변경** | (1) migration `0007_launchpad.sql` — 3 테이블 (`pinned_prs`, `snoozed_prs`, `saved_views`). (2) IPC 7개 (`pin_pr`, `unpin_pr`, `snooze_pr`, `unsnooze_pr`, `save_launchpad_view`, `list_saved_views`, `delete_saved_view`). (3) `lib.rs` 등록 |
| **데이터 모델 (3 테이블)** | `pinned_prs(repo_id, forge_kind, owner, repo, pr_id, pinned_at, position)` UNIQUE / `snoozed_prs(..., snoozed_at, snooze_until NULL=indefinite, reason)` / `saved_views(repo_id NULL=workspace, name, filter_json, created_at)` |
| **로드 시 자동 처리** | snoozed_until < now() → 자동 unsnooze (background task 또는 query 시 필터) |
| **edge case** | PR 삭제됐는데 pinned/snoozed row 남음 → 다음 PR 목록 fetch 시 stale 표시 후 정리 옵션 / Workspace 변경 시 saved_views 격리 |
| **작업량** | L (Frontend 10h + Backend 8h = 18h) |

---

## 4. Sprint B 상세 작업 계획 (10 항목)

### B1. Diff Hunk / Inline / Split 3-mode 토글 + line-level stage

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [DiffViewer.vue#L1-108](apps/desktop/src/components/DiffViewer.vue#L1) 는 CodeMirror unified diff 단일 모드. 모드 토글 / Split pane / line-level stage 부재 (CONFIRMED, 100%) |
| **Frontend 변경** | (1) 신규 `composables/useDiffViewerMode.ts` — `mode: 'hunk'|'inline'|'split'` + localStorage 저장. (2) `DiffViewer.vue` — 상단 라디오 버튼 (Hunk/Inline/Split), Split mode 시 EditorView 2개 좌우 배치. (3) Hunk mode = unified diff 의 `@@` 블록만 (CodeMirror line filter). (4) line-level stage — 라인 클릭 → 🔗 `ContextMenu` (Stage selected lines / Unstage / Discard) |
| **Backend 변경** | 기존 `stage_paths`/`unstage_paths` 재사용. line range 인자가 없으면 추가 (input: `{path, lines: [start, end]}`). 검증 필요 — 현재 IPC 시그니처 확인 |
| **신규 IPC** | (확장 필요 시) `stage_partial(repo_id, path, hunk_indexes)` |
| **edge case** | binary file → split 비활성화. word wrap 시 line stage 영역 계산 / 큰 diff (>1MB) 시 Split mode 메모리 |
| **작업량** | L (Frontend 12h + Backend 2h = 14h) |

### B2. Status bar + Conflict Prediction (target-branch 한정, 로컬 fetch)

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | Status bar 부재. [SyncBar.vue](apps/desktop/src/components/SyncBar.vue) 는 header 역할의 Fetch/Pull/Push 버튼만. Conflict prediction IPC 부재 (CONFIRMED) |
| **Frontend 변경** | (1) 신규 `components/StatusBar.vue` — 하단 28px footer. 3 indicator: ▣ "Up to Date with {target}" / ⚠ "Conflict in N files" / Launchpad badge. (2) `App.vue#L62-125` 의 `<main>` 하단에 `<StatusBar />` 추가. (3) `useStatus` composable 에 `conflictPrediction: Ref<ConflictPrediction>` 필드 |
| **Backend 변경** | (1) 신규 IPC `predict_conflict(repo_path, target_branch) -> ConflictPrediction { would_conflict, conflicted_files, message }`. (2) 로직 = `git fetch origin <target>` + `git merge-base HEAD <target>` + `git diff --name-only` 교집합 + (옵션) `git merge-tree` dry-run. (3) (옵션) 캐시 테이블 `conflict_cache(repo_id, target_branch, would_conflict, conflicted_files JSON, checked_at)` TTL 1시간 |
| **신규 IPC** | `predict_conflict` 1개 |
| **edge case** | target branch 미존재 → 안전 표시 / detached HEAD → "ℹ Detached" / network 실패 → 캐시 fallback |
| **작업량** | M (Frontend 6h + Backend 3h = 9h) |

### B3. Commit Composer AI modal (multi-commit 재작성)

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [CommitMessageInput.vue#L9](apps/desktop/src/components/CommitMessageInput.vue#L9) 의 `aiCommitMessage` 는 단일 commit 만. multi-commit rewrite 부재. `ai/prompts.rs` 에 4개 entry (commit/pr/merge/review) — composer 미포함 (CONFIRMED) |
| **Frontend 변경** | (1) 신규 `components/CommitComposerModal.vue` — commit range picker (graph 다중 선택 또는 SHA range), 재작성 결과 commit 별 편집 가능 list, Reorder/Squash/Edit 컨트롤, "Create commits" / Cancel / Reset / Undo 버튼. (2) 진입점 — 그래프 commit 다중 선택 → 우클릭 → "Recompose Commits with AI" / Commit Details Panel → "Compose Commit with AI" |
| **Backend 변경** | (1) `ai/prompts.rs` 에 `compose_commits_prompt(commits, diff)` 추가 (한국어 + Conventional Commits + squash/reorder 가이드 + Co-Authored-By 금지). (2) IPC `ai_compose_commits(args) -> ComposeCommitsResult` 신규. (3) 응답 파싱 로직 (구분자 `---`). (4) `lib.rs` 등록 |
| **신규 IPC** | `ai_compose_commits` 1개 |
| **edge case** | merge commit 포함 시 reject / 100+ commit range → 경고 / AI 응답 파싱 실패 → raw 표시 + edit fallback |
| **작업량** | L (Frontend 12h + Backend 6h = 18h) |

### B4. Repo tab alias + per-profile 영속성

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [RepoSwitcherModal.vue](apps/desktop/src/components/RepoSwitcherModal.vue) search 만, alias 0건. [repos.ts](apps/desktop/src/stores/repos.ts) 의 `activeRepoId` 글로벌만. Profile 별 탭 영속 0건 (CONFIRMED). [profiles.rs](apps/desktop/src-tauri/src/profiles.rs) 시스템 자체는 완성됨 |
| **Frontend 변경** | (1) RepoSwitcherModal / Sidebar repo item 우클릭 → 🔗 `ContextMenu` ("Set Alias" → input modal). (2) Tab bar 의 repo name 표시를 `alias || repoName` 으로 변경. (3) `useReposStore` 의 `activeRepoId` 를 profile-bound 로 변경: `Map<profileId, repoId>`. (4) Profile 전환 시 `list_profile_tabs` 호출하여 탭 자동 복원 |
| **Backend 변경** | (1) migration `0008_repo_tabs.sql` — `repo_tabs(profile_id, repo_id, alias, position, is_active)` UNIQUE(profile_id, repo_id). (2) IPC `list_profile_tabs(profile_id)`, `set_repo_alias(profile_id, repo_id, alias)`, `set_active_tab(profile_id, repo_id)` 3개 신규 |
| **신규 IPC** | 3개 |
| **edge case** | profile 변경 후 tab 복원 시 repo 가 disk 에서 사라진 경우 → tab 자동 정리 + toast 알림 |
| **작업량** | M (Frontend 5h + Backend 3h = 8h) |

### B5. 단축키 12개 추가

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [useShortcuts.ts#L12-27](apps/desktop/src/composables/useShortcuts.ts#L12) 의 `ShortcutAction` 9개 (fetch/pull/push/newBranch/newPr/commit/help/terminal/tab1-7). ⌘D, ⌘W, ⌘=/-/0, ⌘J·⌘K, ⌘⇧M, ⌘⇧Enter 등 12개 부재 (CONFIRMED) |
| **추가할 12개** | `⌘D` (Diff), `⌘W` (close tab), `⌘=/-/0` (zoom), `⌘J` (Toggle Left Panel), `⌘K` (Toggle Right Panel), `⌘⇧M` (Focus message box), `⌘⇧Enter` (Stage all + commit), `⌘⇧S` (Stage all), `⌘⇧U` (Unstage all), `⌘T` (New tab), `⌘⇧O` (Open repo via palette), `⌘⇧H` (File history search) |
| **Frontend 변경** | (1) `useShortcuts.ts` — `ShortcutAction` 에 12 enum 추가, L83-96 매핑 확장. (2) `App.vue` — Layout 토글 ref (`leftPanelOpen`, `rightPanelOpen`), zoom CSS variable. (3) `CommitMessageInput.vue` — focus method export. (4) `StatusPanel.vue` — `stageAll`, `unstageAll` method export |
| **Backend 변경** | 없음 |
| **edge case** | input focus 시 `⌘⇧M` 외 모두 OFF 유지. zoom 한계 (50%~200%) |
| **작업량** | S (~4h) |

### B6. Command Palette 카테고리 모델 + 30+ 명령

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [CommandPalette.vue#L25-121](apps/desktop/src/components/CommandPalette.vue#L25) 는 평면 list. category 필드 0. 명령 10개 (go.home, go.settings, workspace.all, refetch.all, theme.toggle, sync.template, bisect, reflog, rebase.interactive, terminal.toggle) (CONFIRMED) |
| **Frontend 변경** | (1) `Cmd` interface 확장: `category: 'File'|'Branch'|'Commit'|'Stash'|'View'|'Settings'|'History'`. (2) 렌더링 — 카테고리별 섹션 헤더 + groupBy. (3) 30+ 명령 추가:<br>- File (4): Open in editor / View history / Blame / Open in file manager<br>- Branch (9): Create / Checkout / Delete / Rename / Merge / Rebase / IR / Diff / Compare<br>- Commit (5): Cherry-pick / Revert / Reset / Explain (AI) / Compose AI<br>- Stash (5): Create / Apply / Pop / Delete / List<br>- View (4): Zoom in/out/reset / Toggle panels<br>- History (3): Reflog / Search commits / File history<br>- Settings (3+): Preferences / Profiles / Forge setup |
| **Backend 변경** | 없음 (기존 IPC 호출) |
| **edge case** | 컨텍스트 의존 명령 (e.g. "Stage all") → 활성 repo 없을 때 disabled |
| **작업량** | M (~6h) |

### B7. AI 진입점 3개 추가 (Explain commit / branch / stash)

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | `ai/prompts.rs` 4개 entry (commit/pr/merge/review). Explain 진입점 0건 (CONFIRMED+certain) |
| **Frontend 변경** | (1) **신규 `components/ExplainModal.vue`** — 읽기 전용 텍스트 + "다시 생성" / "복사" 버튼. (2) 진입점 추가:<br>- CommitTable row 우클릭 → "Explain changes" → ExplainModal<br>- BranchPanel 우클릭 → "Explain Branch Changes" → ExplainModal<br>- StashPanel 우클릭 → "Explain Stash" → ExplainModal<br>- Stash 입력에 ✨ AI 메시지 생성 버튼 추가 (별도 흐름) |
| **Backend 변경** | (1) `ai/prompts.rs` — `explain_commit_prompt`, `explain_branch_prompt`, `explain_stash_prompt`, `generate_stash_message_prompt` 4개 prompt 추가. (2) IPC 3개 (`ai_explain_commit`, `ai_explain_branch`, `ai_explain_stash`) + 1개 (`ai_generate_stash_message`). (3) `git/stash.rs` 의 `show_stash`, `get_stash_message` 함수 노출 (이미 있을 수 있음, grep 검증) |
| **신규 IPC** | 4개 |
| **edge case** | merge commit explain → "merge of X branches" 조정 / 큰 branch (1000 commit) → 마지막 50개만 / 한국어 secret 마스킹 (`mask_secrets`) 기존 사용 |
| **작업량** | M (Frontend 6h + Backend 5h = 11h) |

### B8. Drag-drop 인터랙션 4종

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | drag-drop listener 0건 (BranchPanel/CommitGraph/CommitTable 모두). vue-draggable-plus 미설치 (CONFIRMED) |
| **4종 인터랙션** | (1) **Branch → Branch 메뉴**: 좌클릭 hold → drag (source highlight) → drop 시 🔗 `ContextMenu` (Merge / Rebase / Interactive Rebase / **(옵션) Squash merge / Fast-forward**). 기존 IPC `merge`, `rebase` 재사용 + 필요 시 strategy enum 추가. (2) **Commit → Branch cherry-pick**: graph node multi-select → drag → drop branch → cherry-pick. 기존 `bulk_cherry_pick` 재사용. (3) **컬럼 헤더 재배치**: A3 와 통합 작업. (4) **Tab 재정렬**: tab header drag → 위치 변경 → store 저장 |
| **Frontend 변경** | (1) **vue-draggable-plus 설치** ([09-interactive-rebase.md](./09-interactive-rebase.md) 결정과 통일). (2) 각 컴포넌트에 draggable / dropzone 추가. (3) drag preview UI (반투명 ghost) |
| **Backend 변경** | (1) (옵션) `merge` IPC 에 `strategy: MergeStrategy { Merge, Squash, FastForward, Rebase }` enum 추가 — 검증 후 결정. (2) 기존 `bulk_cherry_pick` 동작 검증 |
| **edge case** | self-drop (브랜치를 자기 자신에) → invalid / detached HEAD 에 drop → 막거나 경고 |
| **작업량** | L (Frontend 10h + Backend 0~3h = 10~13h) |

### B9. Sidebar organization 별 그룹핑 + Workspace color

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [Sidebar.vue#L98-100](apps/desktop/src/components/Sidebar.vue#L98) 의 groups 는 부모 디렉토리 기반만. `organization` 필드 0건. workspaces 테이블에 `color` 컬럼 **이미 있음** (검증: `migrations/0001_initial.sql` 읽음, CONFIRMED). UI 색상 picker 0건 |
| **Frontend 변경** | (1) Sidebar 렌더 — workspace 내 organization 섹션 그룹핑 (트리 2-level: workspace → org → repo). (2) Workspace 헤더 좌측 color dot 표시. (3) Workspace 우클릭 → 🔗 `ContextMenu` ("Change color" → color picker 10색 + custom HEX) |
| **Backend 변경** | (1) migration `0009_workspace_organization.sql` — `ALTER TABLE workspaces ADD COLUMN organization_id TEXT`. (2) `Workspace` struct 필드 1개 추가. (3) `create_workspace`/`update_workspace` IPC 시그니처 확장 (organization_id 옵션 인자) |
| **신규 IPC** | 0 (기존 확장) |
| **edge case** | organization_id NULL → "Other" 그룹으로 / forge 가 GitHub org 정보 자동 채움 (옵션) |
| **작업량** | M (Frontend 5h + Backend 2h = 7h) |

### B10. Preferences 트리 60% 흡수

| 항목 | 내용 |
| --- | --- |
| **현재 상태** | [settings.vue#L1-12](apps/desktop/src/pages/settings.vue#L1) 미니멀 — `ProfilesSection`, `ForgeSetup` 만 import. General/SSH/AI/External Tools/UI Customization/Editor/Terminal/Repo-Specific 0건 (CONFIRMED) |
| **흡수 60% (10 섹션 권장)** | (1) **General** (12 항목): Auto-Fetch / Auto-Prune / Conflict Detection / Default Branch / Show All Commits / Initial Commits / Lazy Load / Remember Tabs / Longpaths / AutoCRLF / Logging / Forget Credentials. (2) **SSH/Integrations** (5): GitHub / GitLab / **Gitea (1급)** / Bitbucket / Azure. (3) **GitKraken AI** (2): Provider 선택 (Claude CLI / Codex CLI 토글) / Custom prompts 7 시나리오. (4) **External Tools** (4): Editor / Diff / Merge / Terminal command. (5) **UI Customization** (5): Theme / Avatars vs initials / Date locale / Graph metadata / Hide Launchpad. (6) **Editor** (6): Font / EOL / Syntax / Line-num / Wrap / Indent. (7) **In-App Terminal** (4): Font / Size / Cursor / Autocomplete. (8) **Repository-Specific** (5): LFS / Commit signing / Hooks / Encoding / Submodules |
| **Frontend 변경** | (1) **신규 `components/PreferencesTree.vue`** — 좌측 카테고리 nav + 우측 content (VS Code Settings 스타일). (2) `pages/settings.vue` 전면 재작성. (3) 신규 `composables/usePreferences.ts` — 카테고리별 reactive form |
| **Backend 변경** | (1) migration `0010_preferences.sql` — `ai_custom_prompts(scenario UNIQUE, custom_template, ...)` + `external_tools(tool_type UNIQUE, command, args)` + `repo_settings(repo_id UNIQUE, encoding, gitflow_*, ...)`. (2) UI/Terminal preferences 는 기존 settings KV 재사용. (3) IPC ~14개 신규 (`set/get_ai_prompt_custom`, `set/get_external_tool` 4쌍, `set/get_repo_settings`, `set/get_ui_pref`, `set/get_terminal_pref`) |
| **신규 IPC** | 14개 |
| **edge case** | Custom prompt 빈 값 → default 사용 / repo_settings 의 encoding 변경 시 git config 동기화 |
| **작업량** | L+ (Frontend 16h + Backend 14h = 30h, 분할 가능) |

---

## 5. SQL Migration 통합 인벤토리

순서 보장 (`storage/migrations/` 디렉토리 파일명 prefix):

| 번호 | 파일명 | 출처 | 상태 | 핵심 변경 |
| --- | --- | --- | --- | --- |
| **0002** | `hide_solo_branches.sql` | A1 | ✅ **다른 세션 완료** | `repo_ref_hidden(repo_id, ref_name, ref_kind, hidden_at)` PK + 인덱스 `(repo_id, ref_kind)`. Solo 컬럼 없음 (메모리만) |
| 0003 | `launchpad.sql` | A4 | TBD | `pinned_prs` / `snoozed_prs` / `saved_views` 3 테이블 |
| 0004 | `repo_tabs.sql` | B4 | TBD | `repo_tabs(profile_id, repo_id, alias, position, is_active)` UNIQUE |
| 0005 | `workspace_organization.sql` | B9 | TBD | `ALTER workspaces ADD organization_id TEXT` |
| 0006 | `preferences.sql` | B10 | TBD | `ai_custom_prompts` + `external_tools` + `repo_settings` + (옵션) `ui_preferences` |
| (옵션) 0007 | `conflict_cache.sql` | B2 | TBD | `conflict_cache(repo_id, target_branch, ..., checked_at)` TTL — 캐시 활용 시만 |
| (옵션) 0008 | `graph_columns.sql` | A3 | TBD | `graph_column_configs` — `settings` KV 재사용 시 불필요 |

→ **확정 4개 잔여** (0003~0006), **옵션 2개** (0007, 0008). A1 의 0002 는 적용 완료.

---

## 6. IPC 추가 통합 인벤토리

현재 89개 → 신규 ~33개 → 총 ~122개.

| 출처 | 신규 IPC | 등록 위치 |
| --- | --- | --- |
| A1 (Hide) ✅ 완료 | `list_hidden_refs`, `hide_ref`, `unhide_ref`, `hide_refs_bulk`, `unhide_refs_by_kind`, `unhide_all_refs` (6) | `ipc/hide_commands.rs` (별도 모듈) |
| A3 (컬럼) | `save_graph_columns`, `load_graph_columns` (2) | `ipc/v02_commands.rs` |
| A4 (Launchpad) | `pin_pr`, `unpin_pr`, `snooze_pr`, `unsnooze_pr`, `save_launchpad_view`, `list_saved_views`, `delete_saved_view` (7) | `ipc/forge_commands.rs` |
| B2 (Conflict) | `predict_conflict` (1) | `ipc/v02_commands.rs` |
| B3 (Composer) | `ai_compose_commits` (1) | `ipc/v02_commands.rs` |
| B4 (Tab alias) | `list_profile_tabs`, `set_repo_alias`, `set_active_tab` (3) | `ipc/profile_commands.rs` |
| B7 (Explain) | `ai_explain_commit`, `ai_explain_branch`, `ai_explain_stash`, `ai_generate_stash_message` (4) | `ipc/v02_commands.rs` |
| B8 (Drag-drop) | (옵션) `merge` 의 strategy 인자 확장 | 기존 |
| B9 (Org) | `create_workspace`/`update_workspace` 시그니처 확장 (0 신규) | 기존 |
| B10 (Pref) | `set/get_ai_prompt_custom` (2) + external_tools 4쌍 (8) + `set/get_repo_settings` (2) + `set/get_ui_pref` (2) + `set/get_terminal_pref` (2) ≈ 14 | `ipc/commands.rs` (또는 새 `pref_commands.rs`) |

**총 합계**: ~33 신규 IPC.

---

## 7. 데이터 모델 변경 통합

### Rust struct 신규
- ✅ `HiddenRef { ref_name, ref_kind: HiddenRefKind, hidden_at }` (A1, 다른 세션 완료. enum: Branch/Remote/Tag/Stash, lowercase serde)
- `GraphColumnConfig { repo_id, visible_columns, column_order }` (또는 settings KV)
- `PinnedPr { id, repo_id, pr_id, forge_kind, owner, repo, pinned_at, position }`
- `SnoozedPr { ..., snoozed_at, snooze_until: Option<i64>, reason }`
- `SavedView { id, repo_id: Option<i64>, name, filter_json, created_at }`
- `RepoTab { id, profile_id, repo_id, alias: Option<String>, position, is_active }`
- `ConflictPrediction { would_conflict, conflicted_files, message }`
- `ComposeCommitsArgs/Result { commits, diff, recomposed, squash_groups }`
- `AiCustomPrompt { scenario, custom_template, ... }`
- `ExternalTool { tool_type, command, args }`
- `RepoSettings { repo_id, encoding, gitflow_*, auto_sign_commits, ... }`

### 기존 struct 확장
- `Workspace { ..., organization_id: Option<String> }`
- `GraphRow { ..., primary_ref: Option<String> }` (A1 V1 dim 알고리즘용)

### Vue interface 신규
- `Cmd { ..., category: CommandCategory }` (B6 확장)
- `MenuItem { label, icon?, onClick, disabled?, danger?, separator? }` (ContextMenu 재사용)
- `ColumnConfig { visibleColumns: Set<ColKey>, columnOrder: ColKey[] }`
- `LaunchpadFilter { state, labels, ... }` (saved view 의 filter_json 형)

---

## 8. 기존 패턴 재사용 매트릭스

git-fried 의 패턴을 Sprint A/B 에서 어떻게 재사용하는가:

| 패턴 | 출처 | 재사용 항목 |
| --- | --- | --- |
| **`useMutation`** (Vue Query) | 기존 useBranches/useStatus | A1 hide toggle, A4 pin/snooze, B4 alias, B7 explain |
| **Modal + Teleport** | MergeEditorModal, BisectModal, ReflogModal | A4 SnoozeModal, B3 CommitComposerModal, B7 ExplainModal |
| **`useShortcut` event bus** | useShortcuts.ts | A2 vim nav, B5 단축키 12개 |
| **Toast 알림** | useToast.ts | B2 conflict 변화, A4 snooze 만료, B4 alias 저장 완료 |
| **Tauri IPC + Vue Query 캐시** | `api/git.ts` 패턴 | 모든 항목의 IPC 호출 |
| **localStorage** | useTheme | A3 컬럼 (옵션 KV), B1 diff mode, B8 tab order |
| **SQLite + sqlx + migration** | 0001_initial.sql | 5~7개 신규 migration |
| **`ai/prompts.rs` + secret masking** | mask_secrets() | B3 composer, B7 explain (자동 마스킹) |
| **`git_run` 표준 spawn** | git/runner.rs | B2 conflict prediction 의 git fetch + merge dry-run |
| **`#[cfg(test)]` Korean round-trip** | git/merge.rs tests | A1 ref_visibility, B4 alias, B10 preferences 모든 한글 검증 |
| **🔗 `ContextMenu.vue` (신규, 공용)** | 신규 (A1 에서 만듦) | A1 / A4 / B4 / B7 / B8 / B9 모두 재사용 |

**핵심 인사이트**: `ContextMenu.vue` 는 Sprint 전체의 공용 부품. **A1 첫 시간에 만들고 6개 항목에 걸쳐 재사용**.

---

## 9. Hide/Solo (A1) — Architecture-level 구현 plan

> Plan agent 결과를 인라인 통합. Sprint A 첫 진입 시 그대로 따를 수 있는 시간 단위 분해.
>
> **⚠️ 9-1 ~ 9-3 (데이터 모델 / Migration / Rust IPC) 는 다른 세션에서 ✅ 완료** (2026-04-26). 12번 v1 의 가정과 다른 부분이 있어 실제 구현으로 본 섹션을 교체. **9-4 (그래프 dim 알고리즘) 부터 frontend 작업이 잔여**.

### 9-1. 데이터 모델 — ✅ 결정 완료

다른 세션이 채택한 모델: **SQLite 영속 (Hide 만) + 메모리 (Solo)**.

- **Hide 영속**: `repo_ref_hidden` 테이블 — 50+ 레포 / 8 worktree 환경에서 같은 SQLite 공유로 자동 동기화
- **Solo 메모리**: 세션 단위 시각화 토글이라 영속 불필요 — frontend `Ref<Set<string>>` 로 충분
- **kind 분리**: bulk hide ("모든 remote 숨김") 시 sub-set lookup 효율화 → `ref_kind` 컬럼 필수

이 결정이 12번 v1 의 "Solo 도 영속" 가정보다 단순하고 정확. 11번 §5d 의 "Solo = 시각화 토글" 의도와도 정합.

### 9-2. Migration `0002_hide_solo_branches.sql` — ✅ 완료

실제 적용된 DDL ([apps/desktop/src-tauri/src/storage/migrations/0002_hide_solo_branches.sql](apps/desktop/src-tauri/src/storage/migrations/0002_hide_solo_branches.sql)):

```sql
CREATE TABLE IF NOT EXISTS repo_ref_hidden (
    repo_id   INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    ref_name  TEXT    NOT NULL,           -- 'origin/feature/x', 'refs/tags/v1.0', ...
    ref_kind  TEXT    NOT NULL DEFAULT 'branch',  -- 'branch' | 'remote' | 'tag' | 'stash'
    hidden_at INTEGER NOT NULL,           -- unix ts
    PRIMARY KEY (repo_id, ref_name)
);

CREATE INDEX IF NOT EXISTS idx_repo_ref_hidden_kind
    ON repo_ref_hidden(repo_id, ref_kind);
```

### 9-3. Rust API — ✅ 완료

[git/hide.rs](apps/desktop/src-tauri/src/git/hide.rs) — DbExt trait 패턴이 아닌 **자유 함수** 방식:

```rust
pub enum HiddenRefKind { Branch, Remote, Tag, Stash }   // lowercase serde

pub struct HiddenRef {
    pub ref_name: String,
    pub ref_kind: HiddenRefKind,
    pub hidden_at: i64,
}

pub async fn list_hidden(db: &Db, repo_id: i64) -> AppResult<Vec<HiddenRef>>;
pub async fn hide(db: &Db, repo_id: i64, ref_name: &str, kind: HiddenRefKind) -> AppResult<()>;
pub async fn unhide(db: &Db, repo_id: i64, ref_name: &str) -> AppResult<()>;
pub async fn hide_many(db: &Db, repo_id: i64, refs: &[(String, HiddenRefKind)]) -> AppResult<usize>;
pub async fn unhide_kind(db: &Db, repo_id: i64, kind: HiddenRefKind) -> AppResult<u64>;
pub async fn unhide_all(db: &Db, repo_id: i64) -> AppResult<u64>;
pub async fn gc_stale(db: &Db, repo_id: i64, valid_refs: &[String]) -> AppResult<u64>;  // 보너스
```

[ipc/hide_commands.rs](apps/desktop/src-tauri/src/ipc/hide_commands.rs) — IPC 6개. [api/git.ts#L477-510](apps/desktop/src/api/git.ts) — TS wrapper 6개 (`listHiddenRefs` / `hideRef` / `unhideRef` / `hideRefsBulk` / `unhideRefsByKind` / `unhideAllRefs`).

cargo unit test 6개: `test_hide_unhide_round_trip` (한글 ref) / `test_hide_idempotent_updates_kind` / `test_unhide_kind_deletes_only_matching` / `test_gc_stale_removes_unknown_refs` / `test_unhide_all_clears_repo` / `test_repo_delete_cascades_hidden`.

**Frontend 가 호출할 표준 패턴** (composable 안에서):

```ts
// composables/useHiddenRefs.ts
import { computed, ref, type MaybeRefOrGetter, toRef } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  listHiddenRefs, hideRef, unhideRef,
  hideRefsBulk, unhideRefsByKind, unhideAllRefs,
  type HiddenRefKind,
} from '@/api/git'

export function useHiddenRefs(repoIdRef: MaybeRefOrGetter<number | null>) {
  const repoId = toRef(repoIdRef)
  const qc = useQueryClient()

  // Hide: 영속 (SQLite) — Vue Query 로 캐시
  const { data } = useQuery({
    queryKey: computed(() => ['hidden_refs', repoId.value]),
    queryFn: () =>
      repoId.value == null ? Promise.resolve([]) : listHiddenRefs(repoId.value),
    enabled: computed(() => repoId.value != null),
    staleTime: 60_000,
  })
  const hiddenRefs = computed(
    () => new Set((data.value ?? []).map((h) => h.refName)),
  )

  // Solo: 세션 메모리만
  const soloRefs = ref<Set<string>>(new Set())
  const soloActive = computed(() => soloRefs.value.size > 0)

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['hidden_refs', repoId.value] })

  const hideMut = useMutation({
    mutationFn: ({ refName, refKind }: { refName: string; refKind: HiddenRefKind }) =>
      hideRef(repoId.value!, refName, refKind),
    onSuccess: invalidate,
  })
  const unhideMut = useMutation({
    mutationFn: (refName: string) => unhideRef(repoId.value!, refName),
    onSuccess: invalidate,
  })
  const bulkHideMut = useMutation({
    mutationFn: (refs: { refName: string; refKind: HiddenRefKind }[]) =>
      hideRefsBulk(repoId.value!, refs),
    onSuccess: invalidate,
  })
  const unhideKindMut = useMutation({
    mutationFn: (refKind: HiddenRefKind) =>
      unhideRefsByKind(repoId.value!, refKind),
    onSuccess: invalidate,
  })

  function toggleHide(refName: string, refKind: HiddenRefKind) {
    if (hiddenRefs.value.has(refName)) {
      unhideMut.mutate(refName)
      // hidden 풀리면 자동으로 solo 도 해제 (정합성)
      soloRefs.value.delete(refName)
    } else {
      hideMut.mutate({ refName, refKind })
      soloRefs.value.delete(refName)
    }
  }

  function toggleSolo(refName: string) {
    if (soloRefs.value.has(refName)) {
      soloRefs.value.delete(refName)
    } else {
      soloRefs.value.add(refName)
    }
    soloRefs.value = new Set(soloRefs.value)  // reactive trigger
  }

  function clearSolo() {
    soloRefs.value = new Set()
  }

  function hideAllOfKind(refs: { refName: string; refKind: HiddenRefKind }[]) {
    bulkHideMut.mutate(refs)
  }

  function unhideAllOfKind(kind: HiddenRefKind) {
    unhideKindMut.mutate(kind)
  }

  return {
    hiddenRefs, soloRefs, soloActive,
    toggleHide, toggleSolo, clearSolo,
    hideAllOfKind, unhideAllOfKind,
  }
}
```

### 9-4. 그래프 dim 알고리즘 (V1 권장)

> **V1 = primary_ref 상속** (lane 기반 propagation, O(N), 단순) → **V2 = `git rev-list <hidden> --not <visible>`** (정확하나 IPC overhead).

```rust
// graph.rs 한 줄 변경
pub struct GraphRow {
    // ... 기존 ...
    pub primary_ref: Option<String>,  // 신규: lane-별 nearest ref tip 상속
}
```

newest→oldest 순회 중 각 lane 의 "최초 ref" tracking 후 같은 lane commit 에 propagate.

Frontend dim 판정:

```ts
function isCommitDimmed(row: GraphRow): boolean {
  const refs = row.commit.refs
  if (refs.length > 0) {
    if (soloActive.value) return !refs.some((r) => soloRefs.value.has(r))
    return refs.every((r) => hiddenRefs.value.has(r))
  }
  const pr = row.primaryRef
  if (!pr) return false
  if (soloActive.value) return !soloRefs.value.has(pr)
  return hiddenRefs.value.has(pr)
}
```

Canvas 적용 — `drawGraph()` row 단위:

```ts
const dimmed = isCommitDimmed(row)
ctx.save()
ctx.globalAlpha = dimmed ? 0.2 : 1.0
// lane / edge / circle 그리기
ctx.restore()
```

DOM row wrapper `<div>` 에 `:class="{ 'opacity-25': dimmed }"`.

### 9-5. ContextMenu 컴포넌트 — 직접 구현 권장

git-fried 가 reka-ui alpha 만 일부 사용 중이라 30 LOC 미만 단순 Teleport wrapper 가 더 가벼움. (reka-ui stable 시 마이그레이션)

```vue
<!-- components/ContextMenu.vue -->
<script setup lang="ts">
interface MenuItem {
  label: string; icon?: string; onClick: () => void;
  disabled?: boolean; danger?: boolean; separator?: boolean;
}
defineProps<{ items: MenuItem[]; open: boolean; x: number; y: number }>()
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50"
         @click="emit('close')" @contextmenu.prevent="emit('close')">
      <ul class="absolute min-w-[160px] rounded-md border border-border bg-popover py-1 text-sm shadow-md"
          :style="{ left: x + 'px', top: y + 'px' }" @click.stop>
        <template v-for="(item, i) in items" :key="i">
          <li v-if="item.separator" class="my-1 border-t border-border" />
          <li v-else
              class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-accent"
              :class="{ 'pointer-events-none opacity-50': item.disabled,
                        'text-destructive': item.danger }"
              @click="!item.disabled && (item.onClick(), emit('close'))">
            <span v-if="item.icon" class="w-4">{{ item.icon }}</span>
            {{ item.label }}
          </li>
        </template>
      </ul>
    </div>
  </Teleport>
</template>
```

### 9-6. 1일 시간 단위 분해

| 시간 | 작업 |
| --- | --- |
| 09:00–10:00 | Migration 0006 + `RefVisibility` struct + `RefVisibilityExt` trait + cargo unit test (한글 ref round-trip + CASCADE) |
| 10:00–11:00 | `v02_commands.rs` IPC 4개 + `lib.rs` 등록 + cargo build 검증 |
| 11:00–12:00 | `useRefVisibility.ts` composable + `api/git.ts` wrapper + Vue Query 통합 |
| 13:00–14:00 | **`ContextMenu.vue` 신규 (공용 컴포넌트)** + Vitest |
| 14:00–15:00 | `BranchPanel.vue` 통합 — hover eye icon, 우클릭 메뉴, 섹션 헤더 우클릭, HEAD 강제 visible |
| 15:00–16:00 | `graph.rs` `primary_ref` 추가 (lane propagation) + GraphRow serialize + 회귀 test |
| 16:00–17:00 | `CommitGraph.vue` dim 통합 — `isCommitDimmed`, Canvas globalAlpha, DOM opacity, watch 추가 |
| 17:00–17:30 | Edge case — empty graph state, delete_branch cascade, HEAD always visible 가드 |
| 17:30–18:00 | 회귀 — Vitest + Cargo + 한글 ref round-trip + 250 row 그래프 toggle perf |
| 18:00–18:30 | DOGFOOD 갱신 — `docs/plan/11` §5d ✅, demo |

→ **총 9시간** (점심 1시간 제외).

### 9-7. 회귀 테스트 우선순위

```rust
#[tokio::test]
async fn test_ref_visibility_korean_round_trip() {
    // ref_name = "feature/한글" → set hidden → list → assert UTF-8 보존
    // soloed flip → assert
    // remove_repo → CASCADE → list 0건 검증
}
```

```ts
// __tests__/BranchPanel.spec.ts
// mount → eye icon click → invoke('set_ref_visibility') 호출 mock 검증
// 우클릭 → ContextMenu 렌더 → "Solo" 클릭 → soloed=true mutation
// 섹션 헤더 우클릭 → "Hide all Local" → bulk_set_ref_visibility 호출 검증

// __tests__/CommitGraph.spec.ts
// 1000 row mock + hiddenRefs Set 주입 → primaryRef='feature/x' row 의 wrapper 가 opacity-25 class 검증
// soloActive=true + soloRefs={'main'} → main 외 모든 row dim
```

### 9-8. 위험 / 미결정

| # | 항목 | 권장 |
| --- | --- | --- |
| 1 | 우클릭 메뉴 라이브러리 | **직접 구현** (Teleport + position, 30 LOC). reka-ui stable 시 마이그레이션 |
| 2 | dim 정확성 V1 vs V2 | **V1 시작** (50k commit 에서 V2 IPC overhead 큼) |
| 3 | profile_id 컬럼 | **나중** (active profile 개념 KV 수준 — P1 후) |
| 4 | tag/stash ref `ref_name` 표기 | `graph.rs` `shorthand` 와 통일 (raw shorthand) |

---

## 10. 의존성 / 진입 순서 그래프

```
=== ✅ 모든 Sprint A~M 완료 (2026-04-27 기준) ===

Sprint A (P0 4):    A1 → A2 → A3 → A4              ✅ commit 8aaf1cc → b3db974
Sprint B (P1 10):   B1 ~ B10                       ✅ commit 8f575da → 457c3dc
Sprint C (P2 8):    C1 ~ C8                        ✅ commit f093e74 → 6e5debd
Sprint D~F (v1.x):  D1 D2-D6 D7-D9 E1-E3 F1-F5     ✅ commit 3ef7b26 → e97be39
Sprint G~M (미시):  G H I J K L M                  ✅ commit 6939441 → 313d2de

=== ⏳ 잔여 (v0.3 / v1.x) ===

다음 작업: Line-level stage (Sprint H 후속 v2)
       └─ parseDiff.ts modified 상태 (작업 진행 중 추정)

향후: EV 코드 서명 / Sentry self-hosted / macOS / Linux / OAuth / 수익 모델

═══ Sprint A 완료 (~1주) ═══

Day 6:
  ├─ B5 (단축키 12개) ← 작은 task, 워밍업
  └─ B6 (Command Palette) ← B5 와 시너지

Day 7-8:
  ├─ B2 (Status bar + Conflict) ← 새 컴포넌트 + 새 IPC
  └─ B9 (Sidebar org) ← 작은 task

Day 9-11:
  ├─ B7 (AI Explain 3개) ← ExplainModal 신규
  └─ B4 (Repo alias) ← ContextMenu 재사용

Day 12-14:
  ├─ B1 (Diff 3-mode) ← 큰 task
  └─ B8 (Drag-drop) ← vue-draggable-plus 재사용 (A3 에서 도입)

Day 15-17:
  └─ B3 (Commit Composer AI) ← 큰 task

Day 18-22:
  └─ B10 (Preferences 60%) ← 가장 큰 task, 분할 가능

═══ Sprint B 완료 (~3주) ═══

총 ~4주 풀타임 / ~10주 (주 15h)
```

**Critical path**: A1 (ContextMenu 첫 도입) → A4 (재사용 검증) → B7/B8 (재사용 확장) → B10 (Preferences)

---

## 11. 위험 / 미결정 사항

| # | 항목 | 위험 | 완화 |
| - | --- | --- | --- |
| R1 | Sprint A 의 4개 동시 실행 가능 여부 | 작업량 합계 5~7일 — 1주 sprint 에 빠듯 | A4 (Launchpad) 가 가장 무거움 → A1+A2+A3 우선, A4 는 Sprint A.5 |
| R2 | ~~A3 의 vue-draggable-plus 설치~~ ✅ 해소 | 검증: `package.json#L44` 에 `vue-draggable-plus ^0.6.0` 이미 설치 — 09 sprint 와 무관하게 즉시 사용 가능 | — |
| R3 | ContextMenu 의 reka-ui vs 직접 구현 | reka-ui alpha 의존성 추가 vs 30 LOC 직접 | **직접 구현** (Plan agent 권장) |
| R4 | A1 의 그래프 dim V1 정확성 | merge commit 의 lane propagation 모호 | graph.rs unit test 보강 + 한국 워크플로우 (50+ 레포) 에서 dogfood |
| R5 | B10 Preferences 의 30시간 작업량 | 1인 burnout (plan/06 R5) | 4 phase 분할 (General → AI → External Tools → 나머지) |
| R6 | B1 Diff Split mode 의 CodeMirror 메모리 | 큰 diff (>1MB) 시 두 EditorView 병렬 | 임계값 토글 (>500KB → split 비활성화) |
| R7 | B8 drag-drop 의 worktree-aware 동작 | source/target worktree 다른 경우 | drag 시 worktree id 표기 + 다른 worktree 에 drop 시 명시적 confirm |
| R8 | B3 Commit Composer 의 AI 응답 파싱 | 구분자 `---` 가 commit message 내부 | prompt 에 escape 규칙 + fallback raw view |
| R9 | A4 의 snoozed_until 자동 처리 | 무기한 PR 의 PR 상태 변화 (closed/merged) | PR 목록 fetch 시 stale 표시 + 정리 옵션 |
| R10 | B10 의 AI Provider 토글 (Claude CLI vs Codex CLI) | 사용자 환경에 두 CLI 모두 없으면? | 첫 실행 시 detect + graceful degradation (plan/06 R13 정합) |

---

## 12. Sprint 진입 제안 시퀀스

### 옵션 1: Sprint A 풀 (1주, 2~3 PR)
- **Day 1**: A1 (Hide/Solo + ContextMenu 신규) — 1 PR
- **Day 2**: A2 (Vim nav) + A3 (컬럼 토글 + vue-draggable-plus 설치) — 2 PR
- **Day 3-5**: A4 (Launchpad pin/snooze/saved-view) — 1 PR

### 옵션 2: Sprint A 우선순위 (가장 가성비 높은 것만, 3일)
- **Day 1**: A1 (Hide/Solo)
- **Day 2**: A2 (Vim nav)
- **Day 3**: A3 (컬럼 토글)
- A4 는 별도 sprint (B 와 합치거나 단독)

### 옵션 3: 09/10 와 병행 (혼합)
- **Day 1-2**: docs/plan/09 sprint 1 (Interactive rebase Option A 첫 단계)
- **Day 3**: A1 (사용자 매일 쓰는 기능 우선)
- **Day 4-5**: 09 sprint 2
- **Day 6+**: A2, A3, A4

### 권장
**옵션 2 + 09 sprint 1 병행** — UI 가독성 P0 3개 (5일) + Interactive rebase MVP (3일) = ~8일. 사용자 dogfood 즉시 체감 가능하고 09 결정도 진행.

---

## 13. 검증 체크리스트 (PR별)

각 PR 머지 직전 점검:

- [ ] **한글 ref/PR/commit 메시지 round-trip**: 새 기능에 한글 입력 → SQLite 저장 → 재로드 → 정확 표시
- [ ] **`#[cfg(test)]` cargo unit test**: 신규 IPC 마다 한글 + edge case 1쌍
- [ ] **Vitest component test**: 신규 컴포넌트 마다 mount + 핵심 인터랙션 1개
- [ ] **Existing 회귀**: 사용자 본인 레포 1개에 dogfood (commit/branch/diff 정상)
- [ ] **`apps/desktop/src-tauri && cargo clippy --all-targets -- -D warnings` 0**
- [ ] **`bun run typecheck` 0 errors**
- [ ] **메모리 baseline +20% 이내** (특히 B1 Diff split mode)
- [ ] **`docs/plan/11` 의 해당 항목 ✅ 표기 + 본 문서 §3-§4 의 "현재 상태" 갱신**
- [ ] **commit message HEREDOC + `'EOF'` (한글 안전)**, **trailer 금지** (Co-Authored-By / Generated with)
- [ ] **PR body Gitea API 시 `--data-binary @file` 사용** (CLAUDE.md 정합)

---

## 14. 출처 / 연계 문서

- [docs/plan/11-gitkraken-benchmark.md](./11-gitkraken-benchmark.md) — 흡수 catalog (P0/P1/P2)
- [docs/plan/03-feature-matrix.md](./03-feature-matrix.md) — must/next/late/skip 분류
- [docs/plan/04-tech-architecture.md](./04-tech-architecture.md) — Tauri+Rust+Vue 표준
- [docs/plan/06-risks-and-pitfalls.md](./06-risks-and-pitfalls.md) — Risk 12개 + 회귀 차단 체크리스트
- [docs/plan/09-interactive-rebase.md](./09-interactive-rebase.md) — vue-draggable-plus 결정 통일
- [docs/plan/10-integrated-terminal.md](./10-integrated-terminal.md) — terminal 결정 (B5 ⌥T 단축키와 정합)

### 4 에이전트 분석 결과 (이 문서의 원천)

본 문서는 다음 4개 병렬 에이전트의 결과를 메인 컨텍스트에서 종합한 것:
1. **Sprint A frontend diff** (Explore) — A1~A4 의 정확한 코드 위치 + 변경 인벤토리
2. **Sprint B frontend diff** (Explore) — B1~B10 의 정확한 코드 위치 + 변경 인벤토리
3. **Backend IPC + storage diff** (Explore) — IPC 33개 + migration 5~7개 + 데이터 모델
4. **Hide/Solo architecture plan** (Plan) — A1 의 시간 단위 분해 + 알고리즘 상세 (§9 인라인)

---

## 15. 다음 행동

### A. Line-level stage (Sprint H 후속 v2) ★ 즉시 진입 가능

Sprint H (`a0dd950`) 의 hunk-level stage 위에 line 단위 stage 추가. **`apps/desktop/src/utils/parseDiff.ts` 가 modified 상태** — 작업 진행 중인 것으로 추정.

**구현 포인트**:
- CodeMirror selection 또는 라인 옆 checkbox 로 라인 선택
- 선택 라인 추출 → minimal patch 재조립
  - 선택 외 `-` 라인 → context (`  `) 로 변환
  - 선택 외 `+` 라인 → 무시 (skip)
  - 선택된 `+` 라인 → 그대로 유지
  - hunk 헤더 (`@@ -a,b +c,d @@`) → 선택 결과에 맞게 a/b/c/d 재계산
- `git apply --cached` 로 staged 영역에만 적용
- 회귀: 한글 파일 / multi-line 선택 / 다중 hunk 동시 선택

**참고 코드**:
- 이미 있는 `parseDiffWithHunks` / `buildHunkPatch` (Sprint H) 가 hunk 단위 base 제공
- 새 함수 `buildLinePatch(hunks, selectedLines)` 작성 필요

**작업량**: M~L (4~12h, patch math 까다로움)

### B. dogfood 결과 보고

REVIEW.md §"사용자 dogfood 시 주의사항" 의 12개 신규 진입점 사용 → 발견 사항 보고 → 일괄 패치.

### C. v0.3 / v1.x 신규 방향

EV 코드 서명 / Sentry self-hosted / macOS / Linux / OAuth / GitHub repo 생성 + CI matrix.

---

## 16. 본 문서의 역할 변화 (v3)

- **v1 (2026-04-26 작성)**: Sprint A+B 14항목의 정밀 작업 계획
- **v2 (2026-04-26)**: A1 backend 완료 반영
- **v3 (2026-04-27)**: 14항목 + Sprint C+D~M 추가 21개 모두 완료. **완료 인벤토리 + 다음 작업 가이드** 역할로 전환

다음 문서 후보:
- `13-line-stage-v2.md` — Line-level stage 구현 plan (다음 작업 진입 시)
- `14-v1.x-roadmap.md` — EV 서명 / macOS / Linux / 수익 모델 검토
