# Sidebar 마이크로 디테일 — git-fried ↔ GitKraken 12.x DIFF

- **일시**: 2026-05-18
- **트리거**: `/goal "좌측 사이드바만 상세하게 Codex와 함께 GItkraken과 비교 진행, 작은거 하나하나 모두 다 놓치지 않게"`
- **방식**: 2 병렬 agent — Claude Explore (git-fried 코드 25 finding) + Codex codex-rescue (GitKraken 학습 분포 + 공식 docs S1-S12 120 finding, agentId `a9caf0ee4bc9406c3`)
- **이전 round 와의 관계**: `2026-05-16-sidebar-gitkraken-diff.md` 의 11 Gap (CRIT 0 / HIGH 3 / MED 6 / LOW 2) 보다 **한 단계 더 작은 단위**. 기존 SB-001~SB-011 은 영역 단위 gap, 본 round 는 시각 토큰 / 인터랙션 micro-state / 메뉴 항목 단위.
- **자율 진행 가능성**: 본 round 는 **enumerate + DIFF table** 만. 사용자 결정 / Codex 합류 후 fix sprint 분리.

---

## Executive Summary (10 줄)

1. **git-fried 25 finding × GitKraken 120 finding 합류** — Agreed 패턴 ~30, git-fried gap ~25, GitKraken-only 학습 ~40 (INCONCLUSIVE 포함), git-fried 우월 ~10.
2. **가장 큰 격차 (UX 의도 영향)**: branch 단일 click 동작 — git-fried `click=checkout`, GitKraken `click=select / double-click=checkout`. **사용자 결정 영역** (속도 vs 실수 안전성 trade-off).
3. **Hide/Solo 시각 토큰 미정**: git-fried `useBranchVisibilityActions` 로 동작은 정착, but UI 시각 (GitKraken 의 gray=hidden / orange=solo) 색 표현 미구현 → SB-013.
4. **Smart Branch Visibility** (GitKraken 의 gear icon → checked-out + target + upstreams 자동 필터) git-fried 미구현 → SB-014. 큰 monorepo 에서 ROI 높음.
5. **PR CI 아이콘 4 상태** (green check / yellow dot / red X / gray D) git-fried 의 MiniPrList 는 draft badge + comment count 만 → SB-017.
6. **Drag&drop**: git-fried branch→branch (merge/rebase) ✓, **branch→remote (push) + local→other remote (PR 생성) 미구현** → SB-019.
7. **Multi-select 미구현** (Shift+click range / Ctrl+click pick + bulk delete) → SB-020.
8. **단축키 6건 격차** (Ctrl+J/L/K/P/F/Esc) — Ctrl+P (Command Palette) 는 이미 `useCommandCatalog` 60 명령 정착, wire 만 필요.
9. **git-fried 우월 (★ keep)** — 한글 안전 NFC + decode_korean_safe, IdentityCard 3 차별점, skeleton 7 mini section 적용, branch occupied 🔗 + cursor-not-allowed, workspace color dot.
10. **신규 backlog 19건**: SB-012 ~ SB-030 (HIGH 4 / MED 8 / LOW 5 / needs-user 2). 모두 시각/인터랙션 마이크로 단위 — 기존 SB-001~SB-011 영역 단위 backlog 와 별도.

---

## 1. Visual Dimension DIFF

### 1.1 Sidebar 외곽 / resize

| 영역 | git-fried | GitKraken | 일치 | 비고 |
|------|-----------|-----------|------|------|
| Resize 가능 | ✓ SB-001 (180-400px) | ✓ resizable (S1) | **✓ MATCH** | git-fried 우월: range 명시 |
| Default 폭 | 220px | ~220-260px (training, INCONCLUSIVE) | ✓ 유사 | px 값 GitKraken 공개 안 함 |
| 영속화 backend | localStorage `git-fried.sidebar-width.v1` | LIKELY (storage 미공개) | ✓ 동등 | parity 확인 |
| Section collapse | ✓ `active-repo-quick.{branches,remote,...}` | ✓ section collapse/expand (S1) | **✓ MATCH** | |
| Section header 우클릭 메뉴 | ✗ 미구현 | ✓ 섹션 표시/숨김 (S1/S5/S10) | **▲ SB-018** | sidebar 어느 section 을 보일지 settings 외 직접 토글 |
| Section header **double-click maximize** | ✗ 미구현 | ✓ maximize (S1) | **▲ SB-015** | 큰 list (브랜치 100+) 일시적 집중 |

### 1.2 Section header / row 시각

