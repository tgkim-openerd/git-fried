# 11. GitKraken Client UI/UX 벤치마크 — 흡수 가능한 모든 것

작성: 2026-04-26 / 기준: **GitKraken Desktop 12.0** (2026-04-16 release, Agent Mode 도입)

> **목적**: GitKraken Client 를 정조준 벤치마크 대상으로, UI/UX·기능적으로 git-fried 가 흡수할 수 있는 모든 항목을 한 문서에 정리. 각 항목에 (a) 현재 git-fried 적용 상태 (b) 코드 매핑 (c) 우선순위 (d) 흡수 시 차별화 위협 여부를 표기. 다음 세션에서 별도 컨텍스트 없이 단독 reference 로 사용.
>
> **연계 문서**: [01-why-and-positioning.md](./01-why-and-positioning.md) (4 약점 / 차별화 5축), [03-feature-matrix.md](./03-feature-matrix.md) (M/N/L/S 분류), [09-interactive-rebase.md](./09-interactive-rebase.md), [10-integrated-terminal.md](./10-integrated-terminal.md).

---

## 0. 사용법

| 상태 표기 | 의미 |
| --- | --- |
| ✅ 적용 | 이미 git-fried 에 동등 이상 구현 |
| 🟡 부분 | 일부 구현, 보완 여지 |
| ❌ 미적용 | 미구현 — 흡수 후보 |
| 🚫 거부 | plan §5 또는 보안 정책상 의도적 미적용 |

| 우선순위 | 의미 |
| --- | --- |
| ⭐⭐ P0 | 다음 sprint 즉시 진입 가치 |
| ⭐ P1 | v1.x 직전 sprint 후보 |
| · P2 | 여유 있을 때, 사용자 요청 누적 시 |
| — | 우선순위 적용 안 함 (✅ 또는 🚫) |

---

## 1. 30초 요약 — git-fried 가 베껴야 할 TOP 12

| # | 항목 | 사유 | git-fried 코드 매핑 | 우선순위 |
| - | --- | --- | --- | --- |
| 1 | **Hide / Solo branches** in graph | 50+ 레포 / 8 worktree 사용자 직격, 데이터 변경 0 | `BranchPanel.vue` + `git/graph.rs` 시각화 필터 | ⭐⭐ P0 |
| 2 | **vim navigation `J/K/H/L`** + `S/U` 단일 stage | 키보드 우선 사용자 호감, 외부 의존 0 | `composables/useShortcuts.ts` 확장 | ⭐⭐ P0 |
| 3 | **그래프 컬럼 토글 / 재정렬** | 정보 밀도 사용자 통제 | `CommitGraph.vue` + `CommitTable.vue` | ⭐⭐ P0 |
| 4 | **Launchpad Pin / Snooze / Saved Views** | 멀티 PR 일상 사용 | `pages/launchpad.vue` + `useReposStore` 상태 확장 | ⭐⭐ P0 |
| 5 | **Diff Hunk / Inline / Split 3-mode 토글** | 현재 단일 모드 가정 | `DiffViewer.vue` | ⭐ P1 |
| 6 | **Conflict Prediction (target-branch 한정, 로컬 fetch)** | 회사 50+ 레포 가치 큼, Cloud 의존 없이 가능 | `git/sync.rs` + `useStatus` | ⭐ P1 |
| 7 | **Commit Composer 스타일 multi-commit AI 재작성** | AI suite 4 진입점에 추가 가치 | `ai/prompts.rs` + 새 modal | ⭐ P1 |
| 8 | **Repo tab alias + per-profile 영속성** | 듀얼 포지 사용자 직격 | `RepoSwitcherModal.vue` + `Profile` 스키마 | ⭐ P1 |
| 9 | **`⌘D` diff / `⌘W` 닫기 / `⌘=/-/0` zoom / `⌘J·⌘K` 패널 토글** | 키보드 표준 베끼기 | `composables/useShortcuts.ts` | ⭐ P1 |
| 10 | **Section header 더블클릭 maximize** | 정보 밀도 토글 | `Sidebar.vue` 그룹 헤더 동작 | · P2 |
| 11 | **Drag-drop file → terminal 경로 삽입** | 통합 터미널 sprint 보너스 | docs/plan/10 sprint 4 | · P2 |
| 12 | **Custom theme via JSON / CSS var export·import** | GitKraken 11.8 일시 막힘 — 흡수 기회 | `composables/useTheme.ts` + JSON 스키마 | · P2 |

---

## 2. 윈도우 셸 — 7-zone 레이아웃 매핑

```
┌────────────────────────────────────────────────────────────────┐
│ [Tabs: repo1 | repo2 | + ]                  [⚙ Settings] [👤]│
├────────────────────────────────────────────────────────────────┤
│ ↶ ↷ │ Pull▾ Push │ Branch Stash Pop │ LFS │ ⌘P │ Term │ … │
├──────┬─────────────────────────────────────────┬───────────────┤
│ Left │ Commit Graph                             │ Commit Panel  │
│Panel │ (Branch | Graph | Message | Author |    │  (WIP / Msg)  │
│      │  Date | SHA — 컬럼 재배치/숨김 가능)     │               │
├──────┴─────────────────────────────────────────┴───────────────┤
│ ▣ Up to Date with main / ⚠ Conflict in 3 files  ⏵ Launchpad(N)│
└────────────────────────────────────────────────────────────────┘
```

