# Sidebar UI/UX 집중 탐구 + GitKraken DIFF

- **일시**: 2026-05-16
- **트리거**: `/goal 왼쪽 사이드바부분만 집중적으로 UI UX 탐구하고 gitKraken 과 상세 DIFF 진행`
- **범위**: git-fried 의 `<aside data-testid="sidebar">` (220px / xl:280px) 영역만. 헤더 RepoTabBar / 우측 main / fullscreen diff 등은 scope 외.
- **GitKraken 베이스**: 사용자 명시 + MEMORY 의 `plan/25 GitKraken layout migration` + 누적 c46~c80 parity sprint

## 1. git-fried Sidebar 구조 (실측)

### 1.1 Layout

```text
<aside data-testid="sidebar"> (220px / xl:280px, flex column)
├─ <header> (line 74-84)
│   ├─ "git-fried" 로고 (font-mono semibold)
│   └─ "v0.3.0" 버전 hint (cursor-help tooltip)
├─ <section> Workspace context (line 88-125)
│   ├─ workspace color dot (3×3 rounded)
│   ├─ <select> dropdown — workspace 변경
│   └─ <RouterLink to="/repositories"> "관리" 진입
├─ <section> 통합 검색 input (line 128-149)
│   ├─ placeholder "필터: 브랜치 / 태그 / stash …"
│   ├─ data-testid="sidebar-search"
│   └─ ⌘⌥F focus 단축키
├─ <div class="flex-1 overflow-y-auto"> Body
│   └─ <ActiveRepoQuickActions />
│       ├─ EmptyState (활성 repo 없으면) "레포 미선택"
│       ├─ branch + upstream + ahead/behind row
│       ├─ changes count badges (staged / mod / new / conflicted)
│       ├─ 5 quick tab button grid (변경 / 브랜치 / Stash / PR / Worktree)
│       └─ 7 Mini section (조건부, uiSettings.miniSidebarSections):
│           ├─ MiniBranchList (LOCAL — 트리)
│           ├─ MiniRemoteBranchList (REMOTE — 트리)
│           ├─ MiniWorktreeList (WORKTREES)
│           ├─ MiniStashList (STASHES — Pattern 9 + ⋯ context)
│           ├─ MiniSubmoduleList (SUBMODULES — click=open new tab + 7 action)
│           ├─ MiniPrList (PR — active repo only)
│           └─ MiniTagList (TAGS — 트리, release/v2.0.0 → release > v2.0.0)
└─ <footer> "Tauri 2 · Vue 3 · Rust"
```

### 1.2 Feature inventory (composable 누적)

| Feature | Composable / Component | Sprint 출처 |
|----|----|----|
| 통합 검색 | `useSidebarSearch` | Phase 12-2 |
| Branch tree (build/sort/filter) | `useBranchTree` + `BranchTreeView` | Phase 12-1 |
| Branch context menu | `useBranchInteraction` (Pattern 9 sister) | c54+++ |
| Branch drag&drop | `useBranchDragDrop` | c54+ |
| Branch actions (20개) | `useBranchActions` | c54+++ |
| Branch visibility (hide/solo) | `useBranchVisibilityActions` | c52~ |
| Worktree | `useWorktrees` + `useWorktreePanelActions` | c40~ |
| Stash | `useStash` + `useStashInteraction` (Pattern 9 sister) | c74 |
| Tag tree | (inline) | Phase 12-1 |
| Submodule | `useSubmodules` + `useSubmoduleInteraction` (Pattern 9 sister) | Phase 12-3 + c74 |
| PR list (active-repo) | `usePullRequests` | c27-1 |
| Sidebar groups (repo) | `useSidebarGroups` | c46~ |
| Sidebar filter | `useSidebarFilter` | c47~ |
| Section collapse 영속화 | `useSectionCollapse` | c27-1 |

### 1.3 단축키 / 명령

| Shortcut | Action |
|----|----|
| ⌘⌥F | sidebar 검색 input focus |
| ⌘1 | 변경 탭 |
| ⌘2 / ⌘B | 브랜치 탭 |
| ⌘3 | Stash 탭 |
| ⌘6 | PR 탭 |
| ⌘7 | Worktree 탭 |
| ⌘⇧R | /repositories 페이지 (sidebar 의 "관리" 링크와 동일) |