| 영역 | git-fried | GitKraken | 차이 |
|------|-----------|-----------|------|
| Header 폰트 | `text-[10px] uppercase tracking-wider text-muted-foreground` | (px 미공개) | git-fried 명시 |
| Collapse marker | `▶` / `▼` text-[9px] | (미공개) | git-fried 만 spec 가능 |
| 트리 indent per level | (BranchTreeView 내부, level × ?) | ~12-16px (training, INCONCLUSIVE) | **검증 필요** — git-fried BranchTreeView 의 padding 직접 측정 |
| Row 높이 | (Tailwind `py-1 text-[11px]` → ~26px) | ~28-32px (training, INCONCLUSIVE) | ✓ 유사 |
| Icon 크기 | text-[10px] (~12px) / emoji 14-16px | ~14-16px (training, INCONCLUSIVE) | ✓ 유사 |

### 1.3 Hide/Solo 시각 토큰

| 영역 | git-fried | GitKraken | gap |
|------|-----------|-----------|-----|
| Hide 동작 | ✓ `useBranchVisibilityActions.toggleHide` | ✓ hover + icon click (S8) | ✓ MATCH |
| **Hidden ref 시각** | (LIKELY 별도 색 없음, 직접 read 검증 필요) | **gray icon** (S8 명시) | **▲ SB-013** |
| Solo 동작 | ✓ `useBranchVisibilityActions.toggleSolo` | ✓ context menu (S8) | ✓ MATCH |
| **Solo ref 시각** | (확인 필요) | **orange icon** (S8 명시) | **▲ SB-013** |
| Bulk hide/show | ✓ `bulkHideKind` | ✓ section header bulk (S8) | ✓ MATCH |

### 1.4 git-fried 우월 (★ keep)

- **Workspace color dot** (`h-3 w-3 rounded-full inline-block`) — GitKraken 도 multi-workspace 지원하나 sidebar 시각 표시는 INCONCLUSIVE.
- **Status counts 4색 (staged/mod/new/conflicted)** — emerald/amber/sky/rose @ 15% opacity. GitKraken 의 sidebar 내 표시는 INCONCLUSIVE (Status Bar 측 가능성).
- **IdentityCard 3 차별점 패널 (한글 🇰🇷 / Gitea 🦊 / AI ✨)** — GitKraken 동등 영역 없음.

---

## 2. Interaction Micro-state DIFF

### 2.1 클릭 동작 (가장 큰 UX 격차)

| Ref type | git-fried | GitKraken | gap |
|----------|-----------|-----------|-----|
| **Local branch** | **`click=checkout`** (즉시 전환) | **`click=select`, `dblclick=checkout`** (S3) | **▲ SB-012 (사용자 결정)** |
| Remote branch | `click=checkout` (`onSwitchBranch`) | `dblclick=checkout` (likely) | ▲ 동일 결정 영역 |
| Tag | (사용 부재 — click 동작 미정) | `click=select`, `dblclick=jump to commit` (S5) | **▲ SB-030** tag click 동작 명시 |
| Stash | `click=onStashClick(s.sha)` (graph select) | `click=select`, `dblclick=apply` (likely) | ▲ 검토 |
| Worktree | (mini click 없음 — lock/unlock 만) | `click=select`, `dblclick=open` (likely) | ▲ row click 동작 추가 |
| PR | `click=dispatchShortcut('tab6')` (전체 panel 이동) | `click=open PR View` (S9) | ✓ 의도 동등 (다른 흐름) |
| Submodule | `dblclick=openAsRepo(s)` | `dblclick=open` (likely) | ✓ MATCH |

> **SB-012 의 결정 영역**: 
> - GitKraken 방식 → 실수 클릭으로 unintended checkout 방지 (Branch 50+ 환경에서 안전).
> - git-fried 방식 → 1-click 빠른 전환 (개인 small repo 환경에서 효율).
> - 권고: **uiSettings.branchClickAction = 'checkout' | 'select'** 토글 (사용자 선택). Default 는 `checkout` 보존 (regression 차단).

### 2.2 Hover

| 영역 | git-fried | GitKraken | 일치 |
|------|-----------|-----------|------|
| Row hover bg | `hover:bg-accent/30` ~ `/40` (mini 별) | (미공개) | ✓ 작동 |
| **Worktree hover popover (full path)** | ✗ title attribute 만 | ✓ **full path popover** (S7) | **▲ SB-016** Vue tooltip 컴포넌트 사용 |
| **Annotated tag hover popover (msg)** | ✗ 미구현 | ✓ **annotation 메시지 tooltip** (S5) | **▲ SB-030** |
| Branch hover preview (last commit) | ✗ 미구현 | LIKELY (training, 미공개) | SB-003 (기존, 보류 HIGH) |
| Hover delay | (CSS instant) | ~300-500ms (training, INCONCLUSIVE) | ▲ delay 통일 검토 |

### 2.3 Focus / a11y micro

