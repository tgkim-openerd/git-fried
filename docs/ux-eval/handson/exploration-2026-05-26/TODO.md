# Exploration Backlog — GitKraken 12.1.2 vs git-fried (2026-05-26~)

> /goal: "현재 윈도우에 있는 깃 크라켄을 직접 MCP던 뭐던 직접 조작하여 모든 UI 에 대한 동작 정의 후 git-fried 직접 띄워서 동작 테스트 하여 찾을 것이 없을 때까지 진행, 코덱스와 페어로 진행"
>
> 사용자 명시: "페이지 하나를 띄우고 해당 페이지에 있는 버튼을 모두 누르고 (좌클릭 / 우클릭) 거기서 나온 화면들을 전부 클릭하여 동작 테스트 하는 것으로 탐색 리스트를 추가해 가면서 작업하는 것을 권장. 다만 실제 git과 연결되어 있으므로 아무 빈 저장소나 만들어서 테스트 하는 것을 권장"

## Test Repo

- 위치: `C:\Users\tgkim\test-gitkraken-vs-git-fried`
- 상태: 9 commit / 2 branch (feature/branch-a, feature/branch-b) / 1 stash / 2 tag (v0.1.0 lightweight + v0.2.0 annotated) / 1 untracked / 1 unstaged
- 양쪽 앱에 add 필요

## BFS Queue (페이지/영역)

### Top-level Pages (1st 라운드)
- [ ] **P1 Workspaces / Home** (앱 시작 직후 첫 화면)
- [ ] **P2 Repository main view** (test repo 열린 후 graph/sidebar)
- [ ] **P3 Settings** (Ctrl+,)
- [ ] **P4 Launchpad** (멀티 repo 한눈에 보기)
- [ ] **P5 Hotkey list** (모든 단축키)

### Within each page: button matrix
- [ ] Sidebar 섹션 (LOCAL/REMOTE/WORKTREES/STASHES/CLOUD PATCHES/PR/TAGS)
  - [ ] LMB: expand/collapse + item select
  - [ ] RMB: context menu (per item)
  - [ ] Hover: tooltip
- [ ] Top toolbar 버튼
  - [ ] Pull / Push / Fetch (LMB + RMB dropdown)
  - [ ] Branch / Merge / Rebase (modal)
  - [ ] Stash / Pop / Undo / Redo
- [ ] Graph area
  - [ ] commit row LMB (detail)
  - [ ] commit row RMB (context menu)
  - [ ] column header LMB (sort)
  - [ ] column header RMB (column toggle)
- [ ] Commit Detail Sidebar
  - [ ] file LMB (diff)
  - [ ] file RMB (context menu)
  - [ ] subject area (copy/etc)
- [ ] Status bar
  - [ ] branch label LMB/RMB
  - [ ] ahead/behind LMB/RMB
  - [ ] license/version LMB

### Sub-modals (button click 결과 발생 → 탐색 큐 추가)
- (cycle 진행 중 추가)

## Cycle Log

### Cycle 0 — Setup (2026-05-26)
- ✅ test repo 생성 (9 commit + 2 branch + stash + 2 tag + untracked/unstaged)
- ✅ GitKraken 12.1.2 실행 확인 (PID 24736)
- ✅ AHK v2 portable 확인 (`bench/gitkraken-spike/ahk-v2/AutoHotkey64.exe`)
- ✅ `capture-window.ps1` fully-autonomous 작성
- 🔄 git-fried tauri:dev 빌드 중 (Rust 1.95.0 — chocolatey rustc 1.60 PATH 우회: `PATH=~/.cargo/bin:$PATH`)

### Cycle 1 — P1 Workspaces baseline
- (대기)

## Stop Condition

- 탐색 큐 empty (모든 page + button + sub-screen cover)
- new finding 0 라운드 2회 연속

## Findings Log

- (cycle 진행 시 추가)
