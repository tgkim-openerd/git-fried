# 22. UI Polish v2 — 우클릭 ContextMenu + Click→Viewer + Dogfood Friction

작성: 2026-04-27 / 트리거: plan/14 100% 완료 직후 + GitKraken 표준 vs git-fried 격차 deep audit (3 source 병렬)

> **목적**: plan/12 (UI v3) 와 plan/14 (GitKraken gaps 22) 를 100% 완료한 시점에서 **여전히 GitKraken 일상 사용자가 느낄 미흡 영역** 을 카탈로그. 카테고리: (a) 우클릭 ContextMenu 17 위치 (3/47 만 inline 구현, 14 위치 누락) (b) Click → Detail viewer 15 흐름 (2 P0 + 4 P1 누락) (c) Dogfood Friction 5 CRITICAL + 8 IMPORTANT (d) plan/15 미완 8 (modal/focus trap/한글 너비/etc).
>
> **연계**: [plan/12 v3](./12-ui-improvement-plan.md) (43 항목 ✅), [plan/14](./14-additional-gitkraken-gaps.md) (22/22 ✅), [plan/15](./15-quality-cleanup.md) (Sprint 1+2 ✅, **3+4+5 미완**), [plan/18](./18-dogfood-feedback.md) (사용자 누적 후).
>
> **Audit 출처** (2026-04-27):
>
> - Source A (Explore): 우클릭 ContextMenu 위치 매핑 — 17 위치 / 47 컴포넌트 grep
> - Source B (Explore): Click → Detail viewer 흐름 — 15 영역
> - Source C (Codex, background): micro-detail (drag/drop, hover preview, multi-select, etc.)

---

## 1. 30초 요약

| 카테고리 | 발견 | P0 | P1 | P2 | P3 | 합계 작업량 (AI pair) |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| **우클릭 ContextMenu** | 17 위치 catalog | 5 | 6 | 3 | — | ~6h |
| **Click → Detail viewer** | 15 흐름 | 2 | 4 | 4 | 3 | ~5h |
| **Dogfood Friction** | 13 (이번 audit) | **5** | 4 | 4 | — | ~3h |
| **plan/15 미완** | 8 (Sprint 3~5) | — | 4 | 3 | 1 | ~6h |
| **신규 UI 시스템** | 4 (audit Source A) | — | 1 | 3 | — | ~3h |
| **합계** | **57 항목** | **12** | **19** | **17** | **4** | **~23h** (단일 세션 범위 외 — 4~5 세션) |

---

## 2. R-2A: 즉시 수정 — CRITICAL 5건 (이번 세션에서 완료)

| # | 항목 | 위치 | 작업량 | Why critical |
| ---- | ---- | ---- | ---- | ---- |
| **C1** | Bulk fetch 결과 절단 (5+ 실패 시 toast 잘림) | `Sidebar.vue:72-83` | 1h | 사용자가 어느 레포가 실패했는지 모름 |
| **C2** | 한글 commit subject visual width 환산 부재 | `CommitMessageInput.vue:59-60` | 1h | 한글 36자 = 영문 72자, 현재 경고 안 뜸 |
| **C3** | Hunk-stage 진입점 숨김 (file row 에 visible 버튼 없음) | `StatusPanel.vue` | 30m | 신규 사용자가 hunk-stage 가 있는지도 모름 |
| **C4** | IPC timeout 미처리 (30s+ 무응답 → UI freeze) | 신규 wrapper | 2h | 사용자가 강제 종료 → 재시작 |
| **C5** | Conflict marker commit 거부 시 가이드 부재 | `CommitMessageInput.vue:81-94` | 30m | 어디 충돌인지 못 찾음 |

**합계**: ~5h (R-2A 통합 PR 1개)

---

## 3. 우클릭 ContextMenu 누락 catalog (17 위치)

> **현재 implemented**: 3 위치 — 모두 row 메뉴 아닌 **헤더/섹션 collapse 토글**
> - `StashPanel.vue:162` — `@contextmenu="collapsedNew = !collapsedNew"` (새 stash 폼 접기)
> - `StatusPanel.vue:260,299,370,407` — 4 섹션 헤더 collapse 토글
> - `CommitGraph.vue:406` — 컬럼 헤더 메뉴 (컬럼 표시/숨김)
>
> **결론**: row-level 우클릭 메뉴 = **0/47 컴포넌트**. 모두 신규 구축 필요.

### 3-1. 신규 공용 `ContextMenu.vue` 컴포넌트 (선결 조건)

**작업량**: 2h. 모든 17 위치 마이그레이션의 base.

```ts
interface ContextMenuItem {
  label: string
  icon?: string
  shortcut?: string  // '⌘D'
  destructive?: boolean
  divider?: boolean
  disabled?: boolean
  submenu?: ContextMenuItem[]
  action?: () => void
}
```

요구사항:
- Teleport to body + z-50 + outside-click close
- 키보드 nav (↑↓ Enter Esc) + auto-focus 첫 항목
- mouse position 기반 position (viewport edge 회피)
- divider 지원
- destructive 항목 색상 분리 (빨강)
- submenu 1 depth 지원 (예: Reset → soft/mixed/hard)

### 3-2. P0 우클릭 메뉴 (5 위치, ~6h)

| # | 위치 | 액션 메뉴 | 작업량 |
| ---- | ---- | ---- | ---- |
| **CM-1** | **CommitGraph row** | Show diff (⌘D) / Cherry-pick / Revert / Reset → soft/mixed/hard / Create branch from / Create tag from / Compare with / Copy SHA / Open in forge / Explain (AI) | 2h |
| **CM-2** | **CommitTable row** | (CM-1 과 동일 — composable 재사용) | 30m |
| **CM-3** | **StatusPanel file row** | Stage / Unstage / Discard / View history / Blame / Open in editor / Copy path / Add to .gitignore / Hunk-stage | 1.5h |
| **CM-4** | **HunkStageModal hunk row** | Stage hunk / Unstage hunk / Discard hunk / Stage line | 1h |
| **CM-5** | **BranchPanel branch row** | Checkout / Create from / Rename / Delete (destructive) / Merge into HEAD / Rebase onto / Hide / Solo / Compare / Push / Set upstream | 1h |

