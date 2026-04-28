# 25. GitKraken Layout Migration (Sprint c25)

작성: 2026-04-28 / 트리거: 사용자 본인 dogfood — GitKraken 12.0 의 핵심 UX 3 영역 (상단 Action Toolbar / 우측 영구 Commit Panel / 인라인 Diff) 흡수.

> **목적**: [docs/plan/11-gitkraken-benchmark.md](./11-gitkraken-benchmark.md) §2-(2)/(5) 와 §3 에서 ❌ / 🟡 로 분류된 흡수 후보를 4 sprint 로 단계적 적용. layout 철학은 **option (b) full GitKraken-style swap** 채택 — 우측 = commit panel 영구, 7-tab 은 좌측 또는 collapsible 로 이전, 상단 = 8-button action toolbar.
>
> **연계**: plan/06 §1, plan/11 §1·§2·§3, plan/22 §3·§5 (UI 부채), plan/24 §10 (visual refactor 진행 로그).

---

## 0. 30초 요약

| Sprint | 범위 | 비용 | 가치 | 예상 sprint |
| ---- | ---- | ---- | ---- | ---- |
| **c25-1** | 상단 Action Toolbar (Undo/Redo/Pull/Push/Branch/Stash/Pop/Terminal 8-button) | S~M | ★★★ Discoverability + Reversibility 1급 | 1 |
| **c25-2** | 우측 Commit Panel 영구화 (Path/Tree/Stage All/Amend/AI Compose/CTA) | M | ★★★ context 0 | 1 |
| **c25-3** | 7-tab 좌측 collapsible 로 이전 (또는 sidebar 통합) | L | ★★ layout 정합성 | 2 |
| **c25-4** | Diff 인라인화 (모달 → side panel, Edit/Blame/History 헤더) | L | ★★ review 흐름 | 2 |

**total**: ~6 sprint, 변경 파일 15~25개 추정.

---

## 1. 배경 — 왜 지금?

- plan/11 §1 Top 12 중 **#5 Diff 3-mode 토글** 외에 §2 Toolbar / §2 Commit Panel 항목은 ❌ / 🟡 인 채로 남음.
- 사용자 본인 dogfood 캡처 (2026-04-28) — GitKraken 의 빨간 동그라미 3 영역이 일상 사용 friction 의 핵심으로 식별됨.
  - ① 상단 Toolbar — Undo/Redo 버튼 부재로 위험 액션 후 reflog modal 진입까지 3 클릭
  - ② 우측 Commit Panel — 변경 카운트가 status 탭 진입해야 보임 (context switch 비용)
  - ③ 인라인 Diff — review 시 다른 파일 점프 시 모달 닫고 다시 열어야 함
- 흡수 후 차별화 위협 검증: GitKraken 의 Cloud-first / Electron / Gitea 미지원 약점은 그대로 유지, layout 만 흡수.

---

## 2. Sprint c25-1 — Top Action Toolbar (이번 세션)

### 2-1. 목표
SyncBar (Fetch/Pull/Push 3 button) 를 **GitKrakenToolbar (8 button)** 로 확장.

### 2-2. 버튼 시퀀스
좌→우, 그룹핑:

```
[history]  Undo · Redo
[sync]     Pull · Push
[branch]   Branch · Stash · Pop
[shell]    Terminal
[meta]     branch indicator (on main → upstream ↑/↓)
```

| 버튼 | 액션 | 기존 wiring | 상태 |
| ---- | ---- | ---- | ---- |
| **Undo** | ReflogModal 열기 (HEAD restore 버튼 포함) | `window.gitFriedOpenReflog()` | ✅ 즉시 가능 |
| **Redo** | placeholder — toast.info '준비중' | — | 🔜 c25-1.5 (reflog forward 추적) |
| **Pull** | 기존 `pullMut` | `useShortcut('pull')` | ✅ 즉시 가능 |
| **Push** | 기존 `pushMut` | `useShortcut('push')` | ✅ 즉시 가능 |
| **Branch** | BranchPanel 탭 활성 + new branch input focus | `useShortcut('newBranch')` | ✅ 기존 단축키 재사용 |
| **Stash** | `pushStash(repoId)` (메시지 없이 즉시) | `api/git.ts:160` | ✅ 즉시 가능 |
| **Pop** | `popStash(repoId, 0)` (가장 최근) — stash 0개면 disabled | `api/git.ts:168` | ✅ 즉시 가능 |
| **Terminal** | `terminalOpen` 토글 | `useShortcut('terminal')` | ✅ 기존 단축키 재사용 |

### 2-3. 시각 디자인
- 높이: `h-10` (현재 SyncBar `py-2` 와 유사)
- 그룹 사이 `divide-x divide-border` (시각 분리)
- 각 버튼: `icon + label` (라벨 너무 길면 sm 미만에서 icon-only fallback)
- Undo/Redo: 키보드 ⌘Z / ⌘⇧Z 단축키 매핑 (Sprint c25-1.5)
- Stash 버튼은 working tree 변경 0개면 disabled, Pop 은 stash 0개면 disabled

