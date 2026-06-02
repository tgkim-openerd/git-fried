# Plan #44 — UI/UX 인간 친화성 전면 검토 & 재설계 UltraPlan

> Goal (사용자 2026-06-02): "UI/UX 가 전부 인간 친화적인지 코덱스와 전부 검토 → 미탐색 UI 없을 때까지 → 이론은 웹서칭으로 find → 타 앱 벤치마킹 → 실제 구현 이점이 검증된 항목만 → UI 리디자인 + 기능 추가 & 개선 계획을 시행 가능하게."
>
> 방법: Claude 3 Explore agent + Codex 페어 (R1 blind audit + R2 adversarial) + 웹 UX 이론/벤치마크 리서치. 본 문서는 **검토·리서치 우선** 산출물 (코드 변경 없음 — 구현은 별도 sprint).
>
> 진행 상태(라운드 무관 서술): 현재 라운드/verdict 는 §6 (Codex R2) + §7 참조.

---

## 1. 방법론 & 검증 게이트

| 단계 | 도구 | 산출 |
| --- | --- | --- |
| 인벤토리 SoT | Glob/find 전수 | §2 union-diff 기준점 |
| 기존 자산 digest | Read | §4 (재론 금지 경계) |
| 이론 리서치 | WebSearch | §3 (Nielsen/Laws of UX/WCAG 2.2) |
| 벤치마크 | WebSearch + Codex training | §3 (7 경쟁 앱) |
| Fresh audit (3각) | Explore×2 (visual/feature) + Codex 페어 R1 | §5 themes A-E |
| parent 검증 | Read/grep 재실행 | [VERIFIED] 태그 |
| 적대적 R2 | Codex 페어 | §6 verdict + benefit gate |
| 종합 | Claude | §7 Phase sequencing |

**검증 원칙**: 모든 negative assertion (없음/dead/누락) 은 5-Check 또는 confidence 명시. positive coverage 단정 (이미 구현/다 봤음) 은 §2 union-diff 게이트. "실제 구현 이점" 없는 항목은 §6 benefit gate 에서 DROP.

---

## 2. UI 인벤토리 SoT & Union-Diff Coverage (정직 표기)

**전체 surface = 107** (4 pages + 102 components + App.vue)

| 카테고리 | 수 | 대표 |
| --- | --- | --- |
| Pages | 4 | index / launchpad / repositories / settings |
| App shell | 1 | App.vue (sidebar + RepoTabBar + 9 global modal + StatusBar + CommandPalette + Toast) |
| Modals/Dialogs | 26 | Base/CommitDiff/CommitSearch/CreatePr/HunkStage/InteractiveRebase/MergeEditor/PrDetail/Reflog/RemoteManage/Compare/Bisect/FileHistory/FirstRunWizard/GitKrakenImport/Help/IssueDetail/ReleaseDetail/SyncTemplate/RepoSwitcher/AiResult/BulkFetchResult/Choose/Clone/Confirm/Prompt |
| Panels | 21 | Branch/CommitDetailSidebar/CommitDiff/Forge/GitKrakenToolbar/Issues/Lfs/Pr/RangeDiff/Releases/RepoTabBar/Sidebar/SidebarResize/Stash/StatusBar/Status/Submodule/Sync/Tag/Terminal/Worktree |
| 기타 컴포넌트 | 55 | CommitGraph/CommitTable/DiffViewer(+Merge)/FullscreenDiffView/CommandPalette/ContextMenu/CommitMessageInput/ConventionalCommitBuilder/Mini*(8)/Settings*(12)/primitives(18) |

### Coverage 정직 진술 (§Coverage Claim Discipline 준수)

- **전 surface 스윕됨**: Codex 가 `rg "^" apps/desktop/src -g "*.vue"` 전수 list pass + visual agent 가 token/color/text-size 차원으로 전 파일 grep 스윕.
- **Deep-review (개별 human-friendliness)**: ~24 high-signal surface (pages 4 + App + CommandPalette/BaseModal/BranchPanel/PrPanel/StatusPanel/LfsPanel/useContextMenu/CommitGraph + feature modals 10여). 
- **Swept-not-deep (의도적)**: 18 primitive (Skeleton/Spinner/Avatar/Tooltip/EmptyState/ErrorBoundary/Badge/RefPill/Mini*/Toast — UX 위험 낮음, 시각 스윕만) + 12 Settings sub-panel (2026-05-22 C8 sprint 에서 nav 검색/저장 피드백/기본값 복원 이미 처리 — 재 deep-review 생략, 사유 명시).
- **미탐색 (unseen)**: 0. 단 "전 107 surface 개별 deep human-friendliness review" 는 아님 — high-signal 우선 + 나머지는 dimension sweep + 사유부 생략. (= 정직한 union-diff: 차집합 0 이되 deep-review 깊이는 surface 별 차등)
- **Swept-not-deep 표적 spot-check (검증)**: Settings*/Mini* 의 button aria/hover/target-size grep 결과 — critical 0. unlabeled button (SettingsMaintenance/UiCustomization) 은 전부 **visible-text button** (text = accessible name, aria-label 불요). 유일 minor = MiniStashList/MiniWorktreeList 의 hover-only opacity 컨트롤 2건 (discoverability — THEME 일관성으로 흡수). → swept-not-deep surface 에 숨은 중대 이슈 없음 확인.
- **★ 실제 화면 기반 audit 추가 (사용자 피드백 2026-06-02 "코드 기반 아닌 실제 화면 기반")**: 위 union-diff 는 **코드 구조** 차원. 추가로 Vite dev server(devMock) + Playwright 실제 렌더 → Claude vision 으로 **rendered-visual** 차원 audit 수행 (THEME F). 전 4 page + home 4 component + light/dark 양테마 + Command Palette/Clone/Help overlay sampled. 코드 grep 이 못 잡는 언어혼용·라벨wrap·그룹핑 렌더결함 4 HIGH 도출. 산출물 `docs/ux-eval/audit-2026-06-02/` (캡처 PNG + VISUAL-FINDINGS.md). modal 23개는 BaseModal chrome 공유(코드 21/21) → 시각언어 일관, per-modal 밀도는 Phase 3 systematic modal pass 로 위임.

---

## 3. 이론 & 벤치마크 기반 (웹 리서치)

### 3.1 UX 이론 (평가 프레임)