### 3-3. P1 우클릭 메뉴 (6 위치, ~4h)

| # | 위치 | 액션 메뉴 | 작업량 |
| ---- | ---- | ---- | ---- |
| **CM-6** | **Sidebar repo row** | Open in Explorer / Copy path / Set alias (rename) / Remove from workspace / Fetch only this / Set as active / Pin / Run gc | 1h |
| **CM-7** | **RepoTabBar tab** | Close / Close others / Close all / Pin tab / Move left/right | 30m |
| **CM-8** | **TagPanel tag row** | Push / Delete local / Delete remote / Checkout / Create branch from | 30m |
| **CM-9** | **PrPanel/Launchpad PR row** | Open detail / Pin / Snooze (1h/1d/1w/1m) / Open in browser / Copy URL / Copy PR number / Copy branch name | 1h |
| **CM-10** | **ReflogModal entry** | Restore HEAD here / Show diff / Copy SHA / Create branch here | 30m |
| **CM-11** | **WorktreePanel row** | Open / Switch / Remove / Lock / Unlock | 30m |

### 3-4. P2 우클릭 메뉴 (3 위치, ~1h)

| # | 위치 | 액션 메뉴 | 작업량 |
| ---- | ---- | ---- | ---- |
| **CM-12** | **RemoteManageModal remote row** | (이미 inline form, 우클릭 빠른 메뉴) Fetch / Rename / Set URL / Remove | 20m |
| **CM-13** | **IssuesPanel issue row** | Open in browser / Copy URL / Copy number | 20m |
| **CM-14** | **ReleasesPanel release row** | Open in browser / Copy URL / Download asset | 20m |

---

## 4. Click → Detail viewer 누락 catalog (15 흐름)

### 4-1. P0 — Critical viewer 누락 (2 흐름, ~3h)

| # | 위치 | 현재 | 누락 | 작업량 |
| ---- | ---- | ---- | ---- | ---- |
| **V-1** | **CommitGraph row click** | `selectedSha` 갱신만 — diff 안 열림 | row dblclick → CommitDiffModal auto-open (또는 single click 옵션) | 1h |
| **V-2** | **PrDetailModal Files Changed tab** | 코멘트만 표시 | 신규 "Files" tab — file list (count + size) + 각 file diff (CodeMirror split) + per-file 코멘트 진입 | 4h |

### 4-2. P1 — High priority viewer (4 흐름, ~3h)

| # | 위치 | 현재 | 누락 | 작업량 |
| ---- | ---- | ---- | ---- | ---- |
| **V-3** | **CommitDiffModal action buttons** | diff 만 | header 에 cherry-pick / revert / reset (soft/mixed/hard) 버튼 group | 1.5h |
| **V-4** | **TagPanel tag click** | click handler 없음 | annotated msg viewer (modal 또는 inline) + commit SHA navigate | 30m |
| **V-5** | **StatusPanel file detail side-panel** | row highlight 만 | 신규 detail panel (status/size/diff preview + quick stage/discard) | 1.5h |
| **V-6** | **ReflogModal row click** | click handler 없음 | row 하이라이트 + diff preview + "Restore HEAD here" 버튼 | 30m |

### 4-3. P2 — Medium viewer (4 흐름, ~3h)

| # | 위치 | 현재 | 누락 | 작업량 |
| ---- | ---- | ---- | ---- | ---- |
| **V-7** | **BranchPanel hover preview** | hover 무반응 | tooltip: latest commit subject + ahead/behind | 1h |
| **V-8** | **StashPanel diff mode toggle** | compact 만 | useDiffMode 재사용 → compact/default/split | 30m |
| **V-9** | **CommitGraph ref badge** | 클릭=숨김만 | (a) 클릭=filter by ref (b) hover=ref 정보 tooltip | 1h |
| **V-10** | **WorktreePanel row click** | click handler 없음 | row click → focus / "Switch to this worktree" | 30m |

### 4-4. P3 — Polish viewer (3 흐름, ~5h)

| # | 위치 | 현재 | 누락 | 작업량 |
| ---- | ---- | ---- | ---- | ---- |
| **V-11** | **IssueDetailModal** | 없음 (외부 link 만) | 자체 modal (body / comments / assignee / labels / state change) | 3h |
| **V-12** | **ReleaseDetailModal** | 없음 (외부 link 만) | 자체 modal (changelog / asset list / download) | 1h |
| **V-13** | **PR Comment edit/delete** | read-only | edit form + delete confirm (forge API 추가 필요) | 1h |

---

## 5. Dogfood Friction (이번 audit Source B, 13 항목)

> **CRITICAL 5건은 §2 의 R-2A 에 통합. 여기는 IMPORTANT/POLISH 만.**

### 5-1. IMPORTANT (P1, 4건, ~5h)

| # | 항목 | 위치 | 작업량 |
| ---- | ---- | ---- | ---- |
| **F-I1** | StatusPanel 150+ 파일 검색/필터 input | `StatusPanel.vue` 헤더 | 1h |
| **F-I2** | Forge token 401 → 재등록 prompt (`api/git.ts` interceptor + toast actionable button) | `api/git.ts` | 1.5h |
| **F-I3** | Bulk fetch cancel 버튼 (Tauri AbortHandle) | `Sidebar.vue` + Rust runner | 2h |
| **F-I4** | Multi-repo SyncTemplate 진행도 progress UI | `SyncTemplateModal.vue` | 30m |

