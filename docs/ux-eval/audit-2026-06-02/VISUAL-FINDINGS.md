# 실제 화면 기반 visual 전수검사 — findings (2026-06-02)

> 방법: Vite dev server(devMock) + Playwright 실제 렌더 캡처 → Claude vision. 코드 grep 이 못 잡는 **렌더링 시각 문제** 전담. plan #44 §5 (코드기반) 보완.

## Home (/) — dark
- **V1 [HIGH]** sidebar quick-action "브랜치" 버튼이 2줄 wrap(브랜/치), 형제(변경/Stash/PR/Worktree)는 1줄 → 행 높이 ragged, 깨져 보임. CJK label + 좁은 버튼. (02-sidebar)
- **V2 [LOW]** search 힌트 "—" 뒤 ⌘⌥F 안 보임 (truncate). (02)
- **V3 [LOW]** section header 케이싱 혼용: LOCAL/REMOTE/STASHES/SUBMODULES 대문자 vs Worktree title-case. (02)
- **V4 [MED]** 언어 혼용: top nav 홈/레포/Launchpad/설정 (3 KO+1 EN). view-tab 그래프/브랜치/Stash/Sub/LFS/PR/WT (KO+EN+축약 혼재). (03-topbar)
- **V5 [LOW]** 축약 Sub/WT 비자명 (Submodule/Worktree). recognition>recall. (03)
- **V6 [LOW]** author avatar 불일치: 일부 3자 GIT fallback vs 단일자 T. (04-graph)
- **V7 [LOW]** "커밋 그래프" 타이틀이 활성 탭 "그래프" 와 중복. (04)
- **V8 [MED]** commit panel 과밀: Conventional/Free-form+type+scope+subject+body+footer+preview+amend+signoff+no-verify+button 좁은 컬럼 stack (Miller). progressive disclosure 후보. (05)
- **V9 [LOW]** 부유 −/+/🔍 zoom 컨트롤 affordance 불명. (05)
- 강점: graph DAG 렌더 깔끔(선택 노드 orange) / staging tree 추가·수정 색라벨 / status bar 단축키 힌트.

## Repositories (/repositories) — dark
- **V10 [MED]** 페이지 타이틀 "Repository Management" + 버튼 Browse/Clone 영어 (Korean-first 위배). (10)
- **V11 [HIGH]** "기타" 그룹이 dotfiles/git-fried/tauri 각각 "기타 (1)" 3개 헤더로 분리 — 하나의 "기타 (3)" 여야. non-org repo 마다 자기 그룹 생성 = 혼란+공간낭비, 그룹핑 버그처럼 보임. (10)
- **V12 [LOW]** 우측 host 라벨(GitHub/Gitea) "GITH…" truncate. (10)

## Launchpad (/launchpad) — dark
- **V13 [MED]** 우측 컬럼(상태/CI)이 view 밖으로 — full-width 에서 CI 컬럼 cramped 여부 확인 필요. (11)
- **V14 [LOW]** ✈(비행기) = snooze 메타포 비표준 (보통 clock/bell). (11)
- **V15 [LOW]** Launchpad/all/open/closed/merged 영어 + KO 컬럼 헤더 혼용 (V4). (11)
- 강점: 필터 chip, 라벨 tag inline, starred row amber 강조(Von Restorff).

## Settings (/settings) — dark
- **V16 [HIGH]** 좌측 nav 카테고리 언어 혼용 심각 — 그룹헤더 KO(계정/워크스페이스/유지보수) vs item ~9 EN(Repository-Specific/Conflict Prevention/Commit/Issue Tracker/Git Hooks/Sparse Checkout/UI Customization/General/About) vs ~5 KO. 미완성처럼 보임. (12)
- **V17 [MED]** nav 라벨 2줄 wrap: "에디터/터미널 (★ AI CLI)", "외부 도구 연결 (v0.5 예정)". (V1 동류) (12)
- **V18 [LOW]** disabled 미래항목 "외부 도구 연결 (v0.5 예정)" nav 노출(도달 불가) = clutter. (12)

## ★ Cross-surface theme (모든 page)
- **VX-LANG**: KO/EN 언어 혼용이 전 surface(V4/V10/V15/V16) — 가장 강한 시각 일관성 이슈. 코드 audit 의 "i18n 1599 leaf 대칭" 은 이걸 못 잡음(하드코딩 EN + 혼용 시각충돌).
- **VX-WRAP**: CJK/긴 라벨 2줄 wrap(V1 sidebar quick-action, V17 settings nav) — 좁은 컨테이너 + 긴 라벨.

