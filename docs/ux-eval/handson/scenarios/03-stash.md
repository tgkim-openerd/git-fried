# Phase 1 시나리오 — 03 Stash

> Plan #40 Phase 1 / 3번째 우선 — Stash 영역은 git-fried 의 Mini 패턴 (Pattern 9 sister) 이 적용된 영역. GitKraken 의 stash 흐름 정확한 baseline 확인 = SB-024~027 backlog 검증.
>
> backlog 매핑: SB-024~027 (예상 범위) + Pattern 9 sister useStashInteraction (Sprint c74 도입)

## 영역 개요

GitKraken Sidebar 의 "STASHES" 섹션 — local stash list (untracked + tracked changes). stash row 우클릭 → Apply / Pop / Drop / View diff / Save copy as patch 메뉴. Stash 생성 = 상단 "Stash" 버튼 (또는 hotkey).

## 시나리오 list (4건, outline)

### SC-03-1: Stash 생성 (현재 working tree 변경 → stash@{0})

- 사용자 액션: working tree 에 변경 있는 상태에서 좌상단 "Stash" 버튼 클릭
- 예상 반응: stash message input dialog 표시 (optional message). OK → STASHES 섹션에 새 stash@{N} 추가, working tree clean.
- git-fried 대응: TopBar 의 Stash 버튼 + useStashInteraction (Sprint c74). 동작 흐름 일치 검증.
- screenshot: 3개 (working tree 변경 / Stash 버튼 클릭 후 dialog / stash 생성 후 list)
- AHK: **M** (working tree 변경 사전 setup — 별도 fixture 필요)
- 우선도 **HIGH** / backlog: SB-024 stash creation parity

### SC-03-2: Stash list 표시 + row hover

- 사용자 액션: STASHES 섹션 expand → 첫 stash row hover
- 예상 반응: stash list — `stash@{0}` `stash@{1}` ... + message preview + date. hover → tooltip / ⋮ icon.
- git-fried 대응: MiniStashList 컴포넌트 (Sprint c54+++ 의 Mini sister). hover tooltip 미구현 (후보).
- screenshot: 2개 (list / hover)
- AHK: **S**
- 우선도 **MEDIUM** / backlog: SB-025 hover tooltip 후보

### SC-03-3: Stash 우클릭 메뉴 (Apply / Pop / Drop / View diff)

- 사용자 액션: stash row 우클릭
- 예상 반응: context menu — Apply (keep stash) / Pop (apply + delete) / Drop / View diff / Save as patch / Rename message.
- git-fried 대응: useStashInteraction + ContextMenu (Sprint c79 native menu 차단 후 custom). 메뉴 항목 완전성 비교.
- screenshot: 2개 (메뉴 / Drop 클릭 후 confirm)
- AHK: **M** (right-click + context menu image anchor)
- 우선도 **HIGH** / backlog: SB-026 stash menu parity

### SC-03-4: Stash diff view (CommitDetailSidebar 대응)

- 사용자 액션: stash row 좌클릭 (또는 더블클릭)
- 예상 반응: stash diff panel 우측에 표시 — file list + 변경 내용 inline. CommitDetailSidebar 와 유사 UX.
- git-fried 대응: CommitDetailSidebar 가 commit / stash / WIP 모두 처리 (Sprint c67 god comp 0). 동일 흐름 검증.
- screenshot: 2개 (stash 클릭 직후 / 파일 1개 클릭 후 diff)
- AHK: **M** (좌클릭 + panel transition + image search file row)
- 우선도 **MEDIUM** / backlog: SB-027 stash diff parity

## Open question

- GitKraken 의 stash 생성 시 message dialog 가 modal 인지 inline 인지
- Apply 와 Pop 의 시각 구분 (icon? color? wording?)
- Untracked 파일 stash 시 별도 옵션 UI (`--include-untracked`) 가 어떻게 노출되는지
