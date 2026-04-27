# Changelog

All notable changes to git-fried will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sprint 22-8 — plan/22 잔여 종료 (Modal 4 + V-11/12 + F-P1 + aria 5):
  - **BaseModal `align` prop** — `'center' (기본) | 'top'` (palette/switcher 용 `pt-24`)
  - **잔여 4 modal BaseModal 마이그레이션** — 누적 **18 modal 전부 완료**:
    - RepoSwitcherModal — `align="top"` + show-close-button=false + panel-class="w-[640px]"
    - HunkStageModal — header slot (모두 ✕/✓ + 닫기) + show-close-button=false + panel-class max-h-[90vh] w-[1000px]
    - InteractiveRebaseModal — title + panel-class max-h-[90vh] w-[720px]
    - MergeEditorModal — `isOpen = computed(open && path != null)` + header/footer slot
  - **V-11 IssueDetailModal 신규** — `components/IssueDetailModal.vue` — IssuesPanel row click → 자체 modal (state 뱃지 + author + 라벨 + bodyMd + ↗ 외부 열기). IssuesPanel 외부 link-only → self-modal 격상 + LoadingSpinner + EmptyState 적용
  - **V-12 ReleaseDetailModal 신규** — `components/ReleaseDetailModal.vue` — ReleasesPanel row click → 자체 modal (draft/pre 뱃지 + tag + name + bodyMd changelog + ↗ 외부 열기). ReleasesPanel 동일 패턴 + LoadingSpinner + EmptyState
  - **F-P1 App 시작 spinner** — Sidebar reposQuery isFetching 시 LoadingSpinner ("레포 목록 로딩 중...") + 빈 상태 EmptyState ("레포 없음" with [+ 추가] / [⬇ Clone] 안내). 첫 진입 + 150 레포 환경 3s+ 대기 친화 UX
  - **잔여 aria-label 5건** — StatusBar (AI 분석 ✨ / Launchpad badge link) + Sidebar header (워크스페이스 ⚙ / 일괄 fetch ⤓ / 일괄 결과 📡)
  - 검증: typecheck 0 / lint 0 / vitest 13 pass
  - **plan/22 모든 sprint 부분/완료** (22-1 ~ 22-8)
- Sprint 22-7 — Q-3 한글 너비 + 복잡 Modal 3건 + aria-label 11건 (`docs/plan/22 §22-7`):
  - **Q-3 visualWidth utility 추출** — 신규 `utils/visualWidth.ts` (visualWidth / visualTruncate / cjkRatio export). CommitMessageInput 의 inline 함수 → utility import (DRY)
  - **Q-3 RepoTabBar 한글 tab label 시각 보정** — visualWidth > 24 cell 시 `max-w-[180px]` → `max-w-[280px]` 동적. 한글 tab name dense 환경 (회사 50+ 한글 레포) 가독성 향상
  - **Modal BaseModal 마이그레이션 3건 (복잡 layout)**:
    - CommitDiffModal — V-3 header action group (cherry-pick / revert / reset) 보존, header slot + show-close-button=false + panel-class for w-[1000px] + AiResultModal 외부 분리 (Vue fragment)
    - CompareModal — split layout (좌 commit list + 우 patch) 그대로, max-h-[90vh] w-[1100px]
    - PrDetailModal — V-2 Conversation/Files tab 보존 + footer slot (Merge/Close/Reopen + 머지 방식 select with aria-label)
    - 잔여 4 modal: RepoSwitcherModal (top-aligned palette) / HunkStageModal / InteractiveRebaseModal / MergeEditorModal — 별도 sprint
  - **S-1 aria-label 11건 추가** — StatusPanel (history / discard / hunk-stage / hunk-unstage / stage 동적 path) + RepoTabBar (탭 닫기 / 새 탭 추가) + TagPanel (push / del local / del remote 동적 tag name) + PrDetailModal 머지 방식 select
  - 누적 BaseModal 14 modal / aria-label 17건 (Sprint 22-5 6 + 본 sprint 11)
  - 검증: typecheck 0 / lint 0 / vitest 13 pass
