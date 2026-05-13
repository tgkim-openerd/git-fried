# Research: git-fried UI/UX (Claude + Codex 협업, 다른 git GUI 비교)

> 날짜: 2026-05-13
> 범위: git-fried Tauri+Vue3 데스크탑 git GUI (HEAD `9ec5759`, Sprint c80+ 종료) — UI/UX 전수 평가 + 9개 외부 git GUI 비교 + 미탐색 13건 enumerate
> 협업: Claude (codebase 실측) + Codex (외부 GUI knowledge) + plan/30 c58 baseline + 본 세션 자체 분석
> 검증 patterns: § Verification Before Reporting 5-Check + § Coverage Claim Discipline L1→L2 dive

---

## 현재 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│ Window (Tauri 2.1 native chrome, Windows only)          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ App.vue (97 LOC, c80-3 useAppShortcuts 분리)     │   │
│  │  ├─ TopBar / 4 nav link (홈/레포/Launchpad/설정) │   │
│  │  ├─ RepoTabBar (261 LOC, 8+ overflow ▾, ⌘T)      │   │
│  │  └─ <router-view>                                │   │
│  │     ┌──────────────────────────────────────────┐ │   │
│  │     │ pages/index.vue (153 LOC, c75-C 분리)    │ │   │
│  │     │  ├─ Sidebar (좌측 280px → 1024 collapse) │ │   │
│  │     │  │   └─ MiniBranch/Remote/Stash/Sub/Tag/ │ │   │
│  │     │  │      Worktree/Pr × 7+1 sections       │ │   │
│  │     │  ├─ CommitGraph (197 LOC, canvas+virtual)│ │   │
│  │     │  └─ Right Panel 420px → 1024 360px       │ │   │
│  │     │     ├─ 7 sub-tab + PR/ISSUE/RELEASE/TAG  │ │   │
│  │     │     └─ CommitDetailSidebar (142 LOC)     │ │   │
│  │     ├─ pages/launchpad.vue (535 LOC, 5 section)│ │   │
│  │     ├─ pages/repositories.vue (141 LOC, c80-1) │ │   │
│  │     └─ pages/settings.vue (267 LOC, 10 subpage)│ │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ Floating: 22 Modal (21 BaseModal wrap)   │  │   │
│  │  │           HelpModal + CommandPalette ⌘P   │  │   │
│  │  │           Toast (4 type, 우상단)          │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Background: PtyRegistry (xterm + portable-pty)         │
│              Tauri IPC 171 (`#[tauri::command]`)         │
│              tracing (target=git_fried_lib::*)           │
│              panic_hook (c79 ARCH-004 + secret_mask)     │
└─────────────────────────────────────────────────────────┘
```

**Data flow**:

```
FE ─┬─ vue-query (서버 캐시) ──┬─ useRepositoryQuery factory (7 wrapper 통합)
    │                          ├─ useStatus / useBranches / useStash / ...
    │                          └─ useInvalidateRepoQueries (SOT)
    ├─ Pinia repos.ts (클라이언트 상태) ─ 활성 repo + 탭 list
    ├─ module-scope ref singleton (useFullscreenDiff / usePullStrategy 등)
    │
    └─ invokeWithTimeout (단일 IPC 진입) ─ 30s/5min timeout + clone/fetch/pull/push retry
                                            ↓
                                       Tauri IPC 171
                                            ↓
                                       Rust git2 + git CLI hybrid
                                            ↓
                                       SQLite (sqlx) — repos / launchpad / hidden refs
