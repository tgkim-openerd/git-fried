# 06. GitKraken Feature Parity — 야망 카탈로그 + 디자인 implication

> **이 문서의 독자**: 디자이너 — git-fried 가 어디까지 가려는지, 어떤 기능을 위한 자리를 화면에 미리 비워둬야 하는지.
> **출처**: [`plan/03 feature matrix`](../plan/03-feature-matrix.md) (M/N/L/S 분류) + [`plan/14`](../plan/14-additional-gitkraken-gaps.md) (✅ 22 추가 흡수) + [`plan/22 §3·§4·§5·§15`](../plan/22-ui-polish-v2.md) (UI 부채 + 미해결).
> **분류**: **✅** 구현 / **⚠️** 부분 / **🔜** v0.3~v1.0 예정 / **❌** 의도적 skip.

---

## 0. 의도 명문화

git-fried 의 목표는 **GitKraken 의 핵심 기능 ≈70개를 흡수** 하면서 GitKraken 이 5년째 안 고치는 4 약점을 정조준한다 (`docs/plan/01`):

| 약점 (GitKraken) | git-fried 응답 |
|------------------|----------------|
| ❌ Gitea 미지원 | ✅ 1급 시민 (PR / Issue / Release / Workspaces / Launchpad) |
| ❌ 한국어 인코딩 결함 | ✅ UTF-8 강제 + file-based commit + CP949 차단 |
| ❌ Cloud-first / Free 페이월 | ✅ 로컬 우선, 모든 기능 무료 |
| ❌ Electron 200~300MB | ✅ Tauri 50MB 목표 |

**디자인 함의**: 기능 선택은 GitKraken 기준이지만, 시각 정체성 (illustration / 큰 그래프 / 풍부한 색) 은 따라가지 않는다. JetBrains / Tower / Fork 의 instrumented 톤 유지.

---

## 1. 코어 Git (24)

| 기능 | 상태 | 화면/모달 | 디자인 implication |
|------|------|----------|------------------|
| Repo add / clone (`clone with options`) | ✅ | Sidebar `↓ Clone` + CloneRepoModal | sparse-checkout / depth / shallow-since / single-branch advanced expand |
| Status / Stage / Unstage / Discard | ✅ | StatusPanel | 4 collapsible section (Staged/Unstaged/Untracked/Conflicted) |
| Hunk-stage | ✅ | HunkStageModal + StatusPanel `✂ hunk` | 진입점 visible (sprint 22-1 C3) |
| **Line-level stage** | ⚠️ 부분 (line patch 가능, UI 미흡) | HunkStageModal | v0.4 예정. 디자인 시 line range select pattern 자리 확보 |
| Commit (한글 안전 file-based) | ✅ | CommitMessageInput | 한글 visual width 36자=72 amber/destructive |
| Push / Pull / Fetch | ✅ | SyncBar + ⌘L/⌘⇧L/⌘⇧K | Pre-push LFS size estimation badge 자리 |
| Branch list / switch / create / delete / rename | ✅ | BranchPanel | 9 브랜치 표시 (캡처 07) |
| Commit graph (lane) | ✅ | CommitGraph | pvigier straight-line, 컬럼 표시/숨김 토글 |
| Diff viewer (Hunk/Inline/Context/Split) | ✅ | DiffViewer/DiffSplitView/CommitDiffModal | 4 mode toggle (캡처 06/32) |
| File history (visual) | ✅ | FileHistoryModal (⌘⇧H) | 캡처 25 |
| Blame (inline + 패널) | ✅ | StatusPanel context-menu `Blame` | inline blame 줄 색 spec 필요 |
| Stash list / apply / drop / show diff | ✅ | StashPanel (⌘3) | 캡처 08 |
| Stash 단일 파일 apply | ✅ (plan/14 D1) | StashPanel preview row | per-file row + "이 파일만 apply" |
| Stash edit message | ✅ (plan/14 D2) | StashPanel `edit msg` | window.prompt → BaseModal 이후 inline edit 으로 |
| Tag list / create / delete / push / annotated | ✅ (plan/14 G1) | TagPanel (캡처 13) | annotated msg viewer Click→Detail (V-4 P1 미구현) |
| Reset (soft/mixed/hard/keep) | ✅ | ContextMenu submenu (CM-1) | destructive 시각 분리 |
| Revert | ✅ | ContextMenu (CM-1) | — |
| Cherry-pick (단일) | ✅ | ContextMenu (CM-1) | — |
| **Cherry-pick (멀티 레포 동시)** | ✅ git-fried 차별화 | SyncTemplateModal (캡처 31) | GitKraken 미지원 — 강조 위치 확보 |
| Interactive rebase (drag-drop) | ✅ | InteractiveRebaseModal (캡처 30) | step indicator (setup→edit→running→result) |
| Merge / Rebase | ✅ | ContextMenu (CM-5) + drag&drop (예정) | branch→branch drag spec |
| 3-way merge conflict editor | ✅ | MergeEditorModal | ours/theirs/result 3-pane (미캡처) |
| Submodule init/update/diff/sync | ✅ | SubmodulePanel (캡처 10) | 6 항목 status 표시 |
| Worktree 매니저 (lock/unlock/prune) | ✅ | WorktreePanel (캡처 12) | 8 worktree 시각화 |
| LFS (track / untrack / fetch / pull / prune) | ✅ | LfsPanel (캡처 11) | pre-push size estimation |
| GPG / SSH commit signing | ⚠️ 부분 | RepoSpecificForm | 토글 + 상태 인디케이터 spec 필요 |
| Hooks (pre-commit 결과 표시) | 🔜 v0.4 | StatusPanel footer | lefthook/husky 결과 패널 자리 확보 |
| Bisect | ✅ | BisectModal (캡처 27) | good/bad/skip 3 button + lastOutput |
| Reflog | ✅ | ReflogModal (캡처 29) | restore HEAD button (V-6 P1 미구현) |