### 5-2. POLISH (P2, 4건, ~5h)

| # | 항목 | 위치 | 작업량 |
| ---- | ---- | ---- | ---- |
| **F-P1** | App 시작 시 spinner (150 레포 로딩 3s) | `App.vue` | 30m (LoadingSpinner 도입 후) |
| **F-P2** | Sidebar 50+ repo virtualization (vue-virtual) | `Sidebar.vue` | 1.5h |
| **F-P3** | "어느 레포 작업할까" 미리보기 (사이드바 옆 ahead/behind) | `Sidebar.vue` | 30m |
| **F-P4** | 한글 파일명 encoding 자동 감지 (chardet via Rust) | `git/runner.rs` | 2h |
| **F-P5** | 전체 commit 메시지 grep 검색 (`git log --grep`) | `git/commit.rs` + Command Palette | 1.5h |

---

## 6. plan/15 미완 항목 (Sprint 3+4+5, 8건, ~12h)

> plan/15 §5 의 Sprint 3~5 미실행. 본 plan 22 의 일부로 흡수.

| # | 항목 | plan/15 § | P | 작업량 |
| ---- | ---- | ---- | ---- | ---- |
| **Q-1** | **BaseModal 추출** (z-50 통일 / p-6 / max-w 정책 / Header slot) + 13 modal migration | §2-1 | P1 ★ | 3h |
| **Q-2** | **`useFocusTrap` composable** + 13 modal Tab cycling + close 시 focus restore (WCAG 2.1 AA) | §2-8 | P1 ★ | 2h |
| **Q-3** | **한글 너비 / ellipsis** — `--korean-char-width: 1.3em` CSS var + BranchPanel/CommitTable/PrPanel 재계산 | §2-6 | P1 | 2h |
| **Q-4** | **`LoadingSpinner.vue` + `EmptyState.vue`** + 16 components 마이그레이션 | §2-3 | P2 | 2h |
| **Q-5** | **Transition 정책** (200ms/150ms/100ms) + 37 components @class 적용 | §2-4 | P2 | 1h |
| **Q-6** | **Toast 중복 방지** Map<key, lastShownAt> + 1s dedup | §2-5 | P3 | 30m |
| **Q-7** | **Custom theme JSON HSL 검증** (잘못된 값 → toast.error) | §2-7 | P3 | 30m |
| **Q-8** | **commits INDEX migration** ✅ 이미 완료 (`0005_commits_lookup_index.sql`) | §3-5 | — | — |

---

## 7. 신규 UI 시스템 audit 발견 (Source A 중 plan/15 외, 4건, ~3h)

| # | 항목 | P | 작업량 | Why |
| ---- | ---- | ---- | ---- | ---- |
| **S-1** | **`aria-label`** 모든 icon-only 버튼 (현재 0/47) | P1 | 1h | WCAG / 스크린리더 호환 |
| **S-2** | **Tooltip 표준** (icon-only 버튼 + 단축키 hint, 예: "Stage all (⌘⇧S)") | P2 | 1h | discoverability |
| **S-3** | **Color 일관성** (button focus ring `ring-2 ring-primary`, secondary vs muted 통일) | P2 | 30m | 디자인 토큰 정합 |
| **S-4** | **Micro-interaction spec** (hover/active/disabled) `main.css` 문서화 + 일관 적용 | P2 | 30m | 폴리시 |

---

## 8. Sprint 분할 (Sprint 22-1 ~ 22-6)

### Sprint 22-1 (R-2A) ✅ 이번 세션 — CRITICAL 5건 (~5h)

C1 + C2 + C3 + C4 + C5. PR 1개. 다음 세션 진입 전 dogfood 가속.

### Sprint 22-2 — ContextMenu 공용 + P0 4 위치 ✅ 완료 (2026-04-27)

(선결) 신규 `ContextMenu.vue` ✅ Teleport + 키보드 nav (↑↓ Enter Esc, ← submenu 닫기, → submenu 진입) + submenu 1 depth + viewport edge 회피 + outside-click close + destructive 색상 분리.

- ✅ 신규 composable `useCommitActions` — copySha / cherryPick / revert / reset(submenu soft/mixed/hard) / createBranchFrom / createTagFrom + buildItems(callbacks) (CM-1, CM-2 공유)
- ✅ **CM-1 CommitGraph row** — `@contextmenu="onRowContextMenu"` + emit (showDiff/compareWith/explainAi/openInForge)
- ✅ **CM-2 CommitTable row** — `useCommitActions` 재사용, 동일 emit 구조
- ✅ **CM-3 StatusPanel file row** — staged: Unstage / Hunk-unstage / File history / Copy path. unstaged: Stage / Discard (destructive) / Hunk-stage / File history / Copy path
- ✅ **CM-4 HunkStageModal hunk row** — Hunk stage/unstage 전체 / 선택 라인만 stage / Hunk 접기·펼치기

(P0 의 CM-5 BranchPanel 11 액션은 §22-3 으로 분리 — 작업량 큼)

### Sprint 22-3 — BranchPanel 깊은 메뉴 + P0 viewer (~4h) ✅ 완료

CM-5 BranchPanel 11 액션 (1h) + V-1 commit dblclick → diff (1h) + V-2 PrDetailModal Files tab (1.5h) — V-2 는 가장 시간 큼.

- ✅ **CM-5 BranchPanel 11 액션** — Checkout / Create from / Rename / Delete (destructive) / Merge into HEAD / Rebase HEAD onto / Hide / Solo / Compare / Push / Set upstream
  - 신규 `useBranchActions` composable (`useCommitActions` 패턴 재사용 + `localBranchName` helper export)
  - hide/solo/compare 는 callback (useHiddenRefs / `window.gitFriedOpenCompare`)