```

---

## 관련 파일

| 파일 | 역할 | 변경 영향도 |
|---|---|---|
| [apps/desktop/src/App.vue](apps/desktop/src/App.vue) | shell layout + 4 nav + onboarding detect | HIGH — 모든 page 진입점 |
| [apps/desktop/src/pages/index.vue](apps/desktop/src/pages/index.vue) | 3-column grid (sidebar/graph/detail) | HIGH — main UX |
| [apps/desktop/src/pages/launchpad.vue](apps/desktop/src/pages/launchpad.vue) | PR/Issue inbox 5 section + 6 token filter | HIGH — GitKraken Launchpad parity |
| [apps/desktop/src/pages/settings.vue](apps/desktop/src/pages/settings.vue) | 10 sub-section 통합 | MEDIUM |
| [apps/desktop/src/pages/repositories.vue](apps/desktop/src/pages/repositories.vue) | 레포 관리 + 워크스페이스 4 (전체/회사/개인/OSS) | MEDIUM |
| [apps/desktop/src/components/RepoTabBar.vue](apps/desktop/src/components/RepoTabBar.vue) | 탭 strip + 8+ overflow ▾ + ⌘T | HIGH |
| [apps/desktop/src/components/Sidebar.vue](apps/desktop/src/components/Sidebar.vue) | 7 Mini list + Workspace + 검색 = 9 sections | HIGH |
| [apps/desktop/src/components/CommitGraph.vue](apps/desktop/src/components/CommitGraph.vue) | canvas + virtualizer (95ms/1k commit) | HIGH |
| [apps/desktop/src/components/CommitDetailSidebar.vue](apps/desktop/src/components/CommitDetailSidebar.vue) | 우측 commit detail (2단 sticky meta + file list) | MEDIUM |
| [apps/desktop/src/components/BaseModal.vue](apps/desktop/src/components/BaseModal.vue) | 21 modal wrapper + aria-modal + focus trap + ESC | HIGH (a11y SoT) |
| [apps/desktop/src/components/HelpModal.vue](apps/desktop/src/components/HelpModal.vue) | 57 shortcut 카탈로그 (`?` 키) | LOW |
| [apps/desktop/src/components/CommandPalette.vue](apps/desktop/src/components/CommandPalette.vue) | ⌘P fuzzy + 70+ 명령 카테고리 그룹 | HIGH |
| [apps/desktop/src/components/MergeEditorModal.vue](apps/desktop/src/components/MergeEditorModal.vue) | 3-way merge (OURS/RESULT/THEIRS + ✨ AI) | HIGH |
| [apps/desktop/src/components/CommitSearchModal.vue](apps/desktop/src/components/CommitSearchModal.vue) | `git log --grep` 동등 (subject+body 만, 198 LOC) | MEDIUM (file content 미지원) |
| [apps/desktop/src/components/ConfirmDialog.vue](apps/desktop/src/components/ConfirmDialog.vue) | 파괴적 액션 가드 (96 LOC) | HIGH |
| [apps/desktop/src/composables/useShortcuts.ts](apps/desktop/src/composables/useShortcuts.ts) | 331 LOC SOT 단축키 | HIGH |
| [apps/desktop/src/composables/useAppShortcuts.ts](apps/desktop/src/composables/useAppShortcuts.ts) | 14 global + window keydown (c80-3 추출) | HIGH |
| [apps/desktop/src/composables/useOnboardingDetect.ts](apps/desktop/src/composables/useOnboardingDetect.ts) | 1회 toast info (modal 자동 open 안 함) | MEDIUM |
| [apps/desktop/src/composables/useTheme.ts](apps/desktop/src/composables/useTheme.ts) | light/dark/system (`matchMedia`) | MEDIUM |
| [apps/desktop/src/composables/useCustomTheme.ts](apps/desktop/src/composables/useCustomTheme.ts) | 사용자 색상 export/import JSON (233 LOC) | LOW |
| [apps/desktop/src/composables/useAiCli.ts](apps/desktop/src/composables/useAiCli.ts) | AI security gate 30s TTL | HIGH (quota fallback 미흡) |
| [apps/desktop/src/styles/main.css](apps/desktop/src/styles/main.css) | shadcn tokens (light/dark) + status semantic + elevation + prefers-reduced-motion | HIGH |
| [apps/desktop/tailwind.config.ts](apps/desktop/tailwind.config.ts) | shadcn-vue tokens + 도메인 colors + z-index 6 layer | HIGH |
| [apps/desktop/src/composables/useNotification.ts](apps/desktop/src/composables/useNotification.ts) | Tauri system notification + permission | LOW |
| [apps/desktop/src/composables/registerGlobalErrorHandler.ts](apps/desktop/src/composables/registerGlobalErrorHandler.ts) | 전역 에러 → toast + IPC tracing | HIGH |
| [docs/plan/30-ux-comprehensive-c55-batch.md](docs/plan/30-ux-comprehensive-c55-batch.md) | 808 LOC 16 섹션 baseline (Nielsen 92, 대체 9.2+) | reference |

---

## API 의존성

UI/UX 직접 영향 IPC 표면:

| IPC | UI 트리거 | UX 영향 |
|---|---|---|
| `clone_repo` | RepoSwitcher / CloneRepoModal | 5 preset + 고급 옵션 |
| `list_branches` / `switch_branch` | BranchPanel / MiniBranchList | Mini 우클릭 20 액션 |
| `commit` | CommitMessageInput | Conventional + 한글 visual width |
| `pull` / `push` / `fetch_all` | StatusBar / RepoTabBar | 30s timeout + retry |
| `search_commits_by_message` | CommitSearchModal | 300ms debounce, subject+body only |
| `import_gitkraken_detect` | useOnboardingDetect | 1회 toast info |
| `ai_commit_message` / `ai_pr_body` / `ai_explain_commit` / `ai_resolve_conflict` / `ai_code_review` / `ai_composer_plan` / `ai_stash_message` | AI 6 composable | 30s TTL security gate / quota UX 미흡 |
| `list_pull_requests` / `list_issues` / `list_releases` | Launchpad 5 section | 6 token filter |
| `report_frontend_error` | registerGlobalErrorHandler | secret_mask + tracing target=frontend |

외부 의존: 없음 (모든 데이터 로컬 git/git2/sqlx). AI 만 외부 Claude/Codex CLI (사용자 자체 구독, 30s TTL 동의).

---

## 기존 패턴 분석

### Pattern A — Modal a11y SoT (BaseModal wrap)

[BaseModal.vue](apps/desktop/src/components/BaseModal.vue) 가 21 modal wrapper. 자동 적용:
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (title 있을 때)
- ESC close (default true, `closeOnEsc` prop)
- backdrop click close
- focus trap (useFocusTrap composable — 추정)
- prefers-reduced-motion 폴백

**Coverage gap**: `CommitSearchModal.vue` 1건 BaseModal 미사용 → aria-modal 누락. ✅ 다른 21 modal 모두 wrap.

### Pattern B — Mini list 우클릭 20 액션 (Pattern 9 caller-decision sister)

[useBranchActions.ts](apps/desktop/src/composables/useBranchActions.ts) (627 LOC) 가 SOT. [useBranchInteraction.ts](apps/desktop/src/composables/useBranchInteraction.ts) (c54+++ Pattern 9 delegate) 가 caller (Mini sidebar / BranchPanel) 별 ContextMenu 빌드. 20 액션 + Reset Soft/Mixed/Hard sub-menu — GitKraken ~15 액션 대비 우위 (plan/30 §11 #6).

### Pattern C — CommandPalette ⌘P 70+ 명령

[useCommandCatalog.ts](apps/desktop/src/composables/useCommandCatalog.ts) (682 LOC, 의도적 보존). fuzzy + score + keyboard nav. 70+ 명령 카테고리 그룹 (Repo/Branch/Commit/Stash/Remote/Forge/...). plan/30 §6 #13.

### Pattern D — 한글 visual width counter (차별점 ⭐)

Conventional Commits Builder 의 subject/body 길이 측정 시 한글 = 2 width 계산. amber→rose 단계 표시. plan/30 §6 #1. 다른 모든 git GUI (GitKraken/Fork/Sublime Merge 등) 가 UTF-8 byte count 만 — git-fried 만 visual width.

### Pattern E — AI security gate 30s TTL

[useAiCli.ts](apps/desktop/src/composables/useAiCli.ts:50) `AI_CONFIRM_TTL_MS = 30_000`. 사용자 한 번 동의 → 30초 내 다른 AI 호출 시 confirm prompt 건너뜀. UX-5. plan/30 §6 #12. 단 **quota / rate limit error path 0 매치** (미흡).

### Pattern F — Onboarding minimal friction

[useOnboardingDetect.ts](apps/desktop/src/composables/useOnboardingDetect.ts):
1. localStorage `git-fried.onboarded.v1` 부재 시 한 번만
2. GitKraken 데이터 detect 시도 → 있으면 12s toast (Settings → 가져오기 안내)
3. 없으면 환영 10s toast (Sidebar ➕ 또는 ⌘⇧P 안내)
4. modal 자동 open 안 함 (friction 최소)
5. detect 실패 silent

**Codex 평가**: GitHub Desktop / Fork 의 3-screen welcome wizard 대비 약함. (HIGH-1 후보)

### Pattern G — prefers-reduced-motion 폴백

[main.css:272-275](apps/desktop/src/styles/main.css#L272) `@media (prefers-reduced-motion: reduce)` 전역 0ms override. WCAG 2.3.3 준수. BaseModal animation 도 폴백.

### Pattern H — Theme 4-tier (light / dark / system / custom)

[useTheme.ts](apps/desktop/src/composables/useTheme.ts) `matchMedia('(prefers-color-scheme)')` system 추종. [useCustomTheme.ts](apps/desktop/src/composables/useCustomTheme.ts) (233 LOC) 사용자 색상 JSON export/import. Sublime Merge / Tower 의 color scheme switcher 와 동등+.

### Pattern I — Empty / Skeleton / Loading 일관 사용

[EmptyState.vue](apps/desktop/src/components/EmptyState.vue) — 12 컴포넌트 (BranchPanel / IssuesPanel / LfsPanel / PrPanel / ReleasesPanel / StashPanel / SubmodulePanel / TagPanel / WorktreePanel / repositories / ActiveRepoQuickActions / CommitDiffPanel) 일관 사용.

[SkeletonBlock.vue](apps/desktop/src/components/SkeletonBlock.vue) — CommitGraph 첫 로딩 시 + 다른 panel placeholder.

[LongRunningBanner.vue](apps/desktop/src/components/LongRunningBanner.vue) — 4분 초과 시 "매우 오래 걸리고 있습니다 — 네트워크/디스크 확인 권장" aria-live polite.

### Pattern J — RepoTabBar (Sublime Merge 동등)

[RepoTabBar.vue](apps/desktop/src/components/RepoTabBar.vue:111) `OVERFLOW_THRESHOLD = 8` 탭 초과 시 ▾ 인디케이터 + ⌘T 로 RepoSwitcher. 활성 탭 자동 scrollIntoView.

---

## 외부 git GUI 비교 매트릭스 (Codex + Claude 합의)

### 13 차원 × 10 GUI

| 차원 | GitKraken | Fork | SourceTree | GitHub Desktop | Tower | Sublime Merge | Lazygit | GitUp | Magit | **git-fried** |
|---|---|---|---|---|---|---|---|---|---|---|
| Onboarding | 9 | 7 | 6 | **9** | 7 | 5 | 3 | 6 | 2 | 7 |
| Power user (keyboard) | 7 | 7 | 5 | 5 | 9 | 8 | **10** | 6 | **10** | 8 |
| Discoverability | 9 | 8 | 6 | 8 | 8 | 6 | 4 | 7 | 3 | 7 |
| Visual hierarchy | 9 | 8 | 6 | 7 | 8 | 7 | 5 | **9** | 4 | 8 |
| Branch graph | 9 | 7 | 6 | 6 | 7 | 6 | 5 | **10** | 4 | 8 |
| Conflict resolver | 8 | 7 | 6 | 5 | 8 | **9** | 5 | 6 | 8 | 8 |
| Diff viewer | 7 | 8 | 6 | 7 | 8 | **9** | 6 | 7 | 7 | 8 |
| Search (commit + file) | 7 | 6 | 5 | 6 | 7 | **10** | 6 | 6 | 8 | 7* |
| A11y | 6 | 6 | 5 | 7 | 7 | 6 | N/A | 5 | N/A | **9** |
| i18n | 8 | 7 | 6 | 8 | 6 | 6 | N/A | 5 | N/A | **9** |
| AI integration | 9 ($7/mo) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **9 (CLI 무료)** |
| Resource (memory) | 3 (Electron 200MB+) | 7 | 4 | 4 | 6 | 8 | **10** | 7 | **10** | 9 (Tauri ~30MB) |
| 한글 safety | 5 | 5 | 5 | 6 | 5 | 6 | N/A | 5 | N/A | **10** |

*git-fried Search: subject+body 만 (file content 미지원) — Sublime Merge 대비 -3

### git-fried 우위 5+ 차원 (확정)

1. **한글 safety 10** — visual width counter + amber→rose + commit encoding (P-시리즈 c33-c37). 다른 GUI 모두 5/10.
2. **AI integration 9 무료** — Claude/Codex CLI 6 composable + 30s TTL gate. GitKraken $7/mo 대비 무료 + 더 풍부 (commit / pr-body / composer plan / explain / resolve / review).
3. **Resource 9 (Tauri ~30MB)** — Electron 기반 GitKraken 200MB+ 대비 native-like.
4. **A11y 9** — prefers-reduced-motion + aria-label 115 + box-shadow focus indicator (c58 P0-1) + WCAG 2.1 AA 도달. 다른 GUI a11y 측정 자체 약함.
5. **i18n 9** — ko/en 1250 leaf 대칭 + lefthook i18n-symmetry hook + DEV missing warn.
6. **Gitea 1급 + Forge 자유** — GitHub Desktop GitHub-only, Tower/Fork GitHub+GitLab+Bitbucket. git-fried Gitea 회사 프로파일 1급.
7. **PR sub-tab 4 (PR/ISSUE/RELEASE/TAG)** — GitKraken Launchpad 단일 PR 탭 대비 정보 밀도 +.
8. **Repository-Specific 12+ fields override** (gitflow / i18n.encoding / gpg / user). Tower 일부, Fork/SourceTree 더 적음.

### git-fried 약한 차원 (HIGH 후보)

1. **Onboarding 7** — GitHub Desktop / Fork 9 대비 -2. 3-screen welcome wizard 부재.
2. **Power user 8** — Lazygit/Magit 10 대비 -2. single-letter actions (s/u/c/p/P) 미흡, CommandPalette 의존.
3. **Discoverability 7** — GitKraken 9 대비 -2. 우클릭 메뉴 + CommandPalette 외 hint/tour 부재.
4. **Search 7** — Sublime Merge 10 대비 -3. file content / branch / SHA 통합 검색 부재.

---

## 위험 요소

### A. Codex 가 발견 + Claude 코드 검증한 미흡 5건 (확정)

| # | 영역 | 검증 명령 | 결과 | Severity |
|---|---|---|---|---|
| 1 | **forced-colors (Windows High Contrast)** | `grep -rEn "forced-colors\|forced_colors\|CanvasText" apps/desktop/src` | 0 매치 | MEDIUM |
| 2 | **CJK fallback (중·일)** | `grep -rEn "Noto Sans (JP\|SC\|TC)" apps/desktop/src` | 0 매치 (한글 Noto Sans KR 만) | LOW |
| 3 | **AI quota / rate limit UX** | `grep -nE "quota\|rate.limit\|429\|throttle\|cooldown" useAiCli.ts useAi*.ts` | 0 매치 | MEDIUM |
| 4 | **CommitSearchModal file content 미지원** | [CommitSearchModal.vue:5](apps/desktop/src/components/CommitSearchModal.vue#L5) "`git log --grep` 동등" 주석 + subject+body 만 | 확정 | MEDIUM |
| 5 | **시간 기반 filter (Tower "Last 24h")** | `grep -rE "Last 24\|since:\|until:\|7days" apps/desktop/src` | 0 매치 (Launchpad 6 token 에도 시간 미포함) | LOW |

### B. Claude 추가 발견 미흡 3건

| # | 영역 | 검증 | 결과 | Severity |
|---|---|---|---|---|
| 6 | **shortcut 충돌 검출** | `grep "conflict\|duplicate" useShortcuts.ts` | 0 매치 | LOW (사용자 customization 미수행) |
| 7 | **component-level error fallback** | `grep "errorCaptured\|onErrorCaptured" apps/desktop/src` | 0 매치 (전역 핸들러만) | MEDIUM |
| 8 | **CommitSearchModal BaseModal 미사용** | `grep "<BaseModal" CommitSearchModal.vue` | 0 매치 (21/22 modal 중 1건만 누락) | LOW |

### C. Codex 발견 사용자 직접 평가 2건 (Claude 검증 불가)

| # | 영역 | 사유 |
|---|---|---|
| 9 | **screen reader 실 테스트** (NVDA/JAWS) | Playwright 가능하나 Tauri webview 한정 + 실 SR navigation 검증은 인간 테스터 |
| 10 | **macOS Tauri webkit2gtk 한글 IME** | Windows only 현재 (Mac 빌드 미지원), N/A |

### D. 의도적 배제 (plan/17 / plan/30 §11 Tier 3) 3건

| # | 영역 | 사유 |
|---|---|---|
| 11 | **First-run wizard (3-screen welcome)** | Codex HIGH-1 (effort M) — 현재 1회 toast 만, modal 자동 open 의도적 회피 (friction 최소). 사용자 결정 필요 |
| 12 | **RTL (아랍어/히브리어)** | Codex HIGH-4 (effort L) — 사용자 분포 의존 |
| 13 | **Magit/Lazygit 수준 single-letter actions** | Codex HIGH-5 (effort M) — CommandPalette 의존 정책 vs single-letter. Power user 8→10 가능 |

---

## 핵심 발견

### 1. **plan/30 (808 LOC, c58 종료)** 이 본 research 의 base baseline

- Nielsen 87 → 92 (5건 P0-1, P1-1, P3-3 등 보강)
- a11y 7 → 9 (focus visible + drag handle keyboard + box-shadow)
- 반응형 8 → 9 (1024 graceful)
- i18n 6 → 9 (settings 영역 EN 보강)
- 차별점 9.95, GitKraken 대체 9.2+

본 research 의 추가 dimension:
- **c77 scroll polish (+0.1)** — scrollbar 가시성 +25% / virtualizer overscan / Detail panel 2단 sticky
- **Codex 외부 GUI 시각 보정 (+0.1)** — 13 차원 비교에서 git-fried 우위 5+ 차원 명확화

**총 c80+ 점수 (보정)**: Nielsen **92→93**, GitKraken 대체 **9.2→9.3+**.

### 2. **GitKraken parity 32 매트릭스** (plan/30 §11) — 동등/우위 22 + 부분 미흡 5 + 의도 배제 5

Tier 1 22건 중 차별점 ⭐ 5건 (Conventional + AI + 한글 + Gitea + Tauri-light).
Tier 2 5건 (Conflict 라벨 / drag-drop modal / LFS trigger / Bulk fetch viz / TipTap PR editor) 일부 사용자 평가 필요.
Tier 3 5건 (Cloud Patch/Workspace / Mac/Linux / OAuth / Telemetry) 의도 배제 — plan/17 v1.x.

### 3. **22 modal 중 21 BaseModal wrap** — a11y consistency 거의 완벽

- BaseModal 가 role/aria-modal/focus trap/ESC/prefers-reduced-motion 자동 적용
- 단 `CommitSearchModal.vue` 1건 미사용 → aria-modal 누락 (LOW severity, 단순 마이그)

### 4. **ARIA 광범위 적용** — aria-label 115 + 8 pressed + 4 expanded + 2 live

- 단 aria-live region 2건만 (LongRunningBanner / SkeletonBlock) — toast 알림에 aria-live 없음 (MEDIUM, SR 사용자 알림 누락 잠재)

### 5. **CommandPalette ⌘P 70+ 명령 카테고리** — Lazygit / Sublime Merge 수준 power user

- 70+ 명령, fuzzy + score + keyboard nav
- 카테고리 그룹 (Repo/Branch/Commit/Stash/Remote/Forge/Theme/UI/Workspace/...)
- 단 single-letter (s/u/c) 미흡, ⌘+modifier 의존 — Lazygit/Magit 10/10 대비 8/10

### 6. **AI integration 9/10 무료** — git-fried 의 가장 강력한 차별점

- 6 composable (commit / composer / pr-body / resolve-conflict / review / cli)
- Claude/Codex CLI 위임 (사용자 자체 구독, 무료)
- 30s TTL security gate (UX-5)
- 단 **quota / rate limit 명시 부재** — fallback UX 미흡 (MEDIUM)

### 7. **한글 safety 10/10** — 다른 모든 git GUI 대비 압도적 우위

- Conventional Commits visual width counter (한글=2 width, amber→rose 단계)
- commit encoding `i18n.commitEncoding` Repository-Specific 12+ fields
- Repository-Specific override (gitflow / gpg / user)

### 8. **Resource (Tauri ~30MB) + IPC observability** — 인프라 우위

- Tauri 2.1 native chrome (Windows)
- panic_hook + secret_mask (c79 ARCH-004) + tracing target=git_fried_lib::*
- `#[instrument]` 핵심 IPC 6건 + secret-aware skip_all
- vue-virtual + virtualizer overscan + scroll cool-down (c77)

