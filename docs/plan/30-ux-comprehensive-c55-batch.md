# plan/30 — UX Comprehensive Roadmap (c55+ batch)

> 작성일: 2026-05-08
> 트리거: 4-Round UX 평가 (`docs/ux-eval/2026-05-08-ux-eval-report.md`) 결과로 발견된 19+ 액션 항목 통합 sprint plan
> 입력: 63 PNG 캡처 + Nielsen 10 + UX 7원칙 + a11y + 반응형 + i18n + GitKraken parity 매트릭스
> 산출물: c55 / c56 / c57 sprint 3-tier 로드맵 + 코드 위치 + LOC + 시간 estimate

---

## §0 Executive Summary

### 현재 점수 (Round 4 종료)

| 차원 | 점수 | 다음 sprint 후 목표 |
|---|---:|---:|
| Nielsen 10 | 84/100 | 92/100 |
| a11y | 7/10 | 9/10 |
| 반응형 | 6/10 | 9/10 |
| i18n | 7/10 | 9/10 |
| 차별점 | 9.7/10 | 9.7 (유지) |
| **GitKraken 대체 가능성** | **8.0/10** | **9.2/10** |

### Sprint 분할 (3-tier)

| Sprint | 범위 | 시간 | 초점 |
|---|---|---:|---|
| **c55-batch-A** (P0 2 + P1 critical 4) | UX critical fix | ~3.5h | 출시 가능 수준 |
| **c55-batch-B** (P1 후속 4 + P2 4) | UX polish | ~4h | a11y AA + 반응형 |
| **c56-batch** (P3 5 + i18n EN 화면 잔여) | cosmetic | ~3h | 완성도 |

총 **~10.5h** (2-3 sprint, 8~12 commits)

---

## §1 P0 2건 — 출시 차단 (c55-A 1순위)

### P0-1: Tab focus indicator invisible (다크 테마)

**증거**: Round 3 Phase 4 측정 — `outline: rgb(16, 16, 16) auto 1px` (거의 검정) on dark background.

**WCAG**: 2.4.7 Focus Visible (Level AA) 위반. 키보드 사용자 + screen reader 사용자 영향.

**파일**: [`apps/desktop/src/styles/main.css`](../../apps/desktop/src/styles/main.css) 또는 `tailwind.config.ts` preflight

**액션**:

```css
/* main.css 추가 */
@layer base {
  *:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
}
```

또는 Tailwind global preflight + `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` 통일.

**LOC**: ~5 / **시간**: 1h (테스트 포함) / **위험**: 낮음

**검증**: vitest a11y unit test + Playwright Tab key snapshot

---

### P0-2: AI confirm dialog 한글 hardcoded (i18n 누락)

**증거**: Round 2 [ux-eval-32-en-locale.png](screenshots/ux-eval-32-en-locale.png) — locale=en 후 dialog body `"외부 LLM 송출 확인 / staged diff 가 외부 LLM 으로 송출됩니다 / 회사 보안정책을 확인하셨나요?"` 한글 그대로.

**위험**: en 사용자 보안 confirm 실패 가능 (이해 못하고 Confirm 클릭).

**파일 추정**: `apps/desktop/src/composables/useAiCli.ts` + `useAiCommitMessage.ts` + `useAiPrBody.ts` + `useAiResolveConflict.ts` + `useAiReview.ts` (5 AI composable)

**액션**:

1. grep 으로 hardcoded 한글 추출:
   ```bash
   grep -rn "외부 LLM\|보안정책\|송출" apps/desktop/src/ | grep -v locales
   ```
2. i18n 키 추가:
   ```json
   "aiConfirm": {
     "title": "외부 LLM 송출 확인",
     "bodyStaged": "staged diff 가 외부 LLM 으로 송출됩니다.",
     "bodyPolicy": "회사 보안정책을 확인하셨나요?",
     "btnCancel": "취소",
     "btnConfirm": "확인"
   }
   ```
3. en.json 영문:
   ```json
   "aiConfirm": {
     "title": "Confirm external LLM submission",
     "bodyStaged": "Your staged diff will be sent to an external LLM.",
     "bodyPolicy": "Have you reviewed your company's security policy?"
   }
   ```

**LOC**: ~10 코드 + 10 ko + 10 en = 30 / **시간**: 30분 / **위험**: 낮음

**검증**: locale=en 전환 후 Compose with AI 클릭 → en 텍스트 확인

---

## §2 P1 critical 4건 — c55-A 2순위 (~2h)

### P1-1: 1024×768 layout broken

**증거**: Round 2 [ux-eval-31-responsive-1024.png](screenshots/ux-eval-31-responsive-1024.png) — workspace 셀렉터 wrap, AI confirm dialog 좌측 sidebar overlap, footer collision.

**파일**: `apps/desktop/src/pages/index.vue` + `Sidebar.vue` + `App.vue` 레이아웃 grid