- ✅ **V-1 CommitGraph + CommitTable row dblclick** — `@dblclick` 이벤트 → `emit('show-diff', sha)` → pages/index.vue `onShowDiff` → CommitDiffModal auto-open. ⌘D 단축키와 동일 액션.
- ✅ **V-2 PrDetailModal Files Changed tab** —
  - Backend: `forge::PrFile` 모델 + `ForgeClient::list_pr_files` trait + GitHub/Gitea 구현 (per_page=100)
  - IPC: `list_pr_files` command (lib.rs invoke_handler 등록)
  - Frontend: `listPrFiles` API, PrDetailModal 에 Conversation/Files tab + 파일별 status 뱃지 (A/M/D/R/C) + +/- 카운트 + DiffViewer (CodeMirror) per-file expand/collapse + Expand all / Collapse all + binary/large file 안내

### Sprint 22-4 — P1 ContextMenu 6 + P1 viewer 3 (~6h) ✅ 부분완료 (V-5 다음 sprint 이월)

CM-6 ~ CM-11 (~4h) + V-3 / V-4 / V-6 (~2h). **V-5 StatusPanel side-panel 은 신규 패널 디자인 비용으로 22-7 또는 별도 sprint 로 이월.**

- ✅ **CM-6 Sidebar repo row** — Open in Explorer / Copy path / Set as active / Fetch only this / Pin / Set alias / Run gc (submenu: gc, gc --aggressive ⚠) / Remove from workspace (destructive)
- ✅ **CM-7 RepoTabBar tab** — Close / Close others / Close all (destructive) / Move left / Move right
- ✅ **CM-8 TagPanel tag row** — Push to origin / Checkout / Create branch from / Copy SHA / Delete local (destructive) / Delete remote (destructive)
- ✅ **CM-9 PrPanel PR row** — Open detail / Open in browser / Pin (useLaunchpadMeta.pinMut) / Snooze (submenu 1h/1d/1w/1m, 또는 해제) / Copy URL / Copy PR # / Copy branch
- ✅ **CM-10 ReflogModal entry** — Show diff / Restore HEAD here (reset --mixed, destructive) / Copy SHA / Create branch here
- ✅ **CM-11 WorktreePanel row** — Open in Explorer / Switch / Lock·Unlock toggle / Remove (destructive, main 불가)
- ✅ **V-3 CommitDiffModal header action button group** — 🍒 Cherry-pick / ↩ Revert / Reset (mode dropdown soft·mixed·hard ⚠) — `useCommitActions` 재사용
- ✅ **V-4 TagPanel tag click → inline annotated viewer** — row click 으로 expand 영역 (annotated/lightweight 뱃지 + full SHA + subject `<pre>` + 우클릭 안내)
- ✅ **V-6 ReflogModal row click + dblclick + 우클릭** — selectedSha highlight + dblclick `emit('showDiff', sha)` + CM-10 메뉴 (App.vue 에서 부모 listen 추가는 차후)
- ⏸ **V-5 StatusPanel file detail side-panel** — 신규 패널 + status/size/diff preview + quick stage·discard. 이월 사유: 패널 layout / 우측 detail 영역 점유 정책 결정 필요 (focusMode 와 충돌 가능성)
- 검증: typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-5 — plan/15 Sprint 3 흡수 + 신규 UI 시스템 (~6h) ✅ 부분완료 (점진 마이그레이션 진행)

Q-1 BaseModal (3h) + Q-2 useFocusTrap (2h) + S-1 aria-label (1h).

- ✅ **Q-2 useFocusTrap composable** — 신규 `composables/useFocusTrap.ts` (open watch → first focusable focus, Tab/Shift+Tab wrap, close 시 prev focus 복원, WCAG 2.1 AA: 2.1.2 / 2.4.3). FOCUSABLE_SEL = `button:not([disabled]):not([tabindex="-1"]),[href]...,[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])`. capture phase keydown listener.
- ✅ **Q-1 BaseModal 추출** — 신규 `components/BaseModal.vue` (Teleport + z-50 + max-w-* prop + role="dialog" + aria-modal + aria-labelledby + ESC close + backdrop click + slots: header/default/footer + 자동 useFocusTrap). 마이그레이션 3건: HelpModal / AiResultModal / BulkFetchResultModal. **잔여 15 modal** 은 점진 마이그레이션 (Sprint 22-6/22-7 흡수 — modal layout 재검토 필요한 복잡한 modal 위주: Compare / MergeEditor / PrDetail / InteractiveRebase / HunkStage / FileHistory / GitKrakenImport / RemoteManage / RepoSwitcher / Sync / Bisect / Reflog / CreatePr / Clone / CommitDiff)
- ✅ **S-1 aria-label** — icon-only button 핵심 6건 시범 적용 (BranchPanel 의 Hide/Solo/AI Explain/Delete + Sidebar 의 Pin/별칭 편집). **잔여 ~41 button** 은 점진 적용 (StatusPanel / StatusBar / SyncBar / TagPanel del / RepoTabBar / 모달 내부 등)
- ✅ **V-6 보강** — `pages/index.vue::onShowDiff` 를 `window.gitFriedShowDiff` 에 onMounted 등록 + App.vue 의 ReflogModal `@show-diff` → `onReflogShowDiff(sha)` → `window.gitFriedShowDiff?.(sha)` 호출. ReflogModal dblclick / 우클릭 Show diff 가 CommitDiffModal 트리거.
- 검증: typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-6 — Polish + Dogfood Friction IMPORTANT (~6h) ✅ 부분완료 (Q-3 다음 sprint)