---

## 2. 멀티 레포 / 워크스페이스 (8)

| 기능 | 상태 | 디자인 implication |
|------|------|------------------|
| Multi-repo 사이드바 | ✅ | workspace → org → repo 2-level tree |
| 듀얼 레포 (`frontend` + `frontend-admin`) | ✅ | 페르소나 직접 표현 — fixture 에 명시 |
| 일괄 fetch / status / list-prs | ✅ | bulk_* prefix 5min timeout |
| BulkFetchResultModal | ✅ (sprint 22-1 C1) | 📡 결과 버튼 + 실패 N개 badge |
| Launchpad (모든 PR 통합) | ✅ | filter syntax (+author: +state: +repo: +is:) |
| 레포 alias / 그룹 / 태그 | ✅ (plan/14 B4) | per-profile 영속 |
| Workspace color picker | ✅ | 회사/개인 시각 분리 |
| **Cloud Workspace 동기화** | ❌ skip | 보안정책 거부 — `Integrations` slot 으로 대체 |

---

## 3. Forge 통합 — Gitea + GitHub (12)

GitKraken 에서 Gitea 0점인 영역 — git-fried 의 1차 차별 가치 전부.

| 기능 | 상태 | 디자인 implication |
|------|------|------------------|
| PR list / detail / 생성 | ✅ | PrPanel + CreatePrModal (캡처 09/24) |
| PR 코멘트 / Review (Approve / Request) | ✅ | PrDetailModal (미캡처) |
| PR Code Suggestions (라인-레벨) | ✅ (plan/14 F1) | + Code suggestion 토글 → form |
| PR 머지 (앱에서) | ✅ | PrDetailModal footer Merge button |
| PR Filter syntax | ✅ (plan/14 F2) | helper 버튼 + AND token |
| Issue list / detail | ⚠️ 부분 (panel ✅, IssueDetailModal ❌ V-11 P3) | ForgePanel sub-tab Issue (캡처 14) |
| Issue 생성 (브랜치명에서 자동) | 🔜 v1.x | branch panel context-menu 자리 |
| Releases | ⚠️ 부분 (list ✅, ReleaseDetailModal ❌ V-12 P3) | ForgePanel sub-tab (캡처 15) |
| Webhook / CI 상태 | 🔜 v1.x | PR row 에 status badge slot 자리 |
| Bot PR 그룹핑 (release-please / dependabot / renovate) | ✅ | Launchpad showBots checkbox |
| OAuth | 🔜 v1.x | Settings → Forge 에 OAuth 버튼 자리 |
| Discussions (GitHub) | ❌ skip | GitKraken 도 미흡, scope-out |