**액션**:

1. Tailwind breakpoint 활용:
   ```vue
   <!-- pages/index.vue grid -->
   <div class="grid grid-cols-[280px_1fr_420px] lg:grid-cols-[280px_1fr_420px] md:grid-cols-[200px_1fr_360px]">
   ```
2. 1024px 이하 기본 동작:
   - 좌측 sidebar collapsible (auto-collapse + toggle button)
   - 우측 patel 360px (현재 420)
   - footer 위치 fixed → static (collision 회피)
3. `min-width: 1280px` 권장 banner 또는 `<MinViewportWarning>` 컴포넌트 표시 (한 번 보이고 dismiss)

**LOC**: ~30 / **시간**: 1h / **위험**: 중간 (기존 레이아웃 회귀 가능)

**검증**: Playwright resize 1024×768 / 1280×720 / 1440×900 / 1920×1080 전체 → snapshot 비교

---

### P1-2: Mini sidebar Click target 16-18px → 24px

**증거**: Round 1 + 3 — `text-[11px] py-0.5` (16-18px row 높이) — Fitts' Law 미흡.

**파일**: [`apps/desktop/src/components/Sidebar.vue`](../../apps/desktop/src/components/Sidebar.vue) `MiniBranchList`, `MiniRemoteBranchList`, `MiniWorktreeList`, `MiniStashList`, `MiniPrList`, `MiniSubmoduleList`, `MiniTagList`

**액션**:

```vue
<!-- 기존 -->
<button class="text-[11px] px-1 py-0.5">

<!-- 변경 -->
<button class="text-[11px] px-1 py-1">
<!-- 또는 hit area 확대 + visible padding 유지 -->
<button class="text-[11px] px-1 py-1 min-h-[24px]">
```

**LOC**: 7 Mini list × 1 줄 = 7 / **시간**: 30분 / **위험**: 낮음 (시각 변화 미미)

**검증**: Playwright hover/click + 시각 회귀

---

### P1-3: 헤더 nav active route 시각 강조

**증거**: Round 1 — `홈 · 레포 · Launchpad · 설정` inline nav, 현재 페이지 강조 없음.

**파일**: `apps/desktop/src/components/RepoTabBar.vue` 또는 `App.vue` 의 nav 섹션

**액션**:

```vue
<router-link
  to="/"
  class="text-muted-foreground hover:text-foreground"
  active-class="text-foreground font-semibold border-b-2 border-emerald-500"
  exact-active-class="text-foreground font-semibold border-b-2 border-emerald-500"
>홈</router-link>
```

**LOC**: 4 link × 1 attr = 4 / **시간**: 15분 / **위험**: 낮음

**검증**: 4 page 순환 + active class 시각 확인

---

### P1-4: F-16 `/repositories` `Workspaces` 버튼 → `/settings` 라벨 부적합

**증거**: Round 4 — 사용자는 workspace **management** 화면 기대.

**액션 옵션**:
- A. label 변경: `Workspaces` → `Profiles 설정` 또는 `워크스페이스 설정`
- B. 라우팅 분리: `/workspaces` 별도 페이지 신규 (큰 작업)
- C. label `↗ 워크스페이스 설정` (화살표 + 명시)

권장: **A** (1줄 변경, 5분)

**파일**: `apps/desktop/src/pages/repositories.vue` Workspaces 버튼

**LOC**: 1 / **시간**: 5분 / **위험**: 없음

---

## §3 P1 후속 4건 — c55-B (~1.5h)

### P1-5: 좌측 sidebar 9 섹션 Miller 7±2 상한

**증거**: 워크스페이스 + 검색 + LOCAL/REMOTE/Worktree/Stash/SUBMODULES/Open PR/TAGS = 9 섹션.

**현재 완화책**: Stash / SUBMODULES default `▶` collapsed 적용됨 (활성 표시 5).

**액션** (선택):

1. **사용자 빈도 sort 옵션** — Settings → UI Customization → "Mini sidebar order" drag-drop reorder + visibility toggle
2. **그룹 묶음** — `LOCAL+REMOTE` 통합 토글 (BranchPanel 처럼) 또는 `PR+TAGS+Stash` 묶음

권장: **#1** (사용자 결정 위임, 작은 변화)

**LOC**: ~50 (`useSidebarOrder` 신규 composable + Settings UI Customization 섹션 보강) / **시간**: 1.5h / **위험**: 중간 (저장 schema 마이그)

---

### P1-6: Conflicted `🛠 / 해결` 라벨 명료화 (Round 5 보정)

**Round 5 보정**:

- `🛠` button: title `"외부 mergetool (git config merge.tool)"` (기존 OK)
- `해결` button: title 없음 + 빨강 border. 클릭 시 → **MergeEditorModal in-app** (3-way merge + ✨ AI 추천)