| 영역 | git-fried | GitKraken | gap |
|------|-----------|-----------|-----|
| Search focus border | `focus:border-primary` (border 색 전환) | (미공개) | ✓ |
| Focus-visible ring | (기본) | INCONCLUSIVE | ✓ |
| Keyboard nav (↑/↓) | ✗ list row 미구현 | LIKELY (Electron 기본) | **▲ SB-031** |
| PgUp/PgDn | ✗ 미구현 | INCONCLUSIVE | ▲ (낮은 우선) |
| Inline rename (F2) | ✗ 미구현 (모달만) | LIKELY (rename 액션 inline) | ▲ SB-029 |

### 2.4 Multi-select

| 영역 | git-fried | GitKraken | gap |
|------|-----------|-----------|-----|
| **Shift+click range** | ✗ 미구현 | ✓ S3 CONFIRMED | **▲ SB-020** |
| **Ctrl/Cmd+click pick** | ✗ 미구현 | ✓ S3 CONFIRMED | **▲ SB-020** |
| **Bulk delete** | ✗ 미구현 | ✓ S3 CONFIRMED (multi-delete) | **▲ SB-020** |
| Other bulk actions | ✗ 미구현 | INCONCLUSIVE | ▲ |

---

## 3. Context Menu DIFF (per ref type)

### 3.1 Local branch

| # | GitKraken (S3 CONFIRMED) | git-fried (`useBranchActions` 20 액션) | 일치 |
|---|---|---|------|
| 1 | Checkout | switchBranch | ✓ |
| 2 | Rename branch | renameBranch | ✓ |
| 3 | Delete | deleteBranchLocal / deleteBranchRemote (Pattern 14 split) | ✓ |
| 4 | **Pin to left / Unpin** | ✗ | **▲ SB-025** |
| 5 | Merge [branch] into [current] | mergeBranch | ✓ |
| 6 | Rebase [current] onto [branch] | rebaseBranch | ✓ |
| 7 | Interactive Rebase | (IRR 모달) | ✓ |
| 8 | Cherry pick | cherryPickFromBranch | ✓ |
| 9 | Create branch here | createBranchFromBranch | ✓ |
| 10 | Create tag here | createTagAtBranch | ✓ |
| 11 | Push [branch] | pushBranch | ✓ |
| 12 | Fetch | fetchBranch | ✓ |
| 13 | Pull | pullBranch | ✓ |
| 14 | Set upstream | setUpstream | ✓ |
| 15 | Hide branch | toggleHide (useBranchVisibilityActions) | ✓ |
| 16 | Solo branch | toggleSolo | ✓ |
| 17 | Hide all branches | bulkHideKind('branch') | ✓ |
| 18 | Show all branches | unhideAll | ✓ |
| 19 | Copy branch name | copyBranchName | ✓ |

> **결론**: git-fried 의 useBranchActions 20 항목이 GitKraken 19 항목을 **18/19 cover** (94%). Pin to left 만 부재.

### 3.2 Remote branch (LIKELY 14 항목)

| GitKraken | git-fried | 일치 |
|-----------|-----------|------|
| Checkout (local tracking 생성) | ✓ checkout-from-remote | ✓ |
| Fetch / Pull / Set upstream | ✓ | ✓ |
| Delete remote branch | ✓ deleteRemote | ✓ |
| Merge into current / Rebase onto / Cherry pick | ✓ | ✓ |
| Create branch / Create tag here | ✓ | ✓ |
| Hide / Solo / Copy name | ✓ | ✓ |
| **Open in browser** | (확인 필요 — useBranchActions 에 openRemoteInBrowser 있는가) | ▲ 검증 |

### 3.3 Tag (GitKraken 10 항목 S5)

| # | GitKraken | git-fried | 일치 |
|---|-----------|-----------|------|
| 1 | Push tag | pushTag | ✓ |
| 2 | Create branch here | createBranchFromTag | ✓ |
| 3 | Merge [tag] into [current] | mergeTag | ✓ |
| 4 | Rebase [current] onto [tag] | rebaseTag | ✓ |
| 5 | **Fast-forward** | ✗ 미확인 | **▲ SB-032** |
| 6 | **Annotate tag** | ✗ 미구현 | **▲ SB-033** annotated tag 생성 모달 |
| 7 | Delete tag | deleteTagLocal/deleteTagRemote | ✓ |
| 8 | Hide tag | toggleHide(tag) | ✓ |
| 9 | Copy tag name | copyTagName | ✓ |
| 10 | Cherry pick | cherryPickFromTag (확인 필요) | ✓ likely |

### 3.4 Stash (GitKraken 8 항목 S6)