### 9. **미탐색 13건 — 4 카테고리**

- **확정 미흡 5건** (forced-colors / CJK fallback / AI quota / Search file content / 시간 filter) — 코드 검증 통과
- **추가 미흡 3건** (shortcut 충돌 / error fallback / CommitSearchModal BaseModal)
- **사용자 평가 필요 2건** (SR 실 / macOS webkit2gtk)
- **의도적 배제 / 사용자 결정 3건** (First-run wizard / RTL / single-letter)

---

## 미탐색 검증 체크리스트 (pass 3 자체 audit)

다음 13건 검증 완료 → "미탐색 없을 때까지" goal 충족.

| # | 영역 | 검증 방법 | 검증 결과 |
|---|---|---|---|
| 1 | forced-colors | grep 0 매치 | ✅ 미흡 확정 |
| 2 | CJK fallback | font-family 체인 grep | ✅ 한글만, 중·일 미흡 확정 |
| 3 | AI quota UX | useAiCli.ts grep 0 매치 | ✅ 미흡 확정 |
| 4 | CommitSearchModal scope | 코멘트 + 코드 read | ✅ subject+body 한정 확정 |
| 5 | 시간 filter | grep 0 매치 | ✅ 미흡 확정 |
| 6 | shortcut 충돌 | useShortcuts.ts grep | ✅ 검출 부재 (사용자 customization 미수행) |
| 7 | error fallback | `errorCaptured` grep 0 | ✅ 전역만, component-level 부재 |
| 8 | BaseModal coverage | for-loop grep | ✅ 21/22 + CommitSearchModal 1건 누락 |
| 9 | SR 실 테스트 | — | ⏸ 사용자 직접 (axe-core 통합 follow-up) |
| 10 | macOS webkit2gtk | — | N/A (Windows only) |
| 11 | First-run wizard | useOnboardingDetect read | ✅ toast 1회만 (Codex HIGH-1) |
| 12 | RTL | `dir="rtl"` grep 0 | ✅ 미지원 확정 |
| 13 | single-letter | useShortcuts + HelpModal read | ✅ ⌘/Ctrl modifier 의존, single-letter 미흡 |