### 1.4 LOC 분포

| Component | LOC |
|----|----|
| Sidebar.vue | 162 |
| ActiveRepoQuickActions.vue | 121 |
| MiniSection.vue (wrapper) | 66 |
| MiniBranchList.vue | 177 |
| MiniRemoteBranchList.vue | 85 |
| MiniWorktreeList.vue | 79 |
| MiniStashList.vue | 141 |
| MiniSubmoduleList.vue | 121 |
| MiniPrList.vue | 60 |
| MiniTagList.vue | 69 |
| **합계** | **1,081 LOC** |

모두 script <200 보존 (c67 마일스톤 정합).

## 2. GitKraken Left Sidebar 패턴

### 2.1 Layout (사용자 명시 + plan/25 정합)

```text
┌─ Top Bar ─────────────────┐
│  Workspace switcher       │
│  Network/sync status      │
├─ Repository List ─────────┤
│  Folder grouping (개인/회사)│
│  Workspace 안 repo (10~50) │
├─ REFS section (current repo)
│  ├─ Branches              │
│  │   ├─ Local (tree)      │
│  │   └─ Remote (origin/*)│
│  ├─ Tags                  │
│  ├─ Stashes               │
│  ├─ Submodules            │
│  └─ Worktrees             │
├─ HISTORY ─────────────────┤
│  All commits / Active     │
├─ Pull Requests (forge)    │
├─ Issues (forge)           │
└─ LAUNCHPAD (별도 view)    │
```

### 2.2 핵심 동작

- **Hover preview**: ref 위 마우스 hover → commit 메시지 / 변경 파일 작은 popover
- **Context menu**: 우클릭 → checkout / rename / delete / push / pull / merge / rebase / tag / cherry-pick 등
- **Drag&drop**: branch → folder, branch → another branch (merge gesture)
- **Double-click**: checkout / open commit / open file
- **Global search ⌘⇧F**: 모든 commit / file / ref / issue 통합 검색
- **Section collapse**: 사용자 학습 후 영속화

## 3. 상세 DIFF (영역 별)

### 3.1 Header / Branding

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| 로고 | "git-fried" font-mono | "GitKraken" + workspace logo | 정합 ✓ (간결) |
| 버전 hint | v0.3.0 (cursor-help) | sync status / network | git-fried 가 marketing 적 — GitKraken 이 functional |
| Action button | (없음) | settings / account / help | git-fried 는 RepoTabBar trailing 으로 분리 (정당) |

### 3.2 Workspace Context

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Selector | `<select>` 단일 dropdown + "ALL" fallback | inline workspace switcher + repo list tree | git-fried 가 더 compact (Phase 11-6 의 의도된 separation) |
| Color dot | 3×3 rounded, workspace.color | 동일 (좌측 사각형 또는 dot) | 정합 ✓ |
| Repo 관리 진입 | `RouterLink to="/repositories"` (sidebar 내 작은 버튼) | inline tree expand or right-click | git-fried 가 별도 페이지 분리 (Phase 11-4 결정) |
| Multi-workspace active | ✗ (단일 active) | ✓ (multi-active 가능) | UX gap — git-fried 는 명시 단일 |

### 3.3 검색 (Sidebar Local)

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Scope | sidebar local: LOCAL/REMOTE/WORKTREES/STASHES/PR/TAGS/SUBMODULES | global: commit/file/ref/issue (⌘⇧F) | **다른 책임** — git-fried 의 sidebar search = filter only / global search 는 ⌘P CommandPalette 분리 |
| Clear button | ✕ inline (search.isActive 시) | escape / ✕ inline | 정합 ✓ |
| Auto-expand tree | ✓ 검색 시 모든 폴더 자동 펼침 (Phase 12-2) | ✓ 동일 | 정합 ✓ |
| 단축키 | ⌘⌥F | ⌘⌥F | 정합 ✓ |

### 3.4 활성 Repo Status Row

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Branch | "on <branch> → <upstream>" | "on <branch>" | 정합 (upstream 표기 git-fried 추가) |
| ahead/behind | ↑N (text-diff-add) ↓N (text-danger-rose) | ↑N ↓N 같은 색 약 | 정합 ✓ |
| Changes count badges | staged/mod/new/conflicted 4종 색 | 동일 | 정합 ✓ |
| Empty state | "변경사항 없음 ✓" | "No changes" (영문) | i18n 정합 (한국어 1급) |