Q-3 한글 너비 (2h) + Q-4 Spinner/Empty (2h) + F-I1 file filter (1h) + F-I2 token 만료 (1h).

- ✅ **Q-4 LoadingSpinner + EmptyState** — 신규 `components/LoadingSpinner.vue` (size sm/md/lg + label + inline 모드 + role="status" + animate-spin) + 신규 `components/EmptyState.vue` (icon + title + description + action slot + size sm/md). PrPanel 시범 적용 (불러오는 중 spinner / "PR 없음" empty state with stateFilter 안내).
- ✅ **F-I1 StatusPanel file filter** — 변경 파일 50+ 환경용 부분 매칭 input (filteredStaged/filteredUnstaged/filteredUntracked/filteredConflicted computed). ✕ 클리어 버튼 + aria-label.
- ✅ **F-I2 Forge 401/403 token UX** — `humanizeGitError` 에 HTTP 401 (Bad credentials / token expired / invalid token) 패턴 + 403 Forbidden 패턴 + 각각 한국어 가이드 (PAT 재발급 위치 / scope 안내, GitHub vs Gitea 구분). 모든 forge IPC 실패 toast 가 자동 적용 (describeError chain).
- ⏸ **Q-3 한글 너비 / ellipsis** — `--korean-char-width: 1.3em` CSS var + BranchPanel/CommitTable/PrPanel 재계산. CJK=2 cell 가정 vs 실제 폰트 width 차이. Sprint 22-7 또는 별도 sprint 로.

### V-5 ✅ 부분완료 (22-4 이월분 처리)

- ✅ **V-5 StatusPanel file row click → inline diff preview** — 선택 파일 하단 30% (min-height 140px) detail panel: file 경로 + STAGED/WORKDIR 뱃지 + + stage / − unstage / ✂ hunk / ⤺ discard / ✕ 닫기 quick action + DiffViewer (CodeMirror unified diff, getDiff IPC + STALE_TIME.REALTIME). focusMode 와 충돌 없음 (StatusPanel 내부 분할 — 우측 detail 영역 미점유).

### Sprint 22-17 — E-1 Skeleton 시범 (BranchPanel/PrPanel) ✅ (2026-04-28, frontend-only)

plan/24 Sprint E E-1 부분 흡수. design 04 §4-2 spec 만족.

- ✅ **`SkeletonBlock.vue` 신규** — props (count / height sm·md·lg / widthRange). animate-pulse + bg-muted + deterministic width (sin pseudo-noise reload 안정). `role="status" aria-live="polite"` + sr-only
- ✅ **BranchPanel** — `useBranches({ isFetching })` + `<SkeletonBlock count=6 height=sm v-if="branchesFetching && !branches">` / `<ul v-else>`
- ✅ **PrPanel** — LoadingSpinner 대체 → SkeletonBlock count=5 height=md. dead code import 정리
- 잔여: CommitGraph / StatusPanel / PrDetail / 기타 panel (Stash / Worktree / LFS / Submodule / Issues / Releases / Tag) — virtualizer 영향 큼 / 별도 sprint
- 검증: typecheck 0 / lint 0 / vitest 29 pass

### Sprint 22-16 — M6 Q-7 Custom theme HSL 검증 (design 01 §10) ✅ (2026-04-28, frontend-only)

§6 Q-7 처리. design 01 §10 "Custom theme JSON 사용자 입력 검증" 의도 충족.

- ✅ **`validateHsl(value)` 신규 export** — shadcn-vue 표준 `<hue> <saturation>% <lightness>%` 형식. 정규식 + Hue 0~360 / Saturation 0~100% / Lightness 0~100% 범위 체크. 한국어 에러 메시지
- ✅ **`importJson` HSL 검증 통합** — var 별 검증, 1개라도 실패 시 reject + `잘못된 HSL 값 N개:\n${var}: ${error}` (앞 3개 + `...외 N개 더`). settings UI toast.error 자동 표시
- ✅ **vitest 16 신규** (`useCustomTheme.test.ts`) — 유효 / 형식 실패 / 범위 실패 / git-fried 실제 토큰 검증. 누적 **13 → 29 pass**
- 미적용 (Sprint 22-17+): theme JSON 미리보기 (변경 전후 시각 비교) — design 01 §10 두 번째 의도
- 검증: typecheck 0 / lint 0 / vitest 29 pass

### Sprint 22-15 — M1 Settings 2-level 6 그룹 (plan/24 C-7 / design §8-1) ✅ (2026-04-28, frontend-only)

design §8-1 hard constraint 충족. v1.0 12+ 카테고리 확장 대비 평면 → grouping.

- ✅ **CATEGORY_GROUPS 6 그룹 재구조화** (Q1 답변 반영, 평면 9 → 2-level 6)
  - 계정 / 워크스페이스 / 에디터·터미널 / UI / 유지보수 / 시작·마이그레이션
- ✅ **2-level nav UI** — group header + 들여쓰기 item (`pl-6 text-[13px]`). active + `aria-pressed` + `aria-label="${group} > ${item}"`
- ✅ **nav width 48 → 52** (한글 그룹 label fit) + `<nav aria-label="설정 카테고리">` landmark
- 검증: typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-14 — M3 Tab overflow (plan/24 C-6 / design §8-1) ✅ (2026-04-28, frontend-only)

design §8-1 hard constraint (Layout extensibility) 부분 흡수. 본격 "더 보기" dropdown 은 reka-ui Popover 도입 후.

