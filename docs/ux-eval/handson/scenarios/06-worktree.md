# Phase 1 시나리오 — 06 Worktree

> Plan #40 Phase 1 / 4번째 우선 — Worktree 영역은 git-fried Sprint c48 의 Wave D-4 에서 v02_commands worktree+merge 분리. GitKraken 의 worktree UX 정확한 baseline 확인 = SB-043~046 backlog 검증.
>
> backlog 매핑: SB-043~046 (예상 범위) + useWorktreePanelActions + MiniWorktreeList (Sprint c95 signature 정합 수정)

## 영역 개요

GitKraken Sidebar 의 "WORKTREES" 섹션 — main repo + 추가 worktree list. worktree row 우클릭 → Open in new window / Remove / Lock / Unlock. worktree 추가 = 상단 "Add worktree" 버튼.

## 시나리오 list (4건, outline)

### SC-06-1: WORKTREES 섹션 진입 + main + sub worktree list

- 사용자 액션: 좌측 sidebar 의 "WORKTREES" 섹션 클릭 (collapsed → expanded)
- 예상 반응: worktree list — main worktree 1개 + 추가 worktree N개. 각 row = path + branch + status (clean/modified).
- git-fried 대응: MiniWorktreeList + useWorktreePanelActions (Sprint c95 signature fix). list rendering 일치 검증.
- screenshot: 2개 (collapsed / expanded)
- AHK: **S**
- 우선도 **HIGH** / backlog: SB-043 worktree list parity

### SC-06-2: Worktree 추가 (Add worktree dialog)

- 사용자 액션: WORKTREES 섹션 우측 + 버튼 클릭 (또는 우클릭 → Add worktree)
- 예상 반응: modal/dialog — path input + branch select (existing / new). Create 버튼.
- git-fried 대응: useWorktreePanelActions.addWorktree (action 정의). dialog UX 비교.
- screenshot: 3개 (Add 버튼 클릭 / dialog 상태 / 생성 완료 후 list)
- AHK: **L** (dialog 입력 + branch select + 생성 후 list refresh — 다단계)
- 우선도 **HIGH** / backlog: SB-044 add dialog parity

### SC-06-3: Worktree 우클릭 메뉴 (Open / Remove / Lock)

- 사용자 액션: sub worktree row 우클릭
- 예상 반응: context menu — Open in new window (별도 GitKraken 인스턴스) / Remove (force prompt?) / Lock / Unlock / Copy path.
- git-fried 대응: useWorktreePanelActions 의 4 action. 메뉴 완전성 비교.
- screenshot: 2개 (메뉴 / Remove 클릭 후 confirm)
- AHK: **M**
- 우선도 **MEDIUM** / backlog: SB-045 worktree context menu parity

### SC-06-4: Worktree 전환 (현재 active worktree 표시)

- 사용자 액션: sub worktree row 좌클릭 (active 전환 시도)
- 예상 반응: GitKraken 은 multi-window 모델 (별도 창에서 worktree 열림). 같은 창 내 전환은 X?
- git-fried 대응: 현재 git-fried 도 multi-window 가능 (별도 tab). single-window 안에서 active worktree 표시 방식 비교.
- screenshot: 2개 (좌클릭 직전 / 직후 — 새 window 또는 같은 window 변화)
- AHK: **L** (multi-window spawn → 새 window focus 추적)
- 우선도 **LOW** / backlog: SB-046 worktree switch UX 결정

## Open question

- GitKraken 이 worktree 전환을 single-window 안에서 지원하는지, 별도 window 만 지원하는지
- Lock/Unlock 의 시각 표시 (icon? badge? row 색상?)
- Worktree path 가 깊으면 truncation 방식 (HEAD-only / middle ellipsis)