- **Nielsen 10 Usability Heuristics** — 데스크탑 앱에도 동일 적용. 3-5인 heuristic eval = 전체 usability 이슈의 ~60% 검출 ([NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/)).
- **Laws of UX** — Fitts(타겟 크기/거리), Hick(선택지 수), Jakob(관례 일치), Miller(7±2 인지 한계), Doherty(<400ms 피드백), Aesthetic-Usability, Peak-End. (git-fried 2026-05-22 sprint 이 30원칙 7라운드 이미 적용 — §4)
- **WCAG 2.2 신규 SC** ([W3C](https://www.w3.org/TR/WCAG22/)):
  - **2.5.8 Target Size (Minimum, AA)** — 24×24 CSS px 최소 (간격 예외 有).
  - **2.5.7 Dragging Movements (AA)** — drag-and-drop 은 **single-pointer 대안** 필수 (드래그 못하는 사용자). → git-fried branch drag-merge / tab drag 점검 대상 (THEME B7).
  - **2.4.11/2.4.13 Focus (Not Obscured / Appearance)** — focus 가림 방지 + 충분한 대비.

### 3.2 경쟁 앱 벤치마크 (2025 git GUI 시장)

| 앱 | standout (인간 친화 강점) | git-fried 시사 |
| --- | --- | --- |
| **GitKraken** | 시각적 commit graph(색상 lane), 3-way merge editor, worktree, focus view. 단 "crowded" 비판 | parity 70% 달성 (comparison.md). crowded 회피 = density 설계 |
| **Sublime Merge** | command palette, **class-leading 검색**(commit/diff/file 통합), 키보드 우선, 최speed diff | git-fried command palette 보유 ✓ / **통합 검색 미보유** → THEME E1 |
| **Fork** | 100k+ commit 무지연, drag-drop rebase, 3-way merge, **image diff** | graph 가상화 보유 ✓ / image diff 미보유 → E7 |
| **GitButler** | **virtual branches**(동시 다중 브랜치, hunk 단위 할당), stacked branch, **unlimited undo** | 전략적 차별화 후보 → E5 |
| **GitHub Desktop** | 단순 PR flow, squash-merge UI, **inline PR line comment** | PR review 보유 ✓ / line comment deferred → E3 |
| **Tower** | undo, snippets, quick actions, service 연동 | reflog undo 보유 ✓ / snippets 미보유 → E9 |
| **VS Code Git / Lazygit** | **inline gutter blame**, line staging, 키보드 ergonomics | hunk staging 보유 ✓ / gutter blame 미보유 → E2 |

> 출처: [Best Git GUI 2025/2026](https://thesoftwarescout.com/best-git-clients-2026-top-gui-tools-for-version-control/), [Tower blog](https://www.git-tower.com/blog/best-git-client), [GitButler](https://github.com/gitbutlerapp/gitbutler), [Sublime Merge](https://www.sublimemerge.com/), [DEV comparison](https://dev.to/_d7eb1c1703182e3ce1782/best-git-gui-clients-in-2025-gitkraken-sourcetree-fork-and-more-compared-4gjd).

---

## 4. 이미 구현됨 (재론 금지 경계)

**본 plan 은 아래를 다시 list 하지 않는다** (검증: git log 2026-05-20~27):

- **Laws of UX flow-friction (~80건, sprint 2026-05-22, C1~C10)**: 파괴적 confirm + truthful feedback(C1) / async 상태 일관성(C2) / 리스트 행 키보드 접근성(C3) / 에러 가독성(C4) / 멀티스텝 가시성(C5) / unsaved 보존(C6) / 옵션 노출 PR CI·push·tag·bisect(C7) / Settings nav 검색·기본값 복원·별칭편집·repo untrack(C8) / 단축키·날짜 포맷 일관(C9) / empty state + colorblind graph palette(C10). 7라운드 R7=0 수렴.
- **Button size WCAG 2.5.8 (2026-05-27, `91992ef`)**: 50+ button 24×24, GitKrakenToolbar min-h-[40px], focus-visible 14 loci. ※ **단 BranchPanel 은 focus-visible 만, target-size 누락** (THEME B1).
- **GitKraken feature parity 70%** (comparison.md 30 row): Settings hierarchical / Conflict Prevention / LFS / Commit Options / Git Hooks / Sparse Checkout / status bar / toolbar 6버튼 등.
- **성숙 기능** (feature-gap audit): command palette, hunk staging, file history/blame(modal), interactive rebase(drag), worktree, submodule, LFS, reflog/undo, graph 가상화, PR review.

**본 plan 의 신규 축**: ① 시각 디자인 시스템 일관성 (리디자인) ② overlay/modal 시스템 통합 ③ a11y 완결 잔여(05-27 누락분 + WCAG 2.2 신규) ④ 대용량 반응성 ⑤ 벤치마크 기반 신규 기능.

---

## 5. Consolidated Findings (3각 audit + parent 검증)

> [VERIFIED] = parent context Read/grep 재실행 확인. 나머지는 agent confidence 표기.

### THEME A — Modal/Overlay 시스템 (cross-agent 최고 수렴)

| ID | finding | 증거 | 검증 | UX 원칙 |
| --- | --- | --- | --- | --- |
| A1 | modal stack manager 부재 — 전 BaseModal z-50 동일, useAppModals 는 closeAll 만, 중첩 시 focus trap 경쟁 + Esc 모호 | App.vue:181-209 / useAppModals.ts:47 / BaseModal.vue:99 | [VERIFIED] | Error Prevention |
| A2 | CommandPalette 가 dialog primitive 우회 — role=dialog/aria-modal/focus-trap/restore 전무 | CommandPalette.vue:144 | [VERIFIED] (grep 0) | Focus order |
| A3 | elevation token 정의됐으나 미사용 — `--shadow-popover/modal/toast` main.css:70-72,142-144 양테마 정의, component 사용 **3회**뿐 / raw `z-40/z-50/z-[60]` **16곳** | main.css / components | [VERIFIED] | 시각 계층 |
| A4 | modal backdrop `bg-black/50` 고정 → 중첩 시 double-darken | BaseModal.vue:99 | likely | 가독성 |
| A5 | 18 modal 중 ~7 BaseModal 미사용 (chrome 불일치) | 18 modal | likely (R2 정밀화) | 일관성 |

### THEME B — Keyboard & Target-Size a11y 완결

| ID | finding | 증거 | 검증 | UX 원칙 |
| --- | --- | --- | --- | --- |
| B1 | BranchPanel filter/action button sub-24px (`px-1.5 py-0.5 text-[10px]`, :192 py 없음) — 05-27 wave 누락 | BranchPanel.vue:159,192 | [VERIFIED] (`91992ef` focus-visible only) | WCAG 2.5.8 / Fitts |
| B2 | PrPanel PR row mouse-only `<li>` — role/tabindex/Enter/Space/focus 부재 | PrPanel.vue:212,263 | certain | 키보드 접근 |
| B3 | index.vue 메인 탭 plain button — role=tablist/aria-selected/Arrow nav 부재 | index.vue:194 | certain | WCAG / Jakob |
| B4 | StatusPanel untracked `+` 버튼 title/aria-label 부재 (staged/unstaged 는 有) | StatusPanel.vue:519 | certain | name/role/value |
| B5 | useContextMenu submenu **focus desync 버그** — focusSubMenuItem 가 visible index 를 raw 로 재해석, divider 선행 시 focus ring ≠ Enter 실행대상 (see-one/activate-another) | useContextMenu.ts:222 | [VERIFIED] (logic trace) | Error Prevention |
| B6 | LfsPanel 상태 색/기호(●◌)+분리 범례만 — per-row aria/title 부재 | LfsPanel.vue:267 | certain | 색 의존 a11y |
| B7 | WCAG 2.5.7 Dragging — branch drag-merge/rebase + tab drag 의 single-pointer 대안 점검 (branch 는 action-sheet fallback 일부 존재 가능 — R2 코드 확인) | useBranchDragDrop / RepoTabBar | R2 확인 | WCAG 2.5.7 |

### THEME C — 시각 디자인 시스템 일관성 (리디자인 핵심)

| ID | finding | 증거 | 검증 | effort |
| --- | --- | --- | --- | --- |
| C1 | arbitrary `text-[Npx]` **217곳** (9/10/11px) — fontSize 토큰화 미흡 | components/*.vue | [VERIFIED] | S |
| C2 | 라이트테마 `--secondary == --muted == --accent` 동일 → hover/disabled 무변화 (plan/28 부분수정, 현 상태 R2 확인) | main.css:34-42 | 부분 [VERIFIED] | XS |
| C3 | Button primitive 부재, min-h 7종(24/28/32/40/none) | 40+ 파일 | likely | L (B1 연결) |
| C4 | input border 5 토큰 혼용, 상태(error/warn/success) 시각체계 부재 | 50+ input | likely | S |
| C5 | icon 라이브러리 부재, raw Unicode(✕/+/▼) — 도입 vs 유지 디자인 결정 | 24 컴포 | uncertain | L |
| C6 | line-height: pre/code/h1-3 미세조정 (body 1.55 한글안전 OK) | main.css:169 | likely | XS |
| C7 | dark theme 일부 토큰 대비 AA 경계 (warning ~4.2:1) — 측정 필요 | main.css:118-135 | likely | XS |
| C8 | CommitGraph ref pill 색 비의미적 — semantic 매핑 제안 | CommitGraph.vue | likely | S |

### THEME D — 대용량 데이터 반응성

| ID | finding | 증거 | 검증 | UX 원칙 |
| --- | --- | --- | --- | --- |
| D1 | repositories.vue repo 리스트 무가상화 (v-for, 1k+ repo 저하) | repositories.vue:400-441 | [VERIFIED] | Doherty |
| D2 | launchpad.vue PR board 전 row 즉시 렌더 (가상화 없음) | launchpad.vue:276,312+ | [VERIFIED] | Doherty/Miller |

> 참고: CommitGraph 는 이미 @tanstack/vue-virtual 가상화 (100k+ commit OK). D1/D2 는 같은 패턴 재사용.

### THEME E — 신규 기능 (벤치마크 기반)

| ID | 기능 | 벤치마크 | 현 상태 | 가치 | effort |
| --- | --- | --- | --- | --- | --- |
| E1 | **Global diff/file-content 검색** | Sublime Merge | message-only | ⭐⭐⭐⭐⭐ | M-L |
| E2 | Inline gutter blame | VS Code/Lazygit | modal-only | ⭐⭐⭐⭐ | S-M |
| E3 | Inline PR line comments | GitHub/GitKraken | v1.x deferred | ⭐⭐⭐⭐ | M |
| E4 | CodeMirror merge view | Fork/GitKraken | textarea | ⭐⭐⭐ | M |
| E5 | **Virtual/stacked branches** | GitButler | 부재 | ⭐⭐⭐⭐⭐ | L-XL |
| E6 | Service integration wire | GitKraken | placeholder | ⭐⭐⭐ | L |
| E7 | Image diff | Fork | 부재 | ⭐⭐ | S-M |
| E8 | Vim/keyboard preset | Lazygit | 부분 | ⭐⭐⭐ | S |
| E9 | Snippets/quick-action | Tower | 부재 | ⭐⭐ | M |

### THEME F — Rendered-Visual (실제 화면 기반 — 코드 grep 不검출)

> 방법: Vite dev server(devMock) + Playwright 실제 렌더 → Claude vision. THEME A-E(코드 구조/a11y) 가 못 잡는 **눈으로만 보이는** 시각 문제. 캡처 산출물: `docs/ux-eval/audit-2026-06-02/` (24 PNG). 전 4 page + home 4 component + light/dark 양테마 + **modal 8 distinct content 캡처**(RepoSwitcher/CommitSearch/Help/Reflog/Bisect/Clone/Command Palette/CreatePr — window hook + 단축키 트리거, repo bootstrap 전제).
>
> **모달 수렴 판정**: 캡처 8 modal 전부 동일 BaseModal chrome(header+×+KO+guidance) → 신규 visual theme 0, modal = **강점**(Help kbd-box 그룹핑 / Reflog inline `git reset` 가이드 / action 색코딩). 잔여 18 modal 은 git state(충돌/선택/no-repo) 또는 inline 패널 렌더 → chrome 일관(코드 BaseModal 21/21) 이므로 Phase 3 systematic modal pass(실 fixture) 로 위임. F1(언어혼용)이 modal 라벨에도 재현되나 기존 theme.

| ID | finding | 증거(캡처) | severity | UX 원칙 |
| --- | --- | --- | --- | --- |
| **F1** | **언어 KO/EN 혼용이 전 surface** — top nav 홈/레포/Launchpad/설정, view-tab 그래프/브랜치/Stash/Sub/LFS/PR/WT, repositories "Repository Management"/Browse/Clone, settings nav ~9 EN item(Repository-Specific/Conflict Prevention/Commit/Issue Tracker/Git Hooks/Sparse Checkout/UI Customization/General/About) vs ~5 KO. 미완성 인상 | 02/03/10/11/12/40 | **HIGH** | Consistency, Aesthetic-Usability |
| **F2** | **CJK/긴 라벨 2줄 wrap** — sidebar quick-action "브랜치"(브랜/치) 형제는 1줄 → ragged row / settings nav "에디터/터미널(★AI CLI)"·"외부 도구 연결(v0.5 예정)" 2줄. light+dark 공통 | 02/12/31 | **HIGH** | Aesthetic-Usability, 시각 정렬 |
| **F3** | **repositories "기타" 그룹 ×3 분리** — dotfiles/git-fried/tauri 각각 "기타(1)" 헤더, "기타(3)" 통합 아님. non-org repo 마다 자기 그룹 = 혼란+공간낭비, 그룹핑 로직 결함 | 10 | **HIGH** | Miller, 그룹핑 일관성 |
| **F4** | commit panel 과밀 — Conventional/Free-form+type+scope+subject+body+footer+preview+amend+signoff+--no-verify+button 좁은 컬럼 stack. progressive disclosure 후보 | 05 | MED | Miller / 인지부하 |
| **F5** | Command Palette 우측 컬럼 raw command-id leak — 일부 단축키(⌘L/⌘K) vs 일부 내부 id(invalidate everything / repo.unselect / repo.tab.close-others / navigate /settings) 혼재 노출 | 40 | MED | Mental Model, 내부노출 |
| **F6** | section header 케이싱 혼용(LOCAL/REMOTE/STASHES 대문자 vs Worktree title) / "커밋 그래프" 타이틀 활성 탭 "그래프" 중복 / Sub·WT 비자명 축약 / author avatar GIT vs T 불일치 / ✈=snooze 비표준 메타포 / 부유 −+🔍 zoom affordance 불명 | 02/03/04/05/11 | LOW | Consistency, Recognition |
| **F7** | **강점**: no-repo/empty state 우수 — sidebar "레포 미선택" 안내 + main "🌱 커밋이 없습니다" 액션 가이드 + toolbar 전 버튼 disabled | m12 | — | Empty-state UX |
| **F8** | no-repo 시 sidebar "레포 미선택"(repo 없음) vs main "커밋이 없습니다 / 이 저장소에는…"(repo 있음·commit 없음) **메시지 모순** | m12 | LOW | Mental Model |
| **F9** | CommitDiffModal 좌상단 **"MODAL DIFF" prefix** — dev/디버그 인상 (full-screen diff 자체는 강점) | m06 | LOW | 전문성/polish |
| **F-OK** | **강점(유지)**: graph DAG 렌더 깔끔(선택 노드 orange) / staging tree 색라벨(추가·수정) / status bar 단축키 힌트 / **dark theme parity 우수(leakage 0)** / launchpad starred-row amber 강조 / palette category 그룹핑 / Help kbd-box 그룹핑 / Reflog inline `git reset` 가이드 / CommitDiff green-red diff 렌더 | 전반 | — | — |

**모달 전수 sweep 최종 (goal "잔여 없을 때까지", devMock-B 보강 후)**: **39 PNG, content 캡처 17 distinct modal** + 4 page + 양테마 + empty-state. devMock.ts 에 detail fixture 추가(get_pull_request/read_conflicted/compare_refs/get_file_history/get_file_blame — **mock 레이어만, 프로덕션 불변**)로 PrDetail/MergeEditor/Compare/FileHistory/IssueDetail/ReleaseDetail/HunkStage/CommitDiff/GitKrakenImport 등 렌더 성공.
- 캡처 17: RepoSwitcher/CommitSearch/Help/Reflog/Bisect/Clone/CommandPalette/CreatePr/CommitDiff/Compare/MergeEditor/PrDetail/IssueDetail/ReleaseDetail/HunkStage/FileHistory/GitKrakenImport.
- 신규: F10(MergeEditor 3-way 강점)·F11(PrDetail rich 강점)·F12(ReleaseDetail tag+name 중복 LOW)·F9(CommitDiff "MODAL DIFF" prefix). F1 전 모달 재현.
- **수렴 = 신규 visual theme 0** (17 modal 전부 BaseModal chrome + F1 + 강점 일관).
- **gate-blocked 4 modal 후속 소진 (2026-06-02)**: 트리거 발굴로 **전부 reachable+rendering 확인** — FirstRunWizard(7s auto-open delay) + BulkFetchResult(Fetch All→📡) **clean 캡처**, ConfirmDialog(브랜치 삭제) + AiResult(✨→privacy confirm→ai fixture) **proven-open**(content text; headless dialog-dismiss timing 으로 clean PNG 만 미취득). **전 26 modal reachable, unreachable 0.** 산출물 `docs/ux-eval/audit-2026-06-02/VISUAL-FINDINGS.md §gate-blocked 소진`.

**F-theme 의 의미**: 코드 audit(THEME A-E)는 "i18n 1599 leaf 대칭"·"role/aria 유무"는 잡지만 **언어 혼용 시각 충돌(F1)·라벨 wrap(F2)·그룹핑 렌더 결함(F3)·raw-id leak(F5)** 은 실제 렌더 화면에서만 보임. 사용자 지적("코드 기반 아닌 실제 화면 기반")의 정당성 — F1/F2/F3 는 HIGH 인데 코드 grep 전무 검출.

#### THEME F 코드 root-cause (Codex 교차검증 — **4/4 CONFIRM, false positive 0**)

| ID | verdict | 코드 root-cause (파일:라인) | fix | effort |
| --- | --- | --- | --- | --- |
| F1 | **CONFIRM** | `repositories.vue:183` `<h1>Repository Management</h1>` + `:192` 📂 Browse + `:200` ⬇ Clone = **하드코딩 영어**. settings nav 는 i18n key 쓰나 `ko.json:763-772` **값 자체가 영어**("repoSpecific":"Repository-Specific", conflictPrevention, issueTracker, gitHooks, sparseCheckout, "ui":"UI Customization", `:789` launchpad) | repositories.vue 3곳 i18n key 화 + ko.json 값 한국어 번역. 기술용어(Git Hooks 등) 괄호병기 vs 수용은 **사용자 정책 결정** | S |
| F2 | **CONFIRM** | `ActiveRepoQuickActions.vue:116` `grid-cols-5` 좁은 셀 + `:126` label `<span>` 에 `whitespace-nowrap` 부재 → CJK "브랜치"(`ko.json:811`) 줄바꿈. `settings.vue:243` `w-40` 고정폭 + 긴 라벨(`ko.json:771` 에디터/터미널, `:774` 외부도구) | QuickActions span `whitespace-nowrap` / settings nav `truncate`+`title` 또는 `w-52` 확장 | S |
| F3 | **CONFIRM**(REFINE) | `useSidebarGroups.ts:74` directory 모드 `parentDirName(r.localPath) ?? '__solo__'` — singleton 들이 **dir 별 별도 그룹** 생성, `:95` `label: isSolo ? null` → 전부 "기타"(repositories.vue:419) 로 렌더되나 그룹 객체는 분리 → "기타(1)" ×3. `__solo__` 미통합 = **실제 로직 버그** | `useSidebarGroups.ts:67-95` — `label===null`(singleton) 그룹 전부 `__misc__` 단일 그룹으로 후처리 병합 | S |
| F5 | **CONFIRM** | `CommandPalette.vue:181` `{{ c.hint || c.id }}` fallback → hint 없는 command 가 내부 id(`repo.unselect`/`repo.tab.close-others`/`navigate /settings`) 노출. 일부 hint 도 개발용 문자열(`ko.json:1659` "invalidate everything") | `c.hint || ''`(빈칸) + ko.json 개발용 hint 정리 | XS |

→ vision finding 이 코드 원인과 100% 정합(REFUTE 0). 사용자 지적의 정당성 + 실제 화면 audit 의 actionable 가치 입증. **F1 기술용어 한글화 범위는 사용자 정책 결정 필요** (Decision 4).

---

## 6. Codex R2 적대적 검증 + Benefit Gate

> Codex 페어 R2 (adversarial) 결과 통합. §2.6 Disagree 규칙: Codex REFUTE → 보존적 판단 채택(false positive 비용 > false negative). Codex-only 신규는 5-Check 후 surface.

### 6.1 Verdict 표

| ID | R2 verdict | tier | 비고 (R2 정정) |
| --- | --- | --- | --- |
| A1 | **CONFIRM** | P0 | modal stack manager 부재 + z-50 collision 확정 |
| A2 | **CONFIRM** | P1 | CommandPalette dialog primitive 우회 확정 |
| A3 | REFINE | P2 | token 미사용은 real, 단 "16곳" 카운트 부정확 — 정성만 채택 |
| A4 | **CONFIRM** | P2 | 중첩 backdrop double-darken 확정 |
| A5 | **REFUTE** ❌ | — | **21 *Modal.vue 전부 BaseModal 사용**. 비사용은 overlay primitive(CommandPalette/ContextMenu/Toast) — "7 rogue modal" 과장. → A2 가 CommandPalette cover, 나머지는 의도적 비-modal. **DROP "7 모달" 표현** |
| B1 | **CONFIRM** | P1 | BranchPanel filter sub-24px 확정 |
| B2 | **CONFIRM** | P1 | PrPanel `<li>` mouse-only 확정 |
| B3 | **CONFIRM** | P2 | index 메인 탭 tablist/arrow 부재 |
| B4 | REFINE | P1 | **path-mode** untracked `+` 만 라벨 부재 (tree-mode 는 이미 有) |
| B5 | REFINE | P1 | 버그 real — 정확히는 "Enter 는 visible-filtered item 실행, template 는 raw-indexed item highlight" (= 내 parent trace 와 일치) |
| B6 | **CONFIRM** | P2 | LfsPanel 색/기호 only 확정 |
| B7 | REFINE ↓ | P2 | branch drag **context-menu fallback 존재**(BranchPanel.vue:314, useBranchActions.ts:523-533), tab drag 우클릭 Move 존재. → SC 2.5.7 **완전 누락 아님**, **discoverability** gap 으로 강등 |
| C1 | REFINE | P1 | arbitrary text size **347곳** (217 보다 worse) |
| C2 | **REFUTE** ❌ | — | 현 main.css `--secondary/--muted/--accent` **distinct HSL** (plan/28 수정 완료). **DROP** |
| C3 | **CONFIRM** | P1 | Button primitive 부재 확정 (B1 흡수) |
| C4 | **CONFIRM** | P2 | input 상태 시각체계 부재 |
| C5 | **DROP** | — | icon lib = 디자인 선택, defect 아님 |
| C6 | (유지) | P3 | line-height polish |
| C7 | **REFUTE→REDIRECT** | P3 | dark warning 경계 아님. **light amber-on-white 가 실제 위험** — 방향 전환 |
| C8 | REFINE | P3 | ref pill 은 **kind 별 이미 semantic** (branch/remote/tag/stash class). hue 만 arbitrary — minor |
| D1 | **CONFIRM** | P1 | repositories.vue 무가상화 확정 |
| D2 | **CONFIRM** | P1 | launchpad PR board 무가상화 확정 |
| E1 | CONFIRM | P1 | global search — 신규, 최고 ROI |
| E2 | CONFIRM | P2 | gutter blame — modal→gutter |
| E3 | REFINE ↓ | P2 | **inline comment form 이미 존재**(api+PrDetailModal, 단 수동 path/line). → "수동 → inline diff overlay 승격" 으로 축소 |
| E4 | REFINE ↓ | P2 | **split diff 는 이미 @codemirror/merge**. → **MergeEditorModal conflict editor 만** textarea. 범위 축소 |
| E5 | CONFIRM | P3 | virtual branches — 전략, POC-gated |
| E6 | REFINE ↓ | P3 | **forge API 이미 존재** + settings scaffold 有. → "기존 API wire-up" 으로 축소 |
| E7/E8/E9 | (유지) | P3 | image diff / vim / snippets — backlog |

### 6.2 Codex-only 신규 (5-Check 통과)

- **A6 [VERIFIED] — `closeAllModals` 가 `compareOpen` 미닫음**: [useAppModals.ts:47-54](../../apps/desktop/src/composables/useAppModals.ts#L47) 가 7 modal close 하나 `compareOpen`(:31) 누락 → ⌘W/Esc-all 시 Compare overlay 잔존. severity MED (Compare 는 read-only, data-loss 낮음, 단 일관성 위반). **Phase 1 에 흡수** (overlay 시스템 정리 시 1라인). E4 merge editor 마이그레이션 시 MergeEditorModal dirty-close guard(:119-129) 보존 필수.

### 6.3 Benefit Gate 최종 (DROP 목록)

- **DROP**: A5(false), C2(이미 수정), C5(디자인 선택). 
- **범위 축소 (이미 부분구현)**: B7(fallback 존재→discoverability), E3(form 존재→overlay 승격), E4(merge view 존재→conflict editor 만), E6(API 존재→wire).
- **방향 전환**: C7(dark→light amber).
- **생존 + 실제 이점 확정**: A1·A2·A3·A4·A6 / B1·B2·B3·B4·B5·B6 / C1·C3·C4 / D1·D2 / E1·E2·E3·E4·E5·E6.

### 6.4 수렴 증거 (Round 3 — "미탐색/누락 없을 때까지")

**독립 metric sweep (app-wide aggregate, parent context)** — theme 이 systemic 이슈를 cover 하는지 정량 확인:

| smell class | 전역 카운트 | theme 판정 |
| --- | --- | --- |
| raw `z-40/50/[60]` vs elevation token 사용 | 16 vs 3 | A3 systemic 확정 |
| arbitrary `text-[Npx]` | **346** | C1 (≈347) 확정 |
| small-padding button loci | 168 | C3 Button primitive high-leverage 확정 |
| color-only `●/◌` 상태 | **12 파일** | **B6 범위 확장** — LfsPanel 단독 아님 |
| `role="tablist"` 전역 | 0 | B3 가 유일 tab-ARIA gap |
| button 312 vs aria/title 382 | 라벨링 양호 | unlabeled 은 예외 → 수렴 |

**B6 refinement (누락 보완)**: color-only 상태가 **12 파일 패턴** (LfsPanel + Mini*/status dot 등). 제안 fix 를 "per-row aria/title + 상태 텍스트 convention 을 12 파일 공통 적용" 으로 일반화. THEME B6 scope 확장.

**수렴 판정**: metric sweep 에서 신규 systemic theme 0 (A-E 가 bulk cover) + Codex R3 per-file NEW 판정은 §6.5. → "미탐색/누락 없음" 정량 근거 확보.

### 6.5 Codex R3 per-file 수렴 결과 (54/54 미-deep surface 전수)

Codex R3 가 deep-review 안 됐던 54 surface (panel 13 + modal 16 + 기타 11 + Settings 12 + 2) 전수 read → **NEW 5건** (모두 기존 THEME B 클래스의 새 인스턴스, 새 theme 0):

| # | surface | finding | class | effort |
| --- | --- | --- | --- | --- |
| B8 | **CommitTable.vue:131** | commit row 가 `@dblclick` only — Enter 키 경로 없음 (role/tabindex 부재) | B2 (mouse-only) | S |
| B9 | ProfileSwitcher.vue:75 | dropdown profile row mouse-only `<li @click>` (roving/Enter 부재) | B2 | S |
| B10 | RemoteManageModal.vue:102 | inline rename/url editor 표시 시 focus 미이동 | focus mgmt | XS |
| B11 | SyncTemplateModal.vue:174 | target repo checkbox 라벨/aria 부재 | B4 (label) | XS |
| B12 | CompareModal.vue:89 | compare ref input placeholder-only (durable label 부재) | B4 | XS |

> 추가: SidebarResizeHandle.vue 는 R3 스코프 외 (resize handle — keyboard resize 가능 여부 별도 점검 후보, confidence:uncertain).

### 6.6 수렴 판정 (최종 — "미탐색/누락 없을 때까지")

| 축 | 상태 | 근거 |
| --- | --- | --- |
| **Surface 탐색** | **107/107 cover** | R1 deep 24 + R3 deep 54 + swept-not-deep spot-check 통과. union diff 차집합 0 |
| **Theme taxonomy** | **포화 (수렴)** | R2·R3 신규 theme 0. A-E 가 모든 systemic 이슈 cover |
| **Instance 수렴 추세** | 하향 (10 → 5 NEW) | R1 10 → R3 5 NEW, 전부 B2/B4 계열. 인스턴스 tail 존재 |
| **Instance tail 처리** | **systematic sweep 로 sized** | B2(mouse/dblclick-only row) ≈ 11-15 surface / B4(checkbox·input label) = 31 checkbox·17 파일 `<label>`. Phase 2 systematic 항목으로 흡수 (개별 무한 enumerate 대신) |

**결론**: 모든 **surface 탐색 완료** + **theme 포화** = 목표 "미탐색/누락 없음" 충족. 잔여 instance tail (B2/B4 계열) 은 plan 의 무한 나열 대상이 아니라 **Phase 2 systematic a11y sweep** 의 sized scope 로 위임 (구현 sprint 작업). R4 추가는 동일 클래스 인스턴스만 재발견 → diminishing, plan 단계에서 불필요.

---

## 7. Phase Sequencing (시행 가능 계획)

### 7.1 Claude 독립 제안 (페어 2-view — §7.2 에서 R2 와 reconcile 완료)

**Benefit gate 사전 판정 (실제 구현 이점 기준)**:

| 등급 | 항목 | 사유 |
| --- | --- | --- |
| **사용자 직접 체감** | A1·A2·B1·B2·B3·B4·B5·B6·C2·C4·C7·E1·E2·E3 | 측정가능: focus escape 0 / 키보드 단독 조작 가능 / WCAG 충족 / hover·disabled 가시 / 검색·blame·리뷰 시간 단축 |
| **간접(dev 유지보수 → 일관성)** | A3·A5·C1·C3·C8 | 토큰화/primitive — 사용자 체감은 일관성으로 간접. "구현 enabler" 로 frame |
| **조건부** | D1·D2 (repo/PR 규모 1k+ 시), B7 (drag fallback 부재 시), A4 (중첩 modal 빈도) | 본 사용자(개인 dual-forge, repo ~6) 는 D 우선도 낮음 — 정직 표기 |
| **polish / 선택** | C5(icon lib)·C6(line-height)·E7(image diff)·E8(vim)·E9(snippets) | ROI 낮음 또는 디자인 취향 — 후순위 |
| **전략 (POC-gated)** | E5(virtual branches)·E6(service integ) | 큰 가치이나 L-XL + 회귀 위험 → 별도 POC 후 의사결정 |

**Phase 묶음 (같은 시스템/파일 묶기)**:

- **Phase 1 — Overlay/Modal 시스템 통합 (P0)** : A3(elevation token 적용) → A1(modal stack manager) → A2(CommandPalette 를 BaseModal primitive 로) + A4 + A5(7 modal 흡수). **한 시스템 = 한 Phase**. 의존: A3→A1→{A2,A4,A5}.
- **Phase 2 — a11y 완결 quick-win (P0/P1)** : B5(submenu 버그 fix, 단발) + B2·B3·B4·B6(role/aria/keyboard, 다수 XS-S) + B7(R2 확인 후). B3 는 공용 tab composable 로. 대부분 독립 소작업.
- **Phase 3 — 디자인 시스템 토큰화 (P1)** : C1(fontSize 토큰) + C2·C7(color/contrast) + C6 먼저(CSS only) → C3(Button primitive, **B1 24px 흡수**) + C4(input 상태) → C8·C5(polish). 의존: C1→C3→B1.
- **Phase 4 — 대용량 반응성 (P2, 규모 gated)** : D1+D2 (CommitGraph 의 @tanstack/vue-virtual 패턴 재사용). 사용자 repo/PR 규모 확인 후 진행.
- **Phase 5 — 신규 기능 high-leverage (P1-P2)** : E1(global search) → E2(gutter blame) → E3(PR line comment) → E4(merge view). 각 독립.
- **Phase 6 — 전략/backlog (P3)** : E5(virtual branch, 별도 POC 브랜치) · E6(service integ) · E7·E8·E9.

**Dependency graph (Claude view)**:
```
A3 ──▶ A1 ──▶ A2, A4, A5            (overlay 시스템)
C1 ──▶ C3 ──▶ B1                    (sizing token → Button primitive → 24px)
B3 ──▶ (shared tab composable) ──▶ index 탭 / PrDetail 탭 재사용
E1, E2, E3, E4  : 상호 독립 (병렬 가능)
E5 : POC 선행 필수 (Rust git model)
```

### 7.2 최종 Phase 계획 (Claude 7.1 ⊕ Codex R2 reconcile)

> 7.1 Claude view 와 R2 verdict diff 반영: A5/C2/C5 제거, A6 추가, B7/E3/E4/E6 범위 축소, C7 방향전환, C1 카운트 347.

**Phase 1 — Overlay/Modal 시스템 통합 (P0, 한 시스템=한 Phase)**
- 항목: A1(modal stack manager) + A2(CommandPalette → dialog primitive/focus-trap) + A3(elevation token 적용) + A4(backdrop opacity prop) + **A6(closeAllModals 에 compareOpen 추가 — 1라인)**
- 의존: A3 → A1 → {A2, A4}. A6 은 독립 quick.
- 실제 이점: focus escape 0 / Esc 가 top overlay 만 / 시각 z-계층 명확 / Compare 도 ⌘W 로 닫힘 (일관성).
- 주의: useAppModals closeAll 호출부 시맨틱 보존. ContextMenu/Toast 는 의도적 비-modal (A5 refute) — 건드리지 않음.

**Phase 2 — a11y 완결 (P0/P1 quick-win) + systematic sweep**
- 단발 fix: B5(submenu focus desync 버그) + B1(BranchPanel 24px) + B3(index 탭 ARIA tablist+roving tabindex, 공용 tab composable) + B7(drag discoverability affordance) + B10(RemoteManage inline editor focus 이동)
- **B2 systematic sweep (mouse/dblclick-only row → 키보드 경로)**: PrPanel(B2) + **CommitTable(B8, 주요)** + ProfileSwitcher(B9) + @dblclick 11 파일·clickable `<tr>` 6 파일 audit → role/tabindex/Enter 일괄. (CommitGraph 등 이미 J/K nav 보유분 제외 확인)
- **B4 systematic sweep (label/aria)**: StatusPanel path-mode `+`(B4) + SyncTemplate checkbox(B11) + Compare ref input(B12) + 31 checkbox·input 라벨 coverage audit (17 파일만 `<label>`) + LfsPanel 색-only(B6, **12 파일 color-only 상태** 공통 텍스트 convention)
- 실제 이점: 키보드 단독 전체 조작 / 스크린리더 parity / WCAG 2.5.8·name-role-value 충족 / submenu 오작동 제거. B1 은 Phase 3 Button primitive 와 합칠 수도.

**Phase 3 — 디자인 시스템 토큰화 + primitive (P1, 리디자인 핵심)**
- 3a (CSS-only, blast-radius 안전): C1(fontSize 토큰 8/9/10/11 + **347곳** 점진 치환, ≤10 파일 dry-run 먼저) + C6(pre/code/h1-3 line-height) + C7(**light amber-on-white** 대비 측정·보정)
- 3b (primitive 추출): C3(Button primitive 3 size — **B1 24px 흡수**) + C4(input error/warn/success 상태)
- 3c (polish): C8(ref pill hue 정리 — semantic layer 이미 존재, hue만)
- 의존: C1 → C3. C2/C5 는 DROP (이미 수정/디자인 선택).
- 실제 이점: 217→347 arbitrary size 제거 = 유지보수 + 시각 일관성 / 버튼·인풋 상태 self-documenting / 라이트테마 대비 안전.

**Phase 4 — 대용량 반응성 (P1, 단 규모 gated)**
- 항목: D1(repositories.vue) + D2(launchpad PR board) — CommitGraph 의 @tanstack/vue-virtual 패턴 재사용.
- **규모 게이트**: 본 사용자(개인 dual-forge, repo ~6) 는 D1 체감 낮음. launchpad PR 다수 workspace 면 D2 우선. 실제 repo/PR 규모 확인 후 착수.

**Phase 5 — 신규 기능 high-leverage (P1-P2, 상호 독립 병렬 가능)**
- E1(Global diff/file-content search — Sublime Merge parity, Rust ripgrep + ranked UI) **최우선**
- E2(Inline gutter blame — CodeMirror decoration + 기존 blame data join)
- E3(PR comment **수동 form → inline diff overlay 승격** — 신규 아님)
- E4(**MergeEditorModal conflict editor 만** @codemirror/merge 로 — split diff 는 이미 적용됨)
- 실제 이점: "이 함수 바꾼 commit?" 검색 / blame click 절감 / 리뷰 ergonomics / conflict 시각 해소.

**Phase 6 — 전략/backlog (P3, POC-gated)**
- E5(virtual/stacked branches — **별도 POC 브랜치 필수**, Rust git model 신규, 15+ 파일) · E6(forge API wire-up — 신규 아님) · E7(image diff) · E8(vim preset) · E9(snippets)

**THEME F (rendered-visual) 배치 — 실제 화면 기반, 사용자 핵심 요구**
- **Phase 2 quick-win 흡수**: F3(repositories "기타" 그룹핑 버그 — Codex root-cause 검증 후 단발 fix) + F5(command palette raw-id leak — shortcut 없으면 빈칸/사람라벨) + F2(라벨 wrap — `whitespace-nowrap`/min-width CSS, sidebar quick-action + settings nav)
- **신규 Phase F — 언어 일관성 sweep (P1, HIGH)**: F1(전 surface KO/EN 혼용) — ① 언어 정책 결정(기술용어 EN 허용 범위 vs 전면 KO) ② 하드코딩 EN → i18n key 전환(Codex 가 하드코딩/i18n 판정 중) ③ "Repository Management"/Browse/Clone/settings nav 9 item/Sub·WT 축약 정리. **i18n 1599 leaf 대칭이 못 잡은 영역** — effort S-M, 사용자 정책 결정 선행.
- **Phase 3 흡수**: F4(commit panel progressive disclosure) + F6(케이싱·중복타이틀·avatar·snooze 아이콘·zoom affordance polish)
- **유지(F-OK)**: graph DAG / staging 색라벨 / status bar 힌트 / **dark parity** / palette 그룹핑 — 건드리지 않음.

**최종 Dependency graph**
```
A3 ─▶ A1 ─▶ {A2, A4}      A6 (독립)         [Phase 1]
C1 ─▶ C3 ─▶ B1(흡수)       B3 ─▶ tab composable  [Phase 2/3]
E1‖E2‖E3‖E4 (병렬)          E5 ─◀ POC 선행      [Phase 5/6]
D1‖D2 (규모 gate)                                [Phase 4]
```

**권장 착수 순서**: Phase 1(P0 정합성) → Phase 2(P0/P1 quick a11y) → Phase 3(P1 리디자인) → Phase 5 E1·E2(P1 신규) → Phase 4(규모 확인 시) → Phase 6(POC).

---

## 8. Risks & POC 요구

- **E5 virtual branches**: Rust git model 신규 (hunk↔branch 매핑) — 15+ 파일 영향, **별도 POC 브랜치 필수** (CLAUDE.md Architecture POC 룰).
- **C3 Button primitive**: 40+ call-site refactor — scope-lock + 점진 마이그레이션 (한 번에 금지).
- **C1 fontSize 토큰화**: 217 find-replace — blast-radius check (≤10 파일 dry-run 먼저).
- **A1 modal manager**: 기존 useAppModals 시맨틱 보존 (closeAll 호출부 깨지지 않게).

---

## 9. Acceptance Criteria

- [x] 107 surface union-diff 차집합 0 (§2) — 충족 (deep 24 + dimension sweep 전수 + swept-not-deep spot-check)
- [x] 이론 3 프레임(Nielsen/Laws of UX/WCAG 2.2) + 7 앱 벤치마크 인용 (§3)
- [x] 5 theme finding + parent 검증 [VERIFIED] (§5)
- [x] Codex R2 adversarial + benefit gate (§6) — REFUTE 3·DROP·REFINE 8 + 신규 A6 5-Check
- [x] Phase sequencing + dependency graph (§7) — Claude ⊕ Codex 2-view reconcile
- [x] **수렴 (미탐색/누락 없음) (§6.6)** — surface 107/107 + theme 포화 + instance tail systematic sweep 로 sized (Codex R1→R3, 신규 theme 0)
- [x] 모든 항목 effort(XS-XL) + 실제 구현 이점 명시, 시간 환산 0

## 10. 다음 단계 (구현 sprint 진입점)

본 plan 은 **검토·리서치 산출물** (코드 변경 0). 구현은 Phase 별 별도 sprint:
- 즉시 착수 가능 quick-win (단발·저위험, Codex 검증된 fix 위치): **A6**(closeAllModals 1라인) + **B5**(submenu 버그 fix) + **B10**(RemoteManage focus) + **B11·B12**(checkbox/input label) + **B1**(BranchPanel 24px) + **F3**(useSidebarGroups.ts:67-95 singleton `__misc__` 병합 — "기타"×3 버그) + **F5**(CommandPalette.vue:181 `c.hint||c.id`→`||''` raw-id leak) + **F2**(ActiveRepoQuickActions.vue:126 `whitespace-nowrap` + settings.vue:243 nav 폭).
- `/plan` 또는 sprint 진입 시 **Phase 1(overlay 통합)** 부터 — P0 정합성 + cross-agent 최고 수렴.
- **Phase 2 systematic a11y sweep** = B2(11-15 row surface) + B4(31 checkbox) 일괄 — sized.
- **E5(virtual branches)** 는 진입 전 별도 POC 브랜치 + 사용자 전략 결정 필요 (개인 도구에서 GitButler 모델 ROI 판단).
- D1/D2 는 실제 repo/PR 규모 사용자 확인 후.

### Codex 페어 가치 실측 (본 plan, R1+R2+R3)
| 지표 | 값 |
| --- | --- |
| Claude+agent 단정 | 30 |
| Codex R2 REFUTE/DROP | 3 (A5·C2·C5) — false positive 차단 |
| Codex R2 REFINE | 8 (A3·B4·B5·B7·C1·C8·E3·E4·E6) |
| Codex-only 신규 (R2) | 1 (A6 closeAllModals) |
| Codex R3 신규 인스턴스 (수렴) | 5 (B8 CommitTable·B9·B10·B11·B12) |
| 수렴 추세 | R1 10 → R3 5 NEW, 신규 theme 0 (포화) |
| Claude 오류율 (REFUTE/전체) | ~10% (Memory Rule 3 baseline 35% 대비 양호) |