- ✅ **활성 탭 자동 scrollIntoView** — `watch(store.activeRepoId)` + `nextTick` → `[data-tab-id]` 검색 → `scrollIntoView({ smooth, nearest, center })`. ⌘T / RepoSwitcher 로 active 변경 시 viewport 밖이면 자동 노출
- ✅ **8 탭 초과 시 overflow indicator** —
  - `OVERFLOW_THRESHOLD = 8`. 초과 시 `.has-overflow` class
  - 좌/우 끝 fade gradient 12px (`hsl(var(--muted) / 0.6)` → transparent) — 스크롤 가능 인지
  - 우측 점선 `▾ N+` 버튼 (N = 가려진 탭 수) → click 시 RepoSwitcher (⌘T) 열림. aria-label "N개+ 탭이 가려져 있음. ⌘T 로 검색·전환"
- 검증: typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-13 — a11y wrap (S-1 잔여 21건) ✅ (2026-04-28, frontend-only)

§7 S-1 카탈로그 47개 중 22 → 43 건 (~91%) 도달. hot path 6 컴포넌트 21건 추가.

- ✅ **StashPanel action button 5건** — show / apply / pop / edit msg / drop 동적 `stash@{N} ...` aria-label
- ✅ **WorktreePanel 4건** — prune (header) + lock / unlock / remove 동적 `worktree '${path}' ...`
- ✅ **ForgePanel sub-tab 4건** — PR / Issue / Release / Tag tab + `aria-pressed` (현재 탭 시각 표시)
- ✅ **CommitGraph search 2건** — 검색 열기 (⌘F/Ctrl+F) / 닫기
- ✅ **PrPanel header 4건** — state filter (all / open / closed) + `aria-pressed` + 새 PR 생성
- ✅ **CommitMessageInput 2건** — Conventional / Free-form 모드 + `aria-pressed`
- 잔여 4건 (~9%): BranchPanel header (filter local/remote/all + Remote 관리 🔗) / Sidebar workspace 그룹 모드 / CommitTable column header — dogfood feedback 후 Sprint 22-14+
- 검증: typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-12 — P0 polish 묶음 (Q-5 + Q-6 + E-9) ✅ (2026-04-28, frontend-only)

§6 Q-5/Q-6 + §7 S-4 + plan/24 Sprint E E-9 묶음 처리. design 01 §7 + 04 §6+§7 + §8-3+§8-4+§8-6 hard constraint 부분 흡수.

- ✅ **Q-5 Transition 정책 + S-4 Micro-interaction 문서화** —
  - `main.css` CSS variables: `--transition-fast 75ms` / `--transition-base 150ms` / `--transition-slow 200ms` / `--transition-instant 0ms` + `--ease-out` / `--ease-in` cubic-bezier
  - `@media (prefers-reduced-motion: reduce)` 전역 폴백 (WCAG 2.3.3, E-7 부분 흡수) — animation/transition duration 0.01ms 강제
  - 정책 문서화 코멘트 (각 변수 사용처 + cubic-bezier 의미)
- ✅ **BaseModal enter/exit transition** — backdrop fade + panel scale-fade (0.97→1) 모두 enter 150ms (ease-out) / exit 100ms (ease-in). `<Transition appear>` wrapper 2단 (backdrop + panel). 18 modal 자동 적용
- ✅ **ToastContainer transition CSS var 통합** — slide-in 200ms (ease-out) / slide-out 100ms (ease-in). 기존 `0.2s ease` → CSS variables
- ✅ **Q-6 Toast dedup** — `useToast.ts` 에 dedup window 1s + Map<id, timer>. 같은 `(kind, title)` 1초 내 재호출 시 새 toast 생성 X, 기존 toast `count++` + duration 갱신. ToastContainer 에 `+N` badge (title="같은 메시지 N회 누적" + aria-label). 50+ Gitea 레포 환경 같은 에러 반복 방지
- ✅ **E-9 v0.4 placeholder 패턴** — 신규 `components/PlaceholderButton.vue` (props: label / eta / detail / icon / size / showToast). disabled 회색 + 점선 border + `🔜 v0.4` 뱃지 + tooltip + click 시 toast.info. design §8-4 (placeholder 표시 정책) 충족
- ✅ **Sidebar Integrations slot 신규** — design §8-3 / §8-6 (Cloud-Free 시각화 대체) 부분 흡수. 하단 collapsed `<details>` 섹션 + 3 placeholder (`GitHub Actions v0.4` / `Linear/Jira v0.5` / `Discord 알림 v0.5`). GitKraken Pro 의 Cloud Workspace 위치를 로컬-우선 / CLI-위임 plugin slot 으로 채움
- 검증: typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-11 — F-P3 Sidebar repo ahead/behind preview ✅ (2026-04-28, backend+frontend)

§5-2 F-P3 처리. cargo build 환경 이슈(next_session_entry 알려진 위험) 해결 후 첫 backend 변경 commit.

- ✅ **`bulk_quick_status` IPC 신설** —
  - Rust `git/status.rs::read_quick_status` (branch + upstream + ahead/behind 만, file walk 생략)
  - Rust `git/bulk.rs::bulk_quick_status` (워크스페이스 전체 병렬 spawn_blocking, BulkResult)
  - `bulk_status` 대비 ~50× 빠름 (50+ repo: ~5s → ~50~250ms)
  - `lib.rs` invoke_handler 등록 — 누적 159 IPC