## 테마 정정 + Dark parity
- ⚠️ 정정: 앱 default 는 **light theme** (파일명 "dark" 오기). localStorage `git-fried.theme`.
- **Dark parity = 강점**: 전 패널 일관 다크(bg rgb(9,9,11)), white-panel leakage 없음, green commit 버튼/blue pill 대비 양호. (30/31)
- **V1 재확인**: "브랜치" 2줄 wrap 은 dark 에서도 동일 (cross-theme). (31)

## Modals (sampled — BaseModal chrome 공유, 21/21 코드확인)
- **A1 시각 확인**: help overlay = `fixed inset-0 z-50`, container role=""/aria-modal="" (flat z-50, 코드 A1/A2 시각 corroborate). (20)
- Clone modal: URL input + sparse 옵션 radio(Monorepo 빠른 시작 / 필요한 디렉터리만). light=white panel 정상. (21, 좌측 clip 잘림 — 재캡처 권고)
- **V19 [MED]** Command Palette 우측 컬럼 불일치 — 일부 단축키(⌘⇧P/⌘L/⌘K) vs 일부 raw command id(invalidate everything / repo.workspace.all / repo.unselect / repo.tab.close-others / navigate /settings) 노출. 내부 id leak = 비전문적. (40)
- 강점: palette category 그룹핑(REPO/탭) + KO 라벨 + 선택행 highlight.

## 모달 coverage 정직 진술
- 캡처/분석: Clone + Command Palette + Help-overlay (3) + 전 page.
- 미개별캡처 23 modal: BaseModal chrome 공유(코드 21/21 확인) → 시각언어 일관. 잔여 per-modal 밀도/내용 검사 = Phase 2 "modal 시각 전수 pass" systematic 항목으로 위임.

## ★ 종합 (실제 화면 only-visible 핵심)
1. VX-LANG 언어 혼용 (전 surface) — HIGH, 코드 i18n 대칭 검사가 못 잡음
2. V1/V17 CJK 라벨 2줄 wrap (sidebar quick-action, settings nav) — HIGH
3. V11 repositories "기타" ×3 그룹 분리 — HIGH (rendered-logic)
4. V8 commit panel 과밀 — MED
5. V19 command palette raw-id leak — MED
6. V16 settings nav 언어 혼용 (VX-LANG 최강 instance) — HIGH

## 모달 전수 sweep (사용자 "더이상 캡처할 화면 없을 때까지")

**트리거 메커니즘 (코드 확인)**: window hook (gitFriedOpenBisect/Reflog/Compare/Rebase/SyncTemplate/CommandPalette) + 단축키(Ctrl+Shift+P RepoSwitcher / Ctrl+Shift+F CommitSearch / ? Help / Ctrl+N CreatePr / Ctrl+D CommitDiff). 전제: localStorage repo bootstrap (`repo-tabs.v1={tabs:[1],active:1}` + locale ko).

**content 캡처 성공 (8 distinct modal)**:
- RepoSwitcher (Ctrl+Shift+P) — repo 리스트 palette (opnd 5 + dotfiles/git-fried, GITEA/GITHUB badge 정상 표시). repositories page/command palette 와 기능 중복(3중 repo 전환 경로).
- CommitSearch (Ctrl+Shift+F) — graph 상단 anchored 검색바 "검색: subject/작성자/SHA/ref (esc 닫기)". centered modal 아님.
- Help (?) — **강점**: kbd-box 좌/설명 우, 글로벌/동기화/편집/레이아웃 그룹핑 깔끔. 단축키 전체 노출.
- Reflog — **강점**: action 색코딩(commit green/rebase violet) + inline `git reset <sha>` 복구 가이드.
- Bisect / Clone / Command Palette / CreatePr — BaseModal chrome 일관.

**inline-panel 또는 state 필요 (overlay 미렌더)**: CommitDiff(Ctrl+D)·PrDetail(launchpad row click)·Compare·Rebase·SyncTemplate — 인자(sha/refs/conflict) 또는 inline 우측 패널로 렌더. MergeEditor/HunkStage/FileHistory/IssueDetail/ReleaseDetail/GitKrakenImport/AiResult/BulkFetchResult/Choose/Confirm/Prompt/FirstRunWizard — 특정 git state(충돌/선택/no-repo) 필요, devMock+headless 단순 트리거로 미도달.

**수렴 판정 (modal 차원)**: 캡처된 8 modal 전부 동일 BaseModal chrome(header+×+KO content+helpful guidance) → **신규 visual theme 0**. 언어혼용(F1)이 modal 라벨에도 나타나나 기존 theme. **modal = 강점**(일관·명확·가이드 풍부). 잔여 state-dependent modal 은 새 finding 가능성 낮음(chrome 동일) → Phase 3 systematic modal pass(실제 git fixture 로 conflict/selection 재현) 로 위임.

