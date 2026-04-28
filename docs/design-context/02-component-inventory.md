# 02. Component Inventory — git-fried

> **이 문서의 독자**: Figma 컴포넌트 라이브러리 작성자 / BaseModal·Tooltip 신규 spec 잡는 디자이너.
> **출처**: Phase 1 Agent B (Explore) + 부분 검증.
> **카운트**: 48 컴포넌트 (`src/components/`) + 4 진입점 (`pages/index.vue`, `pages/launchpad.vue`, `pages/settings.vue`, `App.vue`).

---

## 1. 분류표 (48 컴포넌트)

| 분류 | 개수 | 컴포넌트 |
|------|-----|----------|
| **Modal** | 18 | AiResultModal · BisectModal · BulkFetchResultModal · CloneRepoModal · CommitDiffModal · CompareModal · CreatePrModal · FileHistoryModal · GitKrakenImportModal · HelpModal · HunkStageModal · InteractiveRebaseModal · MergeEditorModal · PrDetailModal · ReflogModal · RemoteManageModal · RepoSwitcherModal · SyncTemplateModal |
| **Panel** (탭/사이드 콘텐츠) | 11 | BranchPanel · ForgePanel · IssuesPanel · LfsPanel · PrPanel · ReleasesPanel · StashPanel · StatusPanel · SubmodulePanel · TagPanel · TerminalPanel · WorktreePanel |
| **Display** (데이터 시각화) | 4 | CommitGraph · CommitTable · DiffViewer · DiffSplitView |
| **Input/Form** | 3 | CommitMessageInput · RepoSpecificForm · ForgeSetup |
| **Bar/Toolbar** | 3 | RepoTabBar · StatusBar · SyncBar |
| **Utility** | 6 | CommandPalette · ToastContainer · WipBanner · UserAvatar · FileRow · ProfileSwitcher |
| **Layout** | 3 | Sidebar · App.vue (root) · (TerminalPanel 도 layout-ish) |

> **주의**: Modal · Panel · Display · Input · Bar · Utility · Layout 은 Figma 라이브러리 페이지 분리 후보.

## 2. Props / Emit 공통 시그니처

| 분류 | 시그니처 핵심 |
|------|--------------|
| **Modal** | `open: boolean` + (선택) `repoId / sha / path / number` + `emit('close')` (18/18 일관) |
| **Panel** | `repoId: number \| null` (100% 공통) — 패널은 활성 레포 컨텍스트로 묶임 |
| **Display** | `repoId` 또는 `patch: string` (CodeMirror 입력) |
| **Bar** | `repoId` ± `branch` |

**naming convention**:
- camelCase 100%
- boolean prop 은 명시적 이름 (`open`, `breaking`, `singleBranch`) — `is*` / `has*` 미사용
- v-model 사용: 24/48 (50%) — CommitMessageInput (9), RepoSpecificForm (13), PrDetailModal (7)

## 3. 모달 18개 — 공통 vs Divergence

### 3-1. 공통 패턴 (100% 일관)

| 항목 | 패턴 |
|------|------|
| Container | `fixed inset-0 z-40/50 flex items-center justify-center bg-black/50` |
| Backdrop dismiss | `@click.self="$emit('close')"` |
| Header | `border-b border-border px-4 py-2` + 제목 + X 버튼 |
| Max height | `max-h-[80vh]` 또는 `max-h-[85vh]` |
| Close 패턴 | ESC + backdrop + X 버튼 모두 지원 |

### 3-2. Divergence (디자이너 통합 결정 필요)

| 모달 | 특이점 | 디자인 결정 |
|------|--------|-----------|
| **InteractiveRebaseModal** | step indicator (setup → edit → running → result) — 유일 | step 표시 컴포넌트 신규 (BisectModal 도 후보) |
| **CommitDiffModal** | mode toggle (Hunk/Inline/Context/Split) + AI Explain ✨ + 중첩 모달 (AiResultModal) | mode toggle 그룹 + AI 액션 button 포지션 |
| **MergeEditorModal** | 3-way 패널 (ours/theirs/result) — CodeMirror merge view 미사용 | 3-way 레이아웃 spec |
| **PrDetailModal** | 가장 복잡 — comments + Review + Merge | tabbed modal spec (Body/Files/Reviews) |
| **HunkStageModal** | checkbox range select (Shift-click) + buildLinePatch | line action menu spec |
| **CompareModal** | ref dropdown 2개 + ahead/behind 카운트 | dual-ref selector pattern |
| **CloneRepoModal** | advanced expand (sparse-checkout/shallow/single-branch) | progressive disclosure spec |

