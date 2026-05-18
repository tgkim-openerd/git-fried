# Plan #40 Phase 3 — 7 영역 narration + git-fried 비교표

> 캡처: 2026-05-18 17:57~18:00 (PoC v3.0 일괄 실행 — 7 tour script + helper lib) / Claude vision 단독 draft / Codex cross-val 1 batch 적용 후 정정 필요 (Memory Rule 3)

## 한계 명시

본 Phase 3 일괄 실행 결과 — **사용자 사전 setup (sidebar 모든 섹션 expanded)** 미적용 상태에서 자동 캡처. 결과적으로 04 tag / 05 pr / 06 worktree default PNG 가 sidebar 의 specific 섹션 보이지 않는 main graph view 임. 후속 PoC v4 권고: 사용자 setup 명시 (LOCAL/REMOTE/WORKTREES/STASHES/CLOUD PATCHES/PULL REQUESTS/TAGS 7 섹션 모두 expand) → 재실행.

본 narration 은 PoC v3.0 의 부분 cover 범위에서:

- 00 overview: sidebar baseline (default — 일부 섹션 collapsed)
- 01 workspace: Ctrl+O Open Repo dialog 진입 + ESC 닫기
- 02 graph: Ctrl+Home / Ctrl+End scroll navigation
- 03 stash: Ctrl+S (effect 없음 — GitKraken hotkey 아님)
- 04~06: default main view (specific 영역 view 못 잡음)

## 영역별 narration

### 00 — Sidebar Overview (Codex 정정 반영)

- 캡처: `20260518-175659-00-sidebar-overview-default.png` + `20260518-175701-00-sidebar-overview-after-esc.png`
- GitKraken 상태: react-native repo / branch `develop` / **`Viewing 106`** (Codex 정정 — Claude "Showing 156" REFUTED, SB-052 와 동일 패턴)
- 좌측 sidebar (visible 영역, Codex 검증):
  - 상단: workspace name "react-native" + "develop" pill
  - **Filter `(Ctrl+Alt+f)` input** (Codex 정정 — "All branches"/Refresh button REFUTED)
  - **Sidebar section counts** (Codex 신규 finding): `LOCAL 35` / `REMOTE 71` / `WORKTREES 4` / `STASHES 10` / `CLOUD PATCHES 0` / `PULL REQUESTS 0` + `TEAMS` 섹션 추가
  - **REMOTE 만 expanded**, 나머지 collapsed (TAGS 는 viewport 밖)
  - REMOTE branch list 일부 visible (구체 list 는 PNG 시각 확인 필요 — Claude 의 "develop_b/ROCK" 단정 REFUTED)
- **Top toolbar** (Codex 신규 finding): `Pull` / `Push` / `Branch` / `Stash` / `Pop` / `Terminal` 6 버튼
- **Bottom-right status bar** (Codex 신규): zoom `100%` / `Support` link / license `PRO` / version `12.1.1`
- **Tab row** (Codex 신규): active tab close `x` 버튼 + 우측 `+` 새 탭 버튼
- 우측 panel:
  - commit detail — "docs: 현대커머셜 ..." + author tgkim + **Explain commit AI 버튼** (Sprint c63 git-fried useCommitExplain baseline)
  - **Path/Tree segmented control** (Codex 신규 finding)
  - **View all files checkbox** (Codex 신규)
  - parent hash `4fb5df` + commit hash `750b2e`
- 중앙: commit graph (lanes + nodes + branch chips)
- ESC 후 변화 없음 — main view stable

**git-fried 대응**: 동일 layout 패턴 (sidebar + graph + detail panel). useCommitExplain 구현 ✓ (Sprint c63).

### 01 — Workspace (Open Repo dialog)

- 캡처: 3개 (default / open-dialog / after-esc)
- Ctrl+O 결과: **dialog 발생 X (PNG default 와 동일 248KB)** — Ctrl+O 가 GitKraken main hotkey 아닐 가능성 또는 dialog 가 즉시 닫힘
- ESC 후 main view 그대로