**문제**: `해결` 의 title 부재 + 라벨이 동작 (mark resolved? in-app editor?) 명시 안 함.

**파일**: `apps/desktop/src/components/StatusPanel.vue:582,620`

**액션 (Round 5 보정 권장)**:

```vue
<!-- 기존 -->
<button title="외부 mergetool (git config merge.tool)">🛠</button>
<button class="border-destructive/40">해결</button>

<!-- 변경 (라벨 + tooltip 명시) -->
<button title="외부 mergetool 실행 (git config merge.tool)" aria-label="외부 도구 실행">🛠 외부</button>
<button title="3-way merge editor 열기 (in-app, AI 추천 포함)" aria-label="MergeEditor 열기">⚖ 편집</button>
```

또는 단일 dropdown:

```vue
<DropdownMenu>
  <DropdownMenuTrigger>충돌 해결 ▾</DropdownMenuTrigger>
  <DropdownMenuItem>⚖ MergeEditor (3-way + AI)</DropdownMenuItem>
  <DropdownMenuItem>🛠 외부 mergetool</DropdownMenuItem>
  <DropdownMenuItem>✓ Resolved 으로 표시 (수동)</DropdownMenuItem>
</DropdownMenu>
```

**LOC**: 4~10 / **시간**: 15분 / **위험**: 낮음

**기능 자체는 강점**: MergeEditor 3-way + ✨ AI 추천은 GitKraken 대비 차별점. 라벨/tooltip 만 보정.

---

### P1-7: F-5 우클릭 commit → Create tag annotated 옵션 부재

**증거**: Round 3 — branch 우클릭은 lightweight + annotated 2-step, commit 우클릭은 1-step 만.

**파일**: [`apps/desktop/src/composables/useCommitActions.ts`](../../apps/desktop/src/composables/useCommitActions.ts) (추정)

**액션**: branch 측의 `tagActions.cmCreateLightweight` / `tagActions.cmCreateAnnotated` 와 동일 패턴 적용.

**LOC**: ~15 / **시간**: 15분 / **위험**: 낮음

---

### P1-8: EN locale 추가 화면 hardcoded ko 잔여 (Round 6 측정 완료)

**Round 6 DOM 측정 결과** (페이지별 hardcoded 한글 카운트):

| 페이지 | UI 한글 hardcoded | 추출 대상 i18n 키 |
|---|---:|---|
| Settings | **16+** | `프로파일 / 수정 / 삭제 / 외부 도구 연결 (v0.5 예정) / GitKraken 마이그레이션 / Repository-Specific / 에디터·터미널 / UI Customization / gc / fsck / LFS 등 nav 라벨` |
| Launchpad | **7+** | `레포 / 제목 / 작성자 / 브랜치 / 상태 / 갱신 (6 column header) + 💤 1개 snoozed (탭 전환)` |
| Repositories | ~1 | 대부분 user data (이미 i18n 처리됨) |
| Modal (AI confirm 외) | ?? | 수동 검증 필요 |

**총 25-30 신규 i18n 키 추정**.

**액션**:

1. **이미 측정 완료** — 각 페이지 DOM grep 으로 정확 카운트 측정.
2. i18n 키 추가:
   ```json
   "settings": {
     "nav": {
       "profiles": "Profiles",
       "forgePat": "Forge accounts (PAT)",
       "repoSpecific": "Repository-Specific",
       "editorTerminal": "Editor / Terminal (★ AI CLI)",
       ...
     },
     "btnEdit": "Edit",
     "btnDelete": "Delete"
   },
   "launchpad": {
     "header": {
       "repo": "Repo",
       "title": "Title",
       "author": "Author",
       "branch": "Branch",
       "status": "Status",
       "updated": "Updated"
     },
     "snoozed": "{n} snoozed (tab to switch)"
   }
   ```
3. e2e 검증: `tests/i18n-en-coverage.spec.ts` — 4 page DOM grep `[가-힣]` < 0 (또는 user data only).

**LOC**: ~80 코드 + ~30 ko + ~30 en = 140 / **시간**: 1.5h (Round 6 측정 완료, 추출 + 번역만 남음) / **위험**: 낮음

---

## §4 P2 4건 — c55-B (~1h)

### P2-1: F-1 Settings `외부 도구 연결 (v0.5 예정)` disabled 처리

**증거**: Round 3 — 클릭 가능 + 빈 페이지 진입.

**파일**: `apps/desktop/src/pages/settings.vue` 또는 `SettingsNav.vue`

**액션**:

```vue
<button
  disabled
  aria-disabled="true"
  class="cursor-not-allowed text-muted-foreground/50"
  title="v0.5 출시 예정 — 현재 비활성"
>외부 도구 연결 <span class="text-[10px] text-amber-500">v0.5 예정</span></button>
```

**LOC**: 3 / **시간**: 5분

---

### P2-2: F-11 Drag handle separator 키보드 접근 (`tabindex=-1` → `0`)