### 3.5 Quick Tab Buttons (5개)

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Layout | 5×1 grid (변경/브랜치/Stash/PR/Worktree) | 좌측 nav rail (수직 stacked tab) | **다른 layout** — git-fried 가 수평 / GitKraken 이 수직 |
| 아이콘 | unicode (◇⎇⤓⇄🌳) | SVG / Material | git-fried 가 더 minimal |
| 한글 라벨 | hardcoded ("변경/브랜치/Stash/PR/Worktree") | i18n 자동 | **⚠ git-fried i18n 미적용** (잔존 backlog) |
| title hint | "변경 탭 (⌘1)" hardcoded | i18n with shortcut | **⚠ git-fried i18n 미적용** (잔존 backlog) |

### 3.6 Mini Section — LOCAL (Branches)

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Tree nesting | prefix `/` 자동 (feat/api → feat > api) | 동일 | 정합 ✓ (Phase 12-1) |
| Folder collapse | ✓ 영속화 | ✓ 영속화 | 정합 ✓ |
| Filter (search query) | ✓ 통합 | ✓ inline filter | 정합 ✓ |
| Context menu | useBranchInteraction (Pattern 9 sister) — 20 액션 | 동일 | 정합 ✓ |
| Drag&drop | useBranchDragDrop (folder 이동) | branch → folder + branch → branch merge gesture | **부분 정합** (merge gesture 부재) |
| Hover preview | (없음) | commit message popover | **UX gap** |
| Worktree 점유 배지 | ✓ (occupiedMap, c38 fix HIGH-2) | ✓ (다른 worktree icon) | 정합 ✓ |
| Visibility (hide/solo) | useBranchVisibilityActions (CommitGraph filter 영향) | ✗ | **git-fried 추가 기능** |

### 3.7 Mini Section — REMOTE

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Tree | origin/feat/x → origin > feat > x | 동일 | 정합 ✓ |
| Multi-remote | ✓ (다중 remote 자동 그룹) | ✓ | 정합 ✓ |
| Pull/Fetch action | context menu | inline + context | 정합 ✓ |

### 3.8 Mini Section — TAGS

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Tree | release/v2.0.0 → release > v2.0.0 (Phase 12-1) | 동일 | 정합 ✓ |
| Sort | (확인 필요 — semver vs alpha) | semver descending | **확인 필요** |
| Tag action | useTagInteraction (delete/copy) | delete/push/copy | 정합 ✓ |

### 3.9 Mini Section — STASHES

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| List | 모든 stash + scrollable (c74) | 동일 | 정합 ✓ |
| Timestamp | formatRelativeTime (c74) | 동일 | 정합 ✓ |
| Apply hint | ⌘L (Pattern 9 sister) | inline button + context | 정합 ✓ |
| ⋯ context | useStashInteraction (apply/pop/drop) | 동일 | 정합 ✓ |

### 3.10 Mini Section — WORKTREES

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| List | useWorktrees | 동일 | 정합 ✓ |
| Add/remove | dispatchShortcut('newWorktree') | inline + context | 정합 ✓ |
| Lock/unlock | (composable 보유, mini UI 확인 필요) | inline icon | **확인 필요** |

### 3.11 Mini Section — SUBMODULES

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Click → open as repo (new tab) | ✓ (c74) | ✓ (별도 window 또는 in-place) | 정합 ✓ |
| 7 action context | update/sync/foreach 등 (c74) | 동일 | 정합 ✓ |

### 3.12 Mini Section — PR (active-repo)

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| Scope | active repo only | active repo + workspace 전체 | **gap** (workspace 전체 PR 미노출) |
| Author filter | (확인 필요) | ✓ assignee/author filter | **확인 필요** |
| Status | open / closed / draft | 동일 | 정합 ✓ |
| forge | Gitea + GitHub (multi) | GitHub/GitLab/Bitbucket/Azure | git-fried 가 Gitea 1급 (정당) |

### 3.13 Footer

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| 내용 | "Tauri 2 · Vue 3 · Rust" | sync status / 네트워크 / cloud | **functional gap** — git-fried 의 footer 가 marketing |