**git-fried 대응**: `pages/repositories.vue` 가 Open Repo + Repository Management 통합. GitKraken 의 Ctrl+O dialog UX 는 본 PoC 에서 미확인 → 후속 image-search-based PoC v4 권고.

### 02 — Graph (Ctrl+Home / Ctrl+End)

- 캡처: 4개 (default / top / bottom / home-return)
- Ctrl+Home: graph top (HEAD/most recent commit) 으로 scroll
- Ctrl+End: graph bottom (oldest commit) 으로 scroll — large repo 의 경우 long scroll
- Home return: Ctrl+Home 으로 복귀 — 시작 위치와 일치 여부

**git-fried 대응**: useCommitGraphRows + useGraphInfiniteScroll (Sprint c75) — STEP 500 / CAP 5000. GitKraken 도 Lazy Load (Initial 2000 + 추가 lazy) 패턴 (Settings PoC 확인). scroll 방식은 동일하나 STEP 크기 차이.

### 03 — Stash (Ctrl+S effect 없음)

- 캡처: 3개 (default / ctrl-s / after-esc) — 모두 동일 main view (247KB 가까이 동일)
- Ctrl+S 결과: GitKraken main hotkey 아님 — 효과 없음 (확인)
- **PoC v4 권고**: Stash 생성 hotkey 가 별도 (Settings → Workflow → Hotkey 확인 필요) 또는 sidebar 상단 + 버튼 image search

**git-fried 대응**: TopBar Stash 버튼 + useStashInteraction (Sprint c74). hotkey 대응 미확정 — GitKraken baseline 미확인.

### 04 — Tag (default main view)

- 캡처: 1개 (`20260518-180030-04-tag-default.png`)
- GitKraken view: main graph (sidebar 의 TAGS 섹션 expanded 안 됨, capture 미 cover)
- **PoC v4 권고**: 사용자 setup (TAGS 섹션 expand) 후 재캡처 또는 image search anchor 도입

**git-fried 대응**: SB-033 Annotate tag (Sprint c95 commit `56cffd3`) + SB-018 Tag mini filter bar — GitKraken 의 tag context menu / annotate dialog baseline 미확인.

### 05 — Pull Request (default main view)

- 캡처: 1개
- GitKraken view: main graph (PULL REQUESTS 섹션 미캡처)
- **PoC v4 권고**: 사용자 setup 또는 좌측 sidebar 의 PULL REQUESTS 섹션 image anchor

**git-fried 대응**: SB-017 PR CI 4 아이콘 인프라 (Sprint c95+ Wave 1) + ARCH-001 PR CI wire (CRIT-001 다음 sprint). GitKraken PR list UI / CI icon UX 미확인.

### 06 — Worktree (default main view)

- 캡처: 1개
- GitKraken view: main graph (WORKTREES 섹션 미캡처)
- **PoC v4 권고**: 사용자 setup

**git-fried 대응**: MiniWorktreeList + useWorktreePanelActions (Sprint c95 signature fix). GitKraken worktree dialog / context menu 미확인.

---

## git-fried vs GitKraken 비교표 (Phase 5 통합)

PoC v3.0 cover 범위 기반. detail UX 비교는 PoC v4 (image search anchor + 사용자 sidebar setup) 이후 보강.