| # | GitKraken | git-fried (`useStashInteraction`) | 일치 |
|---|-----------|------------------------------------|------|
| 1 | Apply Stash | applyStash | ✓ |
| 2 | Pop Stash | popStash | ✓ |
| 3 | Delete Stash | dropStash | ✓ |
| 4 | **Edit stash message** | ✗ 미구현 (only AI msg) | **▲ SB-034** |
| 5 | **Share stash** | ✗ N/A (GitKraken Cloud) | 의도적 거부 (plan/01 §5) |
| 6 | Hide | toggleHide(stash) | ✓ likely |
| 7 | Hide all stashes | bulkHideKind('stash') | ✓ |
| 8 | Show all stashes | unhideAll | ✓ |

### 3.5 Worktree (GitKraken 6 항목 S7+S11)

| # | GitKraken | git-fried (`useWorktreePanelActions`) | 일치 |
|---|-----------|---------------------------------------|------|
| 1 | Open this worktree | openWorktree | ✓ |
| 2 | Open in new tab | openWorktreeNewTab | ✓ |
| 3 | Remove this worktree | removeWorktree | ✓ |
| 4 | **Remove worktree and delete branch** | ✗ (분리 동작만) | **▲ SB-035** combo action |
| 5 | Lock / Unlock | toggleLock (SB-009) | ✓ |
| 6 | **Start agent session** (S11 신규) | ✗ N/A (Claude/Codex CLI subprocess 만, Agent view 부재) | 의도적 — git-fried 는 GitKraken Agents view 미흡수 |

### 3.6 Submodule (GitKraken 5 항목 S10)

| # | GitKraken | git-fried (`useSubmoduleInteraction`) | 일치 |
|---|-----------|---------------------------------------|------|
| 1 | Update | updateSubmodule | ✓ |
| 2 | **Edit** | ✗ (URL/path 수정) | **▲ SB-036** |
| 3 | Open | openAsRepo | ✓ |
| 4 | Delete | deleteSubmodule | ✓ |
| 5 | Initialize (if not initialized) | initSubmodule | ✓ |

### 3.7 PR (GitKraken 4 항목 S9+S12)

| # | GitKraken | git-fried (`usePrMutations`) | 일치 |
|---|-----------|------------------------------|------|
| 1 | Checkout PR branch | checkoutPr | ✓ |
| 2 | Open in browser | openPrInBrowser | ✓ |
| 3 | View PR details (panel) | dispatchShortcut('tab6') | ✓ (동등 흐름) |
| 4 | Copy PR URL | copyPrUrl (확인 필요) | ▲ 검증 |

---

## 4. Drag & Drop Matrix DIFF

| Source → Target | GitKraken (S3, S4, S9) | git-fried (`useBranchDragDrop`) | gap |
|-----------------|------------------------|--------------------------------|-----|
| Branch → Another branch | Merge or Rebase dialog | ✓ Merge/Rebase | ✓ |
| Commit → Branch | (별도) | ✓ Cherry-pick (c50~) | ✓ MATCH |
| **Branch → Remote (same repo)** | **Push** | ✗ 미구현 | **▲ SB-019a** |
| **Branch → Remote (different remote)** | **Start PR creation** | ✗ 미구현 | **▲ SB-019b** |
| Tag → ? | N/A | ✗ | ✓ MATCH |
| Stash → ? | N/A (no drag) | ✗ | ✓ MATCH |
| Branch → Worktree | (확인 필요 — GitKraken 12.x Worktree drag) | ✗ | **▲ 후보** |
| Branch → Tab (open in new tab) | (확인 필요) | ✗ | ▲ 후보 |

---

## 5. Keyboard Shortcut DIFF

### 5.1 Confirmed parity

| Shortcut | git-fried | GitKraken (S2) | 일치 |
|----------|-----------|----------------|------|
| ⌘⌥F / Ctrl+Alt+F | ✓ Sidebar search focus | ✓ Left Panel filter | ✓ MATCH |
| ⌘1-9 / Ctrl+1-9 | ✓ 5 quick tab | ✓ Swap tab 1-9 | ✓ MATCH |
| ⌘B / Ctrl+B | ✓ /branches | ✓ Create branch | **△ 의미 다름** — git-fried 는 nav, GitKraken 은 action |
| ⌘P / Ctrl+P | ✓ Command Palette (`useCommandCatalog` 60 명령) | ✓ Toggle Command Palette | ✓ MATCH |
| ⌘⇧R | ✓ /repositories | (직접 매칭 없음) | git-fried 만 |

### 5.2 GitKraken-only (git-fried 미구현)

