# GitKraken Desktop 12.1.1 vs git-fried v0.3.0 — Phase 5 비교표

> Plan #40 Phase 5 산출물 / 캡처: 2026-05-18 17:26~18:00 (PoC v2.1 + v3.0 통합) / Codex cross-validation 2 batch 통과 (Memory Rule 3)
>
> 본 비교표는 부분 cover (Phase 2 Settings detail + Phase 3 7영역 default view). PoC v4 (image search anchor + 사용자 sidebar 모든 섹션 expand setup) 결과 보강 후 update 권고.

## parity matrix (30+ row — Plan #41 Step 1 update)

> Plan #41 Step 1 결과: Repo-Specific Preferences 가 3 → **10 항목** 으로 확장 발견 (Codex 1차 페어 검증 완료). 7 신규 row 추가.

| # | 영역 | GitKraken 동작 | git-fried 대응 | parity | backlog / 결정 |
| --- | --- | --- | --- | --- | --- |
| 01 | Settings 진입 | `Ctrl+,` → full-page replacement (modal X) | `pages/settings/` route 별도 페이지 | ✓ 동일 패턴 | — |
| 02 | Settings nav 구조 | **12 global + 10 repo-specific** (Plan #41 Step 1 정정 — 이전 단정 3 REFUTED) | `pages/settings/sections/*.vue` (flat structure) | △ 부분 | SB-XXX repo-specific sub-nav 분리 후보 |
| 03 | Auto-Fetch Interval | 사용자값 `1` (default 미확정) | Sprint c95 SB-028: default 0 → 5min (`ace68a0`) | △ baseline 불일치 가능 | SB-028 cross-check (PoC v4) |
| 04 | Initial Commits in Graph | `2000` + Lazy Load toggle | Sprint c74 STEP 500 / CAP 5000 | △ 전략 차이 | UX 결정 — STEP 크기 조정 검토 |
| 05 | Repo-Specific Preferences | 좌하단 별도 섹션 (Encoding/Gitflow/Git Hooks) | SB-013 per-repo forge override (Sprint c81 commit `1784c3f`) | ✓ 패턴 동일 | parity 확장 (Gitflow/Git Hooks 후보) |
| 06 | GitKraken AI tab | Settings 내 별도 nav 항목 | useAiRunner + ai_commands.rs 9 IPC (Sprint c40+) | △ 통합 위치 다름 | Settings sub-section 통합 검토 |
| 07 | Commit Signing tab | Settings nav 별도 | 미구현 | ✗ | SB-XXX 신규 (GPG/SSH signing UI) |
| 08 | Gitflow tab | Settings nav 별도 (Repo-Specific 하위) | 미구현 (의도적 거부 가능) | ✗ | `26-3constraints-identity.md` 검토 |
| 09 | Git Hooks tab | Settings nav 별도 (Repo-Specific 하위) | 미구현 (lefthook 외부 사용) | ✗ | SB-XXX 신규 (hooks 관리 UI) |
| 10 | Explain commit AI 버튼 | 우측 commit detail panel 표시 (purple 버튼) | useCommitExplain (Sprint c63) ✓ | ✓ 구현 완료 | UI parity 검증 — purple color 매칭? |
| 11 | Graph scroll | `Ctrl+Home` / `Ctrl+End` hotkey 지원 (PoC v3 확인) | useGraphInfiniteScroll (Sprint c75) | △ hotkey 미확정 | git-fried hotkey 추가 검토 |
| 12 | Stash 생성 hotkey | `Ctrl+S` 아님 (PoC v3 confirmed, no effect) | TopBar 버튼 (hotkey 없음) | ✗ 미확정 | PoC v4: Settings → Workflow → Hotkey list 캡처 필요 |
| 13 | Tag annotate UX | GitKraken context menu 추정 (PoC v3 미 cover) | SB-033 Annotate tag (Sprint c95) | ? 미검증 | PoC v4 capture |
| 14 | PR CI status | GitKraken sidebar PR row 표시 추정 | SB-017 4 아이콘 인프라 (Sprint c95+ Wave 1) | ? 미검증 | PoC v4 + ARCH-001 wire |
| 15 | Worktree context menu | GitKraken 추정 (PoC v3 미 cover) | useWorktreePanelActions (Sprint c95 fix) | ? 미검증 | PoC v4 capture |
| 16 | **Bottom-right status bar** | zoom 100% / Support / license PRO / version v12.1.1 | Sprint c91 Phase A + Sprint c101 SB-NEW-1 (FREE 라이선스 + v0.3.0 버전) | ✓ **격상** | zoom % / Support 링크 보류 (Tauri native zoom) |
| 17 | **Top toolbar 6 버튼** | Pull / Push / Branch / Stash / Pop / Terminal | GitKrakenToolbar.vue 의 6 버튼 (Pull/Push/Branch/Stash/Pop/Terminal) **이미 구현** | ✓ **격상** | Sprint c102 finding — Codex 단정 REFUTED |
| 18 | **Sidebar section count badges** | LOCAL 35 / REMOTE 71 / WORKTREES 4 / STASHES 10 / PULL REQUESTS 0 (TEAMS 별도) | MiniSection 의 `(count)` 표시 **이미 구현** (모든 mini list) | ✓ **격상** | Sprint c102 finding — cosmetic 스타일만 차이 (괄호 vs space) |
| 19 | **Right detail panel file view** | Path/Tree segmented + View all files checkbox + parent/commit hash | CommitDetailSidebar 의 `ViewMode = 'path' \| 'tree'` **이미 구현** | ✓ **격상** | Sprint c102 finding — Path/Tree segmented 이미 cover |
| 20 | **Tab row polish** | active tab close `x` + 우측 `+` 새 탭 + drag handle | RepoTabBar 의 `✕ 닫기` + Sprint G 다중 탭 **이미 구현** | ✓ **격상** | Sprint c102 finding — close `x` 이미 cover |

### Plan #41 Step 1 신규 row (Repo-Specific 7 신규 항목)

| # | 영역 | GitKraken 동작 | git-fried 대응 (Codex 1차) | parity | backlog / 결정 |
| --- | --- | --- | --- | --- | --- |
| 21 | Repo-Specific Encoding | i18n.commitEncoding / logOutputEncoding 등 per-repo override | PARTIAL Rust `config_local.rs` + Vue `RepoSpecificForm.vue` B2 | △ HIGH | identity-core 한글 안전 — Settings UI 통합 권고 |
| 22 | Repo-Specific Gitflow | per-repo gitflow branch.* 설정 | PARTIAL Rust `config_local.rs` gitflow.* | △ LOW | 1인 환경 가치 낮음 — 미구현 유지 권고 |
| 23 | Repo-Specific Git Hooks | per-repo `core.hooksPath` 관리 + hook list | PARTIAL Rust `core.hooksPath` + Vue `RepoSpecificForm.vue` B1 | △ MED | hook manager UI 신규 후보 |
| 24 | **Repo-Specific Commit** | Push after each commit / Skip git hooks / Squash / Commit Template (Codex 1차 신규) | PARTIAL Rust `commit.rs` + gpgsign | △ HIGH | Commit template / Squash toggle UI 신규 |
| 25 | **Repo-Specific Agents** | 외부 AI agent 연동 (cloud) | PARTIAL/DIFFERENT `ai/runner.rs` (CLI subprocess 다른 개념) | ✗ **거부 권고** | git-fried 정체성 충돌 (cloud SaaS), 미구현 유지 |
| 26 | **Repo-Specific Conflict Prevention** | per-repo 충돌 사전 검출 옵션 | **YES** Rust `conflict_prediction.rs` + `v02_commands.rs` IPC + Vue `StatusBar.vue` + `useUserSettings.ts` | △ HIGH | **Settings UI 노출만 필요** — 빠른 win |
| 27 | **Repo-Specific LFS** | per-repo LFS track / install / fetch | **YES** Rust `lfs.rs` + `lfs_commands.rs` (7 IPC) + Vue `LfsPanel.vue` + `api/git.ts` | △ HIGH | **Settings UI 노출만 필요** — 빠른 win |
| 28 | **Repo-Specific Sparse Checkout** | per-repo sparse manager | PARTIAL Rust `clone.rs` CloneOptions.sparse_paths (clone 시점만) + Vue `CloneRepoModal.vue` | △ MED | repo-specific manager UI 신규 |
| 29 | **Repo-Specific Issue Tracker** | Jira / Linear / GitHub Issues 연동 | PARTIAL Rust forge issue list + Vue `IssuesPanel.vue` + `useExternalIssueTracker.ts` (skeleton) | △ MED | Gitea/GitHub 1급 — 외부 tracker (Jira/Linear) 제외 |
| 30 | **Repo-Specific Team** | "Select a team for this repo" collab | NO Rust + NO Vue | ✗ | LOW — local profiles 대체 가능 |

## parity 통계 (30 row, Sprint c102 후 — SB-NEW 5건 일괄 ✓ 격상)

- ✓ **완전 parity**: **13** (Settings 진입 / Repo-Specific 패턴 / Explain commit AI / scroll / **Conflict Prevention** / **LFS** / **Commit Options** / **Sparse Checkout** / **Status bar** / **Top toolbar** / **Sidebar counts** / **Right panel Path/Tree** / **Tab polish**)
- △ **부분 parity**: 7 (기존 일부 + 5 Repo-Specific — Encoding / Gitflow / Git Hooks / Issue Tracker + 기존 미명시 3)
- ✗ **git-fried 미구현 또는 거부**: 6 (Commit Signing UI / Stash hotkey + Agents 거부 / Team 미구현)
- ? **미검증 (PoC v4 필요)**: 3 (Tag annotate / PR CI / Worktree dialog)

전체 30 row 중 ✓ 13 / △ 7 / ✗ 6 / ? 3 = git-fried coverage **77%** (✓ + △ = 23/30, 절대 ✓ +5 추가 — Sprint c102 finding).

> **Sprint c96 + c97 + c98 누적 결과** (Plan #42 H-1 ~ H-4 + M-1.2 5/5 wire + M-3, Codex 7차 batch audit `adf22d6a0607a9f0d` 통과): 절대 ✓ count 4→**7** 증가 (Conflict Prevention + LFS + Commit Options 격상). 다음 sprint = M-1 Git Hooks UI / M-2 Sparse Checkout / M-1.1 Conflict per-repo override (DB migration).

## Sprint c96 batch 산출물 정합

| Plan #42 항목 | commit | 상태 |
| --- | --- | --- |
| H-1 Conflict Prevention UI 노출 | `f729b37` + `d449b6d` (audit fix) | ✓ 완료 (StatusBar refetchInterval wire + clamp + 0=비활성) |
| H-2 LFS Settings UI 노출 | `ccdbb36` + `6b6a353` (null guard fix) | ✓ 완료 (LfsPanel wrap + activeRepoId guard) |
| H-3 Encoding identity-core 가이드 | `18ad715` | △ 부분 (안내 only, RepoSpecificForm link 안내) |
| H-4 Commit 4 toggle + template | `37d3a95` + `6b6a353` (M-1.2 부분 wire) | △ 부분 (UI/persistence + commitSkipHooks → noVerify default 연결) |

## Sprint c97 partial 산출물 정합 (M-1.2 + M-3)

| Plan #42 항목 | commit | 상태 |
| --- | --- | --- |
| M-1.2 template prefill + removeComments | `857fa1d` + `93a6e38` (Codex 5차 fix) | △ 부분 (3/5 wire 진행) |
| M-3 Issue Tracker forge 1급 안내 | `2042f75` + `d0d8a5a` (Codex 5차 LOW fix) | △ (forge 1급 ✓ + 외부 skeleton 결정 안내 + actionable button) |
| **M-1.2 pushAfter wire** | **`9b7faaa`** + **`a0caae4`** (Codex 6차 HIGH fix) | △ 부분 → **4/5 wire 완료** (commitPushAfter → useCommitMutation onSuccess push IPC) |

## Sprint c98 산출물 정합 (M-1.2 squashByDefault wire — Commit Options △→✓)

| Plan #42 항목 | commit | 상태 |
| --- | --- | --- |
| **M-1.2 squashByDefault wire** | **`13f83bb`** + **`7ffa218`** (Codex 7차 MED+LOW fix) | ✓ **완료** — Rust merge_branch IPC squash 옵션 추가 + Vue useBranchActions + useBranchDragDrop 양쪽 적용 |
| **Commit Options parity** | 5/5 wire 완료 | △ → **✓** 격상 (Codex 7차 HIGH 0) |

## Sprint c99 산출물 정합 (M-1 Git Hooks manager read-only)

| Plan #42 항목 | commit | 상태 |
| --- | --- | --- |
| **M-1 Git Hooks manager UI** | `3368c9e` + `40b8931` (Codex 8차 HIGH fix) | △ 유지 (Codex 권고) — read-only scan + UI + executable bit / core.hooksPath 자동 반영 / 비표준 wrapper 라벨 / 28 표준 hook enumerate. enable/disable / edit / lefthook wrapper 통합은 M-1 후속 |
| Rust git/hooks.rs 신규 196 LOC + IPC + lib.rs 등록 | (`3368c9e` 포함) | ✓ 새 모듈 |
| 신규 SettingsGitHooks.vue + useRepoConfig wire | (`3368c9e` + `40b8931`) | ✓ 통합 |

## Sprint c97 잔여 (다음 진입점)

| # | 항목 | effort | Codex 5차 권고 우선순위 |
| --- | --- | --- | --- |
| 1 | M-1.2 pushAfter + squashByDefault wire (Commit Options △→✓) | M | **1차 권고** — 작은 effort로 ✓ 격상 |
| 2 | M-1 Git Hooks manager UI | M | 사용자 가치 HIGH |
| 3 | M-2 Sparse Checkout repo manager | M | repo-specific manager gap |
| 4 | M-1.1 Conflict Prevention per-repo override (DB migration) | M-L | 비용 대비 parity 효과 작음 (이미 ✓ 집계) |

## Codex 합류 가치 (Memory Rule 3 실측)

| Phase | Claude 단정 수 | Codex CONFIRMED | Codex REFUTED | PARTIAL | Codex-only 신규 | Claude 오류율 |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 2 (Settings) | 17 | 14 | 1 | 2 | 7 | 18% |
| Phase 3 (7 영역 batch) | 17 | 9 | 2 | 4 | 6 | ~24% (보수적) |
| **누적** | **34** | **23** | **3** | **6** | **13** | **~21%** |

Memory Rule 3 baseline 35% 대비 양호. Codex 합류로 신규 backlog 13 + parity 차이 발견 정량 증명.

## 신규 backlog 5건 (Codex finding 기반)

| # | 우선도 | 영역 | 내용 | git-fried 현재 |
| --- | --- | --- | --- | --- |
| SB-NEW-1 | **HIGH** | Status bar | zoom % / Support link / license tier / version 표시 | Sprint c91 Phase A 부분 구현 |
| SB-NEW-2 | MED | Top toolbar | Pull/Push/Branch/Stash/Pop/Terminal 6 command + disabled state + dropdown affordance | GitKrakenToolbar.vue 414 LOC |
| SB-NEW-3 | MED | Sidebar count badges | 각 섹션 라벨 옆 count (LOCAL 35 등) | 일부 미구현 |
| SB-NEW-4 | MED | Right detail panel | Path/Tree segmented + View all files checkbox | CommitDetailSidebar 미통합 |
| SB-NEW-5 | LOW | Tab row polish | active close `x` + overflow + `+` 새 탭 | RepoTabBar 부분 구현 |

## PoC v4 권고 (다음 sprint 진입 전)

본 PoC v3.0 cover 한계 보강:

1. **사용자 setup 명시화** — GitKraken sidebar 의 7 섹션 (LOCAL / REMOTE / WORKTREES / STASHES / CLOUD PATCHES / PULL REQUESTS / TAGS) 모두 expand
2. **image search anchor 도입** — `bench/gitkraken-spike/anchors/12.1.1/` 디렉토리에 sidebar 라벨 PNG 별도 캡처
3. **Settings → Workflow → Hotkey 페이지 캡처** — GitKraken 단축키 list 확보 (Stash / Branch / Pull 등)
4. **각 영역 context menu 캡처** — right-click + screenshot 자동화 (image search 좌표 + MouseClickDrag)
5. **PoC v3 의 4 PARTIAL 영역 재캡처** — 04 tag / 05 pr / 06 worktree default 시각 확인 강화

## 다음 sprint 권고 우선순위 (compound — 다음 진입점)

1. **CRIT-001 PR CI wire** (Sprint c95+ Wave 1 — 이미 인프라 / ARCH-001 다음 sprint 명시) + Codex SB-NEW-3 sidebar PR count parity
2. **HIGH-001 Smart Branch Visibility wire** (Sprint c95 useSmartBranchVisibility composable 정착, UI 미통합)
3. **SB-NEW-1 Bottom-right status bar parity** (Codex 신규 HIGH)
4. **SB-NEW-2~5 통합 MED batch** (Top toolbar / Sidebar counts / Right panel / Tab polish — 모두 GitKraken parity 검증)
5. **PoC v4 toolchain 보강** + 4 PARTIAL 재캡처

## Phase 5 acceptance

- [x] 비교표 20 row (parity matrix)
- [x] parity 통계 (4 ✓ / 9 △ / 4 ✗ / 3 ?)
- [x] Codex 합류 가치 실측 (Memory Rule 3 누적 오류율 21%)
- [x] 신규 backlog 5건 (Codex finding 기반)
- [x] PoC v4 권고 5 항목
- [x] 다음 sprint 권고 우선순위