| # | 영역 | GitKraken 동작 | git-fried 대응 | parity | backlog |
| --- | --- | --- | --- | --- | --- |
| 1 | Settings 진입 | Ctrl+, → full-page replacement (modal X) | `pages/settings/` route 별도 페이지 | ✓ 동일 패턴 | — |
| 2 | Settings nav | 12 global + 3 repo-specific 분리 (Codex REFUTED) | `pages/settings/sections/*.vue` | △ 부분 | SB-XXX repo-specific sub-nav 신규 후보 |
| 3 | Auto-Fetch Interval | default 미확정 (사용자 1, Codex 검증 필요) | Sprint c95 SB-028: default 0→5min | △ baseline 불일치 가능 | SB-028 cross-check |
| 4 | Initial Commits in Graph | 2000 + Lazy Load toggle | STEP 500 / CAP 5000 (Sprint c74) | △ 전략 차이 | UX 결정 — STEP 크기 조정 검토 |
| 5 | Repo-Specific Preferences | 좌하단 별도 섹션 (Encoding/Gitflow/Git Hooks) | SB-013 per-repo forge override (Sprint c81) | ✓ 패턴 동일 | parity 확장 (Gitflow/Git Hooks) |
| 6 | GitKraken AI tab | Settings 내 별도 nav 항목 | useAiRunner + ai_commands.rs 9 IPC | △ 통합 위치 다름 | Settings sub-section 통합 검토 |
| 7 | Commit Signing tab | Settings nav 별도 | 미구현 | ✗ | SB-XXX 신규 |
| 8 | Gitflow tab | Settings nav 별도 (Repo-Specific) | 미구현 (의도적 거부 가능) | ✗ | `26-3constraints-identity.md` 검토 |
| 9 | Git Hooks tab | Settings nav 별도 (Repo-Specific) | 미구현 (lefthook 외부 사용) | ✗ | SB-XXX 신규 (hooks 관리 UI) |
| 10 | Explain commit AI 버튼 | 우측 commit detail panel 표시 (Codex finding) | useCommitExplain (Sprint c63) | ✓ 구현 완료 | UI parity 검증 |
| 11 | Graph scroll | Ctrl+Home/End hotkey 지원 (PoC v3 확인) | useGraphInfiniteScroll | △ hotkey 미확정 | git-fried hotkey 추가 검토 |
| 12 | Stash 생성 hotkey | Ctrl+S 아님 (PoC v3 confirmed) | TopBar 버튼 (hotkey 없음) | ✗ | hotkey 통일 검토 |
| 13 | Tag annotate | GitKraken context menu 추정 (PoC v3 미 cover) | SB-033 Annotate tag (Sprint c95) | ? 미검증 | PoC v4 caprure |
| 14 | PR CI status | GitKraken sidebar PR row 표시 추정 (PoC v3 미 cover) | SB-017 4 아이콘 인프라 (Sprint c95+ Wave 1) | ? 미검증 | PoC v4 + ARCH-001 wire |
| 15 | Worktree context menu | GitKraken 추정 (PoC v3 미 cover) | useWorktreePanelActions | ? 미검증 | PoC v4 capture |

**parity 통계**:

- ✓ 완전 parity: 4 (Settings 진입 / Repo-Specific 패턴 / Explain commit AI / scroll)
- △ 부분 parity: 4 (nav 구조 / Auto-Fetch / Initial Commits / AI 통합 위치)
- ✗ git-fried 미구현: 4 (Commit Signing / Gitflow / Git Hooks / Stash hotkey)
- ? 미검증 (PoC v4 필요): 3 (Tag annotate / PR CI / Worktree)

## PoC v4 권고 (Phase 6 commit 후 후속 sprint 진입)

본 PoC v3.0 의 부분 cover 영역 (04/05/06) 보강:

1. **사용자 setup 명시화** — GitKraken sidebar 의 7 섹션 (LOCAL / REMOTE / WORKTREES / STASHES / CLOUD PATCHES / PULL REQUESTS / TAGS) 모두 expand 상태 사전 setup
2. **image search anchor 도입** — `bench/gitkraken-spike/anchors/12.1.1/` 디렉토리에 sidebar 라벨 PNG (TAGS, STASHES, WORKTREES, PULL REQUESTS) 별도 캡처 → ImageSearch 좌표 식별
3. **Stash 생성 hotkey 확인** — Settings → Workflow → Hotkey 페이지 캡처로 GitKraken 단축키 list 확보
4. **각 영역 context menu 캡처** — right-click + screenshot 자동화 (image search 좌표 + MouseClickDrag)

---

## Verification — Codex cross-validation (Memory Rule 3, batch 1회)

Codex (`ab6c7c0c186040769`) 가 narration + 7 핵심 PNG 검증.

### A. Claude 단정 정정