| Shortcut | GitKraken 동작 | git-fried | 후보 |
|----------|----------------|-----------|------|
| **Ctrl/Cmd+J** | **Toggle Left Panel** | ✗ | **▲ SB-022** UI Customization 기반 |
| **Ctrl/Cmd+K** | Toggle Commit Detail panel | ✗ | **▲ SB-037** |
| **Ctrl/Cmd+L** | Fetch all | ✗ (`useAutoFetch` 는 별도) | **▲ SB-023** |
| **Ctrl/Cmd+/** | Open keyboard shortcuts panel | ✗ (Settings 진입만) | **▲ SB-021** |
| **Ctrl/Cmd+F** | Focus search/filter | ✗ (⌘⌥F 만) | **▲ SB-038** standard search hotkey |
| **Esc** | Close current panel | (확인 필요 — modal 닫기만) | **▲ SB-039** 일관 처리 |
| Ctrl+Tab / Ctrl+Shift+Tab | Next/prev tab | ✓ tab 시스템 부재 검토 (RepoTabBar 와 다름) | 검증 |

### 5.3 git-fried-only (GitKraken parity 없음)

- **⌘B / ⌘3 / ⌘6 / ⌘7** — Mini panel quick nav. GitKraken 의 ⌘1-9 와 의도 다름 (git-fried 는 panel 별 직접 진입).
- **⌘⌥F** 의 동작이 sidebar search focus 인 점은 GitKraken Cmd+Option+F 와 동일.

---

## 6. Status & Notification DIFF

| 영역 | git-fried | GitKraken | gap |
|------|-----------|-----------|-----|
| Auto-fetch | ✓ `useAutoFetch` + `general.autoFetchIntervalMin` 설정 | ✓ 1분 default (S4) | **▲ SB-028 needs-user** default 값 확인 (사용자 결정) |
| Fetch in-progress spinner | (확인 필요) | toolbar area ✓ (per-row INCONCLUSIVE) | ✓ likely |
| **Per-row pull/push 진행 표시** | ✗ 미구현 | INCONCLUSIVE | ▲ 보류 |
| **Conflict 표시 (row 색)** | (확인 필요) | LIKELY red dot | **▲ SB-040** |
| **Ahead/behind 표시** | ✓ ↑N ↓N (text-[9px], diff-add/danger-rose) | INCONCLUSIVE pill | ✓ ★ git-fried 우월 (명시) |
| **WIP indicator** | ✗ 미구현 | LIKELY (S3 + training) | **▲ SB-027 needs-user** branch row 상단 표시 |
| **Stale ref indicator** | ✗ 미구현 | INCONCLUSIVE | ▲ 보류 |
| **PR CI 아이콘 4 상태** | ✗ draft + comment 만 | ✓ green/yellow/red/gray-D (S9 CONFIRMED) | **▲ SB-017** |
| **Unread PR comment** | ✗ 미구현 | INCONCLUSIVE | ▲ 보류 |
| **Worktree 삭제 진행 시각** | (확인 필요) | ✓ S11 CONFIRMED | **▲ SB-041** |

---

## 7. Search / Filter DIFF

| 영역 | git-fried | GitKraken | gap |
|------|-----------|-----------|-----|
| 통합 검색 input | ✓ Sidebar top | ✓ Left Panel filter (S2) | ✓ MATCH |
| Clear button | ✓ ✕ (`search.clear()`) | ✓ (Esc/X INCONCLUSIVE) | ✓ |
| **Per-section filter** | ✗ 통합만 | ✓ Tags 전용 filter bar (S5) | **▲ SB-018** 큰 list 영역 |
| Search auto-expand folder | ✓ `auto-expand="search.isActive.value"` | ✓ likely | ✓ ★ git-fried 명시 |
| Result highlight | ✗ visual highlight 없음 (filter only) | INCONCLUSIVE | ▲ SB-042 highlight text in row |
| Empty result message | ✗ section 자체 v-if 숨김 | INCONCLUSIVE | ▲ SB-043 빈 결과 메시지 (검색어 + 0건 명시) |
| **PR filters (predefined + custom)** | ✗ 통합 search 만 | ✓ My PRs / All PRs + custom (S9) | **▲ SB-044** |
| Search history persistence | ✗ 미구현 | INCONCLUSIVE | ▲ LOW |

---

## 8. Persistence DIFF

| 영역 | git-fried | GitKraken | gap |
|------|-----------|-----------|-----|
| Sidebar width | ✓ `git-fried.sidebar-width.v1` (180-400px) | LIKELY (storage 미공개) | ✓ likely |
| Section collapse (7 mini) | ✓ `active-repo-quick.*` | LIKELY | ✓ likely |
| Tree expand state | ✓ `branch-tree.{local,remote,tags}` | INCONCLUSIVE | ✓ |
| Tabs per profile | ✗ N/A (git-fried 의 tabs 는 repo 단위) | ✓ tabs persist + adjust on profile switch (S1) | **▲ SB-045** repo tabs ↔ profile 연결 |
| **New worktree state 상속** (hidden/solo/collapsed) | ✗ 미구현 | ✓ S7+S11 CONFIRMED | **▲ SB-046** |
| Search term persist | ✗ 미구현 | INCONCLUSIVE | ▲ LOW |
| Sidebar state on workspace 전환 | ✓ Pinia + localStorage | INCONCLUSIVE | ✓ |

---

## 9. GitKraken-Specific Behavior DIFF (git-fried 가 모를 만한)

| # | GitKraken | git-fried | 판정 |
|---|-----------|-----------|------|
| 1 | **Pin to left** (branch column lock in Commit Graph) | ✗ (Commit Graph BRANCH_CHIP_STICKY_WIDTH 있으나 다른 개념) | **▲ SB-025** |
| 2 | Hide/Solo gray/orange visual | △ 동작만, 시각 미정 | **▲ SB-013** |
| 3 | **Smart Branch Visibility (gear)** | ✗ | **▲ SB-014** |
| 4 | WIP indicator | ✗ | ▲ SB-027 needs-user |
| 5 | Branch groups / folders | ✗ | **▲ SB-026** Gitflow 도입 시 valuable |
| 6 | List \| Agents segmented | ✗ N/A | 의도적 거부 |
| 7 | Agent sessions from worktree | ✗ N/A | 의도적 — AI 는 commit msg/PR/conflict 만 |
| 8 | Multi-active workspace | ✗ N/A | SB-005 (기존 needs-user) |
| 9 | GitKraken Projects (group repos) | ✓ Workspace (의도 유사) | ✓ MATCH |
| 10 | Submodule recursive 표시 | ✗ | ▲ LOW (Gitflow 도입 시) |
| 11 | **CJK ref/path mangling** (community reports) | ✓ NFC normalize + decode_korean_safe + UTF-8 강제 | **★ git-fried 우월** |
| 12 | Cloud sync indicator | ✗ N/A | 의도적 거부 (plan/01 §5) |
| 13 | Profile color in sidebar rows | △ Profile system 정착, sidebar row 색 차별 미정 | ▲ SB-047 |
| 14 | Gitflow visual grouping (develop/feature/hotfix/release) | ✗ | ▲ SB-026 family |
| 15 | PR code suggestions inline | ✗ N/A (PR view 전용) | 의도적 |

---

## 10. Empty / Loading / Error State DIFF (per section)

| Section | git-fried Empty | git-fried Loading | GitKraken |
|---------|-----------------|-------------------|-----------|
| Branches | section 자체 `v-if` 숨김 | ✓ SkeletonBlock count=5 | INCONCLUSIVE |
| Remotes | section 자체 숨김 | ✓ count=5 | hover + plus affordance ✓ S4 |
| Worktrees | section 자체 숨김 (or "+N more") | ✓ count=3 | INCONCLUSIVE empty / 삭제 progress ✓ S11 |
| Stashes | section 자체 숨김 | ✓ count=3 | INCONCLUSIVE |
| Submodules | section 자체 숨김 | ✓ count=3 | hover + plus ✓ S10 / Initialize ✓ |
| PRs | section 자체 숨김 | ✓ count=5 | empty 시 filter 없음 메시지 (S9) |
| Tags | section 자체 숨김 | ✓ count=5 | filter bar 유지 (S5) |
| **ActiveRepoQuickActions** | ✓ `<EmptyState size="sm">` "활성 레포 없음" | - | N/A |

> **git-fried 우월 (★ keep)**: 7 Mini section 모두 SkeletonBlock 명시. GitKraken 은 INCONCLUSIVE.
> **gap (▲)**: empty 시 section 자체를 숨기는 정책 — "0건 명시" vs "section 숨김" 사용자 결정 영역. SB-048.

---

## 11. i18n 잔재 (Claude A Finding F)

### 한글 hardcode (수정 필요, **SB-049**)

| 파일 | 위치 | 텍스트 | 액션 |
|------|------|--------|------|
| `MiniSection.vue:61` | full button label | `"전체 →"` | i18n 키 `miniSection.viewAll` 등 |
| `MiniWorktreeList.vue:96` | "+N more" footer | `"⋯ +{{ moreCount }}개 더 (전체 → 클릭)"` | i18n |
| `MiniPrList.vue:56` | "+N more" footer | `"⋯ +{{ moreCount }}개 더 (전체 → 클릭)"` | i18n |
| `MiniSection.vue:48` | collapse toggle title attr | ``` `${title} 섹션 ${collapsed ? '펴기' : '접기'}` ``` | i18n template literal → t() |

→ **신규 i18n key 5건 예상** (ko/en 각 + title attr).

---

## 12. 신규 마이크로 backlog enumerate (SB-012 ~ SB-049)

> 기존 SB-001 ~ SB-011 (영역 단위) 는 c93 까지 7건 해소. 본 round 는 **마이크로 단위** — 시각 토큰 / 인터랙션 / 메뉴 / drag / 단축키 / 상태 / 영속화 / i18n 38건.

### HIGH (4건) — UX 격차 큰 영역

| ID | 영역 | 내용 | Effort |
|----|------|------|--------|
| **SB-012** | 인터랙션 | Branch click 동작 (`checkout` vs `select`) — **needs-user** toggle 설정 추가 | S |
| **SB-013** | 시각 토큰 | Hide=gray / Solo=orange icon 색 명시 (`useBranchVisibilityActions` 정착) | S |
| **SB-014** | 인터랙션 | Smart Branch Visibility (Commit Graph header gear → checked-out + target + upstreams 자동 필터) | M |
| **SB-017** | 상태 표시 | PR CI 4 아이콘 (green/yellow/red/gray-D) MiniPrList 추가 | S |

### MEDIUM (10건) — 명확한 패치 패턴

| ID | 영역 | 내용 | Effort |
|----|------|------|--------|
| SB-015 | 인터랙션 | Section header double-click maximize | S |
| SB-016 | hover | Worktree hover popover (full path) | S |
| SB-018 | 검색 | Per-section filter (Tag mini 전용 filter bar) | S |
| SB-019 | drag | Branch → Remote (push) + Branch → Other Remote (PR 생성) | M |
| SB-020 | multi-select | Shift+click range + Ctrl+click pick + bulk delete | M |
| SB-026 | 인터랙션 | Branch groups/folders (Gitflow develop/feature/hotfix/release) | L |
| SB-029 | 인터랙션 | Inline rename (F2 또는 context menu → inline edit) | M |
| SB-030 | hover | Annotated tag hover popover (annotation 메시지) + tag click 동작 명시 | S |
| SB-033 | menu | Annotate tag 모달 (Tag 메뉴 #6) | S |
| SB-040 | 상태 | Conflict 표시 (branch row 의 red dot) | S |

### LOW (5건) — 단축키 / 영속화

| ID | 영역 | 내용 | Effort |
|----|------|------|--------|
| SB-021 | 단축키 | Ctrl+/ shortcuts panel (Settings 진입 별도, 빠른 reference modal) | S |
| SB-022 | 단축키 | Ctrl+J Toggle Left Panel | S |
| SB-023 | 단축키 | Ctrl+L Fetch all (`useAutoFetch.fetchNow()` wire) | S |
| SB-031 | a11y | List row 키보드 nav (↑/↓) | M |
| SB-046 | 영속화 | 새 worktree 의 hidden/solo/collapsed 상속 | S |

### needs-user (2건) — 사용자 결정 영역

| ID | 영역 | 내용 |
|----|------|------|
| SB-027 | 시각 | WIP indicator on branch row (uncommitted changes 있을 때 표시) — git-fried 의 IdentityCard 와 위치/표시 협상 |
| SB-028 | 정책 | Auto-fetch default 1분 (GitKraken 기준) vs 현재 git-fried 기본값 |

### Backlog (낮은 ROI / 의도적 거부)

| ID | 영역 | 내용 | 분류 |
|----|------|------|------|
| SB-025 | 시각 | Pin to left (Commit Graph branch column lock) | LOW |
| SB-032 | menu | Tag Fast-forward 동작 | LOW |
| SB-034 | menu | Stash Edit message (현재 AI msg 만) | LOW |
| SB-035 | menu | Worktree Remove + delete branch combo | LOW |
| SB-036 | menu | Submodule Edit (URL/path 수정) | LOW |
| SB-037 | 단축키 | Ctrl+K Commit Detail panel toggle | LOW |
| SB-038 | 단축키 | Ctrl+F standard search hotkey (현재 ⌘⌥F 만) | LOW |
| SB-039 | 단축키 | Esc 일관 처리 (panel close 통일) | LOW |
| SB-041 | 상태 | Worktree 삭제 진행 시각 feedback | LOW |
| SB-042 | 검색 | Result highlight (text 강조) | LOW |
| SB-043 | 검색 | Empty result 메시지 | LOW |
| SB-044 | 검색 | PR filters predefined + custom | LOW |
| SB-045 | 영속화 | Profile-tied repo tabs | LOW |
| SB-047 | 시각 | Profile color 로 sidebar row 차별화 | LOW |
| SB-048 | empty | Empty section 정책 (숨김 vs "0건 명시") | LOW |
| SB-049 | i18n | "전체 →" 등 한글 hardcode 4곳 마이그 | XS |

### 의도적 거부 (★ skip)

- **GitKraken Agents view / List\|Agents segmented** — git-fried 는 AI subprocess 만 (commit msg / PR body / conflict resolve / explain), Agent view 자체 없음. plan/01 §5 정합.
- **Cloud sync / Saved views sync** — GitKraken Cloud 의존, 의도적 거부.
- **Share stash** — GitKraken Cloud, 의도적 거부.
- **Multi-active workspace** — SB-005 (needs-user 기존 보류).

---

## 13. git-fried 우월 (★ keep — 회귀 차단)

1. **한글 안전 NFC** — `api/git.ts` 의 toNFC() 8 함수 + Rust `decode_korean_safe`. GitKraken CJK community reports vs git-fried 정착.
2. **IdentityCard 3 차별점 패널** — 한글 🇰🇷 / Gitea 🦊 / AI ✨. GitKraken 동등 없음.
3. **7 Mini section 모두 SkeletonBlock** — count=3~5 명시. GitKraken loading 상태 INCONCLUSIVE.
4. **Workspace color dot** — `h-3 w-3 rounded-full` workspace.color 명시.
5. **Branch occupied 시각** — 🔗 emoji + cursor-not-allowed + disabled attr (worktree 점유). GitKraken 동등 없음 (단순 hidden 만).
6. **status counts 4색 (staged/mod/new/conflicted)** — emerald/amber/sky/rose @ 15%. ActiveRepoQuickActions 명시.
7. **Section collapse 영속화 7키** — `active-repo-quick.*` 명시. GitKraken LIKELY but 미공개.
8. **Branch tree auto-expand on search** — `:auto-expand="search.isActive.value"` 명시. UX 명료.
9. **Pattern 9 sister (delegate)** — useBranchInteraction / useStashInteraction / useSubmoduleInteraction / useRemoteInteraction / useTagInteraction. Composable 일관성.
10. **Resize handle ARIA slider** — `role="separator" aria-valuemin=180 aria-valuemax=400`. GitKraken 동등 INCONCLUSIVE.

---

## 14. Cross-Validation Conclusion

### Agreed (4 agent ↔ docs)
- Sidebar resize ✓, section collapse ✓, hide/solo 동작 ✓, branch tree ✓, multi-workspace ✓ (Workspace = Projects), per-repo persistence ✓.

### git-fried 가 부족 (▲ — backlog SB-012~)
- 시각: hide/solo 색, PR CI 아이콘, hover popover (worktree path + tag annotation), WIP indicator.
- 인터랙션: click 동작 (checkout vs select), multi-select, inline rename, section header double-click, Smart Visibility.
- 메뉴: Pin/Unpin, Tag Fast-forward, Tag Annotate, Stash Edit msg, Worktree Remove+delete combo, Submodule Edit.
- Drag: branch→remote (push/PR).
- 단축키: Ctrl+J/K/L/F/Esc/Slash (6건).
- 영속화: 새 worktree state 상속, profile-tied tabs.

### GitKraken 이 부족 (★ — git-fried 우월, keep)
- 한글 안전 (CJK round-trip), IdentityCard 3 차별점, branch occupied 명시 시각, 7 mini skeleton 명시, workspace color dot.

### INCONCLUSIVE (Codex 학습 분포 불확실)
- 픽셀 수치 전체 (row height / indent / icon size)
- ahead/behind pill 위치, conflict red dot, stale ref indicator
- 빈/로딩/에러 copy
- F2 inline rename
- Esc/X filter clear semantics
- 검색 history persist

→ **사용자가 GitKraken 직접 사용 시 검증 가능한 영역**. 본 보고서의 "needs-user" 영역.

---

## 15. Decision Triage Summary

- **autonomous-safe (10)**: SB-013/015/016/017/018/021/022/023/030/046 — 작고 명확. Claude 단독 진행 가능.
- **needs-claude-judgment (10)**: SB-014/019/020/026/029/031/033/040/042/043 — 패턴 명확하나 design 검토 필요.
- **needs-user (4)**: SB-012 (click 동작), SB-027 (WIP indicator), SB-028 (auto-fetch default), SB-048 (empty 정책).
- **의도적 거부 (5)**: GitKraken Agents view, Cloud sync, Share stash, Multi-active workspace (SB-005 보류), Saved views sync.

---

## 16. Files

- 본 보고서: `docs/ux-eval/2026-05-18-sidebar-microdetail-diff.md`
- Codex 원본 finding 120건: `docs/ux-eval/2026-05-18-sidebar-microdetail-codex.md` (Codex agent `a9caf0ee4bc9406c3`)
- Claude inventory 25건: 본 세션 inline (Agent A 응답, 별도 파일 미저장)
- 기존 sidebar DIFF (영역 단위 11 Gap): `docs/ux-eval/2026-05-16-sidebar-gitkraken-diff.md`

---

## Next

- HIGH 4건 (SB-012/013/014/017) 중 SB-013 (hide/solo 색) + SB-017 (PR CI 4 아이콘) 은 `/plan sidebar-microgap-wave-1` 으로 즉시 진행 가능.
- SB-012 (branch click 동작) 는 사용자 결정 — `/research branch-click-action-policy` 권장.
- 본 보고서 + MEMORY entry 추가 (`analyze_2026_05_18_sidebar_microdiff.md`) 권장.
