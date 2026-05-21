# git-fried UX 플로우 마찰점 감사 — Laws of UX 반복 탐색

> Goal: Codex와 함께 UI/UX·UX 플로우 문제점을 발견점 0이 될 때까지 반복 탐색.
> 평가 프레임: "Laws of UX" 30 심리학 원칙 (https://news.hada.io/topic?id=29034).
> 대상: git-fried v0.3.0 — 기능 parity(comparison.md)와 다른 축, **플로우 마찰**.
> 참조 GUI: GitKraken / SourceTree / Fork / GitHub Desktop / Tower / lazygit / VS Code Git.

## 진행 상태 (수렴 추이)

| Round | 범위 | 신규 finding | 비고 |
| --- | --- | --- | --- |
| R1 | 핵심 플로우 (commit/graph/conflict/clone/rebase/launchpad) | 35 | Claude+Codex blind |
| R2 | settings/repos/stash/worktree/search/diff/first-run/theme/tab/toast/resize | 37 | Codex 35 + Claude 6, 일부 dedup |
| R3 | PR/issue/blame/tag/remote/submodule/bisect/graph-detail/drag/help/notif/colorblind/modal-z | 26 | R2 HIGH 재보정: 6 REJECTED·9 강등 |
| R4 | AI/LFS/sidebar-mini/push/sync/repo-switcher/branch-create/graph-scroll/error-boundary/empty-repo | 10 | Sparse·Profile 클린 |
| R5 | R3+R4 adversarial + 최종 micro-sweep | (진행) | 수렴 판정 |

추세: 35 → 37 → 26 → 10 (하향 수렴). HIGH severity 비율 라운드마다 감소.

---

## Round 1 — 핵심 플로우 (35건, UXF-01~35)

### HIGH (R3 재검증 반영)
| ID | 마찰점 | 파일:라인 | UX Law | R3 재검증 |
| --- | --- | --- | --- | --- |
| UXF-01 | MergeEditorModal: conflict marker(`<<<`/`===`/`>>>`) 잔재 상태로 stage 허용 (검증 없음) | MergeEditorModal.vue:228,239 | Error Prevention | CONFIRMED HIGH 유지. (단 "ours/theirs 설명 부재"는 :228 안내 텍스트 존재로 REJECTED) |
| UXF-02 | Interactive rebase Continue 버튼이 conflict 해결 여부 미확인 | InteractiveRebaseModal.vue:243 | Error Prevention | DOWNGRADED→MED (git backend가 거부 → 데이터손실 아님) |
| UXF-03 | CommitGraph rows: role/tabindex/keyboard 부재 | CommitGraph.vue:437 | Accessibility | DOWNGRADED→MED (전역 J/K nav 존재, semantics만 미완) |
| UXF-04 | StatusPanel 파일 rows: tabindex/role 부재 | StatusPanel.vue:350 | Accessibility | DOWNGRADED→MED (인접 단축키 존재) |
| UXF-05 | IPC timeout 시 banner 닫히나 native git 계속 실행 → 상태 불일치 | invokeWithTimeout.ts:124 | Mental Model | CONFIRMED HIGH 유지 |

### MED (UXF-06~25)
| ID | 마찰점 | 파일:라인 | UX Law |
| --- | --- | --- | --- |
| UXF-06 | fetch/pull/push 후 invalidate가 status/log/repos만 — graph/branches/diff 미갱신 | useStatus.ts:25 | Doherty/Feedback |
| UXF-07 | Clone 진행: 버튼 텍스트+toast뿐, progress bar/단계/속도 없음 | CloneRepoModal.vue:134 | Goal-Gradient |
| UXF-08 | LongRunningBanner label이 raw IPC command명 노출 | invokeWithTimeout.ts:168 | Mental Model |
| UXF-09 | Commit 버튼: staged 0개여도 활성화 | CommitMessageInput.vue:124 | Jakob's Law |
| UXF-10 | branch drag-drop merge/rebase 선택이 텍스트 prompt | useBranchDragDrop.ts:106 | Hick/Jakob |
| UXF-11 | MergeEditorModal 닫기 시 unsaved guard 부재 | MergeEditorModal.vue:57 | Peak-End |
| UXF-12 | MergeEditor ours/theirs/base 적용 시 undo stack 없음 | MergeEditorModal.vue:90 | Error Prevention |
| UXF-13 | StatusPanel conflicted resolve 버튼 hover-only(`opacity-0`) | StatusPanel.vue:563 | Selective Attention |
| UXF-14 | git stderr 미변환 + error toast `slice(0,200)`/첫 줄만 | useToast.ts/useBranchActions.ts:199 | Cognitive Load |
| UXF-15 | rebase 진행도("3/10") 미표시 + conflict 안내 링크 비클릭 | InteractiveRebaseModal.vue:197 | Zeigarnik |
| UXF-16 | CommitMessageInput 작성 중 닫기 시 unsaved 경고 부재 | CommitMessageInput.vue | Sunk Cost |
| UXF-17 | vim keys(J/K/L/H) GitKraken 비표준 + 단축키 preset 부재 | useShortcuts.ts:28 | Jakob's Law |
| UXF-18 | OS notification 권한 실패 silent swallow | useNotification.ts:46 | Visibility |
| UXF-19 | BranchPanel row: dblclick=checkout 안내 없음 + keyboard 부재 | BranchPanel.vue:297 | Jakob/A11y |
| UXF-20 | rebase todo reorder: keyboard(move up/down) 부재 | InteractiveRebaseModal.vue:112 | Accessibility |
| UXF-21 | "Stage Changes to Commit" stageAll→commit 2단계 pending 단일 표시 안 됨 | CommitMessageInput.vue:166 | Doherty |
| UXF-22 | Clone modal 내부 parent folder Browse 버튼 부재 | CloneRepoModal.vue:184 | Fitts' Law |
| UXF-23 | Clone URL 재입력 시 folderName stale | CloneRepoModal.vue:49 | Postel's Law |
| UXF-24 | Launchpad snooze menu `<li @click>` — menuitem/Esc/Arrow 부재 | launchpad.vue:376 | Accessibility |
| UXF-25 | conflict/rebase abort 버튼에 위험 경고(danger confirm) 부재 | InteractiveRebaseModal.vue:39 | Loss Aversion |

### LOW (UXF-26~35)
| ID | 마찰점 | 파일:라인 | UX Law |
| --- | --- | --- | --- |
| UXF-26 | Context menu destructive 항목 빨간 텍스트만 — 아이콘 부재 | ContextMenu.vue:115 | Von Restorff |
| UXF-27 | StatusPanel 기본 flat list — 30+ 파일 시 tree 자동 전환 없음 | StatusPanel.vue:47 | Miller's Law |
| UXF-28 | Launchpad PR 테이블 `scope="col"`/caption 부재 | launchpad.vue:277 | Accessibility |
| UXF-29 | Launchpad pin/snooze 버튼 `aria-label` 부재 | launchpad.vue:316 | Accessibility |
| UXF-30 | Launchpad empty state 원인 불명 + CTA 부재 | launchpad.vue:528 | Goal-Gradient |
| UXF-31 | pre-commit hook 실패 패널 hook 종류 미구분 | CommitMessageInput.vue:335 | Mental Model |
| UXF-32 | CloneRepoModal URL 실시간 validation 부재 | CloneRepoModal.vue | Constraint |
| UXF-33 | focusMode(헤더 더블클릭 maximize) affordance 부재 | index.vue:82 | Affordance |
| UXF-34 | 버튼 텍스트/close 패턴/section header UI 일관성 불균등 | components/*.vue | Consistency |
| UXF-35 | 파일 discard 후 undo UI 부재 | StatusPanel.vue | User Control |

---

## Round 2 — 미탐색 플로우 (Codex 35 + Claude 6, UXF-R2-xx)

> R3 재검증 반영: 6건 REJECTED(이미 구현/수정됨), 9건 severity MED로 강등. R2 Codex의 "전부 certain" 표기는 과신 — parent spot-check 4건 중 MT-1은 의도적 설계로 확인.

### Settings / Repositories
| ID | 마찰점 | 파일:라인 | severity | UX Law |
| --- | --- | --- | --- | --- |
| R2-S1 | 설정 즉시 localStorage 저장되나 저장됨/되돌리기 피드백 없음 | SettingsGeneral.vue:27 / useUserSettings.ts:262 | MED | Visibility/Reversibility |
| R2-S2 | settings 좌측 nav 검색/필터 입력 없음 (카테고리 다수) | settings.vue:195 | MED | Findability |
| R2-S3 | Plugin settings nav가 futureRelease로 차단 → 컴포넌트 도달 불가 | settings.vue:123 | LOW | Affordance |
| R2-R1 | `removeRepo` API 존재하나 repositories.vue가 제거 플로우 미제공 | api/git.ts:49 / repositories.vue:16 | MED | Task Completeness |
| R2-R2 | alias set/unset mutation 존재하나 페이지는 표시용만 | useRepoAliases.ts:71 | MED | Direct Manipulation |
| R2-R3 | clone 모달이 항상 workspace-id=null로 열림 — 워크스페이스 컨텍스트 유실 | repositories.vue:470 | MED | Context Preservation |

### Stash / Worktree
| ID | 마찰점 | 파일:라인 | severity | UX Law |
| --- | --- | --- | --- | --- |
| R2-ST1 | panel stash `pop`이 confirm 없이 즉시 실행 | useStashPanelActions.ts:56 | MED | Destructive Confirm |
| R2-ST2 | stash apply 에러 catch 후 항상 invalidate → 실패도 갱신처럼 보임 | useStashPanelActions.ts:50 | MED | Truthful Feedback |
| R2-ST3 | apply/pop/drop 버튼에 pending disabled 없음 — double-submit 위험 | StashPanel.vue:157 | MED | Double-Submit |
| R2-ST4 | 신규 stash 폼 collapse가 우클릭으로만 — 명시 버튼 없음 | StashPanel.vue:87 | LOW | Discoverability |
| R2-WT1 | dirty worktree 제거가 차단/확인 없이 가능 (locked만 차단) | WorktreePanel.vue:185 | MED | Data Loss Prevention |
| R2-WT2 | worktree add 폼이 텍스트 입력만, 경로 검증 빈값만 | WorktreePanel.vue:112 | MED | Error Prevention |
| R2-WT3 | worktree remove mutation에 onError toast 없음 | useWorktreePanelActions.ts:54 | MED | Error Visibility |

### Search / Diff
| ID | 마찰점 | 파일:라인 | severity | UX Law |
| --- | --- | --- | --- | --- |
| R2-SE1 | CommitSearchModal keydown 리스너 onUnmounted cleanup 없음 — 누수+닫힌 모달 키 수신 | CommitSearchModal.vue:117 | MED | Lifecycle |
| R2-SE2 | 검색 결과 0건일 때 ArrowDown이 selectedIdx를 -1로 만듦 | CommitSearchModal.vue:102 | MED | Keyboard Predictability |
| R2-SE3 | CommandPalette 결과 없음 상태가 쿼리 echo/폴백 액션 없음 | CommandPalette.vue:187 | LOW | Recoverability |
| R2-D1 | FullscreenDiffView가 Alt+↑/↓ 단축키 표시하나 핸들러는 Escape만 | FullscreenDiffView.vue:236 | MED | Shortcut Truthfulness |
| R2-D2 | DiffViewer가 hunk nav만 expose, hunk stage/unstage 액션 없음 | DiffViewer.vue:60 | MED | Task Locality |
| R2-D3 | 빈 파일/binary를 같은 메시지로 통합 표시 | FullscreenDiffView.vue:290 | LOW | Diagnostic Clarity |
| R2-D4 | DiffViewer 큰 파일(>5MB) 성능 경고/스피너 없음 | DiffViewer.vue | MED | Perception of Perf |

### First-run / Theme / Tab / Toast / Resize
| ID | 마찰점 | 파일:라인 | severity | UX Law |
| --- | --- | --- | --- | --- |
| R2-FR1 | first-run modal X 닫기가 완료 미표시 → 재진입 시 다시 뜸 | useFirstRunWizard.ts:45 | MED | Dismiss Persistence |
| R2-FR2 | 테마 단계에 System 옵션 없음 (light/dark만) | FirstRunWizard.vue:77 | MED | Choice Completeness |
| R2-FR3 | quickstart 액션이 repo 추가 완료 전 wizard.complete() 호출 | FirstRunWizard.vue:35 | MED | Progress Accuracy |
| R2-TH1 | useTheme localStorage.setItem try/catch 없음 | useTheme.ts:22 | MED | Resilient Saving |
| R2-TH2 | theme 상태가 dark/light만, system 모드 미지원 | useTheme.ts:20 | MED | Preference Fidelity |
| R2-TH3 | OS 테마 변경 listener cleanup 없는 영구 리스너 | useTheme.ts:62 | LOW | Lifecycle |
| R2-MT1 | 워크스페이스 전환 시 모든 탭 초기화 | stores/repos.ts:68 | User Decision | 의도적 설계(주석 "다른 컨텍스트 진입") — 보존 옵션 검토만 |
| R2-MT2 | 탭 overflow 카운트가 총 탭 수 기반, 가시성 기반 아님 | RepoTabBar.vue:110 | LOW | Truthful Indicators |
| R2-MT3 | 활성 탭 닫을 때 그룹 우선 아닌 전역 인접 탭 이동 | stores/repos.ts:98 | LOW | Spatial Continuity |
| R2-TO1 | toast 목록 무제한 스택 렌더링 — cap 없음 | useToast.ts:76 | MED | Interruption Control |
| R2-TO2 | toast dedup key가 `kind:title`만 — 다른 메시지도 합쳐짐 | useToast.ts:33 | MED | Diagnostic Integrity |
| R2-TO3 | aria-live polite 컨테이너 안에 role=alert 혼재 | ToastContainer.vue:56 | LOW | Assistive Consistency |
| R2-WR1 | settings 레이아웃 고정 w-52, 반응형 없음 | settings.vue:190 | MED | Responsive Access |
| R2-WR2 | repositories header/toolbar 단일 flex 행, 줄바꿈 없음 | repositories.vue:146 | MED | Responsive Layout |
| R2-WR3 | WorktreePanel 좁은 너비 적응 없음 | WorktreePanel.vue:95 | LOW | Responsive Forms |
| R2-GH1 | SettingsGitHooks repo 미선택 시 경고만, 이동 버튼 없음 | SettingsGitHooks.vue:88 | LOW | Error Prevention |
| R2-WT4 | worktree add branch 입력 선택사항 미표시 | WorktreePanel.vue:117 | LOW | Mental Model |
| R2-DV1 | FullscreenDiffView binary 메시지가 "File 탭" 유도 없음 | FullscreenDiffView.vue:292 | LOW | Discoverability |

### R2 REJECTED (R3 재검증 — 이미 구현/수정됨)
focus ring 가시성(main.css:200 box-shadow), AI confirm i18n(`t('confirm.aiSendMessage')`), drag handle keyboard(role=separator+tabindex), annotated tag 생성 플로우, closed PR reopen(reopenMut), reflog/undo(toolbar Undo/Redo + ReflogModal). + Claude R2 11건 중 다수가 이미 구현 확인(CommandPalette 0건 피드백, repos 빈/로딩 구분, RepoTabBar overflow, toast dedup, FirstRunWizard 3-step).

---

## Round 3 — 잔여 영역 (26건, A-1~A-26)

| ID | 마찰점 | 파일:라인 | severity | UX Law |
| --- | --- | --- | --- | --- |
| A-2 | PrDetailModal에 PR head 브랜치 checkout 액션 부재 | PrDetailModal.vue:436 | MED | User Control |
| A-3 | PrDetailModal CI 상태 미노출 (ciStatus 필드 존재) | api/git.ts:998 | MED | Visibility |
| A-4 | PR 코멘트 Markdown이 `<pre>` 원문 출력 | PrDetailModal.vue:251 | LOW | Match Real World |
| A-5 | IssueDetailModal read-only 상태 미표시 | IssueDetailModal.vue:4 | MED | Visibility |
| A-6 | IssuesPanel 이슈 행 키보드 접근 불가 | IssuesPanel.vue:94 | MED | WCAG 2.1.1 |
| A-7 | IssuesPanel context menu 레이블 영문 하드코딩 | IssuesPanel.vue:51 | LOW | Consistency/i18n |
| A-8 | IssueDetailModal 라벨 색상 단독 의존 (colorblind) | IssueDetailModal.vue:74 | LOW | WCAG 1.4.1 |
| A-9 | FullscreenDiffView blame 행 마우스 전용 클릭 | FullscreenDiffView.vue:332 | MED | WCAG 2.1.1 |
| A-10 | blame commit jump 실패 피드백 없음 | FullscreenDiffView.vue:142 | LOW | Visibility |
| A-11 | TagPanel 태그 대상 커밋(target SHA) 지정 불가 | TagPanel.vue:135 | MED | User Control |
| A-12 | TagPanel 태그 클릭이 주석("commit 점프")과 불일치 | TagPanel.vue:6 | LOW | Consistency |
| A-13 | RemoteManageModal "단일 remote fetch"가 실제 fetch all | RemoteManageModal.vue:7 | MED | Match Real World |
| A-14 | remote URL 긴 경로 wrap/truncate/copy 없음 | RemoteManageModal.vue:124 | LOW | Fitts' Law |
| A-15 | SubmodulePanel context menu 미연결 (구현됐으나) | SubmodulePanel.vue:95 | MED | User Control |
| A-16 | Submodule init/update/sync 즉시 실행, confirm 없음 | SubmodulePanel.vue:70 | MED | Error Prevention |
| A-17 | BisectModal 시작 시 good/bad ref 입력 없음 | BisectModal.vue:38 | MED | Error Prevention |
| A-18 | BisectModal Reset 확인 없음 | BisectModal.vue:150 | MED | Error Prevention |
| A-19 | CommitGraph author/branch 필터 없음 | CommitGraph.vue | MED | User Control |
| A-20 | CommitGraph 레인 색상 단독 의존 (colorblind) | useGraphCanvasRenderer.ts:21 | MED | WCAG 1.4.1 |
| A-21 | 커밋 drag cherry-pick 키보드 대안 없음 | CommitGraph.vue:492 | MED | WCAG 2.5.7 |
| A-22 | branch drop 시 m/r text prompt (UXF-10 재확인) | useBranchDragDrop.ts:106 | MED | Hick's Law |
| A-23 | HelpModal 단축키 표기(⌘/Ctrl/Cmd/⌥) 혼용 | HelpModal.vue:28 | LOW | Consistency |
| A-24 | 알림 권한 거부 시 사용자 안내 없음 | useNotification.ts:25 | MED | Visibility |
| A-25 | confirm-on-modal z-50 단일 계층 — 중첩 z 충돌 | BaseModal.vue:99 | MED | Modal Stacking |
| A-26 | PR/Issue 날짜 절대시간 toggle 없음, 전역 시간포맷 미연동 | IssuesPanel.vue:27 | LOW | Consistency |

> A-1 (IssuesReleasesPanel)은 컴포넌트 명칭 INCONCLUSIVE — 제외.

---

## Round 4 — 최종 잔여 영역 (10건, B4-01~B4-10)

| ID | 마찰점 | 파일:라인 | severity | UX Law |
| --- | --- | --- | --- | --- |
| B4-01 | AI subprocess 취소("중단") 액션 없음 — Retry만 | AiResultModal.vue:93 | MED | User Control |
| B4-02 | LFS prune에 confirm 없음 (untrack만 confirm) | LfsPanel.vue:163 | LOW | Error Prevention |
| B4-03 | MiniPrList 행 키보드 접근 불가 | MiniPrList.vue:38 | LOW | Accessibility |
| B4-04 | Push 드롭다운에 force-with-lease/tags 옵션 미노출 | useToolbarSyncMutations.ts:88 | MED | Recognition |
| B4-05 | Sync 인디케이터 ↑N/↓N 기호만 — diverged 등 명시 상태 없음 | GitKrakenToolbar.vue:408 | LOW | Visibility |
| B4-06 | RepoSwitcherModal keydown 이중 바인딩 — Arrow/Enter 두 번 실행 위험 | RepoSwitcherModal.vue:93 | MED | Error Prevention |
| B4-07 | Branch 생성에 base ref/checkout 옵션 없음 (이름만) | BranchPanel.vue:228 | MED | User Control |
| B4-08 | Graph 무한 스크롤 end-of-history/로딩 상태 표시 없음 | useGraphInfiniteScroll.ts:35 | LOW | Visibility |
| B4-09 | ErrorBoundary 컴포넌트가 App.vue 주요 구역에 미마운트 — toast만 | main.ts:57 | MED | Recoverability |
| B4-10 | 빈/unborn repo 첫 커밋 CTA empty state 없음 | git/graph.rs:59 | MED | Empty State |

> 클린 영역(신규 0): Sparse Checkout (활성 repo 가드/에러/로딩/confirm 모두 구현), Profile/Identity (global config 덮어쓰기 경고 존재).

---

## Round 5: Adversarial 검증 + 최종 micro-sweep + 수렴 판정 (2026-05-21)

### Part A: R3+R4 Adversarial Verdicts

| ID | Title | Verdict | Evidence |
|----|-------|---------|----------|
| A-1 | IssuesReleasesPanel finding | REJECTED | IssuesPanel.vue / ReleasesPanel.vue 별개 컴포넌트로 구현됨 |
| A-2 | PrDetailModal head 브랜치 checkout 부재 | CONFIRMED | PrDetailModal.vue:214 headBranch 표시만, checkout 버튼 없음 |
| A-3 | PrDetailModal CI 상태 미노출 | CONFIRMED | github.rs:477 ci_status: None, UI 표시 없음 |
| A-4 | PR 코멘트 Markdown 원문 출력 | CONFIRMED | PrDetailModal.vue:251 pre 태그로 bodyMd 원문 노출 |
| A-5 | IssueDetailModal read-only 미표시 | DOWNGRADED | IssueDetailModal.vue:86 v1.x 안내 텍스트 있음 — 부분 구현 |
| A-6 | IssuesPanel 이슈 행 키보드 불가 | CONFIRMED | IssuesPanel.vue:98 @click만, keyboard 속성 없음 |
| A-7 | IssuesPanel context menu 영문 하드코딩 | CONFIRMED | IssuesPanel.vue:51-62 label: 영문 리터럴 |
| A-8 | IssueDetailModal 라벨 색상 단독 의존 | REJECTED | IssueDetailModal.vue:74-76 텍스트 라벨 l.name 존재 |
| A-9 | FullscreenDiffView blame 행 마우스 전용 | CONFIRMED | FullscreenDiffView.vue:336 @click만, tabindex/role 없음 |
| A-10 | blame commit jump 실패 피드백 없음 | CONFIRMED | FullscreenDiffView.vue:142 catch/toast 없음 |
| A-11 | TagPanel 태그 대상 커밋 지정 불가 | CONFIRMED | tag_commands.rs:28 HEAD만, SHA 입력 없음 |
| A-12 | TagPanel 태그 클릭과 주석 불일치 | CONFIRMED | TagPanel.vue:6 주석 commit 점프, :162 실제 expand toggle |
| A-13 | RemoteManageModal 단일 remote fetch = fetchAll | REJECTED | RemoteManageModal.vue:7 전체 명시 라벨 있음 |
| A-14 | remote URL truncate/copy 없음 | CONFIRMED | RemoteManageModal.vue:124 font-mono span만, copy 없음 |
| A-15 | SubmodulePanel context menu 미연결 | CONFIRMED | SubmodulePanel.vue:95 contextmenu 없음 (MiniSubmoduleList만) |
| A-16 | Submodule init/update/sync confirm 없음 | CONFIRMED | SubmodulePanel.vue:70/78/86 @click 즉시 실행 |
| A-17 | BisectModal good/bad ref 입력 없음 | CONFIRMED | BisectModal.vue:38 bisectStart() 직접 호출 |
| A-18 | BisectModal Reset 확인 없음 | CONFIRMED | BisectModal.vue:150 @click 즉시 실행 |
| A-19 | CommitGraph author/branch 필터 없음 | CONFIRMED | filter input/handler 없음 |
| A-20 | CommitGraph 레인 색상 단독 의존 | DOWNGRADED | useGraphCanvasRenderer.ts:147 type별 시각 구분 보조 있음 |
| A-21 | drag cherry-pick 키보드 대안 없음 | DOWNGRADED | CommitDiffPanel.vue:119 + useCommitActions.ts:175 context menu 경로 있음 |
| A-22 | branch drop m/r text prompt | CONFIRMED | useBranchDragDrop.ts:107 actionTitle/actionMessage 기반 |
| A-23 | HelpModal 단축키 표기 혼용 | CONFIRMED | HelpModal.vue:28/69/70 ⌘P/Ctrl+P, ⌥O/Alt+O, ⌃⌘F 혼재 |
| A-24 | 알림 권한 거부 시 안내 없음 | CONFIRMED | useNotification.ts:28/45 catch 블록 silent fail |
| A-25 | confirm z-50 단일 계층 | DOWNGRADED | useConfirm.ts:17 단일 Promise queue — 중복 완화, modal stacking 잔존 |
| A-26 | PR/Issue 날짜 절대/상대 toggle 없음 | DOWNGRADED | formatDateLocalized 일부 연동, 절대/상대 toggle 없음 |
| B4-01 | AI subprocess 취소 액션 없음 | CONFIRMED | AiResultModal.vue:25 close/retry만, cancel 없음 |
| B4-02 | LFS prune confirm 없음 | CONFIRMED | LfsPanel.vue:163 @click 즉시 실행 |
| B4-03 | MiniPrList 행 키보드 접근 불가 | CONFIRMED | MiniPrList.vue:43 @click만 |
| B4-04 | Push 드롭다운 force/tags 옵션 미노출 | CONFIRMED | useToolbarSyncMutations.ts:88 기본 push만 |
| B4-05 | Sync 인디케이터 기호 전용 | CONFIRMED | GitKrakenToolbar.vue:408-410 위아래 화살표 기호만 |
| B4-06 | RepoSwitcherModal keydown 이중 바인딩 | CONFIRMED | RepoSwitcherModal.vue:93/100 이중 @keydown |
| B4-07 | Branch 생성 base ref/checkout 옵션 없음 | CONFIRMED | BranchPanel.vue:228/236 이름 입력만 |
| B4-08 | Graph end-of-history 표시 없음 | CONFIRMED | CommitGraph.vue:259 loading만, end UI 없음 |
| B4-09 | ErrorBoundary 주요 구역 미마운트 | CONFIRMED | App.vue ErrorBoundary 미사용 |
| B4-10 | 빈/unborn repo 첫 커밋 CTA 없음 | CONFIRMED | CommitGraph.vue:329 skeleton만, empty CTA 없음 |

**Adversarial 요약:**
- REJECTED: A-1, A-8, A-13 (3건 — 이미 구현, 제거)
- DOWNGRADED: A-5, A-20, A-21, A-25, A-26 (5건)
- CONFIRMED: 나머지 28건

---

### Part B: Round 5 신규 Finding (micro-sweep)

**[R5-001]** 주요 작업면 단일 선택 모델 — batch 작업 발견성 낮음
- verification_command: rg selectedPath/selectedSha/bulk apps/desktop/src
- verification_result: useStatusSelection.ts:4 단일 토글, plan/12-ui-improvement-plan.md:226 graph multi-select 계획만
- verdict: CONFIRMED
- confidence: likely
- ux_law: Fitts / User Control
- severity: MEDIUM

**[R5-002]** Clipboard copy 피드백 문구 불일치 (toast.copied vs toast.copyPath vs 하드코딩)
- verification_command: rg clipboard.writeText|toast.copied apps/desktop/src
- verification_result: IssuesPanel.vue:40 toast.copied, ReleasesPanel.vue:41 toast.copyPath, useCommitActions.ts:39 SHA 복사 하드코딩
- verdict: CONFIRMED
- confidence: certain
- ux_law: Consistency / Nielsen
- severity: LOW

**[R5-003]** panel expand/collapse 순간 점프 — BaseModal Transition 정책 미적용
- verification_command: rg Transition/<details/v-if.*collapsed apps/desktop/src
- verification_result: repositories.vue:364 details 태그, StashPanel.vue:98 v-if=!collapsedNew 즉시 전환
- verdict: CONFIRMED
- confidence: likely
- ux_law: Doherty / Aesthetic-Usability
- severity: LOW

**[R5-004]** Loading skeleton 불균일 — 일부 모달 텍스트 loading 잔존
- verification_command: rg SkeletonBlock|common.loading apps/desktop/src
- verification_result: RemoteManageModal.vue:86-87 텍스트만, CompareModal.vue:183-186 t(common.loading)
- verdict: CONFIRMED
- confidence: certain
- ux_law: Doherty / Perception of Performance
- severity: LOW

**[R5-005]** 앱 종료 시 진행 작업 guard / window title 동적 갱신 없음
- verification_command: rg beforeunload|onCloseRequested|setTitle|registerOperation apps/desktop/src
- verification_result: useAppWindowHooks.ts close guard 없음, useLongRunningProgress.ts:80 registerOperation 있으나 window close event 미연결
- verdict: CONFIRMED
- confidence: likely
- ux_law: Error Prevention / Visibility of System Status
- severity: MEDIUM

**[R5-006]** BranchPanel 긴 branch 이름 leaf-only 표시 — hover에만 full path
- verification_command: rg split.*pop/:title apps/desktop/src/components/BranchPanel.vue
- verification_result: BranchPanel.vue:307 b.name.split(/).pop(), :298 :title hover만
- verdict: CONFIRMED
- confidence: certain
- ux_law: Recognition over Recall
- severity: LOW

---

### Part C: 수렴 판정

신규 발견: **6건**

**미수렴, 추가 라운드 필요**

---

### Round 1~5 누적 통계

| 라운드 | 신규 finding |
|--------|-------------|
| R1 | 37건 |
| R2 | 27건 |
| R3 | 26건 |
| R4 | 10건 |
| R5 신규 | 6건 |
| **누적** | **106건** |

R5 adversarial 검증: REJECTED 3건 제거, DOWNGRADED 5건, CONFIRMED 28건 → 유효 finding **~98건**

---

## Round 6 — 잔여 exhaustive sweep (3건)

| ID | 마찰점 | 파일:라인 | severity | UX Law |
| --- | --- | --- | --- | --- |
| R6-001 | Commit CTA disabled 시 이유(메시지 없음/repo 없음/pending) 미표시 — title은 단축키만 | CommitMessageInput.vue:299 | LOW | Visibility |
| R6-002 | 설정 섹션별/전체 "기본값 복원" 없음 (theme-only reset만 존재) | useUserSettings.ts:110 / SettingsGeneral.vue | LOW | User Control |
| R6-003 | CommitSearchModal 날짜가 `toLocaleString()` 직접 — 전역 `formatDateLocalized` helper 우회 | CommitSearchModal.vue:174 | LOW | Consistency |

R6 adversarial: R5-001 강등(MED→LOW), R5-003·R5-004 REJECTED(R2-ST4 중복 / polish 수준). CLEAN: drag-drop drop-zone highlight, 단축키 충돌 helper, 스크롤 위치 보존, hover/focus 일관성.

## Round 7 — 수렴 확정 (신규 0건)

R6-001~003 전부 CONFIRMED. 신규 finding **0건**. → **CONVERGED**.

---

## 수렴 완료 — 최종 통합 backlog

### 수렴 추이

```
R1 35 → R2 37 → R3 26 → R4 10 → R5 6 → R6 3 → R7 0   ✅ CONVERGED
```

7라운드(Codex 페어 6회 + Claude Explore 2회) 진행. 누적 raw ~116건 → adversarial 재검증으로 REJECTED ~13건·DOWNGRADED ~14건 제거/조정 → **유효 ~100건**. Codex의 라운드별 self-recalibration이 R2의 과신("전부 certain HIGH")을 정정.

### severity 분포 (재보정 후)

| severity | 건수 | 비고 |
| --- | --- | --- |
| HIGH | 2 | UXF-01(merge marker stage 미검증), UXF-05(IPC timeout 상태 불일치) |
| MED | ~45 | 키보드 a11y / 파괴적 confirm / 피드백 / 옵션 노출 |
| LOW | ~53 | i18n·일관성·cosmetic·edge |

### /goal 개선용 테마 클러스터 (우선순위순)

> 개별 100건 대신 테마로 묶어 `/goal` 진입 단위로 제시. 각 클러스터는 독립 sprint 가능.

**C1 — 파괴적 액션 confirm 부재 [HIGH 가치]**
UXF-01(merge marker 잔재 stage), R2-ST1(stash pop), R2-WT1(dirty worktree remove), A-16(submodule update/sync), A-18(bisect reset), B4-02(LFS prune), UXF-25(rebase/conflict abort danger confirm). → 데이터 손실/되돌리기 어려운 작업에 일괄 confirm 게이트.

**C2 — 비동기 작업 상태 일관성 [HIGH 가치]**
UXF-05(IPC timeout vs native git), UXF-06(invalidate 범위), UXF-07(clone progress), UXF-08(banner raw label), UXF-21(stage+commit 2단계 pending), B4-09(ErrorBoundary 미마운트), R5-005(앱 종료 시 진행작업 guard). → 작업 진행/완료/실패 표시를 실제 상태와 동기화.

**C3 — 키보드 접근성 (rows) [MED]**
UXF-03/04(CommitGraph/StatusPanel), UXF-19(BranchPanel), A-6(IssuesPanel), A-9(blame), B4-03(MiniPrList), UXF-20/A-21(rebase reorder/cherry-pick keyboard), UXF-24(launchpad snooze menu). → 리스트 행 공통 `role`+roving `tabindex`+Enter/Space 패턴.

**C4 — 에러 메시지 가독성 [MED]**
UXF-14(stderr 미변환·toast 잘림), UXF-31(hook 종류 미구분), R2-WT3(worktree remove onError), A-10(blame jump 실패), A-24(notification 권한 거부 안내), UXF-18(notification silent). → humanize 매핑 + "자세히 보기" drawer + 실패 toast 일관화.

**C5 — 멀티스텝 플로우 가시성 [MED]**
UXF-15(rebase 진행도+conflict 링크), UXF-02(rebase continue conflict 게이트), R2-D1(diff Alt 단축키 미구현). → rebase/merge 단계 N/M 진행도 + 클릭 가능한 conflict 점프.

**C6 — unsaved/작업 보존 [MED]**
UXF-11(MergeEditor 닫기), UXF-12(MergeEditor undo), UXF-16(CommitMessage 닫기), R2-FR3(wizard 조기 complete). → 모달 dirty guard 공통화.

**C7 — 옵션 노출 (Recognition over Recall) [MED]**
B4-04(push force/tags), B4-07(branch base ref/checkout), A-11(tag target SHA), A-17(bisect good/bad ref), A-2(PR checkout), A-3(PR CI 상태), A-19(graph author/branch 필터), UXF-10/A-22(branch drag action sheet). → 텍스트 prompt·숨은 옵션을 명시 UI로.

**C8 — Settings UX [MED]**
R2-S1(저장 피드백), R2-S2(nav 검색), R6-002(reset), R2-WR1(반응형), R2-R1(repo remove), R2-R2(alias 인라인), R2-GH1(githooks repo 이동). → settings shell 공통 개선.

**C9 — i18n·표기 일관성 [LOW]**
A-7(영문 하드코딩), A-23(단축키 표기 혼용), R6-003·A-26(날짜 포맷 helper 우회), R5-002(copy 문구 분산), UXF-34(버튼/close 일관성).

**C10 — colorblind·empty state·기타 [LOW]**
A-8/A-20(라벨·lane 색상 단독), UXF-30(launchpad empty CTA), B4-10(unborn repo CTA), UXF-27(status flat→tree), 그 외 LOW.

### REJECTED (유효 목록 제외 — adversarial 정정)

focus ring 가시성, AI confirm i18n, drag handle keyboard, annotated tag 생성, PR reopen, reflog/undo 노출(이미 구현), A-1(IssuesReleasesPanel 명칭), A-8 일부, A-13(remote fetch 라벨), R5-003/004, MT-1(워크스페이스 탭 초기화 = 의도적 설계, User Decision).

### 결론

- **Goal 달성**: 7라운드 반복 탐색 결과 R7에서 신규 발견 0건 — 수렴 도달.
- **개선 진입 준비 완료**: 유효 ~100건이 file:line + 권장 fix + UX law + severity로 정리됨. C1~C10 클러스터 단위로 `/goal` 즉시 진입 가능.
- **권장 진입 순서**: C1(파괴적 confirm) → C2(비동기 상태) → C3(키보드 a11y) → C4(에러 메시지) → 이후 MED/LOW.

---

## 구현 진행 상황 (2026-05-21 — `/goal` 개선 sprint, FINAL)

> backlog 를 클러스터 단위로 구현. commit `b20e2bf`~`dd4c273` (22 commit). 각 단계 typecheck + lint + vitest 912 PASS + (Rust 변경 시) cargo test PASS.

| 클러스터 | 상태 | 해소 항목 |
| --- | --- | --- |
| **C1** 파괴적 액션 confirm | ✅ 완료 | UXF-01·R2-ST1·R2-ST2·R2-WT1·R2-WT3·A-16·A-18·B4-02·UXF-25 |
| **C2** 비동기 작업 상태 | ✅ 완료 | UXF-05·UXF-06·UXF-08·UXF-21·B4-09·R5-005 |
| **C3** 키보드 접근성 | ✅ 완료 | UXF-03·04·13·19·20·24, A-6·A-9·A-21, B4-03 |
| **C4** 에러 메시지 | ✅ 완료 | UXF-14·UXF-18·A-24·A-10 / UXF-31·R2-WT3 기구현 |
| **C5** 멀티스텝 가시성 | ✅ 완료 | UXF-15·R2-D1 / UXF-02 REJECTED |
| **C6** unsaved 보존 | ✅ 완료 | UXF-11·UXF-12 / UXF-16·R2-FR3 해당없음 |
| **C7** 옵션 노출 | ✅ 완료 | A-3·B4-07·UXF-10·B4-04·A-11·A-17·A-2 / A-19 = 기존 search 가 커버 (아래) |
| **C8** Settings UX | ✅ 완료 | R2-S1·R2-S2·R6-002·R2-R1·R2-R2·R2-WR1·R2-GH1 |
| **C9** i18n·일관성 | ✅ 완료 | R6-003·A-7·A-23 / R5-002·UXF-34 = cosmetic catch-all |
| **C10** colorblind·empty | ✅ 완료 | UXF-30·B4-10·A-20 / A-8 기구현 / UXF-27 = 사용자 결정 (아래) |

### 완료 (HIGH 2 + MED 전체 + LOW 다수, ~86건 / 25 commit)

C1~C10 전 클러스터 actionable 항목 해소. HIGH 2건(UXF-01 merge marker stage 차단, UXF-05 IPC timeout 안내) 포함.
신규 인프라: `useAppExitGuard`, `chooseDialog`+`ChooseDialog.vue`, `progress`/`errorBoundary`/`notification`/`graph`/`bisect` i18n 네임스페이스.
검증: 매 commit typecheck + lint + vitest 912 PASS, Rust 변경(A-17) cargo test PASS.

### 잔여 (2건 — 구현 불요로 판정)

| 항목 | 판정 |
| --- | --- |
| A-19 graph author/branch 필터 | **부분 REFUTED** — `useGraphSearch.ts:48,50` 가 이미 `authorName` + `refs`(브랜치) 부분일치 매칭. 그래프 검색바가 author/branch 필터를 실질 제공 (match highlight). 별도 "필터 칩 UI" 는 LOW 수준 nicety — 선택적. |
| UXF-27 status flat→tree 자동 전환 | **사용자 결정 영역** — 30+ 파일 시 자동 view 전환은 사용자가 명시 선택한 flat 선호를 침범. 자동 구현 보류, 사용자 결정 필요 (현재 Path/Tree 수동 토글 유지). |

> R5-002(copy 문구 분산)·UXF-34(버튼·close 일관성) 는 개별 finding 이 아닌 cosmetic catch-all — 점진 정리 대상.