### 3.14 Width / Density

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| 기본 너비 | 220px (xl: 280px) | 240~320px (사용자 drag 가변) | git-fried 가 좁은 편 |
| 사용자 resize | ✗ (고정) | ✓ drag handle | **UX gap** — 사용자 너비 조정 부재 |
| 데이터 밀도 | 7 mini section + 5 quick tab + status row + workspace = **극히 dense** | 동일 정보 + 더 큰 여백 | **trade-off** — git-fried 가 정보 우선 |

### 3.15 Skeleton / Loading

| 영역 | git-fried | GitKraken | Verdict |
|----|----|----|----|
| First-paint skeleton | SkeletonBlock 8/8 mini (c54 Issue 2) | 동일 spinner / shimmer | 정합 ✓ |
| Empty state | EmptyState component | "no items" inline | 정합 ✓ |

## 4. UX 평가 — Nielsen 10 Heuristics

| # | 원칙 | 점수 | 근거 |
|----|----|----|----|
| 1 | Visibility of system status | 9/10 | active repo + ahead/behind + changes count + worktree 배지 모두 명확 |
| 2 | Match with real world | 9/10 | 한국어 1급 정책 정합. 단 quick tab + EmptyState 일부 한글 하드코딩 |
| 3 | User control & freedom | 9/10 | ⌘⌥F focus + section collapse 영속화 + workspace ALL fallback |
| 4 | Consistency & standards | 9/10 | 7 Mini section MiniSection wrapper 일관 + Pattern 9 sister context menu 일관 |
| 5 | Error prevention | 8/10 | workspace 잘못 선택 가능 (ALL fallback 으로 회복) + branch context menu 의 confirm dialog |
| 6 | Recognition over recall | 9/10 | workspace color dot + icon + ahead/behind 색 분리 + ⌘N hint |
| 7 | Flexibility & efficiency | 8/10 | ⌘1~7 단축키 + miniSidebarSections 토글 + ⌘⌥F. 단 sidebar 너비 사용자 조정 부재 |
| 8 | Aesthetic & minimalist | 7/10 | 220px 너비 + 7 mini section + 5 tab + status row = 데이터 밀집. GitKraken 대비 여백 부족 |
| 9 | Error recovery | 7/10 | toast 에러 표시 + i18n. 단 sidebar 자체의 graceful degrade (예: workspace fetch fail) 부재 |
| 10 | Help & documentation | 8/10 | title hover hint + ⌘N 표기. 그러나 일부 hardcoded (5 quick tab) |

**총점**: **83/100** (Nielsen 평균 8.3) — 직전 c55-c58 sprint 의 87→92 기준 시 sidebar 영역만 한정하면 약간 lower (전체 페이지 대비 좁은 너비 + 데이터 밀도 부담)

## 5. 발견된 UX Gap (우선순위별)

### CRIT (즉시)

(없음 — 기능 자체 결함 0)

### HIGH (이번 sprint 또는 다음)

| ID | Gap | 근거 | 권장 |
|----|----|----|----|
| **SB-001** | Sidebar **resize 부재** (220px 고정) | GitKraken 의 사용자 drag handle 비교 | localStorage 영속 width + min 200 / max 400 + drag handle |
| **SB-002** | Quick tab 5건 + EmptyState 한글 하드코딩 (i18n 미적용) | `ActiveRepoQuickActions.vue` line 46-51 + 60-61 + Mini header 일부 | i18n `sidebar.quickTab.*` namespace (이미 a11y.ariaLabel.* 정합 패턴) |
| **SB-003** | Branch row **hover preview 부재** | GitKraken commit message popover 비교 | hover 200ms 후 작은 popover (last commit subject + sha + author) |

### MED (다음 sprint)