---

## 4. UX / 생산성 (15)

| 기능 | 상태 | 디자인 implication |
|------|------|------------------|
| Command Palette (⌘P) | ✅ | 30+ commands × 8 카테고리 (캡처 04). **확장성 — v1 까지 60+ 예상** |
| 풍부한 단축키 (37) | ✅ | HelpModal (캡처 05) |
| Theme (light / dark) | ✅ | 시스템 자동 (Q4) |
| **Custom theme (사용자 색)** | ⚠️ 부분 (JSON import/export, 검증 ❌) | Settings UI category — 검증 + 미리보기 spec 필요 |
| Profiles (개인↔회사 1-click) | ✅ (plan/14 B1~B4) | ProfileSwitcher + Settings → Profiles (캡처 03) |
| Per-profile 탭 영속 | ✅ | RepoTabBar |
| Repository-Specific Preferences (13 keys) | ✅ (plan/14 B14-3) | Settings → Repo-Specific |
| Search (commit / file / branch) | ⚠️ 부분 (Author filter ✅, full-text 🔜) | Sidebar 필터 (⌘⌥F) + 미래 SQLite FTS5 |
| StatusPanel 검색 input | 🔜 (plan/22 F-I1) | 150+ 파일 시나리오. **자리 확보 필수** |
| Notification / Toast | ✅ | severity 4 + dedup (🔜 plan/22 §15) |
| 통합 터미널 | ✅ (plan/10 옵션 A) | TerminalPanel (⌘\`) — portable-pty |
| ContextMenu (17 위치) | ⚠️ P0 5/17 (CM-1~5 ✅) | **plan/22 §15 핵심 부채 — 12 위치 자리 확보** |
| Click→Detail viewer (15 흐름) | ⚠️ 6/15 (V-1·V-2 ✅) | **plan/22 §15 핵심 — 9 흐름 자리** |
| Drag & drop (4 종) | 🔜 (plan/12 §B8) | branch→branch / commit→branch / file→stash / tab reorder. **drop target spec** |
| Repository Maintenance (gc / fsck / lfs install) | ✅ (plan/14 A2) | Settings → 유지보수 |

---

## 5. AI / 부가 (8)

git-fried 는 **AI 인프라를 자체 운영하지 않고 Claude/Codex CLI 에 위임** 한다 (plan/04).

| 기능 | 상태 | 디자인 implication |
|------|------|------------------|
| AI commit message | ✅ | CommitMessageInput `✨ AI` button |
| AI PR body 생성 | ✅ | CreatePrModal `✨ AI body 생성` (캡처 24) |
| AI commit explain | ✅ | CommitDiffModal `✨ 설명` (캡처 06) |
| AI branch explain | ✅ | BranchPanel context-menu (CM-5) |
| AI stash message | ✅ | StashPanel |
| AI code review | ✅ | PrDetailModal Reviews tab |
| AI merge conflict 추천 | ✅ | MergeEditorModal `✨ AI 추천` |
| AI Composer (commit 분할 plan) | ✅ (plan/11 B3) | CommitMessageInput `✨ Composer` button |
| **AI 자체 LLM 인프라 (BYOK / Ollama)** | ❌ skip | CLI 위임으로 대체 — Settings 에 "AI CLI" 카테고리만 |
| **Cloud Patches** | ❌ skip | `git format-patch` 면 충분 |
| **Issue 트래커 통합 (Jira/Trello)** | ❌ skip | Gitea/GitHub Issues 만 1급 |
| **Diagram (FigJam-like)** | ❌ skip | 외부 도구 |
| **Agent Session Management (병렬 코딩)** | ❌ skip | scope 폭발 |

---

## 6. 마이그레이션 / 호환 (3)

| 기능 | 상태 | 디자인 implication |
|------|------|------------------|
| GitKraken Importer (workspace/repo/tabs/favorites) | ✅ (plan/21) | Settings → 마이그레이션 → GitKrakenImportModal |
| Tower / Fork importer | 🔜 v1.x | 동일 위치 placeholder |
| `.gitkraken` settings 변환 | ⚠️ 부분 | importer 안에 |

---

## 7. 인프라 / 운영 (7)

| 기능 | 상태 | 디자인 implication |
|------|------|------------------|
| 자동 업데이트 (Tauri updater) | ✅ | Settings → About 에 "업데이트 확인" 버튼 |
| 코드 서명 (Win OV → EV) | 🔜 v1.x | — |
| 코드 서명 (Mac) | 🔜 v1.x | — |
| 텔레메트리 (opt-in only) | 🔜 v1.x | Settings → General 에 토글 자리 |
| i18n (한/영) | 🔜 v0.3 | 모든 string 한국어 우선, en locale 후 추가 |
| a11y (WAI-ARIA) | ⚠️ 부분 (plan/22 §15) | aria-label 0/47 → 디자이너 spec 필수 |
| Performance bench (criterion / memory) | ✅ (plan/20) | About 에 표시 자리 |

---

## 8. 디자인 implication 종합 — 4 가지 hard constraint

### 8-1. Layout extensibility (가장 중요)

현재 카운트 → 예상 v1.0 카운트:
- 메인 우측 탭: 7 → **10+** (Hooks · CI status · Diagnostics 추가 예정)
- Settings 카테고리: 9 → **12+** (Plugin / Telemetry / Updates / Notifications 추가)
- CommandPalette commands: 30+ → **60+**
- 우클릭 ContextMenu 위치: 17 (P0 5 ✅) → 17 모두 + 신규
- Modal: 18 → **25+** (IssueDetail / ReleaseDetail / OAuth flow / Update / Plugin install)

**디자이너 결정 필요**:
- 탭 nav overflow 패턴 (스크롤 / "더 보기" / 숨김 메뉴)
- Settings 카테고리 grouping (현재 평면 9, v1 에서 2-level 필요)
- CommandPalette 의 카테고리 group 확장
- Sidebar 의 "Integrations" 섹션 placeholder

### 8-2. Density 강제 정착

GitKraken 흡수 = minimal 지양. 모든 화면이 **정보 밀도 IDE-grade**. spacious / 큰 여백 / 과도한 illustration 사용 금지.

검증 기준: **1440×900 화면에 같은 정보가 GitKraken 이상으로 들어가는가?**

### 8-3. Plugin / Integration slot

Cloud Workspace / Cloud Patches / Cloud AI 같은 GitKraken Pro 기능을 git-fried 가 로컬-우선 / CLI-위임 으로 대체. 디자이너가 다음 슬롯을 **미리 디자인**:
- Sidebar 하단: `Integrations` 섹션 (현재 비어있음)
- Settings: `Plugin` 카테고리 placeholder
- CommandPalette: `Integration` 카테고리

### 8-4. 미구현 placeholder 표시 정책

**🔜 v0.3~v1.0 예정** 기능 (위 표의 🔜 항목 ≈15) 은 화면에 **placeholder 표시 OK**:
- 회색 / disabled state
- tooltip: "v0.4 예정" / "v1.0 예정"
- 클릭 시 toast.info: "이 기능은 v0.4 에서 추가됩니다 — 진행 상황은 plan/05 참조"

**❌ skip** 기능 (≈10) 은 절대 표시하지 않음 (Cloud / 자체 LLM / Diagram / Agent Session 등).

### 8-5. AI CLI 위임의 시각 함의 (Figma Make Iteration 1 인사이트 5-2)

git-fried 가 자체 LLM 인프라 (BYOK API / Ollama) 를 명시적으로 skip 하고 Claude/Codex CLI subprocess 위임을 채택한 것은 **단순 구현 결정이 아니라 Settings 의 시각 spec 에 직접 영향**:

- **❌ Anti-pattern (Cursor / Copilot / GitKraken AI 류)**: 모델 선택 dropdown / API key input / token usage 표시 / 사용량 progress bar
- **✅ git-fried 패턴**: Settings → "AI CLI" 카테고리는 다음만 노출:
  - CLI path (텍스트 input + 자동 detect 버튼) — `font-mono`
  - 환경변수 키 표시 (read-only, `font-mono`, masked)
  - "claude --version" / "codex --version" probe 결과 (mono)
  - Last used / total invocations (선택)

→ 디자이너 함의: **AI 카테고리 디자인은 BYOK SaaS UI 가 아닌 "ssh keypair / git config" 같은 dev-tooling 시각** 으로 가야 한다. font-mono 가 dominant.

### 8-6. Cloud-Free 정체성의 시각화 (인사이트 5-3)

GitKraken Pro 의 Cloud-first 마케팅 (hero illustration / 클라우드 동기화 진행 UI / 사용량 dashboard) 은 anti-pattern. 그러나 그 자리에 **빈 공간이 생기면 minimal-leaning 으로 회귀** 위험.

→ **빈 공간 처리 룰**: 마케팅 hero 가 아닌 **`Integrations` placeholder + 진단 정보 + 사용 통계 (로컬)** 로 채운다.

| 화면 | GitKraken Pro 의 Cloud UI | git-fried 대체 |
|------|--------------------------|---------------|
| Sidebar 하단 | "Cloud Workspace 동기화 중" | `Integrations` 섹션 (Plugin / 외부 도구 연결) |
| Settings 첫 화면 | Cloud 계정 status / 사용량 | 로컬 통계 (레포 N개 / commit M개 / 마지막 fetch) |
| Launchpad 우상단 | Cloud sync 인디케이터 | 로컬 fetch progress + 마지막 동기화 시각 |
| About | "Pro upgrade" CTA | self-host 정보 + benchmark 결과 + GitHub release link |

### 8-7. Migration UX 의 onboarding 격상 (인사이트 5-4)

`GitKrakenImportModal` (plan/21) 은 단순 Settings → 마이그레이션 의 modal 항목이 아니라 **제품 진입의 1차 funnel**:

- 4 약점 정조준 (Gitea/한글/Cloud/메모리) 의 사용자 = **GitKraken 에서 떠나려는 사람**
- 따라서 첫 실행 onboarding 의 핵심 step 이 "GitKraken 데이터 가져오기"
- plan/21 의 3 단계 (detect → dry_run → apply) 가 onboarding step 2~4 로 격상 가능

**디자이너 결정 필요**:
- 첫 실행 시 GitKrakenImportModal 자동 detect → 데이터 발견되면 onboarding hero 에 "GitKraken 데이터 발견 — 가져오기" CTA
- detect 결과 없으면 minimal "Add repository" CTA 만
- Settings → 마이그레이션 위치는 "재실행 / 추가 가져오기" 용으로 유지

→ Sprint 3 Hub Screens 에서 **첫 실행 onboarding flow** 를 별도 화면으로 디자인 후보 (현재 03-screens-and-flows 에 명시 X — 신규 영역).

---

## 9. 합계

| 분류 | 개수 |
|------|------|
| ✅ 구현 | ~52 |
| ⚠️ 부분 | ~10 |
| 🔜 v0.3~v1.0 예정 | ~15 |
| ❌ 의도적 skip | ~10 |
| **합계** | **~87** |

GitKraken 의 핵심 ≈70 흡수 목표 대비 — 차별화 (멀티 레포 cherry-pick / Gitea 1급 / 한글 / Tauri-light) + 흡수 + 의도적 skip 의 전체 catalog.

---

## 10. 디자이너에게 한 줄 요약

> "GitKraken 을 코드까지 다 베끼되, 시각 정체성은 JetBrains 스타일로 가라. 화면은 v1.0 의 ~25 모달 / ~12 settings / ~10 탭 / ~60 commands 까지 견딜 수 있게 처음부터 그려라. minimal 은 anti-pattern."