- Sprint 22-6 + V-5 + Modal 마이그레이션 8건 (`docs/plan/22 §22-6`, Q-3 다음 sprint):
  - **Modal BaseModal 마이그레이션 8건** — RemoteManageModal / ReflogModal / BisectModal / CreatePrModal / CloneRepoModal / FileHistoryModal (path nullable → computed isOpen) / SyncTemplateModal / GitKrakenImportModal. **잔여 7 modal**: CompareModal / CommitDiffModal / RepoSwitcherModal (top-aligned palette) / HunkStageModal / InteractiveRebaseModal / MergeEditorModal / PrDetailModal (복잡 layout, 차후)
  - **V-5 StatusPanel inline diff preview** (Sprint 22-4 V-5 이월 처리) — 선택 파일 하단 30% (min-height 140px) detail panel: file 경로 + STAGED/WORKDIR 뱃지 + + stage / − unstage / ✂ hunk / ⤺ discard / ✕ 닫기 quick action + DiffViewer (CodeMirror unified diff, getDiff IPC + STALE_TIME.REALTIME). focusMode 와 충돌 없음 (StatusPanel 내부 분할 — 우측 detail 영역 미점유)
  - **F-I1 StatusPanel file filter** — 변경 파일 50+ 환경용 부분 매칭 input (filteredStaged/filteredUnstaged/filteredUntracked/filteredConflicted computed). ✕ 클리어 버튼 + aria-label
  - **Q-4 LoadingSpinner + EmptyState components** —
    - 신규 `components/LoadingSpinner.vue` (size sm/md/lg + label + inline 모드 + role="status" + animate-spin)
    - 신규 `components/EmptyState.vue` (icon + title + description + action slot + size sm/md)
    - PrPanel 시범 적용 (불러오는 중 spinner + "PR 없음" empty state with stateFilter 안내)
  - **F-I2 Forge 401/403 token UX** — `humanizeGitError` 에 HTTP 401 (Bad credentials / token expired / invalid token) + 403 Forbidden 패턴 + 각각 한국어 가이드 (PAT 재발급 위치 / scope 안내, GitHub vs Gitea 구분). 모든 forge IPC 실패 toast 가 자동 적용 (describeError chain)
  - 검증: typecheck 0 / lint 0 / vitest 13 pass