| Zone | git-fried 현재 | 차이 / 흡수 후보 |
| --- | --- | --- |
| (1) Tab Bar | ✅ `RepoSwitcherModal` + ⌘⇧P | 🟡 **Tab alias** (우클릭 → "별칭 부여") + per-profile 영속성 추가 필요 |
| (2) Toolbar | 🟡 Sync 만 우측 `SyncBar` | ❌ Pull/Push/Branch/Stash/Pop 직접 버튼 분리 (사용자 가치 검증 필요 — palette 로 충분할 수도) |
| (3) Left Panel | ✅ 우측 탭 7개 (변경/브랜치/Stash/Sub/LFS/PR/WT) | git-fried 가 우측, GitKraken 이 좌측 — **레이아웃 차이 의도적**, 유지 |
| (4) Commit Graph | ✅ `CommitGraph.vue` + pvigier lane | ❌ 컬럼 토글/재정렬, ❌ Hide/Solo, ❌ ghost branch hover, ❌ multi-select cherry-pick |
| (5) Commit Panel | ✅ `StatusPanel` + `CommitMessageInput` | 🟡 LFS 태그 표시 1급, 색상 코딩 (modified/added/deleted/renamed) 검증 필요 |
| (6) Status Bar | ❌ 부재 | ⭐ P1 — Conflict prediction (▣/⚠) + Launchpad badge 노출 자리 |
| (7) Floating Modals | ✅ Bisect/Reflog/SyncTemplate/CreatePr/Help 5개 | — |

---

## 3. Toolbar — 정확한 버튼 시퀀스

GitKraken 좌→우:

1. Undo / Redo (`⌘Z` / `⌘Y`)
2. Pull + dropdown (Fetch All / FF if possible / FF only / Rebase)
3. Push
4. Branch (`⌘B`)
5. Stash + Pop Stash
6. LFS (조건부 노출)
7. Command Palette (✨ wand, `⌘P`)
8. Terminal (`⌥T`)
9. Conflict Indicator (⚠/✓)
10. Settings (⚙)
11. Profile Switcher (👤)

→ **git-fried 결정**: toolbar 버튼 직접 노출 vs Command Palette 일임 — 후자가 가벼움. **단 Pull dropdown 4 옵션은 유지 가치** (현재 git-fried `SyncBar` 가 옵션 분리 안 함). ⭐ P1.

---

## 4. Left Panel — List ↔ Agents 토글

### 4a. List 모드 섹션
| 섹션 | git-fried 현재 |
| --- | --- |
| Local | ✅ `BranchPanel` |
| Remote | ✅ `BranchPanel` (그룹) |
| Pull Requests | ✅ `PrPanel` |
| Issues | ✅ `IssuesPanel` |
| Teams | 🚫 거부 (Cloud 의존) |
| Tags | 🟡 Releases 안에 부분 — 별도 Tags 섹션 ⭐ P1 |
| Stashes | ✅ `StashPanel` |
| Submodules | ✅ `SubmodulePanel` |

### 4b. Agents 모드 (12.0)
worktree = 카드. 카드: 브랜치명 / WIP +N -N / ↑↓ ahead-behind / agent status (🟢 running / 🔔 "Waiting for input" / ✓ complete).

지원 agent: Claude Code / Codex CLI / Copilot CLI / Gemini CLI / OpenCode.

**New Agent Session 모달 필드**: Branch name / Base branch (default HEAD) / Coding agent / "Configure setup commands" 링크 → Preferences > Repo-Specific > Agents.

→ **git-fried 결정 갱신 필요**: [03-feature-matrix.md](./03-feature-matrix.md) §5 의 "Agent Session Management = **S** (스코프 폭발)" 결정은 **GitKraken 12.0 출시로 압력 증가**. 재검토 옵션:
- **A) 유지 거부** — git-fried 는 worktree 만 1급, agent 는 사용자가 별도 터미널에서 수동 launch
- **B) 부분 흡수** — `WorktreePanel` 의 worktree 카드에 "기본 agent 명령" 토글 추가 (예: 카드 우클릭 → "Run Claude Code in this worktree")
- **C) 풀 흡수** — Agent 카드 모드 + 상태 추적 + setup commands 추가
> 권장: **B (부분 흡수, ⭐ P1)** — 풀 구현은 스코프 폭발이지만 worktree → CLI 1-click launch 는 가벼움.

---

## 5. Commit Graph — 시그니처 자산

### 5a. 기본 컬럼 (재정렬 / 토글 가능)
`Branch/Tag | Graph | Message | Author | Date/Time | SHA`

→ git-fried 현재: `CommitTable.vue` 컬럼 고정. ❌ → ⭐⭐ P0 — 헤더 drag-reorder + right-click 토글 + gear icon 추가 컬럼.

### 5b. 시각 요소
- 일반 commit (원형) / Merge (다이아몬드) / WIP node (최상단) / Stash node
- 라인 추가/삭제 가로 막대 (녹색/빨강)
- Avatar / 이니셜 토글
- **Lane 색상**: `graphLane1Color` ~ `Color10` (CSS 변수 10색)

→ git-fried 매핑: `git/graph.rs` 의 lane 알고리즘은 동등, 시각 요소는 ✅ 대부분. ❌ **WIP node 최상단 별도 행** + ❌ **stash node** 통합. ⭐ P1.