- ✅ **`useBulkQuickStatus` composable 신설** — Vue Query + `staleTime: STATIC` + `Map<repoId, QuickStatus>` 가공 → Sidebar v-for 안에서 O(1) lookup
- ✅ **Sidebar repo row 갱신** — 기존 `repo.defaultBranch` 표시 → `repoBranch(id) ?? repo.defaultBranch` (현재 HEAD 우선) + ahead/behind preview (`↑N` emerald-500 + `↓N` rose-500). title attribute 한국어. `repoBranch` / `repoAhead` / `repoBehind` helper (template inline cast 회피)
- 🌟 **dogfood 가치** — 사용자 회사 50+ Gitea 레포 환경에서 "어느 레포에 push할 게 있는지" 한눈에 확인 가능
- 🛠 **cargo 환경 이슈 해결** — chocolatey cargo 1.60 + rustc 1.60 이 PATH 우선 → cargo가 invoke 한 child rustc 로 chocolatey 잡힘 → `--check-cfg` 거부. base64ct edition 2024 가설은 오인. `PATH="/c/Users/tgkim/.cargo/bin:$PATH"` prepend 로 rustup proxy (cargo 1.95 + rustc 1.95) 강제 → Sprint 22-3 PrFile 변경도 통과
- 검증: `cargo check` 0 (warning 1: `assign_workspace` dead_code 기존) / typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-10 — P2 ContextMenu 3건 (CM-12/13/14) ✅ (2026-04-28, frontend-only)

§3-4 P2 ContextMenu 3건 처리 → §3 catalog 100% 종료 (CM-1 ~ CM-14 모두 완료).

- ✅ **CM-13 IssuesPanel issue row 우클릭** — Open detail / Open in browser / Copy URL / Copy issue number. PrPanel CM-9 패턴 (`useTemplateRef` + `copyText` helper + `window.open(htmlUrl, '_blank', 'noopener')`)
- ✅ **CM-14 ReleasesPanel release row 우클릭** — Open detail / Open in browser / Copy URL / Copy tag. plan 명세 "Download asset" 은 `ForgeRelease.assets` 모델 부재 → v0.2 promise (코멘트 명시)
- ✅ **CM-12 RemoteManageModal remote row 우클릭** — Fetch (전체 remote) / 이름 변경 / URL 변경 / 제거 (destructive). 단일 remote fetch IPC 부재 → `fetchAll(repoId)` 일괄 매핑 + label "(전체 remote)" 명시 (사용자 의도 만족 + IPC 신설 회피). BaseModal 내부 ContextMenu Teleport to body + z-50 충돌 없음 (CM-1/CM-2 패턴 일치)
- 누적: ContextMenu 14곳 / BaseModal 18 modal / Viewer 8건 / aria-label 22건 / 신규 component 6 + composable 2 + utility 1
- 검증: typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-9 — P2 viewer 4건 (V-7/V-8/V-9/V-10) ✅ (2026-04-28, frontend-only)

§4-3 P2 viewer 4건 처리. F-P3 / V-13 / F-P5 / F-P2 / F-P4 는 backend 변경 동반이라 별도 sprint 로 보류.

- ✅ **V-7 BranchPanel hover preview** — row `title` attribute 에 latest commit subject (`BranchInfo.lastCommitSubject` 활용 — Rust 변경 0) + ahead/behind 풀어쓰기 + upstream + HEAD 표시. dblclick=switch / 우클릭=메뉴 안내 포함. `branchHoverTitle(b)` helper 추가
- ✅ **V-8 StashPanel unified diff CodeMirror 화** — raw `<pre>` whitespace-pre-wrap → `DiffViewer` 컴포넌트 (V-5 StatusPanel 패턴 일치, +/− 라인 색상 + hunk 헤더 강조 + 한글 안전). diff mode toggle (compact/default/split) 은 `showStash` IPC 의 `contextLines` 파라미터 추가 필요 → v0.2 단계
- ✅ **V-9 CommitGraph ref-pill body click = Solo toggle** — 기존 동작 (🙈 버튼 = hide) 보존. ref-pill 본문 자체를 button 으로 만들어 `setSolo(name)` 토글. solo 상태면 다시 클릭 = 해제. `useSoloRef` import + `toggleSoloRef(name)` helper. aria-label + title 한국어 ("이 ref 만 그래프에 표시" / "Solo 해제")
- ✅ **V-10 WorktreePanel row click highlight** — `selectedPath` ref + click=시각 focus / dblclick=Switch (main repo 활성화) / 우클릭=CM-11 메뉴 (기존 유지). `onWorktreeDblClick(t)` helper. cursor-pointer + selected ring 시각 cue
- ⏸ **F-P3 Sidebar repo ahead/behind preview** — `Repo` 타입에 ahead/behind 없음 + 50+ repo 일괄 fetch IPC 신설 필요 → 별도 sprint
- ⏸ **V-13 PR Comment edit/delete** — forge API (`patch_pr_comment` / `delete_pr_comment`) 신설 + ForgeClient trait + GitHub/Gitea 구현 + IPC 추가 → 별도 sprint
- ⏸ **F-P5 commit message grep 검색** — `git log --grep` IPC 신설 + Command Palette 통합 → 별도 sprint
- ⏸ **F-P2 Sidebar 50+ repo virtualization** — vue-virtual 도입 (이미 deps 에 있음, 사용처 추가) → 별도 sprint
- ⏸ **F-P4 한글 파일명 chardet** — Rust dep (`chardetng`) + git/runner.rs 인코딩 자동 감지 → 별도 sprint
- 검증: typecheck 0 / lint 0 / vitest 13 pass

### Sprint 22-8 — 잔여 종료 (Modal 4 + V-11/12 + F-P1 + aria 5) ✅

마지막 잔여 작업 모두 종료 — plan/22 모든 sprint 부분/완료.

- ✅ **BaseModal `align` prop 추가** — `'center' (기본) | 'top'` (palette/switcher 용 `pt-24`)
- ✅ **잔여 4 modal BaseModal 마이그레이션** — 누적 18 modal 전부 완료
  - **RepoSwitcherModal** — `align="top"` + show-close-button=false + panel-class="w-[640px]"
  - **HunkStageModal** — header slot (모두 ✕/✓ + 닫기) + show-close-button=false + panel-class max-h-[90vh] w-[1000px]
  - **InteractiveRebaseModal** — title + panel-class max-h-[90vh] w-[720px] (3-step wizard 본문 그대로)
  - **MergeEditorModal** — `isOpen = computed(open && path != null)` + header slot + footer slot (취소 / 결과로 stage)