**증거**: Round 3 — `role=separator tabindex=-1`. WCAG 2.1.1 부분 위반.

**파일**: `apps/desktop/src/components/CommitGraph.vue` 또는 graph resize separator

**액션**:

```vue
<div
  role="separator"
  aria-label="Resize graph width"
  tabindex="0"
  @keydown.left="setGraphWidth(Math.max(120, graphWidth - 10))"
  @keydown.right="setGraphWidth(Math.min(400, graphWidth + 10))"
>
```

**LOC**: ~10 / **시간**: 30분 (키보드 핸들러 + 테스트) / **위험**: 낮음

---

### P2-3: F-6 보정 HunkStageModal Tauri runtime 재검증

**증거**: Round 3 빈 화면 — dev mock 책임 가능성.

**액션**: Tauri runtime 에서 실제 file modify → ✂ hunk 클릭 → modal 정상 표시 여부 확인. dev mock 보강 (devMock.ts:hunkStage 응답 확인).

**LOC**: 0~30 (dev mock 보강 시) / **시간**: 1h (재검증 + 필요 시 보강) / **위험**: 중간

---

### P2-4: status bar 우측 disabled 버튼 시각 노이즈

**증거**: Round 1 — `Ctrl+P Palette` / `Ctrl+1~7 View` [disabled].

**액션**:

- option A: 두 button 제거 (단축키 alone 충분)
- option B: tooltip 만 keyboard hint 으로 유지, button 시각 disabled → muted (낮은 opacity)
- option C: 클릭 시 실제 동작 활성화 (Ctrl+P click → palette 열림, Ctrl+1~7 button → 우측 panel 토글)

권장: **C** (가장 사용자 친화) — `@click="onCtrlP"` wiring

**LOC**: ~10 / **시간**: 30분

---

## §5 P3 5건 — c56-batch (~1.5h)

### P3-1: F-12 Canvas DPR 미대응 (Retina fuzzy)

**증거**: Round 3 — CommitGraph Canvas 200×716 logical = 200×716 device px (no DPR).

**파일**: `apps/desktop/src/components/CommitGraph.vue` `drawGraph` 함수

**액션**:

```ts
const dpr = window.devicePixelRatio || 1
canvas.width = canvas.offsetWidth * dpr
canvas.height = canvas.offsetHeight * dpr
canvas.style.width = canvas.offsetWidth + 'px'
canvas.style.height = canvas.offsetHeight + 'px'
ctx.scale(dpr, dpr)
```

**LOC**: ~10 / **시간**: 30분 / **위험**: 중간 (perf 영향, c51 정밀 시각 회귀 검증)

---

### P3-2: F-14 Workspace 셀렉터 빈 1번째 옵션 placeholder mismatch

**증거**: Round 3 — `<option value="">` 빈 텍스트.

**액션**:

```vue
<option value="">전체 워크스페이스</option>
```

**LOC**: 1 / **시간**: 5분

---

### P3-3: commit time format relative option

**증거**: Round 1 — `05. 08. 오후 05:40` 공간 효율 ↓.

**액션**: Settings → UI Customization 에 `Time format: 절대 / 상대 / 둘 다` toggle. `dayjs.fromNow()` 통합.

**LOC**: ~30 / **시간**: 30분

---

### P3-4: header v0.3.0 tooltip

**증거**: Round 1 — version 옆 추가 정보 부재.

**액션**:

```vue
<span :title="`Released: 2026-04-30 / Sprint c54+++ / Click to open CHANGELOG`">v0.3.0</span>
```

또는 link to CHANGELOG.md (in-app or external).

**LOC**: 3 / **시간**: 10분

---

### P3-5: avatar 한글/영문 단글자 mix

**증거**: Round 1 — `김 / 이 / 박` (한글) vs `T / y` (영문) — 일관성 부분 OK.

**액션**: 한글 fallback 첫 2글자 (예: "김태"). 단, 한글 1글자 + 영문 1글자 mix 시 폰트 width 균등성 확인 필요.

**LOC**: ~10 (`utils/avatarInitial.ts`) / **시간**: 30분 / **위험**: 낮음

---

## §6 차별점 검증 catalog (15건 — 모두 작동 검증됨)