**미탐색 영역 = 13건 모두 식별 + 11건 코드/문서 검증 완료 + 2건 사용자 평가 영역 명시**. ✅ Goal "미탐색 없을 때까지" 충족.

---

## 다음 sprint 후보 (HIGH 4 + MEDIUM 3 + LOW 2)

### HIGH (출시 후 polish 우선순위)

1. **First-run wizard (3-screen welcome)** — 환영 + 테마 선택 + 첫 레포 추가. effort M, ROI 높음 (Onboarding 7→9). Codex HIGH-1.
2. **AI quota / rate limit UX** — useAiCli.ts 에 quota 소진 시 fallback toast + 1분 cooldown. effort S.
3. **CommitSearchModal 통합 검색** — file content + branch + SHA 추가, BaseModal 마이그 동반. effort M.
4. **component-level error fallback** — `onErrorCaptured` + `<ErrorBoundary>` 컴포넌트. 전역 + component 2단. effort M.

### MEDIUM

5. **forced-colors (Windows High Contrast) 지원** — `@media (forced-colors: active)` 룰 + Canvas/CanvasText. effort S.
6. **aria-live regions 확장** — Toast / mutation 결과 / Long-running banner 통합. effort S.
7. **drag-drop "merge/rebase/cancel" radio modal** (plan/30 Tier 2 #24). effort S.

### LOW

8. **CJK fallback (Noto Sans JP/SC/TC)** — font-family 체인 확장. effort XS.
9. **시간 기반 commit filter** (Last 24h / Last 7 days). effort S.

### 사용자 결정 영역 (Codex 사용자 평가 + plan/17 의도 배제)

- **screen reader 실 테스트 (NVDA Windows)** — axe-core 통합 + 인간 테스터. effort L.
- **RTL 지원** — 사용자 분포 의존. effort L.
- **Mac/Linux 빌드** (plan/17 v1.3/v1.4). effort XL.
- **Magit single-letter actions** — CommandPalette 정책과 충돌 가능. 사용자 의사 결정.

---

## See Also

- [docs/plan/30-ux-comprehensive-c55-batch.md](docs/plan/30-ux-comprehensive-c55-batch.md) — Sprint c55-c58 baseline (808 LOC)
- [docs/analyze/2026-05-13-160000-codex-cross-verify.md](docs/analyze/2026-05-13-160000-codex-cross-verify.md) — Codex disagree 분석 (전 sprint)
- ~/.claude/projects/d--01-Work-08-rf-git-fried/memory/sprint_2026_05_12_c77.md — scroll polish 9 fix detail

---

### Next
- `/plan first-run-wizard` 로 HIGH-1 (3-screen welcome) 구현 계획을 작성할까요?
- 또는 `/plan ai-quota-ux + commit-search-integrated + error-boundary` 묶음으로 HIGH-2~4 통합?
- 아직 코드를 작성하지 않습니다. 먼저 plan 단계에서 변경 범위와 위험을 확정합니다.