- Sprint 22-5 — BaseModal + useFocusTrap + S-1 aria-label 시범 (`docs/plan/22 §22-5`, 점진 마이그레이션):
  - **Q-2 useFocusTrap composable** — 신규 `composables/useFocusTrap.ts` — open watch → first focusable 자동 focus, Tab/Shift+Tab wrap, close 시 prev focus 복원 (WCAG 2.1 AA 2.1.2 No Keyboard Trap, 2.4.3 Focus Order). FOCUSABLE_SEL = `button:not([disabled]):not([tabindex="-1"]),[href]...,[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])`. capture phase keydown listener + watch immediate
  - **Q-1 BaseModal 추출** — 신규 `components/BaseModal.vue` (Teleport + z-50 + max-w-* prop ('xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|full') + role="dialog" + aria-modal + aria-labelledby + ESC close + backdrop click + slots: header/default/footer + 자동 useFocusTrap). 3 modal 마이그레이션: HelpModal / AiResultModal / BulkFetchResultModal. **잔여 15 modal** 점진 (Compare / MergeEditor / PrDetail / InteractiveRebase / HunkStage / FileHistory / GitKrakenImport / RemoteManage / RepoSwitcher / Sync / Bisect / Reflog / CreatePr / Clone / CommitDiff)
  - **S-1 aria-label 시범 6건** — BranchPanel (Hide / Solo / AI Explain / Delete) + Sidebar (Pin / 별칭 편집). 동적 label (`'${b.name}' 그래프에서 숨김` 등). 잔여 ~41 button 점진
  - **V-6 보강** — `pages/index.vue::onShowDiff` 를 `window.gitFriedShowDiff` 에 onMounted 등록 + App.vue 의 ReflogModal `@show-diff` → `onReflogShowDiff(sha)` → `window.gitFriedShowDiff?.(sha)` 호출. ReflogModal dblclick / CM-10 Show diff 메뉴가 CommitDiffModal 트리거
  - `types/window.d.ts` 에 `gitFriedShowDiff?: (sha: string) => void` augmentation
  - 검증: typecheck 0 / lint 0 / vitest 13 pass
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
    - `06-gitkraken-feature-parity.md` — GitKraken 기능 ≈87 catalog (✅52 구현 / ⚠️10 부분 / 🔜15 v0.4~v1.0 예정 / ❌10 의도적 skip) + 4 design hard constraint (Layout extensibility / Density 강제 / Plugin slot / 미구현 placeholder 정책). plan/03 + plan/14 + plan/22 합본 + § 8-5/8-6/8-7 (AI CLI 시각 / Cloud-Free / Migration UX onboarding)
  - **Figma Make Iteration 1+2 — Sprint 1 (Foundations) 통과**: Page 01 Foundations 8 카드 (Color Q2 분리 / Pretendard / Spacing·Radius / Elevation·Z-index) + Page 01b Layout Extensibility 5 와이어프레임 (Tab overflow / Settings 2-level / Palette 60+ / Modal 5 size tier / Sidebar Integrations slot). Q1~Q8 + 5-1~5-4 self-assessment ✓
  - **Sprint 2~5 보류 결정** (사용자 판단): plan/22 코드 작업 stabilize + dogfood friction 누적 후 visual refactor 한 번에 진행. 재개 조건은 plan/23 § 9 (3 트리거 중 2 만족). 보존 자산: 7 문서 + 36 PNG + IPC mock + 캡처 스크립트 + Figma file (Page 01·01b 잔존)
  - **Figma Make Iteration 3 — Sprint 2 산출물 도착 (보류 prompt 도달 전 작업 완료)**: 옵션 A 선택 — 산출물 보존만:
    - Page 02 Primitives (D5 Button 4×5×3 + icon-only / D6 Form 6 — Input·Textarea visualWidth·Checkbox·Radio·Select·Tabs scrollable)
    - Page 03 Modals (D7 BaseModal 5 size tier + a11y + 5 시뮬레이션: CommandPalette·Bisect·RepoSwitcher·CreatePr·CommitDiff)
    - Page 04 Floating (D8 Tooltip 4 variant / D9 ContextMenu P0 3개 / D10 Toast 4 severity + dedup + action)
    - a11y 13 icon-only 한국어 aria-label 카탈로그
    - Q1~Q3 confirm: Settings 6 그룹 (★AI CLI = 에디터·터미널 통합) / Modal `full` (GitKrakenImport·MergeEditor·InteractiveRebase 만) / Integrations slot (collapsed + status row, marketing 0)
    - Sprint 3 진입은 § 9 트리거 후 (현재 트리거 C 가 2/3 — Sprint 22-5 BaseModal+useFocusTrap 도입으로 진행, Tooltip 만 남음)
  - **2026-04-27 결정 번복 — Sprint 2~5 보류 해제, Sprint 3~5 즉시 진행**: 사용자 "모든 디자인 뽑고 싶어" 결정. § 9 트리거 무효화. Sprint 3 (Hub Screens) 즉시 발송 → Sprint 4 (18 Modal Audit) → Sprint 5 (UX Polish + D25~D27). 미캡처 모달 7 도 02-component-inventory.md spec 따라 디자인 진행. 코드 implementation 은 디자인 완성 후 한 번에 visual refactor
  - **Figma Make Iteration 4 — Sprint 3·4·5 완료 (디자인 100%)**: Figma file `git-fried Design System.html` 7 페이지 / 60+ 아트보드:
    - Page 05 Hub Screens — D11 CommitDiff (xl, AI streaming) / D12 PrDetail (xl, 3 tab + Merge dropdown) / D13 StatusPanel (5 frame, V-5 detail 포함) / D14 메인 1440×900 (★ Integrations slot + virtualization) / D14b Onboarding (full, 5 step: 환영·GitKraken detect+dry_run·fallback·forge·완료)
    - Page 06 Modal Audit — 18 modal audit table + 17 ContextMenu 12 위치 86 actions + 미캡처 신규 3 (MergeEditor 3-pane full / HunkStage left-list+right-picker full / RemoteManage md)
    - Page 07 UX Polish D18~D27 — Skeleton 4 / Empty 4 / DnD 4 시나리오 / Long-running 30s·1m·4m / 한글 visualWidth+ellipsis+⚠ / **a11y 47 aria-label** (툴바 13+StatusPanel 8+Graph 7+Sidebar 7+Diff 8+Ctx 3+1) / Motion 12 transition+reduced-motion / **Layout audit Tab 7→10 → ⌘8+ overflow dropdown** / Plugin/Integration 3 slot / v0.4 placeholder pattern + 🔜 15 항목 카탈로그
    - Self-assessment 8/8 ✓ (토큰 재사용 / Q1·Q2·Q3 / 미캡처 placeholder / skip 0 / 한국어 100% / 정보 밀도)
    - **다음 단계**: Visual Refactor — plan/24 후보 (토큰 → primitives → hub screens → modals → polish 코드 적용)