### 2-4. 파일 영향
| 파일 | 변경 | 비고 |
| ---- | ---- | ---- |
| `src/components/GitKrakenToolbar.vue` | **신규** | SyncBar 의 superset |
| `src/components/SyncBar.vue` | **유지** (단계적 마이그레이션) | c25-3 까지 deprecation 보류 |
| `src/pages/index.vue` | SyncBar → GitKrakenToolbar 교체 | 1 라인 |
| `src/composables/useShortcuts.ts` | `'undo' \| 'redo'` action 추가 | 2 라인 |
| `src/components/HelpModal.vue` | 단축키 표 갱신 | (c25-1.5) |

### 2-5. 회귀 위험
- **낮음**: SyncBar 의 모든 기존 동작은 GitKrakenToolbar 가 superset 으로 커버.
- 단축키 (`⌘L` Fetch / `⌘⇧L` Pull / `⌘⇧K` Push) 는 GitKrakenToolbar 가 다시 등록 → 동작 동일.
- **검증**: typecheck + dev 실행 후 캡처.

---

## 3. Sprint c25-2 — 우측 Commit Panel 영구화 (다음 세션)

### 3-1. 목표
`pages/index.vue` 우측의 7-tab nav 를 폐기하고 **Commit Panel 영구 노출**. 7-tab 은 좌측 sidebar 의 collapsible section 으로 이전 (또는 c25-3 에서).

### 3-2. 새 우측 panel 구성
```
[ N file changes on {branch} ]      ← 헤더
[Path | Tree]
─ Unstaged Files (N)   [Stage All]
[StatusPanel 의 unstaged 부분만]
─ Staged Files (N)
[StatusPanel 의 staged 부분만]
─ Commit
[CommitMessageInput inline]
[ ] Amend
[✨ Compose with AI]
[Stage Changes to Commit]    ← primary CTA
```

### 3-3. 파일 영향
| 파일 | 변경 |
| ---- | ---- |
| `src/components/CommitPanel.vue` | **신규** (StatusPanel + CommitMessageInput 합성) |
| `src/components/StatusPanel.vue` | unstaged/staged 섹션을 props 로 분리 가능하게 리팩터 |
| `src/pages/index.vue` | 우측을 CommitPanel 고정으로 교체, 7-tab 제거 |

### 3-4. 회귀 위험
- **중간**: 7-tab 사용자(=현재 본인) 가 Branches/Stash/PR 등에 어떻게 접근할지 c25-3 까지 임시 단축키만 의존.

---

## 4. Sprint c25-3 — 좌측 Sidebar 통합

### 4-1. 목표
GitKraken 의 좌측 sidebar 처럼 **Workspace · Branches · Tags · Stash · Submodules · LFS · Worktrees · PR** 를 **collapsible section** 으로 통합. 기존 [src/components/Sidebar.vue](../apps/desktop/src/components/Sidebar.vue) (현재 repo list 만) 를 확장.

### 4-2. 파일 영향 (예상 8~10개)
- `src/components/Sidebar.vue` 대규모 리팩터
- 7개 panel (`BranchPanel`, `StashPanel`, etc.) 을 sidebar 안에서 호출 가능하게 props 인터페이스 통일
- ⌘1~⌘7 단축키는 collapsible expand 트리거로 의미 변경

---

## 5. Sprint c25-4 — Diff 인라인화

### 5-1. 목표
[CommitDiffModal.vue](../apps/desktop/src/components/CommitDiffModal.vue) → 우측 sub-panel 또는 중앙 main panel 의 diff mode. 모달 4개 (`CommitDiffModal`, `HunkStageModal`, `DiffViewer`, `DiffSplitView`) 통합 검토.

### 5-2. 헤더 흡수
- **Edit This File** 버튼 (CodeMirror 편집 모드 토글)
- **Blame · History** 인라인 진입점
- **↑↓ Hunk** 네비게이션
- **3-toggle**: Unstaged / File View / Diff View
- **Stage File** 헤더 상시 노출

---

## 6. Roll-back 전략

각 sprint commit 은 독립 revert 가능:
- c25-1: GitKrakenToolbar 만 도입, SyncBar 유지 → revert 시 1 라인 (`pages/index.vue` import 만 되돌림)
- c25-2: CommitPanel 추가, StatusPanel/CommitMessageInput 보존 → revert 시 우측 7-tab 복원
- c25-3 이후는 feature branch 에서 충분히 검증 후 main merge.

---

## 7. 진행 로그

### 2026-04-28 — c25-1 진입
- feature branch `feat/c25-gitkraken-layout` 생성 (main: `ac4c918`)
- plan 25 문서 작성
- (아래 세션 작업 진행 중)