| ID | Gap | 권장 |
|----|----|----|
| **SB-004** | Branch → branch **merge gesture (drag&drop)** 부재 | useBranchDragDrop 확장 — branch drop on branch = merge dialog |
| **SB-005** | Workspace **multi-active** 부재 (단일 selector) | 의도된 결정인지 사용자 확인 후 multi-active 도입 가능 |
| **SB-006** | PR scope **active-repo only** (workspace 전체 미노출) | workspace 단위 PR aggregation view 추가 (옵션) |
| **SB-007** | Footer "Tauri 2 · Vue 3 · Rust" 가 **marketing** (functional 아님) | sync status / network indicator / 마지막 fetch 시각 표기 |
| **SB-008** | Tag sort 기준 **확인 필요** (semver vs alpha) | semver descending 가 GitKraken 정합 — 본 sprint 코드 확인 |
| **SB-009** | Worktree mini의 lock/unlock **inline icon 부재** | useWorktreeContext 확장 — lock 표기 + click toggle |

### LOW

| ID | Gap | 권장 |
|----|----|----|
| **SB-010** | 사용자 학습 — 5 quick tab 의 순서 자유 변경 | drag&drop reorder + localStorage |
| **SB-011** | sidebar 의 ARCH 측면 — `<aside>` 안의 7 mini section 가 v-if 조건 (uiSettings.miniSidebarSections) 으로 mount/unmount → 검색 시 unmount 영역의 데이터 invalidate | `v-show` 로 변경 + 검색 query 통합 |

## 6. 추천 진행 계획

### Phase A — 즉시 (XS effort)

1. **SB-002 i18n 마이그**: quick tab 5건 + EmptyState 2건 → `sidebar.quickTab.*` + `sidebar.emptyState.*` namespace. 작업 size XS (ko/en 각 7 key + binding 변경)
2. **SB-007 footer 갱신**: marketing → functional (마지막 fetch 시각 또는 sync status). 작업 size S

### Phase B — 다음 sprint (M effort)

3. **SB-001 resize handle**: drag handle + localStorage 영속. 작업 size M (UX 검증 필요)
4. **SB-008 tag sort 확인**: 본 sprint 검증 + 필요 시 fix
5. **SB-009 worktree lock icon**: composable 보유 → mini UI 추가만

### Phase C — 큰 sprint (L effort)

6. **SB-003 hover preview**: 모든 ref 의 last commit 정보 lazy fetch + popover. 작업 size L
7. **SB-004 merge gesture**: useBranchDragDrop 확장 + merge dialog
8. **SB-006 PR workspace aggregation**: 모든 active workspace repo 의 PR 통합 view

### Phase D — 사용자 결정

9. **SB-005 multi-active workspace**: 의도된 단일 active 정책 변경 결정

## 7. Codex 의견 (참고)

본 sprint 의 review autonomous 흐름에서 Codex skip (`user_blocked`). 단 SB-001 (resize) + SB-005 (multi-active) 같은 architectural 결정은 사용자 명시 trigger 시 `/codex:adversarial-review --wait` 권장. GitKraken 의 design 결정 (사용자 customization vs 정해진 UX) cross-check 가치.

## 8. Files Referenced

- `apps/desktop/src/components/Sidebar.vue` (162 LOC) — 본 sidebar 의 layout entrypoint
- `apps/desktop/src/components/ActiveRepoQuickActions.vue` (121 LOC) — sidebar body
- `apps/desktop/src/components/MiniSection.vue` (66 LOC) — 7 mini 공통 wrapper
- `apps/desktop/src/components/Mini{Branch,RemoteBranch,Worktree,Stash,Submodule,Pr,Tag}List.vue` (총 732 LOC)
- `apps/desktop/src/composables/useSidebarSearch.ts`, `useSidebarFilter.ts`, `useSidebarGroups.ts`
- `apps/desktop/src/composables/useBranchTree.ts` + `useBranchInteraction.ts`
- `apps/desktop/src/composables/use{Stash,Submodule,Tag}Interaction.ts` (Pattern 9 sister 3건)

## 9. 진행 권장 (Next)

본 리포트의 SB-001 ~ SB-011 항목 중:
- **자율 즉시 진행 가능 (Phase A)**: SB-002 (i18n 마이그) + SB-007 (footer 갱신)
- **사용자 결정 필요**: SB-005 (multi-active workspace 정책)
- **별도 sprint backlog**: SB-001 (resize) + SB-003 (hover preview) + SB-004 (merge gesture) + SB-006 (PR aggregation)

권장: `/goal Sidebar SB-002 + SB-007 자율 진행` 또는 본 리포트 inline summary 후 사용자 명시 confirm.