| # | 차별점 | 검증 시점 | 증거 |
|---|---|---|---|
| 1 | 한글 visual width counter (amber→rose) | Round 3 F-7 | [46-conventional-builder-korean](screenshots/ux-eval-46-conventional-builder-korean.png) [47-conventional-overlimit](screenshots/ux-eval-47-conventional-overlimit.png) |
| 2 | Conventional ↔ Free-form 1-click | Round 3 F-8 | [48-free-form-mode](screenshots/ux-eval-48-free-form-mode.png) |
| 3 | PromptDialog c38 (window.prompt 9건 마이그) | Round 3 F-3 | [40-create-tag-prompt](screenshots/ux-eval-40-create-tag-prompt.png) |
| 4 | Compare/Range diff = FullscreenDiffView mode 통합 | Round 3 F-4 | [39-compare-modal](screenshots/ux-eval-39-compare-modal.png) [41-range-diff](screenshots/ux-eval-41-range-diff.png) |
| 5 | Empty state 4-channel 일관 메시지 | Round 3 F-13 | [51-workspace-oss](screenshots/ux-eval-51-workspace-oss.png) |
| 6 | Mini 우클릭 20 액션 + Reset Soft·Mixed·Hard | Round 2~3 | [09b-mini-context-menu-VISIBLE](screenshots/ux-eval-09b-mini-context-menu-VISIBLE.png) |
| 7 | Drag handle 12px hit > 2px visible | Round 3 F-10 | DOM 검증 |
| 8 | a11y 90% explicit accessible name | Round 2 | DOM 검증 |
| 9 | Workspace 1-click 4-channel reactive | Round 3 F-15 | [50-workspace-회사](screenshots/ux-eval-50-workspace-회사.png) |
| 10 | Settings nav NN/g 그룹화 (계정/워크스페이스/에디터·터미널/UI/유지보수/PLUGIN/시작·마이그레이션) | Round 3 F-2 | Settings 캡처 4건 |
| 11 | Clone preset 5 (전체/얕은/Monorepo/필요한 디렉터리만/사용자 정의) + 고급 옵션 | Round 2 | [22-clone-wizard](screenshots/ux-eval-22-clone-wizard.png) |
| 12 | AI security gate 30s TTL | Round 2 | [25-ai-compose](screenshots/ux-eval-25-ai-compose.png) |
| 13 | **Command Palette 70+ 명령어 카테고리 그룹화** | Round 4 | [61-command-palette-real](screenshots/ux-eval-61-command-palette-real.png) |
| 14 | **첫 사용자 onboarding toast** | Round 4 | [57-onboarding-empty](screenshots/ux-eval-57-onboarding-empty.png) |
| 15 | **localStorage 11 키 사용자 preference 영속** | Round 4 | DOM 검증 |
| 16 | **MergeEditorModal 3-way merge + ✨ AI 추천** (해결 button) | Round 5 | [65-resolve-button](screenshots/ux-eval-65-resolve-button.png) — `🟦 OURS / ✓ RESULT (편집) / 🟪 THEIRS` + `전체 파일을 한 쪽으로` 1-click + ✨ AI 추천 |
| 17 | **CreatePrModal AI body 생성 + 한글 width counter + draft GitHub-only 명시** | Round 5 | [71-create-pr-tiptap](screenshots/ux-eval-71-create-pr-tiptap.png) — head dropdown / base / 제목 0/72 / 본문 마크다운 + ✨ AI body / draft 명시 |
| 18 | **ConfirmDialog 파괴적 액션 가드** | Round 6 | [84-confirm-dialog-delete](screenshots/ux-eval-84-confirm-dialog-delete.png) — `⚠ 파괴적 액션 확인 / 되돌리기 어려울 수 있습니다` |
| 19 | **PR panel 4 sub-tab (PR / ISSUE / RELEASE / TAG)** — GitKraken 단일 PR 탭 대비 우위 | Round 6 | [78-issue-tab](screenshots/ux-eval-78-issue-tab.png) [79-release-tab](screenshots/ux-eval-79-release-tab.png) [80-tag-tab](screenshots/ux-eval-80-tag-tab.png) |
| 20 | **UI Customization 옵션 catalog** (Date locale 자동/한국어/English / Launchpad 숨김 / 헤더 링크 숨김 / 아바타 이니셜·Gravatar / 테마 export·Import) | Round 6 | [83-ui-customization-detail](screenshots/ux-eval-83-ui-customization-detail.png) |
| 21 | **Repository-Specific override 12+ fields** (gitflow + i18n.encoding + gpg + user) | Round 7 | [98-repo-specific-fields](screenshots/ux-eval-98-repo-specific-fields.png) — `core.hooksPath / i18n.commitEncoding / i18n.logOutputEncoding / gitflow.* / commit.gpgsign / user.signingkey / gpg.format / user.name / user.email` |
| 22 | **Stash apply/pop tooltip 명시** | Round 7 | [93-stash-actions](screenshots/ux-eval-93-stash-actions.png) — `apply (working tree 에 적용, stash 보존) / pop (apply + 제거)` UX-7 Recognition |

**c55 sprint 진행 시 회귀 보호 필수**: 모든 15 차별점은 vitest unit test + Playwright e2e 시나리오로 lock-in.

---

## §7 WCAG 2.1 AA 도달 roadmap

### 현재 부분 위반 / 미흡

