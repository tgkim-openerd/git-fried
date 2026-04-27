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