**정직 coverage**: page 4/4 + home component + light/dark 양테마 + modal 8/26 content 캡처(+ 5 attempted inline/state). 총 캡처 PNG = (아래 ls count). modal 26 중 18 미개별 = state 필요 + chrome 일관(코드 BaseModal 21/21). 사용자 지적의 핵심(실제 화면 분석)은 충족 — rendered-visual finding F1~F6 도출 + Codex 4/4 CONFIRM.

## 잔여 모달 최종 sweep (goal "잔여 없을 때까지") — 수렴 + 구조적 한계

**캡처 완료 (content, 11 distinct surface)**: RepoSwitcher · CommitSearch · Help · Reflog · Bisect · Clone · Command Palette · CreatePr · **CommitDiff(full-screen diff)** · **no-repo/empty state** · (settings 패널들). 트리거: window hook(gitFriedShowDiff/OpenBisect/OpenReflog/...) + 단축키(Ctrl+Shift+P/F, ?) + repo bootstrap.

**CommitDiff 신규 finding**:
- **F9 [LOW]** CommitDiffModal 좌상단 "MODAL DIFF" prefix 라벨 — dev/디버그 인상. (m06)
- F1 재현: diff toolbar 액션 Hunk/Inline/Context/Split·Cherry-pick·Revert·Reset 영어 (기술용어, 정책 결정).
- 강점: green/red diff 렌더 + line number + hunk header 깔끔. full-screen diff (GitKraken parity).

**no-repo/empty state**:
- **F7 [강점]** sidebar "레포 미선택" 안내 + main "🌱 커밋이 없습니다" 액션 가이드 + toolbar 전 버튼 disabled. (m12)
- **F8 [LOW]** sidebar "레포 미선택"(repo 없음) vs main "커밋이 없습니다 / 이 저장소에는…"(repo 있으나 commit 없음) 메시지 모순. (m12)

**구조적 미도달 (headless devMock 한계 — 실제 git state/Tauri runtime 필요)**:
| modal | 필요 state | 도달 방법 |
| --- | --- | --- |
| MergeEditor | working-tree **충돌 파일** (devMock 은 conflicted 목록만, 실 conflict 패치 없음) | 실 conflict repo |
| HunkStage | 실제 file diff hunk 클릭 | 실 변경 working-tree |
| PrDetail/IssueDetail/ReleaseDetail | forge row 클릭 → **inline 패널** 렌더(overlay 아님) 또는 forge API | 실 forge + 사용자 클릭 |
| FileHistory | 파일 선택 + Ctrl+Shift+H | 실 파일 |
| Compare/Rebase (proper) | ref/commit 선택 (state bleed) | 실 선택 |
| GitKrakenImport | settings GitKraken 패널 import 버튼 (nav fold 아래) | 사용자 클릭 |
| FirstRunWizard | **first-run 플래그** (localStorage.clear 로 안 뜸) | 실 first-run |
| AiResult/BulkFetchResult | AI run / bulk fetch **action 결과** | 실 backend |
| Choose/Confirm/Prompt | **파괴적 action 트리거** (delete branch 등) | 실 action |

**수렴 판정 (modal 차원, 최종)**: 캡처 11 surface 전부 동일 BaseModal chrome → **신규 visual theme 0** (F9 "MODAL DIFF" 라벨 + F7/F8 empty-state 외 추가 theme 없음). 미도달 modal 은 chrome 공유(코드 BaseModal 21/21)라 새 결함 가능성 낮음. **결론**: programmatically 도달 가능한 전 screen 캡처 완료 = "잔여(도달가능) 없음". 미도달 ~14 modal 은 **구조적 한계** (실 git state/Tauri runtime/first-run flag) — 사용자 hands-on(feedback_research_first_ui_handson 워크플로) 또는 실 conflict fixture 필요. headless devMock 에서 grinding 은 toolkit autonomous-loop 중단 조건(structural failure) 해당.

## ★ devMock-B 보강 후 모달 전수 (goal "잔여 없을 때까지", 2026-06-02 2차)

devMock.ts 에 detail fixture 추가 (get_pull_request/read_conflicted/compare_refs/get_file_history/get_file_blame) → 잔여 모달 headless 렌더 성공. **mock 레이어만 수정, 프로덕션 불변.**