### 5c. 인터랙션 카탈로그
| 동작 | GitKraken | git-fried 현재 | 우선순위 |
| --- | --- | --- | --- |
| Hover commit → ghost branch | ✅ | ❌ | ⭐ P1 |
| Hover branch ref → 무관 commit fade | ✅ | ❌ | ⭐⭐ P0 (시각적 가독성 큼) |
| Double-click commit → checkout | ✅ | ❌ | · P2 |
| Multi-select (⌘/⇧Click) → cherry-pick X | ✅ | ❌ | ⭐ P1 |
| Right-click commit → rebase/revert/checkout/cherry-pick/Compare/Explain | 🟡 일부 | 🟡 부분 | ⭐ P1 (메뉴 항목 표준화) |
| Right-click branch ref → merge/rebase/IR/push/delete/**hide/Solo** | ✅ | 🟡 부분 | ⭐⭐ P0 (Hide/Solo 추가) |
| Right-click 컬럼 헤더 → 토글 | ✅ | ❌ | ⭐⭐ P0 |
| Drag commit → branch (cherry-pick) | ✅ | ❌ | ⭐ P1 |
| Drag branch → branch → menu (Merge/Rebase/IR) | ✅ | ❌ | ⭐ P1 |
| Hover lane 경계 → drag-resize | ✅ | ❌ | · P2 |

### 5d. Hide / Solo (별도 섹션 자격)
- **Hide**: ref hover → eye icon, 또는 우클릭 → "Hide". 회색 = hidden, 클릭 시 복원.
- **Solo**: 우클릭 → "Solo". 다른 모든 ref auto-hide. **주황색** 표시. 옆 반투명 아이콘 클릭으로 추가 solo.
- **Bulk**: 섹션 헤더 우클릭 → "Hide all Remotes / Tags / Branches / Stashes".
- **저장소 데이터 변경 0** — 시각화만.

> **git-fried 구현 결정 (2026-04-26)**: GitKraken 의 Hide/Solo 명세를 단순화 — **Hide 만 SQLite 영속, Solo 는 세션 메모리** (transient). 근거: Solo 는 "지금 이 작업에 집중" 의 일시적 시각 토글이라 영속 가치 작음 + 영속 시 다중 worktree 동기화 필요. 실제 구현: [`migrations/0002_hide_solo_branches.sql`](../../apps/desktop/src-tauri/src/storage/migrations/0002_hide_solo_branches.sql), [`git/hide.rs`](../../apps/desktop/src-tauri/src/git/hide.rs), [`ipc/hide_commands.rs`](../../apps/desktop/src-tauri/src/ipc/hide_commands.rs). 12번 plan §9 갱신 완료.

→ ⭐⭐ P0. AI 페어 + 다중 worktree 환경에서 결정적 가치. 구현 비용 낮음 (그래프 렌더 단계의 ref filter set).

### 5e. 검색
상단 search bar 또는 `⌘F`. 기본 = commit message / SHA / author. 라이브 highlight.
- AI 자연어 검색은 marketing 페이지에만 — docs 미반영, 신뢰도 낮음
- regex 미지원 (feedback 보드 미해결)

→ git-fried 현재: `CommitGraph` 검색 ✅ (⌘F). ❌ author 필터, ❌ file 필터, ❌ 다중 prefix. ⭐ P1.

---

## 6. Commit / WIP Panel

3-section 직렬: Unstaged / Staged / Message (Summary + Description).

- 색상 코딩: modified / added / deleted / renamed
- LFS tag 표시 + diff 메타데이터 (URL / SHA / size)
- `⌘Enter` commit, `⌘⇧Enter` "stage all + commit"
- 파일 우클릭: Stage / Unstage / Discard / **Stash file (단일)** / Open in editor / View history / Blame / Cloud Patch / Explain (AI)

→ git-fried 매핑: `StatusPanel.vue` ✅ 대부분. ❌ **단일 파일 stash** + ❌ **`⌘⇧Enter` stage-all + commit** + 🟡 LFS tag 시각 강화. ⭐ P1.

---

## 7. Diff Viewer

| 모드 | 용도 | git-fried |
| --- | --- | --- |
| Hunk | 변경 블록만 | ❌ |
| Inline | 파일 전체 컨텍스트 | ✅ (기본) |
| Split | 사이드바이사이드 | 🟡 |

라인 단위: 선택 후 우클릭 → Stage selected lines / Unstage / Discard. `S` / `U` 단일, `⌘⇧S` 전체.
토글: Word Wrap / Syntax Highlighting / Line numbers (Preferences > Editor).

→ ⭐ P1 — `DiffViewer.vue` 에 3-mode 토글 + line-level stage 액션.

---

## 8. Interactive Rebase 화면

진입 3가지: drag-drop (source→target), right-click branch, right-click parent commit.

```
┌─ Interactive Rebase: feature/x onto main ──────────┐
│ [ Reset ]                              [ Cancel ]  │
├─────────────────────────────────────────────────────┤
│ ⠿  [Action ▾]  abc1234  feat: 한글 메시지          │
│ ⠿  [Action ▾]  def5678  fix: 버튼                  │
├─────────────────────────────────────────────────────┤
│                              [ Start Rebase ]      │
└─────────────────────────────────────────────────────┘
```

- Action picker per row: **Pick (P) / Reword (R) / Squash (S) / Drop (D)** 4종
- `⠿` drag handle → reorder
- Reword → 인라인 modal 로 message 편집
- Reset = 모든 액션 초기화
- 중도 충돌 → 별도 화면 (Continue / Skip / Abort)

**제한**: merge commit 못 다룸, **fixup / autosquash 미지원**, "GitKraken 에서 시작한 rebase 는 CLI 와 mid-flow 호환 안 됨".

→ git-fried: [09-interactive-rebase.md](./09-interactive-rebase.md) Option A 가 동등 + **fixup/autosquash 추가** 시 GitKraken 보다 우월. UI 베끼고 기능 우월화.

---

## 9. 3-way Merge Editor

레이아웃: 3-pane (current / target / output) — base 추가는 옵션.

- 라인 단위 pick (current/target → output)
- ✨ **Auto-resolve with AI** 버튼 → **Merge Summary panel**: hunk 별 결정 + **신뢰도 score** + "Why incoming preferred" 설명
- 외부 도구 launch: Beyond Compare / Araxis / P4Merge / Kaleidoscope
- **유료 lock** (paid GitKraken license)

→ git-fried: `MergeEditorModal.vue` ✅ + AI resolve ✅. **무료** = moat. ❌ 외부 merge tool launch (옵션) — · P2.

---

## 10. Drag-drop 인터랙션 카탈로그

| Source → Target | 메뉴/결과 | git-fried |
| --- | --- | --- |
| Branch → Branch | Merge / Rebase / Interactive Rebase | ❌ ⭐ P1 |
| Commit → Branch | Cherry-pick | ❌ ⭐ P1 |
| Tab → Tab 위치 | 탭 재정렬 | ❌ ⭐ P1 |
| Workspace 헤더 | 그룹 재정렬 | ❌ · P2 |
| 컬럼 헤더 | 재배치 | ❌ ⭐⭐ P0 |
| 패널 분리선 | 폭 조정 | 🟡 일부 |
| 그래프 lane 경계 | graph 폭 조정 | ❌ · P2 |
| 외부 file → Terminal | 경로 삽입 | ❌ · P2 (terminal sprint 보너스) |
| Commit Panel file → Terminal | 경로 삽입 | ❌ · P2 |

→ Drag-drop 라이브러리는 [09-interactive-rebase.md](./09-interactive-rebase.md) 의 vue-draggable-plus 결정과 통일.

---

## 11. Stash 패널

- WIP 텍스트박스 = 그래프 최상단 (이름 prefilling)
- toolbar Stash 버튼
- ✨ AI 메시지 (staged diff 기반)
- **부분 stash**: Staged Files 우클릭 → "Stash file"
- 우클릭: Apply / Pop / Delete / Hide / Show / **Edit stash message**
- **부분 apply**: stash 선택 → 우측 file 우클릭 → "Apply this file"

→ git-fried `StashPanel.vue` ✅ 5개 액션. ❌ **부분 stash / 부분 apply** + ❌ **AI stash 메시지** + ❌ **Edit stash message**. ⭐ P1.

---

## 12. Submodule / Worktree / LFS

### Submodule
- Left Panel 섹션, 헤더 우클릭 토글, 알파벳 정렬
- 우클릭: Update / Init / Sync / Open

→ git-fried `SubmodulePanel.vue` ✅.

### Worktree
- Agents 모드 데이터 소스 동일
- 카드 우클릭: Open / Open in new tab / Lock / Unlock / Remove

→ git-fried `WorktreePanel.vue` ✅. ❌ **Lock / Unlock**. · P2.

### LFS
- 파일에 `LFS` 태그
- Diff 메타데이터 (URL / SHA / size)
- toolbar 조건부 노출
- ❌ pre-push size estimation (community 요청 미해결)

→ git-fried `LfsPanel.vue` ✅ 6 액션 (track/untrack/fetch/pull/prune/list). **GitKraken 보다 명시적**. ❌ pre-push size estimation 흡수 가치 ⭐ P1 (회사 LFS 6/6 사용자 시나리오).

---

## 13. Pull Requests — 패널 + 상세 + 필터 syntax

### Left Panel "PULL REQUESTS"
- CI/review 아이콘 3종 (✓ 통과+승인 / ⏳ 통과·리뷰대기 / ✗ 실패·변경요청)
- 필터: My / All
- Tooltip: branch / author / status / timestamp

### PR Detail View
- 편집 가능 필드: Title / Description / Reviewers / Assignees / Milestones / Labels
- 메인: Code diff / Conversation / Build status (CI)
- 버튼:
  - **Review Code and Suggest Changes** → diff editor 에서 line-level suggestion
  - **Code Suggestions** 패널 (Apply/Reject per suggestion)
  - **Merge pull request** + dropdown (merge / squash / rebase)
  - **Refresh comments**, "quote replies"
- **Submit as draft** 체크박스 (생성 시)
- CI status row 클릭 → 브라우저

### PR 필터 syntax (GitHub)
| 키 | 예시 |
| --- | --- |
| `foo` | 제목/본문 |
| `in:title` / `in:body` | 범위 |
| `author:` `assignee:` `review-requested:` `reviewed-by:` `involves:` | 사람 |
| `base:main` `head:dev` | 브랜치 |
| `draft:true` `label:Bug` `milestone:v1` | 메타 |
| `created:2026-04-01` `updated:` | 날짜 |
| `review:approved` / `changes_requested` / `none` | 리뷰 |
| `status:success` / `pending` / `failure` | CI |
| `no:assignee` `-assignee:user` | 부정 |
| `,` = OR / 공백 = AND | 결합 |

→ git-fried `PrPanel.vue` + `PrDetailModal.vue` ✅ 대부분. ❌ **line-level Code Suggestions** + ❌ **Filter syntax 자동완성** + ❌ Draft 토글 시각화 강화. ⭐ P1.

→ **Gitea 흡수**: 위 syntax 의 90% 는 Gitea API search 와 매핑 가능 (`?type=pull&state=open&author=...`). git-fried 가 통일된 filter syntax 를 Gitea + GitHub 양쪽에 제공하면 **GitKraken 의 GitLab/Bitbucket subset 한계 직격**.

---

## 14. Launchpad — 통합 보드

상단 탭: **Pull Requests | Issues | WIPs | All | Snoozed**
우상단: Personal ↔ Team toggle

### PR 컬럼
| 컬럼 | 내용 |
| --- | --- |
| Last Updated | 시간 |
| Status | Open/Draft/At Risk + review + build |
| PR Title | 제목 + host link + diff |
| Author(s) / Collaborators | 사람 |
| Repository / Branch | 위치 |
| Actions | quick |

### 행 액션
- **Pin** — 상단 고정
- **Snooze** (무기한 또는 시간 지정) → "Snoozed" 탭
- **Save View (+)** — 명명 저장 → 재사용

### 필터
workspace / source / project / labels / fix versions / milestones / sprints / team members.

→ git-fried `pages/launchpad.vue` ✅ PR 통합 + 봇 그룹핑. ❌ **Pin / Snooze / Saved Views** ⭐⭐ P0.
> 주의: Cloud Workspace 동기화 없이 로컬 SQLite 영속화로 충분.

---

## 15. Workspaces

### 진입
좌상단 폴더 아이콘 또는 `⌥O`/`⌘O`.

### 생성
| Local | Cloud |
| --- | --- |
| 이름 + 폴더/`.code-workspace` 선택 | 이름 + hosting service + 레포 + 팀 공유 |

### Bulk 액션
Clone / Fetch / Pull (옵션 dropdown) / Open / Locate / Remove.

### 워크스페이스 메뉴 (3-dot)
Open / Clone / Locate / Edit / Change color / Delete / Leave.

→ git-fried `useReposStore` ✅ Local. 🚫 Cloud (plan §5). ❌ **Change color** + ❌ **Bulk Locate (경로 노출/수정)** ⭐ P1.

---

## 16. Profiles

- 우상단 👤 → dropdown → "Manage Profiles"
- Preferences > Profiles
- **각 프로파일 저장**: integrations / UI prefs (테마) / **열린 탭들** / GPG / General 전체
- **`.gitconfig` sync 토글**: "Keep my .gitconfig updated with my profile info"
- **Avatar**: provider > Gravatar > 이니셜 fallback
- **빠른 전환**: `⌘P` → "Switch to Profile"
- **유료 lock** (paid subscription)

→ git-fried `ProfileSwitcher.vue` + `ProfilesSection.vue` ✅ **무료** = moat ⭐⭐. 🟡 **per-profile 탭 영속성** ❌ ⭐ P1 (현재 active 탭 = 글로벌).

---

## 17. Command Palette — 카테고리

| 카테고리 | 명령 수 | git-fried |
| --- | --- | --- |
| Repo | 10 | 🟡 일부 |
| Branch | 8 | 🟡 일부 |
| File | 8 | ❌ ⭐ P1 |
| Settings | 8 | 🟡 일부 |
| View | 8 | ❌ (zoom/panel toggle) ⭐ P1 |
| Stash | 3 | 🟡 일부 |
| History | 3 | ❌ (Blame / History / Search) ⭐ P1 |

→ git-fried 현재 9 명령. ⭐⭐ P0 — 카테고리 모델 도입 + 누락 30+ 명령 추가. VS Code `>` `?` prefix 분기는 GitKraken 미지원이라 git-fried 도 단순 fuzzy 유지.

---

## 18. AI Suite — ✨ 진입점 catalog (12.0)

| 기능 | 진입점 | git-fried | 우선순위 |
| --- | --- | --- | --- |
| Generate commit message | Commit Panel ✨ | ✅ | — |
| Explain commit changes | Commit Panel "Explain" 버튼 | ❌ | ⭐ P1 |
| Explain Branch Changes | 브랜치/HEAD 우클릭 → "Explain Branch Changes" | ❌ | ⭐ P1 |
| Generate PR title + description | PR 생성 split button ✨ | ✅ | — |
| Auto-resolve conflicts | 충돌 파일 → "Auto-resolve with AI" + 신뢰도 score | ✅ | — |
| Generate stash message | Stash 입력 ✨ | ❌ | ⭐ P1 |
| **Commit Composer** (preview) | (a) Commit Details → "Compose Commit with AI" / (b) commit 범위 우클릭 → "Recompose Commits with AI" → 새 윈도우 (Reorder/Squash/Edit message) | ❌ | ⭐ P1 (큰 차별화 기회) |

### 모델 / 프롬프트 (Preferences > GitKraken AI)
- **Provider**: OpenAI / Azure / Anthropic / Gemini (기본) / **Custom URL** (Ollama)
- **Custom instruction**: Global / Commit / Explain / Stash / PR / Conflict / Composer 시나리오별

→ git-fried `ai/prompts.rs` 4 prompt entry. **차이**: GitKraken 은 BYOK (앱이 LLM 직접 호출), git-fried 는 **CLI subprocess 위임** — 더 가벼움. 단 시나리오별 prompt customization 모듈은 흡수 가치 ⭐ P1.

---

## 19. Cloud Patches

- WIP ☁ 아이콘 → 패치 → URL 카피
- 공유: Anyone with link / Anyone in my org / Only collaborators
- commit 우클릭 → "Share commit as Cloud Patch"
- 수신: GitLens 사이드바 → "Apply to working tree" / "Apply to new branch"

→ 🚫 거부 (plan §5, Cloud 의존). **단 lightweight 대체** = `git format-patch` + 메신저 수동 — 이미 충분. 추가 흡수 0.

---

## 20. Conflict Prevention (10.8+)

- 상시 백그라운드 비교
- ✓ "Up to Date with Merge Target" 또는 ⚠ alert
- 클릭 → 메뉴: 영향 파일/라인 + actions (Cloud Patch / push / 충돌 요약 copy)
- Org Member 충돌 vs Target 충돌 우선순위 분리
- Preferences 에서 wildcard / exclusion

→ **부분 흡수 ⭐ P1**: Org Member 충돌은 🚫 (Cloud 필요). **Target branch 충돌 prediction (로컬 fetch 기반)** 만 적용 — `git fetch origin <target>` + 3-way merge dry-run 으로 가능. 회사 50+ 레포 가치 큼. 결과는 `Status Bar` 의 ▣/⚠ 인디케이터로 노출.

---

## 21. Built-in Terminal

- toolbar Terminal 버튼 / `⌥T` / `⌘P` → "terminal"
- Windows: PowerShell / Bash 토글 / macOS-Linux: OS 기본
- Preferences > In-App Terminal: font / size / line height / cursor / autocomplete
- **Worktree-aware**: worktree 별 독립 세션, 자동 컨텍스트 스위치, long-running 지속
- **CWD**: 자동 active repo / worktree 경로
- **Autocomplete**: git 명령 + flag 제안
- **Drag-drop**: 외부 file 또는 Commit Panel file → 경로 삽입
- Split / multi-tab: 미문서화 (불명)

→ git-fried [10-integrated-terminal.md](./10-integrated-terminal.md) Option A (portable-pty + xterm.js) 동등 가능. **흡수 핵심**: worktree-bound 세션 + autocomplete + drag-drop 경로 삽입. ⭐⭐ P0 (Sprint 진입 시).

---

## 22. Onboarding / Repo Management

좌상단 폴더 아이콘 → Repo Management. 3 탭 + 사이드바.

### 메인 액션
- **Browse** — 로컬 .git 선택
- **Clone** — URL 또는 integration 트리
- **Init** — 새 레포

### Clone 모달
- URL 또는 GitHub/GitLab/Bitbucket integration
- 디렉토리 picker
- **Shallow Clone**: branch / depth / since-date / 커스텀 git flags
- **Sparse Checkout**: path rules (한 줄당)

### Init 모달
- 경로 / Optional `.gitignore` / Optional license / 자동 README

### Recent
- organization 별 그룹핑
- repo card

→ git-fried 현재 `Sidebar.vue` 단순 list. ❌ **Shallow / Sparse 옵션** ⭐ P1 (50+ 레포 + LFS 사용자 직격), ❌ **`.gitignore` / license 템플릿** · P2, ❌ **organization 별 그룹핑** ⭐ P1 (rf vs 01.Projects 구분).

---

## 23. Preferences — 전체 트리 (참고)

GitKraken 의 Preferences 트리는 git-fried 의 `pages/settings.vue` 가 흡수할 표준:

```
Preferences/
├─ General (Auto-Fetch / Auto-Prune / Conflict Detection / Submodules /
│           Default Branch / .orig 삭제 / Show All Commits / Initial Commits /
│           Lazy Load / Remember Tabs / Longpaths / AutoCRLF / Logging /
│           Forget Credentials / Share WIP)
├─ Profiles
├─ SSH and Integrations (GitHub/GitLab/Bitbucket/Azure/Jira/Trello — git-fried 는 + Gitea 1급)
├─ GitKraken AI (Provider / Custom prompts 7 시나리오)
├─ External Tools (Editor / Diff / Merge / Terminal / Coding Agent commands)
├─ UI Customization (Themes / Notification location / Date locale /
│                    Avatars vs initials / Graph metadata / Hide Launchpad /
│                    Show Agents view)
├─ Notification Preferences (Desktop / Marketing)
├─ Commit Signing (GPG)
├─ Editor (font / EOL / syntax / line-num / wrap)
├─ In-App Terminal
├─ Experimental Features
├─ Organization Settings (Pro+)
└─ Repository-Specific (Encoding / Gitflow / Hooks / LFS / Commit settings /
                        Issues / Team View / Submodules / Agent setup)
```

→ git-fried 현재 `pages/settings.vue` 미니멀. ⭐ P1 — 위 트리의 약 60% 흡수 (Cloud / Org / Marketing 제외).

---

## 24. Themes

- Preferences > UI Customization 또는 ⌘P → "switch theme"
- Built-in: light / dark + follow system theme
- **Custom theme JSON**: **11.8.0 부터 비활성화** ("UI 현대화 중") — 이전 `~/.gitkraken/themes/` `.jsonc` + LESS/CSS 함수
- Lane 색상: `graphLane1Color` ~ `Color10` (CSS 변수)

→ **차별화 흡수 기회**: GitKraken 11.8 일시 막힘. git-fried 가 단순 CSS 변수 export/import + JSON 스키마 제공하면 광 팬덤 흡수. · P2.

---

## 25. Status Bar / Indicators

- ✓ "Up to Date with Merge Target" / ⚠ "Conflict in N files"
- Launchpad badge (N 미처리)
- Push/Pull progress (작은 회전 원)
- branch ahead/behind (Left Panel + Agent 카드)

→ git-fried 현재 status bar 부재. ⭐ P1 — 하단 status bar 도입 + 위 4 인디케이터.

---

## 26. Notifications / Toast

- Preferences > UI Customization > Notification location (모서리 선택)
- Error toast: 우상단 빨강
- 데스크탑 알림: Preferences > Notification Preferences

→ git-fried `useToast.ts` ✅ 4 레벨 자동 닫힘. ❌ **Notification location 사용자 선택** · P2, ❌ **데스크탑 OS notification 통합** · P2.

---

## 27. Keyboard Shortcuts — 흡수 매핑 (✅ = 이미 적용)

| 동작 | macOS | Windows | git-fried |
| --- | --- | --- | --- |
| Open shortcuts | `⌘/` | `Ctrl/` | ✅ `?` |
| Command Palette | `⌘P` | `Ctrl+P` | ✅ |
| Search commits | `⌘F` | `Ctrl+F` | ✅ |
| Fetch all | `⌘L` | `Ctrl+L` | ✅ |
| Pull | — | — | ✅ `⌘⇧L` (git-fried 추가) |
| Push | — | — | ✅ `⌘⇧K` (git-fried 추가) |
| Create branch | `⌘B` | `Ctrl+B` | ✅ |
| Open repo via palette | `⌘⇧O` | `Ctrl+⇧O` | ❌ ⭐ P1 |
| File history search | `⌘⇧H` | `Ctrl+⇧H` | ❌ ⭐ P1 |
| Filter Left Panel | `⌘⌥F` | `Ctrl+Alt+F` | ❌ · P2 |
| Open repo terminal | `⌥T` | `Alt+T` | ❌ (terminal sprint 진입 시 ⭐⭐) |
| Open in File Manager | `⌥O` | `Alt+O` | ❌ ⭐ P1 |
| Diff/merge tool | `⌘D` | `Ctrl+D` | ❌ ⭐ P1 |
| Close repo | `⌘W` | `Ctrl+W` | ❌ ⭐ P1 |
| Stage current file | `S` | `S` | ❌ ⭐⭐ P0 |
| Unstage current | `U` | `U` | ❌ ⭐⭐ P0 |
| Stage all | `⌘⇧S` | `Ctrl+⇧S` | ❌ ⭐ P1 |
| Unstage all | `⌘⇧U` | `Ctrl+⇧U` | ❌ ⭐ P1 |
| Commit | `⌘Enter` | `Ctrl+Enter` | ✅ |
| Stage all + commit | `⌘⇧Enter` | `Ctrl+⇧Enter` | ❌ ⭐ P1 |
| Focus message box | `⌘⇧M` | `Ctrl+⇧M` | ❌ ⭐ P1 |
| Undo / Redo | `⌘Z` / `⌘Y` | `Ctrl+Z` / `Ctrl+Y` | ❌ ⭐ P1 |
| **Vim navigation** `J/K/H/L` | `J/K/H/L` | `J/K/H/L` | ❌ ⭐⭐ P0 |
| Prev/Next in branch | `⇧↓` `⇧↑` | `⇧↓` `⇧↑` | ❌ · P2 |
| First/Last commit | `⌘↑` `⌘↓` | `Home` `End` | ❌ · P2 |
| Fullscreen | `⌃⌘F` | `F11` | ❌ · P2 |
| Zoom +/-/0 | `⌘=` `⌘-` `⌘0` | `Ctrl+=` `Ctrl+-` `Ctrl+0` | ❌ ⭐ P1 |
| Toggle Left Panel | `⌘J` | `Ctrl+J` | ❌ ⭐ P1 |
| Toggle Commit Detail | `⌘K` | `Ctrl+K` | ❌ ⭐ P1 |
| New Tab | `⌘T` | `Ctrl+T` | ❌ ⭐ P1 |
| Close Tab | `⌘W` | `Ctrl+W` | (위 close repo 와 통합) |
| Tab #1-9 | `⌘1`~`⌘9` | `Ctrl+1`~`9` | ✅ (Tab 7개까지) |
| Next/Prev tab | `⌘Tab` `⌘⇧Tab` | `Ctrl+Tab` `Ctrl+⇧Tab` | 🟡 `⌘⇧P` 빠른 전환만 |

→ ⭐⭐ P0 합산: J/K/H/L 추가, S/U 단일 stage, Right-click 컬럼 토글. 약 **20개 누락 단축키**.

---

## 28. UX 미시 디테일 / Tips (수집)

- **Focus message box** = `⌘⇧M`
- **그래프 lane drag-resize**: lane 선 hover → drag
- **commit graph 헤더 우클릭** = 컬럼 토글
- **stash 헤더 우클릭** = 섹션 가시성 토글
- **section header 더블클릭** = 그 섹션만 maximize
- **commit 다중 선택 → 우클릭** → "Cherry pick X commits"
- **branch ref 옆 hover** → eye icon 등장
- **"// WIP" 텍스트박스** = 그래프 최상단 — stash 이름 prefilling
- **drag-drop file → terminal** = 경로 삽입

→ 위 9개 모두 ❌. ⭐ P1 / · P2 분포.

---

## 29. Ecosystem 표면

| 표면 | 흡수 | 사유 |
| --- | --- | --- |
| `gk` CLI (workspace / provider / work) | 🚫 거부 | git-fried 자체가 데스크탑 GUI, CLI 분리 가치 낮음 |
| gitkraken.dev (웹) | 🚫 거부 | Cloud 의존, plan §5 |
| Browser Extension (GitHub/GitLab inline) | 🚫 거부 | Cloud Workspace 데이터 의존 |
| GitLens (VS Code) | 🚫 거부 | git-fried 는 standalone 데스크탑 |
| **Deep linking** `gitkraken://...` | ❌ → ⭐ P1 | `git-fried://` URL 로 브랜치 / 레포 직접 진입 — 가벼움 |

→ Deep linking 만 단일 흡수.

---

## 30. 명시적 거부 catalog (anti-차별화)

| 항목 | 사유 |
| --- | --- |
| Cloud Workspace / Cloud Patches / Team View / gitkraken.dev / Browser Extension | plan §5, 보안정책, OPEX |
| 유료 lock 된 in-app merge editor | 우리는 무료 = moat |
| Custom GPG/SAML/SSO/팀 admin | v1.0+ 까지 보류 |
| Issue 트래커 풀 통합 (Jira/Trello/Linear) | Gitea/GitHub Issues 만 1급 |
| Agent Session Management 의 BYOK 멀티 provider 라우팅 | 사용자 CLI subprocess 위임이 더 가벼움 (단, **부분 흡수 §4 옵션 B 권장**) |
| Time-based / OS-sync 다중 테마 위저드 | light/dark + system follow 만 |

---

## 31. 미탐색 / 부분 정보 (정직한 한계)

| 영역 | 상태 | 다음 행동 |
| --- | --- | --- |
| Animation / motion design | 공개 자료 0 | DevTools 직접 inspect (사용자 환경 GitKraken 12.0 설치 후) |
| Accessibility (WCAG / screen reader) | docs 부재 | 직접 NVDA / VoiceOver 테스트 |
| Image diff / word-level highlight | 미언급 | 설치 후 검증 |
| Empty state / first-run 코치마크 | 부분 | 설치 후 캡처 |
| Toast 자동 닫힘 시간 정확치 | 부분 | community 불만 외 데이터 없음 |
| Right-click 메뉴 완전 매트릭스 | 부분 | 설치 후 모든 ref/commit/file/header 우클릭 캡처 |
| Drag-drop branch onto branch 의 Fast-forward / Squash 옵션 | 미언급 | 설치 후 검증 — 우리는 어쨌든 Merge/Rebase/IR 3 옵션이 핵심 |
| Built-in terminal split / multi-tab | 검색 0 | 미존재 가정 |
| Lane 색상 사용자 GUI picker | 미문서화 | 설치 후 검증 |
| iOS / Android 네이티브 앱 | 존재 안 함 (gitkraken.dev 웹만) | — |

---

## 32. 다음 sprint 후보 (TOP-down)

### Sprint A (P0 묶음, 1~2주)
1. **Hide / Solo branches** + bulk hide 섹션 헤더 (⭐⭐)
2. **Vim navigation `J/K/H/L`** + `S/U` 단일 stage (⭐⭐)
3. **그래프 컬럼 토글 / 재정렬 / right-click 헤더** (⭐⭐)
4. **Launchpad Pin / Snooze / Saved Views** (⭐⭐)

### Sprint B (P1, 2~3주)
1. **Diff Hunk/Inline/Split 3-mode 토글** + line-level stage 액션
2. **Status bar** 도입 + Conflict Prediction (target-branch 한정, 로컬 fetch)
3. **Commit Composer AI** modal (multi-commit 재작성)
4. **Repo tab alias + per-profile 영속성**
5. **단축키 약 12개 추가** (⌘D, ⌘W, ⌘=/-/0, ⌘J·⌘K, ⌘⇧M, ⌘⇧Enter 등)
6. **Command Palette 카테고리 모델** + 30+ 명령 추가
7. **AI 진입점 3개 추가**: Explain commit / Branch / Stash 메시지
8. **Drag-drop 인터랙션 4종**: Branch→Branch 메뉴, Commit→Branch cherry-pick, 컬럼 헤더 재배치, Tab 재정렬
9. **Sidebar organization 별 그룹핑** + Workspace color
10. **Preferences 트리 60% 흡수** + per-profile 탭 영속성

### Sprint C (P2, 여유 시)
- Custom theme JSON export/import
- Section header 더블클릭 maximize
- Lane drag-resize
- Worktree Lock/Unlock
- 데스크탑 OS notification
- Deep linking `git-fried://`
- 외부 merge tool launch
- LFS pre-push size estimation

---

## 33. 결정 로그

| 일자 | 결정 | 근거 |
| --- | --- | --- |
| 2026-04-26 | **Hide/Solo + vim nav + 컬럼 토글 + Launchpad pin/snooze** = P0 다음 sprint 우선 | 4축 모두 비용 낮음 + 사용자 일상 사용 빈도 높음 |
| 2026-04-26 | **Agent Session Management 부분 흡수 (옵션 B)** | 03-feature-matrix §5 의 "S 거부" 갱신. worktree → CLI 1-click launch 만, 풀 구현은 여전히 거부 |
| 2026-04-26 | **Cloud / Browser Extension / GitLens / gitkraken.dev** 거부 유지 | plan §5 정합 |
| 2026-04-26 | **유료 lock된 GitKraken 기능 (Profiles / Merge Editor / Cloud)** 모두 무료 제공 = moat | OSS 라이선스로 자연스럽게 흡수 |

---

## 34. 출처

### Help docs (직접 fetch)
- [Interface](https://help.gitkraken.com/gitkraken-desktop/interface/)
- [Commit Graph](https://www.gitkraken.com/features/commit-graph)
- [Diff](https://help.gitkraken.com/gitkraken-desktop/diff/)
- [Interactive Rebase](https://help.gitkraken.com/gitkraken-desktop/interactive-rebase/)
- [Merge Tool](https://www.gitkraken.com/features/merge-conflict-resolution-tool)
- [Workspaces](https://help.gitkraken.com/gitkraken-desktop/workspaces/)
- [Launchpad](https://help.gitkraken.com/gitkraken-desktop/gitkraken-launchpad/)
- [Pull Requests](https://help.gitkraken.com/gitkraken-desktop/pull-requests/)
- [PR Filter Syntax](https://help.gitkraken.com/gitkraken-desktop/pull-requests-filter-syntax/)
- [Profiles](https://help.gitkraken.com/gitkraken-desktop/profiles/)
- [Command Palette](https://help.gitkraken.com/gitkraken-desktop/command-palette/)
- [Keyboard Shortcuts](https://help.gitkraken.com/gitkraken-desktop/keyboard-shortcuts/)
- [Themes](https://help.gitkraken.com/gitkraken-desktop/themes/)
- [Preferences](https://help.gitkraken.com/gitkraken-desktop/preferences/)
- [Open/Clone/Init](https://help.gitkraken.com/gitkraken-desktop/open-clone-init/)
- [Hide & Solo](https://help.gitkraken.com/gitkraken-desktop/hiding-and-soloing/)
- [Conflict Prevention](https://help.gitkraken.com/gitkraken-desktop/conflict-prevention/)
- [Branching/Merging](https://help.gitkraken.com/gitkraken-desktop/branching-and-merging/)
- [Search](https://help.gitkraken.com/gitkraken-desktop/search/)
- [Built-in Terminal](https://help.gitkraken.com/gitkraken-desktop/terminal/)
- [Tips](https://help.gitkraken.com/gitkraken-desktop/tips/)
- [Coding Agents](https://help.gitkraken.com/gitkraken-desktop/agents/)
- [GitKraken AI](https://help.gitkraken.com/gitkraken-desktop/gkd-gitkraken-ai/)
- [Stash](https://help.gitkraken.com/gitkraken-desktop/stashing/)
- [Submodules](https://help.gitkraken.com/gitkraken-desktop/submodules/)
- [Worktrees](https://help.gitkraken.com/gitkraken-desktop/worktrees/)
- [LFS](https://help.gitkraken.com/gitkraken-desktop/git-lfs/)

### 12.0 release / 보조
- [GitKraken Desktop 12.0 Agent Mode blog](https://www.gitkraken.com/blog/youre-running-agents-your-tooling-is-still-catching-up)
- [GitKraken.dev 소개](https://www.gitkraken.com/blog/introducing-gitkraken-dev)
- [Cloud Patches](https://www.gitkraken.com/features/cloud-patches)
- [10.8 Conflict Prevention](https://www.gitkraken.com/blog/stop-merge-conflicts-before-they-happen-with-gitkraken-desktop-10-8)
- [11.1 PR/Stash auto-gen](https://www.gitkraken.com/blog/gitkraken-desktop-11-1-auto-gen-pr-title-descriptions-stash-messages-more)

---

다음 문서 → (TBD — 12-roadmap-update.md 가 v1.x 결정 통합 후보)
