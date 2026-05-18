# Phase 1 시나리오 — 01 Workspace

> Plan #40 Phase 1 / 6번째 우선 — Workspace 영역은 GitKraken 의 multi-repo 관리 핵심. git-fried 의 RepoTabBar + RepoSwitcher + Repository Management 패턴과 1:1 매핑. baseline 확인 = SB-019~023 + 신규 backlog 발굴.
>
> backlog 매핑: SB-019~023 (예상) + RepoSwitcher 폴더 그룹화 (Sprint c49) + Repository Management Collapse/Expand (Sprint c49)

## 영역 개요

GitKraken 상단 좌측 = Workspace dropdown — "Local" / "Cloud Workspace" / "Recent" 분류. 각 workspace 내부에 folder group (예: `chore/`, `feat/`, `fix/`) 으로 repo 묶음. repo 클릭 → graph 영역 active. 최상단 검색 bar = repo / branch / commit cross-search.

## 시나리오 list (6건, outline)

### SC-01-1: Workspace dropdown 열기 + Local/Cloud/Recent 분류

- 사용자 액션: 좌측 상단 workspace 이름 영역 클릭 (또는 dropdown arrow)
- 예상 반응: dropdown panel 표시 — Local Workspace / Cloud Workspace / Recent 분류 + 검색 input.
- git-fried 대응: RepoSwitcher.vue (Sprint c80 god comp 추출). Cloud Workspace 는 미구현 (의도적 거부 — `26-3constraints-identity.md`).
- screenshot: 2개 (dropdown 닫힌 상태 / 열린 상태)
- AHK: **S**
- 우선도 **HIGH** / backlog: SB-019 workspace dropdown parity

### SC-01-2: 폴더 그룹화 (chore / feat / fix prefix)

- 사용자 액션: Workspace dropdown 의 검색 input 에 prefix 입력 (예: "chore/")
- 예상 반응: 같은 prefix repo 그룹 형성 — 폴더 row Enter → 그룹 multi-add. (Sprint c49 git-fried 도입한 패턴 검증)
- git-fried 대응: RepoSwitcher 의 폴더 그룹화 (Sprint c49). GitKraken 의 baseline 확인.
- screenshot: 3개 (검색 전 / "chore/" 입력 후 그룹 / 그룹 row Enter 후 multi-add)
- AHK: **M** (검색 입력 + 그룹 row 위치 식별)
- 우선도 **HIGH** / backlog: SB-020 폴더 그룹화 parity

### SC-01-3: Recent repo list

- 사용자 액션: dropdown 의 "Recent" 탭 클릭
- 예상 반응: 최근 열었던 repo 시간 정렬 list — 각 row = repo name + path + last opened.
- git-fried 대응: stores/repos.ts 의 recent list. 정렬 기준 + truncation 방식 비교.
- screenshot: 2개 (Recent 탭 / row hover with timestamp)
- AHK: **S**
- 우선도 **MEDIUM** / backlog: SB-021 recent list parity

### SC-01-4: Repository Management (full list view)

- 사용자 액션: 상단 메뉴 또는 dropdown 의 "Manage repositories" 클릭
- 예상 반응: 별도 modal/page — 모든 repo list + Collapse/Expand all + 그룹 hover ⊕ "모두 열기" 버튼. (Sprint c49 git-fried 의 baseline)
- git-fried 대응: `pages/repositories.vue` (473 LOC, Layer B). Collapse/Expand all + ⊕ 멀티 add 패턴.
- screenshot: 3개 (Manage 진입 / Collapse all / Expand + ⊕ hover)
- AHK: **M**
- 우선도 **HIGH** / backlog: SB-022 management UX parity

### SC-01-5: 상단 검색 bar (repo + branch + commit cross-search)

- 사용자 액션: 상단 중앙의 검색 input 에 keyword 입력 (예: "test")
- 예상 반응: dropdown 표시 — repo matches / branch matches / commit message matches 카테고리 분류. 클릭 시 해당 entity navigate.
- git-fried 대응: useCommandCatalog (60 commands, Sprint c48). 검색 UI 통합 여부 비교.
- screenshot: 3개 (검색 input focus / "test" 입력 후 / 결과 클릭 후)
- AHK: **M**
- 우선도 **HIGH** / backlog: SB-023 cross-search parity 신규 후보

### SC-01-6: Workspace tab 전환 (HEADER 의 active repo)

- 사용자 액션: 상단 헤더의 repo tab (여러 repo open 시 tab list) 다른 repo 클릭
- 예상 반응: tab 전환 → graph 영역 active repo 변경. tab close 버튼 (X) 확인.
- git-fried 대응: RepoTabBar.vue (Sprint c64 추출 ~127 LOC). drag reorder + close 동작 비교.
- screenshot: 3개 (tab 2개 open / 다른 tab 클릭 / drag reorder)
- AHK: **L** (drag&drop 자동화 — MouseClickDrag + 좌표 정밀도)
- 우선도 **MEDIUM** / backlog: SB-024 tab UX parity

## Open question

- GitKraken 의 Cloud Workspace 가 enterprise feature 인지 free 인지 (PoC 시 진입 가능 여부)
- Multi-repo open 상태에서 sidebar 가 어떻게 분기 표시되는지 (tab 별 isolated sidebar?)
- 검색 bar 의 keyboard shortcut (`Ctrl+P` vs `Ctrl+K` vs 다른?)