### 3-3. 미해결 (Findings — 5필드)

| Claim | Verification | Result | Verdict | Confidence |
|-------|--------------|--------|---------|-----------|
| `BaseModal` 부재 | `grep BaseModal src/` | 0 매치 | **CONFIRMED** | certain |
| `useFocusTrap` composable 부재 | `grep useFocusTrap src/` | 0 매치 | **CONFIRMED** | certain |
| `aria-modal` / `role="dialog"` 미적용 | `grep "aria-modal\|role=\"dialog\""` | 0 매치 | **CONFIRMED** | certain |
| reka-ui Dialog/Tooltip primitive 미사용 | `grep "from 'reka-ui'"` | 0 매치 | **CONFIRMED** | certain |
| ESC keydown listener 일관성 | `grep "Escape" + onUnmounted` | 일부만 cleanup, 불완전 | **PARTIAL** | likely |

→ **plan/22 §15 BaseModal / aria-label / Tooltip / Color 일관성 4 항목 디자인 SoT 필요성 정확히 일치**.

## 4. 컴포넌트 카드 (대표 12개 — 디자이너가 먼저 그릴 항목)

### 4-1. CommitGraph (Display — 핵심)
- **위치**: `src/components/CommitGraph.vue`
- **사용**: `pages/index.vue` 메인 (focusMode 제외 항상 visible)
- **Props**: `repoId` / `selectedSha` / `columns: ColumnConfig[]`
- **States**: row hover / row selected / commit ref badge / column drag / column hide
- **상호작용**: row click → select / dblclick → CommitDiffModal (V-1 미구현, plan/22 §4)
- **우선순위**: P0 (가장 본 화면)

### 4-2. CommitDiffModal (Modal — 핵심 viewer)
- **위치**: `src/components/CommitDiffModal.vue`
- **Entry**: ⌘D / graph row dblclick (예정)
- **Props**: `open` / `sha`
- **Tabs**: Hunk / Inline / Context / Split (4 mode)
- **AI**: ✨ Explain → AiResultModal nested
- **우선순위**: P0

### 4-3. PrDetailModal (Modal — 가장 복잡)
- **Entry**: PR 행 클릭 / Launchpad
- **Tabs**: Body / Files / Reviews / Comments (4 영역)
- **상호작용**: + Code suggestion / Merge / Approve
- **우선순위**: P0

### 4-4. StatusPanel (Panel — 가장 자주 사용)
- **Sections**: Staged / Unstaged / Untracked / Conflicted (4 collapsible)
- **Row actions**: Stage / Unstage / Discard / Hunk-stage / View history
- **Friction**: hunk-stage 진입점 가시성 (sprint 22-1 C3 해결, ✂ hunk 텍스트 노출)

### 4-5. BranchPanel (Panel)
- **List**: local + remote branches
- **Actions**: checkout / create / delete / merge / rebase / hide / solo (모두 ContextMenu 후보, P0)

### 4-6. CommitMessageInput (Input — 한글 핵심)
- **Features**: subject + body 분리, visual width 계산 (CJK=2, 한글 36자 = 영문 72자 amber warning), conflict marker 감지
- **plan/22 sprint 22-1 C2 + C5**: 한글 width + conflict guide 추가 완료

### 4-7. CommandPalette (Utility — ⌘P)
- **30+ commands** (8 카테고리: Repo/Branch/File/View/Stash/History/AI/Settings)
- **Fuzzy search + category group**

### 4-8. Sidebar (Layout)
- **Tree**: workspace → org → repo (2-level)
- **Actions**: 레포 추가 / clone (⬇ Clone 버튼) / 활성 레포 전환

### 4-9. RepoTabBar (Bar)
- **Per-profile 영속** — 프로필 토글 시 탭 복원
- **drag&drop reorder** (계획, vue-draggable-plus 도입 예정)

### 4-10. StatusBar (Bar)
- **하단 28px** (plan/12 § B2)
- **표시**: sync 상태 / conflict prediction / AI 진행