| WCAG | 항목 | 현 상태 | 액션 |
|---|---|---|---|
| 2.4.7 Focus Visible (AA) | Tab focus indicator | 🔴 invisible (다크) | P0-1 |
| 2.1.1 Keyboard (A) | Drag handle 키보드 접근 | 🟡 부분 | P2-2 |
| 1.4.3 Contrast Minimum (AA) | 다크/라이트 contrast | 🟢 추정 OK (axe-core 미측정) | Round 후속 |
| 1.4.11 Non-text Contrast (AA) | UI component 3:1 | 🟢 추정 OK | Round 후속 |
| 4.1.2 Name, Role, Value (A) | 60+ button accessible name | 🟢 0 missing (Round 2 검증) | 유지 |
| 2.4.6 Headings and Labels (AA) | label 명확 | 🟡 일부 (`전체 →`, `🛠 / 해결`) | P1-6 |

### 도달 계획

- **c55**: 2.4.7 (P0-1) + 2.4.6 (P1-6) → AA 달성
- **c56**: 2.1.1 (P2-2) + axe-core 통합 contrast 측정 → AA 검증
- **c57**: WCAG 2.2 신규 항목 검토

---

## §8 반응형 break-point design

### 현재 break-point

| Viewport | 상태 | 비고 |
|---|---|---|
| 1920×1080 | OK | (미테스트, 추정) |
| 1440×900 | ✅ 정상 | Round 1~4 모두 1440 |
| 1280×720 | ✅ 정상 | Round 2 ux-eval-30 |
| 1024×768 | 🔴 broken | Round 2 ux-eval-31 — workspace wrap, dialog overlap, footer collision |
| <1024 | ❌ unsupported | 명시 banner 부재 |

### c55-A P1-1 후 design

```css
/* 권장 break-point */
@media (min-width: 1280px) { /* default 3-column 280+1fr+420 */ }
@media (min-width: 1024px) and (max-width: 1279px) { /* 200+1fr+360, sidebar collapsible */ }
@media (max-width: 1023px) { /* min-width banner */ }
```

### Tailwind config 권장

```ts
// tailwind.config.ts
theme: {
  screens: {
    sm: '640px',    // mobile (unsupported, banner)
    md: '1024px',   // small desktop (collapsed sidebar)
    lg: '1280px',   // standard
    xl: '1536px',   // wide
    '2xl': '1920px' // ultra-wide
  }
}
```

---

## §9 i18n completeness roadmap

### 현재

- ko / en 1044 leaf-keys 대칭 (Round 2 검증)
- AI confirm dialog hardcoded ko (P0-2)
- 다른 화면 EN 잔여 추정 (Round 5 미해결, P1-8)

### c55-A 후 추가 검증 시나리오

```typescript
// e2e/i18n-en-coverage.spec.ts (신규 권장)
test.describe('EN locale coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('git-fried.locale.v1', 'en'));
    await page.reload();
  });
  test('home', async ({ page }) => {
    // grep page text for [가-힣] regex
  });
  // 4 page + 5 modal × 한글 잔여 = expected 0
});
```

### 잠재 hardcoded ko 후보

```bash
# c55-B 사전 작업
grep -rn "[가-힣]" apps/desktop/src/components/ apps/desktop/src/composables/ \
  | grep -v "// \|/\* \|\*\* " \
  | grep -v "ko.json\|en.json"
# 결과 → i18n 키 추출 후보
```

---

## §10 Performance baseline (bench/)

### 현재

- bench/README.md 절차 완비, 사용자 본인 환경 의존
- baseline.json null (외부 BENCH_REPO 미설정)

### c55-c57 동안 측정 권장

| 메트릭 | 목표 | 도구 |
|---|---|---|
| Cold start | < 1.5s | bench/start.ps1 |
| 1k commit graph render | < 100ms | bench/git_perf.rs (c51 95ms 회복 검증) |
| 500 file scroll FPS | 60fps | DevTools profiler (수동) |
| Memory @ 10 repos open | < 100MB | bench/memory.ps1 |
| AI compose round-trip | < 8s (60s timeout 내) | useAiCommitMessage.test.ts |

---

## §11 GitKraken parity 매트릭스 (32 기능 전체)

### Tier 1 — 동등 또는 우위 (22건)