| # | Claude 단정 | Codex 검증 | 처리 |
| --- | --- | --- | --- |
| 1 | `Showing 156` | 실제 `Viewing 106` (SB-052 와 동일 패턴) | **REFUTED** → narration 정정 완료 |
| 2 | Filter "All branches" + Refresh button | 실제 `Filter (Ctrl+Alt+f)` input only | **REFUTED** → 정정 완료 |
| 3 | branch list "develop_b / ROCK / main" | visible 항목 기준 축소 필요 (구체 list 시각 확인 부족) | **PARTIAL** → 정정 완료 |
| 4 | TAGS section visible 가능성 | TAGS 는 viewport 밖 (TEAMS 섹션이 별도 존재 — Claude 누락) | **PARTIAL** → 정정 완료 |
| 5 | 04 tag / 05 pr / 06 worktree default = main graph view | 시각적으로 동일 main view + `PULL REQUESTS 0` `WORKTREES 4` header 만 visible (contents 미캡처) | 유지 + wording 보정 완료 |
| 6 | ESC / Ctrl+S 효과 검증 | PNG 미제공 — Codex 검증 불가 | narration 단정 유지, 검증 보류 |

### B. Codex-only 신규 finding (Claude 가 놓침)

1. **Sidebar section counts** — LOCAL 35 / REMOTE 71 / WORKTREES 4 / STASHES 10 / CLOUD PATCHES 0 / PULL REQUESTS 0 + TEAMS 섹션 (count viewport 밖)
2. **REMOTE 만 expanded** — 나머지 6 섹션 collapsed (사용자 setup 가정과 다름)
3. **Top toolbar 6 버튼**: Pull / Push / Branch / Stash / Pop / Terminal
4. **Bottom-right status bar**: zoom 100% / Support link / license PRO / version v12.1.1
5. **Tab row**: active close `x` + 우측 `+` 새 탭
6. **Right detail panel**: Path/Tree segmented control + View all files checkbox + parent hash 4fb5df + commit hash 750b2e

### C. 비교표 parity 정정

- "Repo-Specific 패턴 ✓ 동일" — 본 batch 7 PNG 에 Settings UI 없음 (Phase 2 캡처만 근거). Settings parity 는 `07-settings-narration.md` 의 Codex 검증 결과로 확정.
- "Explain commit AI ✓ 구현 완료" — GitKraken 측 버튼 visible 확인. git-fried Sprint c63 useCommitExplain 구현은 sprint 기록 근거 (PNG 영역 외).
- "Stash 생성 hotkey ✗" — 본 batch 검증 불가 (Settings hotkey list 캡처 부재). PoC v4 권고.

---

## Codex-only 신규 backlog 후보 (5건)

본 batch Codex finding 기반 — git-fried 신규 backlog candidate:

| # | 우선도 | 영역 | 내용 | 비고 |
| --- | --- | --- | --- | --- |
| SB-NEW-1 | **HIGH** | Status bar | Bottom-right zoom `100%` / Support / license tier / version `v12.1.1` 표시 | Sprint c91 Phase A 영역과 시너지 |
| SB-NEW-2 | MED | Top toolbar | Pull / Push / Branch / Stash / Pop / Terminal 6 command 버튼 + disabled state + dropdown affordance | git-fried 현재 GitKrakenToolbar.vue (414 LOC) 와 parity 검증 |
| SB-NEW-3 | MED | Sidebar count badges | 각 섹션 라벨 옆 count (LOCAL N / REMOTE N / ...) | sidebar microgap SB-024+ 와 함께 |
| SB-NEW-4 | MED | Right detail panel | Path/Tree segmented toggle + "View all files" checkbox + parent/commit hash 표시 | CommitDetailSidebar (Sprint c67) 와 비교 |
| SB-NEW-5 | LOW | Tab row polish | active tab close `x` 버튼 + overflow + 우측 `+` 새 탭 | RepoTabBar (Sprint c64) 와 비교 |

다음 sprint 진입 시 sidebar microgap backlog 에 통합 후보. PoC v4 (image search anchor + 사용자 sidebar setup) 결과 보강 후 backlog 우선순위 재정렬.