### 4-11. ToastContainer (Utility)
- **위치**: `z-[60]` 우상단
- **Severity**: success / info / warning / error (4)
- **dedup**: Map<key, lastShownAt> + 1s (plan/15 §2-5 미해결)

### 4-12. ContextMenu (Utility — **신규 필요**)
- **현재 부재** — plan/22 §3-1 신규 작성 항목
- **17 위치** 마이그레이션 위해 base 필요 (P0 5 / P1 6 / P2 3)

## 5. reka-ui Primitive 현황

| Primitive | 현재 사용 | plan/22 §15 의도 |
|-----------|----------|-----------------|
| Dialog | 0 | **BaseModal 신규 시 reka-ui Dialog 래핑 권장** (focus trap + a11y 무료) |
| DropdownMenu | 0 | ContextMenu 신규 시 reka-ui DropdownMenu 래핑 후보 |
| Popover | 0 | hover preview / Tooltip 의 base |
| Tooltip | 0 | **Tooltip 신규 (P1)** — reka-ui Tooltip 래핑 권장 |

→ **디자인 시 reka-ui 사용 전제로 spec 잡으면 a11y / keyboard nav 자동 해결**.

## 6. 의존성 hot path

**Most-imported (재사용 후보 Top 5)**:
1. `UserAvatar.vue` — 3회 (PrDetailModal, ForgePanel, PrPanel)
2. `AiResultModal.vue` — 3회 (CommitDiffModal, CreatePrModal, PrDetailModal)
3. `DiffViewer.vue` — 2회 (CommitDiffModal, MergeEditorModal)

**Hub components (다른 컴포넌트 많이 import 하는 부모 Top 5)**:
1. `ForgePanel` — TagPanel/ReleasesPanel/IssuesPanel/PrPanel 4 자식
2. `StatusPanel` — FileHistoryModal/MergeEditorModal/HunkStageModal 3 자식
3. `PrPanel` — CreatePrModal/PrDetailModal 2 자식
4. `CommitDiffModal` — AiResultModal/DiffViewer/DiffSplitView 3 자식
5. `Sidebar` — BulkFetchResultModal/CloneRepoModal 2 자식

→ **디자인 시 ForgePanel · StatusPanel · CommitDiffModal · Sidebar = "허브" 화면**. 이들이 잘 잡히면 자식들이 따라온다.

## 7. Variants / States 일관성

| 요소 | 패턴 | 일관성 |
|------|------|--------|
| **Button** | `bg-primary` / `border border-border` / `text-muted-foreground` | ✅ 일관 |
| **Error 상태** | `rounded border border-destructive bg-destructive/10 p-2 text-xs` | ✅ 10+ 컴포넌트 일관 |
| **Loading** | `disabled:opacity-50` / `isFetching` Vue Query 자동 | ⚠️ skeleton UI 부재 |
| **Hover/Focus** | `hover:opacity-90` / `hover:bg-accent/40` / `ring-primary/60` | ✅ 일관 |
| **Empty state** | "no content available" 문자열만 | ⚠️ visual component 부재 |
| **Disabled** | `disabled:opacity-50` | ✅ 100% 일관 |

→ **디자이너 결정 필요**: skeleton UI, Empty state visual (illustration 또는 minimal text).

## 8. Figma 라이브러리 우선순위 (디자이너 작업 권장 순서)

1. **Foundations** — color/typography/spacing/radius variables (`01-design-tokens.md` 기반)
2. **Primitives** — Button (4 variant) / Input / Textarea / Checkbox / Radio / Select / Tabs
3. **BaseModal** — size tier (sm/md/lg/xl) + Header/Body/Footer 슬롯 + confirm/destructive 패턴
4. **Tooltip** — delay 500ms / 위치 (top/bottom/left/right) / shortcut hint 문법
5. **ContextMenu** — items / submenu / separator / destructive 그룹 / shortcut display
6. **Toast** — severity 4 + close 버튼 + dedup spec
7. **Avatar** (`UserAvatar`) — initial / gravatar / forge logo
8. **Hub screens** — ForgePanel · StatusPanel · CommitDiffModal · Sidebar (4 화면)
9. **Modal 18개 동시 audit** — BaseModal 적용 후 모습 시뮬레이션