| # | 기능 | GK | git-fried | 평가 |
|---|---|---|---|---|
| 1 | Multi-repo 탭 | ✅ | ✅ | 동등 |
| 2 | Workspace 그룹화 | ✅ Cloud | ✅ 로컬 (전체/회사/개인/OSS) | 동등 (Cloud 의도 배제) |
| 3 | Commit graph | ✅ Canvas | ✅ Canvas 95ms/1k commit | 동등 |
| 4 | Commit node 시각 (merge donut/tag/signed) | ✅ | ✅ c51 | 동등 |
| 5 | Mini sidebar 그룹 | ✅ 7 그룹 | ✅ 7 + Workspace + 검색 = 9 | 동등+ |
| 6 | Right-click context menu (branch) | ✅ ~15 액션 | ✅ **20 액션** + Reset 3 sub | **동등+** |
| 7 | Right-click context menu (commit) | ✅ ~10 액션 | ✅ 11 + Range diff (c38) | 동등+ |
| 8 | Right panel 7 탭 | ✅ | ✅ | 동등 |
| 9 | Inline + Split diff | ✅ | ✅ + MergeView (c54+++) | 동등 |
| 10 | Hunk-stage | ✅ | ✅ ✂ hunk 인라인 | 동등 |
| 11 | Interactive rebase | ✅ in-app | ✅ via Ctrl+P | 동등 |
| 12 | Bisect | ✅ in-app | ✅ via Ctrl+P | 동등 |
| 13 | Reflog | ✅ in-app | ✅ via Ctrl+P + V-6 | 동등 |
| 14 | Compare with | ✅ | ✅ FullscreenDiffView 통합 (Hick's Law) | 동등+ |
| 15 | **Conventional Commits 빌더** | ❌ | ✅ 12 type + 한글 visual width | **차별점 ⭐** |
| 16 | **AI compose** | $7/mo | ✅ Claude/Codex CLI 무료 | **차별점 ⭐** |
| 17 | **한글 safety** | ❌ | ✅ width / encoding | **차별점 ⭐** |
| 18 | **Gitea 1급** | 별도 PAT | ✅ 회사 프로파일 | **차별점 ⭐** |
| 19 | **Tauri-light** | Electron 200MB+ | ~30MB | **차별점 ⭐** |
| 20 | Launchpad PR | ✅ | ✅ + bot 분리 + snooze + Saved Views + filter syntax 6 토큰 | 동등+ |
| 21 | Clone wizard | ✅ | ✅ preset 5 + 고급 옵션 | 동등+ |
| 22 | **Command Palette** | ✅ Ctrl+P | ✅ 70+ 명령 카테고리 | 동등 |

### Tier 2 — 부분 미흡 (5건)

| # | 기능 | 현 상태 | c55+ 액션 |
|---|---|---|---|
| 23 | Conflict resolver | 🟡 라벨 모호 + 외부/인라인 분기 명시 부족 | P1-6 |
| 24 | Drag-drop "m/r/cancel" radio modal | ❌ UX-9 잔여 | c56 |
| 25 | LFS 작업 직접 trigger | 🟡 panel 만 | c56 |
| 26 | Bulk fetch failure 시각화 | ✅ Modal 존재 단 검증 미실시 | c56 |
| 27 | TipTap PR description editor | ✅ 존재 단 trigger 미관찰 | c56 검증 |

### Tier 3 — 의도 배제 (5건)

| # | 기능 | 사유 |
|---|---|---|
| 28 | Cloud Patch | 단일 사용자 dogfood 정체성 |
| 29 | Cloud Workspace | (동일) |
| 30 | macOS / Linux 빌드 | plan/17 v1.3/v1.4 |
| 31 | OAuth (GitHub/Gitea) | plan/17 v1.x |
| 32 | Telemetry / Sentry | plan/17 v1.x |

---

## §12 Sprint 분할 상세

### c55-batch-A (UX critical fix, ~3.5h, 4 commits)

| # | 작업 | LOC | 시간 | 파일 |
|---|---|---:|---:|---|
| A1 | P0-1 Tab focus indicator | 5 | 1h | main.css |
| A2 | P0-2 AI confirm dialog i18n | 30 | 30분 | useAiCli.ts + ko/en.json |
| A3 | P1-1 1024 layout graceful | 30 | 1h | pages/index.vue + Sidebar.vue |
| A4 | P1-2 Mini sidebar hit-area | 7 | 30분 | Sidebar.vue (7 Mini list) |
| A5 | P1-3 헤더 active route | 4 | 15분 | App.vue (4 link) |
| A6 | P1-4 F-16 Workspaces 라벨 | 1 | 5분 | repositories.vue |
| **합계** | | **77** | **~3.5h** | 6 commits |

### c55-batch-B (UX polish, ~4h, 4 commits)

| # | 작업 | LOC | 시간 |
|---|---|---:|---:|
| B1 | P1-5 Mini sidebar 사용자 빈도 sort | 50 | 1.5h |
| B2 | P1-6 Conflicted 라벨 명료화 | 4 | 15분 |
| B3 | P1-7 F-5 commit annotated tag | 15 | 15분 |
| B4 | P1-8 EN locale 추가 화면 검증 + 잔여 추출 | 50 | 1h |
| B5 | P2-1 외부 도구 v0.5 disabled 처리 | 3 | 5분 |
| B6 | P2-2 Drag handle keyboard nav | 10 | 30분 |
| B7 | P2-4 status bar disabled 버튼 wiring | 10 | 30분 |
| **합계** | | **142** | **~4h** | 4 commits |

### c56-batch (cosmetic + perf, ~3h, 4 commits)

| # | 작업 | LOC | 시간 |
|---|---|---:|---:|
| C1 | P2-3 HunkStageModal Tauri runtime 재검증 | 0~30 | 1h |
| C2 | P3-1 Canvas DPR | 10 | 30분 |
| C3 | P3-2 Workspace placeholder | 1 | 5분 |
| C4 | P3-3 commit time relative | 30 | 30분 |
| C5 | P3-4 v0.3.0 tooltip | 3 | 10분 |
| C6 | P3-5 avatar 2글자 fallback | 10 | 30분 |
| C7 | bench/baseline.json 측정 | 0 | 30분 (외부 BENCH_REPO) |
| **합계** | | **~84** | **~3h** | 4 commits |

### c57+ (장기, plan/30 외부 의존)

- WCAG 2.2 신규 항목
- macOS / Linux 빌드 (plan/17)
- Cloud Workspace (의도 배제 — 정체성 변경 시 재검토)
- axe-core 자동 a11y 측정 통합
- Performance benchmark 정기화

---

## §13 검증 + 회귀 보호

### c55-A 종료 시 회귀 체크리스트

- [ ] Tab focus indicator 다크/라이트 모두 visible (`outline-color: hsl(var(--ring))` 검증)
- [ ] EN locale home / Settings / Repositories / Launchpad / 5 modal hardcoded ko 0건
- [ ] 1024×768 / 1280×720 / 1440×900 / 1920×1080 4 viewport 정상 (Playwright snapshot 비교)
- [ ] Mini sidebar 7 list hit-area ≥24px (Playwright getBoundingClientRect)
- [ ] 4 page active route 시각 강조 visible
- [ ] `/repositories` Workspaces 버튼 라벨 변경 후 사용자 confusion 0건 (1주 dogfood 후 확인)

### vitest 신규 테스트 권장

```typescript
// tests/a11y/focus-visible.test.ts
describe('focus visible', () => {
  it('all interactive elements show focus ring on Tab', async () => {
    // ...
  });
});

// tests/i18n/en-coverage.test.ts
describe('en locale', () => {
  it('no hardcoded Korean in component templates', () => {
    // grep [가-힣] in *.vue templates
  });
});
```

---

## §14 결정 매트릭스 + 사용자 승인 항목

### 사용자 결정 필요

| # | 항목 | 옵션 |
|---|---|---|
| D1 | Mini sidebar 9 섹션 → 사용자 sort vs 그룹 묶음 | A: sort / B: 묶음 / C: 둘 다 |
| D2 | Conflicted 라벨 → 단일 dropdown vs 두 버튼 명료화 | A: dropdown / B: 라벨만 변경 |
| D3 | status bar disabled 버튼 → 제거 vs wiring | A: 제거 / B: 활성 wiring (권장) |
| D4 | commit time format → relative default vs option | A: 절대 default / B: 사용자 선택 |
| D5 | <1024px viewport → banner vs 차단 | A: banner 안내 / B: 사용 차단 |

권장 default: D1=A / D2=B / D3=B / D4=B / D5=A

---

## §15 Roadmap 마일스톤

| 마일스톤 | 시점 | 산출물 |
|---|---|---|
| **M1: c55-A 종료** | +3.5h | P0 0건 / P1 critical 4 fix → 출시 가능 수준 |
| **M2: c55-B 종료** | +7.5h | P1 후속 4 + P2 4 fix → a11y AA + 반응형 OK |
| **M3: c56 종료** | +10.5h | P3 5 fix + perf baseline → v0.3.x 출시 |
| **M4: 외부 의존 완료 (사용자 본인)** | TBD | EV cert + macOS/Linux + tag v0.3.0 push → v0.3.0 release |
| **M5: c57+** | TBD | WCAG 2.2 + axe-core 통합 + Cloud (의도 배제) |

---

## §16 참조

- `docs/ux-eval/2026-05-08-ux-eval-report.md` — 4 Round 평가 상세
- `docs/ux-eval/checkpoint-rounds.md` — Round 진행 상황
- `docs/plan/29-deep-research-rescope.md` — c38 5 에픽 (Restore / Smart Stash / Clone presets / Range diff / Worktree polish + PromptDialog)
- `docs/plan/26-3constraints-identity.md` — 단일 사용자 dogfood 정체성
- `docs/plan/22-ui-polish-v2.md` — UX 7원칙 P0 5건 + R-2A
- `docs/IMPLEMENTATION-STATUS.md` — Sprint c25~c54+++ 145 commits 누적
- 캡처: `d:/01.Work/08.rf/git-fried/ux-eval-01.png ~ ux-eval-63.png` (63건)

---

**작성 종료**: 2026-05-08 19:30 KST
**다음 단계**: 사용자 승인 → c55-batch-A 6 commits 즉시 실행 가능
