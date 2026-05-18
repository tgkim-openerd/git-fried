# Phase 1 시나리오 — 02 Graph (가장 dynamic, 마지막 영역)

> Plan #40 Phase 1 / 7번째 (마지막) 우선 — Graph 영역은 가장 dynamic (virtual scroll + transition + lane 계산). image anchor fragility 최대. Sprint c51 + c75 + c77 의 GitKraken parity 작업 누적 → baseline 확인 = SB-001~014 + SB-052~055 backlog 검증.
>
> backlog 매핑: SB-001~014 (sidebar microgap 절반 이상) + SB-052~055 (Codex V2 baseline 분석 - 메모리 vision rule 3)

## 영역 개요

GitKraken 중앙 panel = commit graph (table-like). 좌측 = graph lanes + 노드 (commit type 별 시각: merge donut / tag violet ring / signed green ring). 우측 = author / message / date column. 상단 = filter bar (branch / search). 하단 우측 = inline diff / commit detail panel. 가장 흔히 보는 영역이라 fragility 높음.

## 시나리오 list (8건, outline)

### SC-02-1: Graph 진입 + 기본 commit list 표시

- 사용자 액션: workspace 의 repo 클릭 → graph 영역 활성
- 예상 반응: commit graph rendering — lane (branch tracking) 곡선 + 노드 + ref-pill (branch sky / remote emerald / tag violet / stash amber). virtual scroll. Sprint c51 git-fried 시각 baseline.
- git-fried 대응: CommitGraph.vue (199 script LOC, threshold 직전) + useCommitGraphRows + useGraphCanvasRenderer.
- screenshot: 3개 (graph 진입 / scroll 후 / 큰 monorepo 의 max_lane 상태)
- AHK: **L** (graph rendering 완료 timing)
- 우선도 **HIGH** / backlog: SB-001 graph rendering parity

### SC-02-2: Commit row 좌클릭 → 우측 detail panel

- 사용자 액션: commit row 1개 좌클릭
- 예상 반응: 우측 CommitDetailSidebar (git-fried 142 LOC, Sprint c67 god comp 0 마일스톤) 표시 — meta + file list + diff preview.
- git-fried 대응: CommitDetailSidebar 동일 흐름. Sticky meta + scrollable file list (Sprint c77 C 구현).
- screenshot: 3개 (commit 클릭 직전 / 직후 detail 표시 / file 1개 클릭 후 diff)
- AHK: **M**
- 우선도 **HIGH** / backlog: SB-002 detail panel parity

### SC-02-3: Branch chip column sticky-left (Sprint c52 ARCH-002 parity)

- 사용자 액션: graph 우측 가로 scroll
- 예상 반응: 좌측 lane + branch chip column 이 sticky 로 유지 (Approach A overlay column ~110 LOC, Sprint c52 git-fried 도입).
- git-fried 대응: useCommitColumns.ALL_COLUMNS 의 widthPx SOT. GitKraken 의 sticky 동작 비교.
- screenshot: 3개 (scroll 0 / scroll mid / scroll right end with sticky 유지)
- AHK: **L** (가로 scroll wheel + image search lane area)
- 우선도 **MEDIUM** / backlog: SB-003 sticky column parity

### SC-02-4: Merge commit donut + avatar centered marker (Codex V2 finding)

- 사용자 액션: merge commit 1개 노드 hover + 시각 확인
- 예상 반응: merge donut (outer ring + 흰 inner dot, Sprint c51 baseline) + 중앙 avatar marker (Codex V2 CDX-V2-004).
- git-fried 대응: 현재 inner dot 만, avatar marker 미구현 (SB-053 신규 후보).
- screenshot: 2개 (merge node hover / zoom-in 확대)
- AHK: **M** (merge commit 위치 식별 — image search + lane index)
- 우선도 **MEDIUM** / backlog: SB-053 신규 (Codex V2 후속)

### SC-02-5: Tag violet ring + signed green ring (Sprint c51 차이)

- 사용자 액션: tagged commit + signed commit 둘 다 화면에 표시 → 시각 비교
- 예상 반응: tag ring r=6 violet, signed ring r=5.5 green. (Sprint c51 git-fried baseline)
- git-fried 대응: useGraphCanvasRenderer 의 ring color. GitKraken 의 dimension/color tone 비교.
- screenshot: 2개 (tagged commit hover / signed commit hover)
- AHK: **L** (특정 commit type 찾아 hover — fixture repo 필요)
- 우선도 **LOW** (시각 비교만)

### SC-02-6: Branch chip 우클릭 → context menu (useBranchActions 20 액션)

- 사용자 액션: graph 의 branch chip 우클릭
- 예상 반응: context menu — Checkout / Rename / Delete / Push / Pull / Fetch / Reset (4 modes ▶) / Cherry-pick / Tag / Worktree / Copy 등 (Sprint c54+++ git-fried 11→20 액션 baseline).
- git-fried 대응: useBranchInteraction (Pattern 9 delegate sister) + useBranchActions 20. 메뉴 완전성 비교.
- screenshot: 3개 (branch chip 우클릭 / Reset submenu / Cherry-pick submenu)
- AHK: **M** (right-click + submenu navigation)
- 우선도 **HIGH** / backlog: SB-004 branch context menu parity

### SC-02-7: Inline diff (file 1개 클릭 → 하단 inline diff)

- 사용자 액션: commit detail panel 의 file row 1개 클릭
- 예상 반응: 하단 (또는 우측) inline diff panel — 변경 line 표시 (DiffViewer). 우측 sticky meta + scrollable.
- git-fried 대응: DiffViewer.vue (Sprint c80 추출). MergeView (SplitView) Sprint c54+++ 도입.
- screenshot: 3개 (file 클릭 / inline diff 진입 / split view toggle)
- AHK: **M**
- 우선도 **HIGH** / backlog: SB-005 inline diff parity

### SC-02-8: Graph 곡선 lanes + tint bands + avatar nodes (Codex V2 CDX-V2-006)

- 사용자 액션: 많은 branch + merge 가 있는 commit history scroll
- 예상 반응: lane 들이 직선이 아닌 곡선으로 흐름. tint band (각 lane 별 background 옅은 색). avatar 가 node 안에 표시 (Codex V2 finding).
- git-fried 대응: 직선 lane (현재). 곡선 lanes 는 SB-055 LARGE 신규 후보 (Codex V2 합류 분석).
- screenshot: 2개 (multi-branch history / merge-heavy section)
- AHK: **L** (fixture: 많은 branch 가 있는 repo 필요)
- 우선도 **MEDIUM** / backlog: SB-055 (Codex V2 후속, LARGE)

## Open question

- GitKraken 의 graph 가 max_lane > 50 일 때 어떻게 동작하는지 (overflow / horizontal scroll / lane 압축)
- Commit signature verification 결과 (GPG good/bad) 의 시각 차이
- Detached HEAD / rebase 진행 중 graph 표시 방식

## Risk (영역 specific)

- Virtual scroll + dynamic lane width → image anchor 변동 큼
- Avatar / commit message 가 동적 — 캡처 시 fixture repo 고정 필요
- Sprint c77 의 scroll polish 후 transition 추가 → AHK timing 보정 필수