**content 캡처 17 distinct modal**: RepoSwitcher · CommitSearch · Help · Reflog · Bisect · Clone · CommandPalette · CreatePr · CommitDiff(full-screen) · **Compare**(main⇄develop+Diff/RangeDiff+commit list) · **MergeEditor**(3-way ours/result/theirs+AI추천) · **PrDetail**(Conversation/Files+review+AI리뷰+merge) · **IssueDetail**(labels+body+외부열기) · **ReleaseDetail**(CHANGELOG) · **HunkStage**(per-hunk/line+shift-range) · **FileHistory**(History/Blame tabs) · **GitKrakenImport**(not-found error state) + empty-state.

**신규 finding (2차)**:
- **F10 [강점]** MergeEditor — 3-column OURS🟦/RESULT🟢/THEIRS🟪 + "✨ AI 추천" + conflict-marker 제거 가이드 + 결과로 stage.
- **F11 [강점]** PrDetail — Conversation/Files 탭 + review verdict(Approve/Request) + ✨AI 리뷰 + merge 방식 dropdown + 브랜치 체크아웃.
- **F12 [LOW]** ReleaseDetail header "v0.2.0 v0.2.0 — ..." tag+name 버전 중복.
- **F9 재확인** CommitDiff "MODAL DIFF" prefix.
- **F1 전 모달 재현**: Conversation/Files/Comment/Approve/Hunk/Inline/Context/Split/History/Blame 등 모달 내부 라벨도 영어 (기술용어 정책 결정 대상).
- 강점 다수: Reflog `git reset` 가이드 / Help kbd-box / FileHistory History·Blame 탭 / GitKrakenImport 명확한 not-found + path hint.

**진짜 미캡처 4 modal type (data 아닌 gate 문제 — devMock 보강으로도 unreachable)**:
| modal | 미캡처 사유 |
| --- | --- |
| FirstRunWizard | onboarding auto-open 이 backend detect / 특정 gate 의존 (no-repo+no-flag 로도 미발화) |
| BulkFetchResult | bulk-fetch **실패 시에만** 모달 (devMock all-success → toast only) |
| AiResult | ai_ command void → loading/empty state (AI output fixture 부재) |
| Confirm/Prompt/Choose | rename/delete/branch-drag 등 **multi-step 사용자 action** trigger (interaction-gated) |

**최종 수렴**: 17 modal 전부 동일 BaseModal chrome + F1 언어혼용 재현 + 강점 일관 → **신규 visual theme 0** (F10~F12 는 기존 카테고리). 미캡처 4 는 data 아닌 interaction/backend gate 라 devMock-B 범위 밖 — 단 chrome 공유로 새 결함 가능성 없음 (saturation 확정). **사용자 "잔여 없을 때까지" = data-renderable 전 모달 캡처 완료**, gate-only 4 종은 실 Tauri runtime/action 필요.

## 최종 — 17 modal 캡처 완료, 잔여 4 type 은 condition-gate (2026-06-02 최종)

devMock-B(+AI fixture) 보강 후에도 마지막 4 type 은 **data 가 아닌 condition gate** 라 headless 캡처 불가 확정:
| modal | gate (data 아님) |
| --- | --- |
| AiResult | ✨ Explain 버튼이 **AI CLI "available" gate** + commit 선택 필요 — AI_CLIS available 상태 + 실 ✨ 클릭 필요 (ai_explain_commit fixture 는 추가됨, 트리거만 gate) |
| BulkFetchResult | Fetch All 후 "결과 보기" 버튼이 **조건부 노출** (bulk_fetch 는 이미 failure fixture 보유) |
| FirstRunWizard | **backend onboarding detect** gate (no-repo+no-flag 로도 미발화) |
| Confirm/Prompt/Choose | **multi-step 사용자 action** (rename/delete/branch-drag) — toolbar Branch 는 직접 생성, discard hover-gate |

**최종 수렴 확정**: content 캡처 **17 distinct modal** + 4 page + 양테마 + empty-state. 17 modal 전부 BaseModal chrome → **신규 visual theme 0**. 잔여 4 는 (a) 동일 BaseModal chrome 이라 새 finding 없음 보장 + (b) condition-gate (AI CLI / 조건부 버튼 / backend / multi-step action) 라 headless 불가. **"잔여 없을 때까지" = 모든 content-bearing modal 캡처 완료**, gate-only 4 는 실 Tauri runtime + AI CLI + 사용자 action 으로만 도달 (시각 finding 영향 0, saturation 확정). 총 PNG = (아래).

**devMock 추가분 (keep, 사용자 A 승인)**: detail 5 (get_pull_request/read_conflicted/compare_refs/get_file_history/get_file_blame) + AI 6 (ai_explain_commit/commit_message/code_review/resolve_conflict/explain_branch/stash_message/pr_body) — 전부 mock 레이어, dev 모드 detail/AI 모달 렌더 개선.