- ✅ **V-11 IssueDetailModal 신규** — IssuesPanel row click → 자체 modal (state 뱃지 + author + 라벨 + bodyMd + ↗ 외부 열기)
- ✅ **V-12 ReleaseDetailModal 신규** — ReleasesPanel row click → 자체 modal (draft/pre 뱃지 + tag + name + bodyMd changelog + ↗ 외부 열기)
- ✅ **F-P1 App 시작 spinner** — Sidebar reposQuery isFetching 시 LoadingSpinner ("레포 목록 로딩 중...") + 빈 상태 EmptyState ("레포 없음" with 안내). 사용자 첫 진입 + 150 레포 환경 3s+ 대기 친화 UX
- ✅ **잔여 aria-label 5건** — StatusBar AI 분석 버튼 + Launchpad badge link + Sidebar (워크스페이스 ⚙ / 일괄 fetch ⤓ / 일괄 결과 📡)

### Sprint 22-7 (선택) — Polish 잔여 (~5h) ✅ 부분완료 (Q-3 + Modal 3 + aria 11건)

Q-5/Q-6/Q-7 + S-2/S-3/S-4 + V-7~V-13 + F-P1~F-P5 중 ranking.

- ✅ **Q-3 한글 너비 — visualWidth utility 추출 + RepoTabBar 적용** —
  - 신규 `utils/visualWidth.ts` (visualWidth / visualTruncate / cjkRatio export)
  - CommitMessageInput.vue 의 inline visualWidth 함수 → utility import (DRY)
  - RepoTabBar tab label `max-w` 동적 (한글 비중 영문 2× 시각 폭 보정 — 24 cell 초과 시 max-w-[180px] → max-w-[280px])
- ✅ **Modal BaseModal 마이그레이션 3건 (복잡 layout)** —
  - **CommitDiffModal** — V-3 header action group (cherry-pick / revert / reset) 보존, header slot + show-close-button=false + panel-class for w-[1000px]
  - **CompareModal** — split layout (좌 commit list + 우 patch) 그대로, max-h-[90vh] w-[1100px]
  - **PrDetailModal** — V-2 Conversation/Files tab 보존 + footer slot (Merge/Close/Reopen + 머지 방식 select)
  - 잔여 4 modal: RepoSwitcherModal (top-aligned palette, layout 다름) / HunkStageModal / InteractiveRebaseModal / MergeEditorModal — 별도 sprint
- ✅ **S-1 aria-label 11건 추가** — StatusPanel (history / discard / hunk-stage / hunk-unstage / stage 동적 path) + RepoTabBar (탭 닫기 / 새 탭 추가) + TagPanel (push / del local / del remote 동적 tag name)
  - 누적 17건 (Sprint 22-5 시범 6건 + 본 sprint 11건). 잔여 ~30 button 점진

**총 6 sprint** (~28h AI pair = 4~5 세션). dogfood 결과로 우선순위 조정 가능.

---

## 9. 검증 체크리스트 (각 Sprint PR)

- [ ] `bun run typecheck` 0
- [ ] `bun run lint` 0
- [ ] `bunx vitest run` (현재 13 → 신규 ContextMenu / useFocusTrap unit test 추가)
- [ ] cargo test (해당 sprint 에 Rust 변경 있을 시)
- [ ] WCAG 자동 도구 (axe-core 통합 검토 — Sprint 22-5 이후)
- [ ] 한글 round-trip (Sprint 22-6 한글 너비 영역)
- [ ] 사용자 본인 50+ 레포 dogfood (각 sprint 후 5분)
- [ ] commit message HEREDOC + `'EOF'` 한글 안전
- [ ] PR/이슈 body 한글은 `--data-binary @file`

---

## 10. 결정 로그 (2026-04-27)

| # | 결정 | 근거 |
| ---- | ---- | ---- |
| 1 | **R-2A CRITICAL 5건 즉시 수정** (이번 세션) | 사용자 dogfood 시 가장 자주 만남, 5h 단위 |
| 2 | **신규 ContextMenu.vue 공용 컴포넌트 = 22-2 의 선결 조건** | 14 위치 마이그레이션 base. 따로 구축 시 중복 |
| 3 | **CM-1 CommitGraph 부터 시작 권장** | 일일 사용 빈도 최고 (그래프 = 메인 view) |
| 4 | **plan/15 Sprint 3+4+5 = 본 plan 22 에 흡수** | plan/15 도 UI 폴리시 영역, 분리 의미 적음 |
| 5 | **F1 PR Code Suggestions ✅ 완료** (plan/14 §7) → V-2 PR Files tab 은 별도 | suggestion = comment, files tab = diff viewer (다른 기능) |
| 6 | **PR reopen ✅ 이미 구현** (lib.rs:158, PrDetailModal:539) | dogfood agent 거짓 양성, audit 통과 |
| 7 | **Codex deep audit (background)** 결과는 plan/22 에 patch | drag/drop / hover preview / multi-select 등 micro-detail 통합 |

---

## 11. 다음 plan 후보

- 23 = **Sourcetree / Fork importer** (~3h, GitKraken 외 client 사용자 다수)
- 24 = **macOS / Linux build** (plan/17 §2 v1.1 분리, EV 후순위)
- 25 = **PR Review 보강** (label / assignee / reviewer / checks integration, V-11/V-12 와 연계)
- 26 = **Dogfood feedback** (사용자 D-001~D-00N 누적 후, plan/18 진입)

---

다음 문서 → R-2A 완료 후 Sprint 22-2 (ContextMenu 공용) 진입 또는 dogfood 결과 반영 후 우선순위 재조정