- **2026-04-27 plan/24-visual-refactor.md 신규 작성** — Figma 디자인 → 코드 적용 절차서. 6 sub-sprint × 12~18일:
  - Sprint A Foundation 토큰 (1~2일) — Pretendard self-host + Q2 색 분리 + Elevation 3 tier + Z-index 6 layer + Status semantic (success/warning/info)
  - Sprint B Primitives + reka-ui (2~3일) — 🔥 Tooltip primitive + ContextMenu reka-ui wrap + Button 4×5×3 + Form 6 + Toast dedup
  - Sprint C Hub Screens (3~5일) — D11 CommitDiff / D12 PrDetail / D13 StatusPanel / D14 Sidebar+Integrations slot / 🆕 D14b Onboarding (full size, 5 step) + Tab overflow ⌘8+ dropdown + Settings 2-level 6 그룹
  - Sprint D Modal Audit (2~4일) — BaseModal 잔여 7 + 미캡처 5 신규 (MergeEditor/HunkStage/RemoteManage/AiResult/GitKrakenImport) + ContextMenu 17/17
  - Sprint E UX Polish (3~5일) — Skeleton 4 / Empty 4 / DnD 4 시나리오 / Long-running 30s·1m·4m / 한글 좌측 ellipsis+tooltip / a11y 47/47 / Motion 12+reduced-motion / Plugin slot 활용 / v0.4 placeholder
  - Sprint F 검증 (1~2일) — 36+ PNG 재캡처 + Figma 60+ 아트보드 visual diff audit ≥95% 일치 + Lighthouse a11y ≥90
  - 의존: plan/22 22-7 의 BaseModal 잔여 7 마이그레이션을 plan/24 Sprint D 로 이전 권장 — 코드 충돌 회피
- **plan/24 Sprint A — Foundation 토큰 ✅ 완료** (`docs/plan/24 § 3`):
  - Anthropic Claude Design hosting 에서 design bundle (4.3MB tar.gz) fetch → README + 8 jsx + tokens.js + 7 .md + 36 PNG 추출
  - **A-1 Pretendard self-host** — `bun add pretendard@1.3.9` + main.css `@import 'pretendard/dist/web/variable/pretendardvariable.css'`. OS fallback 차단, font-display: swap
  - **A-2 Color semantic 분리** (Q2): light muted 95.9%→97.5% / accent 95.9%→92% (primary 옅은 변형) / dark muted 15.9%→12% / accent 15.9%→22%
  - **A-3 Status semantic 신규** — `--success` (emerald-700) / `--warning` (amber-600) / `--info` (blue-600) light+dark
  - **A-4 Elevation tier 3 신규** — `--shadow-popover/modal/toast` (sm/lg/xl, dark opacity 강화)
  - **A-5 Z-index 6 layer 신규** — 10/20/30/40/50/60 (sticky/sidebar/popover/modal-backdrop/modal-content/toast)
  - tailwind.config.ts 확장: popover/success/warning/info colors + boxShadow + zIndex
  - 검증: typecheck 0 / lint 0 / vitest 13 pass / 36 PNG 재캡처 시각 확인
  - **Sprint B~F 계획 단계 유지 결정** (사용자 판단): Sprint A 만 코드 적용, B~F (Primitives+reka-ui / Hub Screens / Modal Audit / UX Polish / 검증)는 plan/24 에 계획으로만 남김. 이유: plan/22 22-7 까지 진행되며 BaseModal 14/18·aria-label 17·ContextMenu 11/17·V-5/F-I1/F-I2/Q-3/Q-4 등 점진 적용이 이미 진행 중. plan/24 § 11 재개 조건 명시 (plan/22 정체 OR Figma↔코드 drift ≥30% OR 사용자 명시 트리거)
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
