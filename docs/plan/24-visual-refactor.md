# 24. Visual Refactor — Figma 디자인 → 코드 적용

작성: 2026-04-27 / 트리거: plan/23 Sprint 1~5 완료 (Figma file 7 페이지 / 60+ 아트보드 / Self-assessment 8/8 ✓)

> **목적**: plan/23 의 Figma 디자인 산출물을 코드에 적용한다. 디자인은 SoT 로 굳히고, 코드는 그에 맞춰 visual refactor.
>
> **연계**: [plan/23](./23-design-system-extraction.md) (디자인 추출 절차서), [plan/22](./22-ui-polish-v2.md) (UI Polish v2 — 22-7 잔여), [docs/design-context/](../design-context/) 7 문서 + Figma file `git-fried Design System.html`

---

## 1. 30초 요약

| 항목 | 값 |
| ---- | ---- |
| Sub-sprint 수 | 6 (A 토큰 → B Primitives → C Hub Screens → D Modal Audit → E UX Polish → F 검증) |
| 추정 일정 (AI pair) | 12~18일 (3주 — 단일 세션 범위 외) |
| 의존 plan | plan/22 22-7 (병행 가능, Tooltip primitive 통합 권장) |
| 코드 변경 규모 | ~50 파일 (tailwind.config.ts / main.css / 18 modal / 48 component / Pretendard self-host) |
| 디자인 SoT | Figma file `git-fried Design System.html` (7 페이지 / 60+ 아트보드) |
| 검증 방식 | Sprint F 에서 Playwright 36+ PNG 재캡처 → 디자인 vs 코드 visual diff audit |

---

## 2. 배경 / 의존성

### 2-1. 디자인 SoT 자산 (plan/23 결과)

- 7 .md 문서 (`docs/design-context/00~06.md` + README) — 정체성 / 토큰 / 컴포넌트 / 화면 / 인터랙션 / Figma 의뢰서 / GitKraken parity
- 36 Playwright PNG (`docs/design-context/screenshots/*.png`) — 코드 현황 baseline
- Figma file `git-fried Design System.html`:
  - Page 01 Foundations + 01b Layout Extensibility
  - Page 02 Primitives (D5 Button + D6 Form 6)
  - Page 03 Modals (D7 BaseModal + 5 시뮬레이션)
  - Page 04 Floating (D8 Tooltip + D9 ContextMenu + D10 Toast)
  - Page 05 Hub Screens (D11~D14 + D14b Onboarding)
  - Page 06 Modal Audit (18 modal + 17 ContextMenu 12 위치 86 actions)
  - Page 07 UX Polish (D18~D27)

### 2-2. 코드 현황 (이미 구현된 부분)

- ✅ `BaseModal` (Sprint 22-5) + 11/18 modal 마이그레이션 (Sprint 22-5: 3 / 22-6: 8). 잔여 7 (Compare / CommitDiff / RepoSwitcher / HunkStage / InteractiveRebase / MergeEditor / PrDetail)
- ✅ `useFocusTrap` (Sprint 22-5)
- ✅ ContextMenu 11/17 위치 (CM-1~11). 잔여 6 (P2 + 일부 P1)
- ✅ aria-label 시범 6+ (Sprint 22-5/22-6) — 47 카탈로그 중 ~10 적용. 잔여 ~37
- ✅ V-5 StatusPanel inline diff preview (Sprint 22-6)
- ✅ F-I1 StatusPanel file filter / F-I2 401·403 한국어 가이드 / Q-4 LoadingSpinner + EmptyState (Sprint 22-6)
- ❌ Tooltip primitive
- ❌ Pretendard self-host (현재 OS fallback)
- ❌ secondary/muted/accent 색 의미 분리
- ❌ Elevation tier (popover/modal/toast 3 단계)
- ❌ Z-index 6 layer 시스템
- ❌ Skeleton UI 4 화면
- ❌ DnD 4 시나리오
- ❌ Onboarding (D14b)
- ❌ Integrations slot (Sidebar 푸터)
- ❌ Settings 2-level 6 그룹 재구성
- ❌ Tab overflow ⌘8+ dropdown

### 2-3. 의존성

- **plan/22 22-7** 와 병행 가능 — Tooltip primitive 가 22-7 에 들어가면 plan/24 Sprint B 자연 흡수
- 코드 충돌 위험: 22-7 잔여 BaseModal 마이그레이션 7건이 plan/24 Sprint D 와 겹침 — **22-7 의 BaseModal 마이그레이션은 plan/24 Sprint D 로 이전 권장**
- plan/22 22-7 의 Q-3 Tooltip 만 남으면 plan/24 Sprint B 의 D8 일부로 흡수

---

## 3. Sprint A — Foundation 토큰 코드 적용 (1~2일)

**목표**: Figma Variables 라이브러리를 `tailwind.config.ts` + `src/styles/main.css` 에 1:1 반영.

### 3-1. Deliverable

| # | 작업 | 파일 |
| ---- | ---- | ---- |
| A-1 | **Pretendard self-host** — woff2 다운로드 + `@font-face` + `<link rel="preload">` | `apps/desktop/index.html` + `src/styles/fonts/` + `main.css` |
| A-2 | **Color semantic 분리** — Q2 답변 적용: secondary 유지 / muted 한 단계 흐리게 / accent = primary 옅은 변형 | `src/styles/main.css` |
| A-3 | **Status semantic 토큰** — success / warning / info (light + dark) | `tailwind.config.ts` extend.colors + `main.css` |
| A-4 | **Elevation tier 3** — popover (shadow-sm) / modal (shadow-lg) / toast (shadow-xl) | `tailwind.config.ts` boxShadow extend |
| A-5 | **Z-index 6 layer** — 10/20/30/40/50/60 | `tailwind.config.ts` zIndex extend |
| A-6 | **Spacing/Radius scale 검증** — 현재 4/8/12/16/24/32 + 4/6/8/full 그대로 OK |  |

### 3-2. 검증

- typecheck 0 / lint 0 / vitest 13 pass
- `bunx tsx scripts/capture-screens.ts` 재실행 → 36 PNG 재캡처 → 토큰 변경 시각 확인

### 3-3. 위험

- Pretendard woff2 라이센스 확인 (SIL Open Font License 1.1, 재배포 OK)
- secondary/muted/accent 분리 후 기존 컴포넌트 색이 어색해질 수 있음 — 36 PNG diff 로 즉시 검증

---

## 4. Sprint B — Primitives (2~3일)

**목표**: shadcn-vue / reka-ui 도입 + Tooltip / ContextMenu 시스템 + Button / Form variants.

### 4-1. Deliverable

| # | 작업 | 파일 |
| ---- | ---- | ---- |
| B-1 | **reka-ui 도입** — `bun add reka-ui` + Dialog/Tooltip/DropdownMenu/Popover wrap | `package.json` + 신규 `components/ui/` |
| B-2 | **🔥 Tooltip primitive** — 4 variant (Action hint / Truncated expand / Status meta / Disabled reason) + delay 500ms / position auto-flip / arrow | `components/ui/Tooltip.vue` |
| B-3 | **ContextMenu primitive 재작성** — 기존 `ContextMenu.vue` 를 reka-ui DropdownMenu 기반으로 wrapping (focus trap / aria 자동) | `components/ContextMenu.vue` 갱신 |
| B-4 | **Button variant matrix** — 4 variant × 5 state × 3 size + icon-only (aria-label 한국어) | 신규 `components/ui/Button.vue` 또는 utility class |
| B-5 | **Form primitive 6** — Input / Textarea (한글 visualWidth 카운터 통합) / Checkbox / Radio / Select / Tabs (scrollable) | `components/ui/Form*.vue` |
| B-6 | **Toast 시스템 dedup** — Map<key, lastShownAt> + 1s 내 같은 key count badge + action 버튼 | `composables/useToast.ts` 갱신 |

### 4-2. 검증

- 기존 47 컴포넌트 중 Tooltip 후보 위치 ≥10 적용
- BaseModal 잔여 7 마이그레이션 시작 (Sprint D 의 일부)

---

## 5. Sprint C — Hub Screens (3~5일)

**목표**: D11~D14 + D14b Onboarding 적용.

### 5-1. Deliverable

| # | 작업 | 파일 |
| ---- | ---- | ---- |
| C-1 | **D11 CommitDiffModal** — 4 mode toggle 정리 + V-3 action group (cherry-pick / revert / reset) + nested AiResultModal streaming + 우측 file list 패널 | `components/CommitDiffModal.vue` |
| C-2 | **D12 PrDetailModal** — 4 tab (Conversation / Files / Reviews / Comments) + footer Merge dropdown (merge / squash / rebase) | `components/PrDetailModal.vue` |
| C-3 | **D13 StatusPanel** — 5 frame 적용 (default / empty / context 9 / detail / light) + V-5 inline diff preview 정리 (이미 22-6 구현, 디자인 alignment) | `components/StatusPanel.vue` |
| C-4 | **D14 Sidebar + 메인 layout** — workspace color picker / 50+ virtualization (vue-virtual) / **🆕 Integrations slot** (collapsed group + status row) | `components/Sidebar.vue` + `pages/index.vue` |
| C-5 | **🆕 D14b Onboarding flow** — 첫 실행 시 GitKrakenImportDetect 자동 → 5 step modal (full size) | 신규 `components/OnboardingFlow.vue` + `App.vue` 진입 hook |
| C-6 | **Tab overflow ⌘8+ dropdown** — D25 audit 결정. Tab nav `⩾8` 시 더 보기 dropdown | RepoTabBar / ForgePanel / Settings nav |
| C-7 | **Settings 2-level 6 그룹 재구성** — Q1 답변: 계정 / 워크스페이스 / 에디터·터미널(★AI CLI) / UI / 유지보수 / 시작·마이그레이션 | `pages/settings.vue` |

### 5-2. 검증

- 36 PNG 재캡처 → Hub screen 이전/이후 visual diff
- Onboarding flow E2E (vitest 또는 Playwright)

---

## 6. Sprint D — Modal Audit (2~4일)

**목표**: 18 모달 모두 BaseModal 위에 + 미캡처 5 신규 디자인 적용.

### 6-1. Deliverable

| # | 작업 | 파일 |
| ---- | ---- | ---- |
| D-1 | **BaseModal 잔여 7 마이그레이션** — Compare / CommitDiff / RepoSwitcher / HunkStage / InteractiveRebase / MergeEditor / PrDetail | 각 *Modal.vue |
| D-2 | **미캡처 5 신규 적용** — MergeEditor (3-pane full) / HunkStage (left-list+right-picker full) / RemoteManage (md) / AiResultModal (streaming) / GitKrakenImport (D14b 의 일부) | 각 *Modal.vue |
| D-3 | **17 ContextMenu 잔여 6** — P2 (CM-12 RemoteManage / CM-13 IssuesPanel / CM-14 ReleasesPanel) + P1 잔여 + 추가 위치 | 각 panel.vue |
| D-4 | **Modal size tier 적용** — sm/md/lg/xl/full Q2 답변 (full 은 onboarding/MergeEditor/InteractiveRebase 만) | BaseModal `max-w-*` prop |

### 6-2. 검증

- 18 modal × BaseModal 일관 (Header/Body/Footer 슬롯 / a11y / focus trap)
- 17 ContextMenu × 키보드 nav (↑↓ Enter Esc ← submenu close → submenu open)

---

## 7. Sprint E — UX Polish (3~5일)

**목표**: D18~D27 산출물 적용.

### 7-1. Deliverable

| # | 작업 | 파일 |
| ---- | ---- | ---- |
| E-1 | **D18 Skeleton 4 화면** — CommitGraph / BranchPanel / StatusPanel / PrDetail | 각 component skeleton sub-component |
| E-2 | **D19 Empty state 4 종** — onboarding hero / 검색 0 / 레포 0 / PR 0 | EmptyState 활용 (Sprint 22-6 신규) + 화면 적용 |
| E-3 | **D20 DnD 4 시나리오** — Branch→Branch / Commit→Branch / File→Stash / Tab reorder. ghost / drop highlight / cancel | `bun add vue-draggable-plus` + 각 panel |
| E-4 | **D21 Long-running progress 30s/1m/4m 단계** — 5min IPC 작업 UI | `useLongRunningProgress.ts` 신규 + 기존 invokeWithTimeout 통합 |
| E-5 | **D22 한글 처리 — 좌측 ellipsis / tooltip expand / encoding ⚠** | utility + Sidebar / file path |
| E-6 | **D23 a11y 47 aria-label** — 잔여 ~37 button | 각 component |
| E-7 | **D24 Micro-interaction 12 transition + reduced-motion** — `@media (prefers-reduced-motion)` fallback | `main.css` + 컴포넌트 |
| E-8 | **D26 Plugin/Integration 3 slot 활용** — Sidebar Integrations + Settings Plugin + CommandPalette Integration 카테고리 (placeholder, 향후 실 plugin 도입 시 채움) | Sidebar / settings / palette |
| E-9 | **D27 v0.4 placeholder pattern** — 06 의 🔜 15 항목 disabled + tooltip "v0.4 예정" + click → toast.info | 각 위치 |

### 7-2. 검증

- Lighthouse a11y score ≥90
- reduced-motion 사용자 경로 시각 확인
- 47 aria-label 카탈로그 100% 적용

---

## 8. Sprint F — 검증 & 마무리 (1~2일)

**목표**: 디자인 vs 코드 drift 0 보장 + 디자인 SoT 영구화.

### 8-1. Deliverable

| # | 작업 | 비고 |
| ---- | ---- | ---- |
| F-1 | **Playwright 재캡처 36+ PNG** — 변경된 컴포넌트 반영 | scripts/capture-screens.ts 재실행 |
| F-2 | **디자인 vs 코드 visual diff audit** — Figma file 의 60+ 아트보드와 36+ 신규 PNG 1:1 비교 | docs/design-context/audit-2026-04.md (또는 plan/24 § 11) 신규 |
| F-3 | **drift 보고서 작성** — 의도 어긋남 / 미적용 항목 / 추후 처리 | docs/plan/25-design-drift-audit.md (옵션) |
| F-4 | **Figma file export** — Figma file 영구 자산화 (PDF / PNG export) | docs/design-context/figma-export/ |
| F-5 | **CHANGELOG 업데이트 + 버전 bump** | `[Unreleased] → 0.3.0` 결정 |
| F-6 | **dogfood feedback 누적 점검** — plan/22 §5 의 13 friction 중 plan/24 로 해결된 항목 표기 | plan/22 §5 갱신 |

### 8-2. 검증 — Done 기준

- [ ] 36+ PNG 재캡처 + Figma 60+ 아트보드 visual diff ≥95% 일치
- [ ] typecheck 0 / lint 0 / vitest 13+ pass
- [ ] Lighthouse a11y ≥90
- [ ] reduced-motion 경로 OK
- [ ] BaseModal 18/18 마이그레이션 완료
- [ ] ContextMenu 17/17 위치 완료
- [ ] aria-label 47/47 카탈로그 완료
- [ ] Tooltip primitive 도입 완료
- [ ] Pretendard self-host 완료

---

## 9. 위험 / 완화

| # | 위험 | 완화 |
|---|------|------|
| 1 | plan/22 22-7 와 코드 충돌 | 22-7 의 BaseModal 잔여 7 마이그레이션을 plan/24 Sprint D 로 이전. Tooltip 만 22-7 에 남기거나 plan/24 Sprint B 로 이전 |
| 2 | Figma 디자인이 실 구현과 어긋남 (예: V-5 inline diff 가 22-6 에서 이미 다르게 구현) | 각 Sprint 시작 전 1 시간 alignment review — 디자이너 의도 vs 코드 현황 비교 |
| 3 | reka-ui 도입 시 기존 vanilla 모달의 keyboard nav 깨짐 | Sprint B 에서 reka-ui Dialog wrap → BaseModal 의 useFocusTrap 보강 (capture phase keydown 유지) |
| 4 | Pretendard self-host 시 번들 크기 증가 | woff2 만 (~150KB) + `font-display: swap` + subset (KR Common 만) 으로 ~80KB 까지 축소 |
| 5 | 36 PNG 재캡처 시 mock fixture 가 새 디자인 가정과 어긋남 | Sprint F 에서 devMock.ts 도 갱신 (예: Onboarding fixture 추가) |
| 6 | DnD 도입 시 vue-draggable-plus 의 한글 ghost 텍스트 깨짐 | Sprint E DnD 시작 전 sample test |

---

## 10. 진행 로그

- 2026-04-27 작성. plan/23 Sprint 1~5 완료 직후. plan/22 22-6 머지 + 22-7 잔여 (BaseModal 7 + Tooltip + ContextMenu P2 3).
- (대기) Sprint A 진입 전: 사용자 review (핵심 4 화면 D11/D12/D13/D14 + D14b)
- 2026-04-27 **Sprint A Foundation 토큰 ✅ 완료**:
  - Anthropic Claude Design hosting (`api.anthropic.com/v1/design/h/...`) 에서 design bundle (4.3MB tar.gz) fetch → README + chats + project (8 jsx + tokens.js + html + uploads 7 .md + 36 PNG) 추출
  - **A-1 Pretendard self-host** — `bun add pretendard@1.3.9` + `main.css` 에 `@import 'pretendard/dist/web/variable/pretendardvariable.css'` 추가 (woff2, ~150KB, font-display: swap). OS fallback 차단
  - **A-2 Color semantic 분리** (Q2 적용) — `main.css`:
    - light: muted 95.9% → 97.5% (한 단계 흐리게) / accent 95.9% → 92% (primary hue 일치 옅은 변형) / secondary 그대로
    - dark: muted 15.9% → 12% / accent 15.9% → 22% / secondary 그대로
  - **A-3 Status semantic 토큰 신규** — `main.css` 에 `--success` / `--warning` / `--info` (light + dark, foreground 짝 포함). emerald-700 / amber-600 / blue-600 기반
  - **A-4 Elevation tier 3 신규** — `main.css` 에 `--shadow-popover` (sm) / `--shadow-modal` (lg) / `--shadow-toast` (xl). dark 는 opacity 강화
  - **A-5 Z-index 6 layer 신규** — `tailwind.config.ts` zIndex extend (10 sticky / 20 sidebar overlay / 30 popover-dropdown-tooltip / 40 modal backdrop / 50 modal content / 60 toast)
  - **`tailwind.config.ts` 확장**: colors 에 popover / success / warning / info 추가 (DEFAULT + foreground), boxShadow extend (popover/modal/toast = CSS var 참조), zIndex extend
  - 검증: typecheck 0 / lint 0 / vitest 13 pass / `bunx tsx scripts/capture-screens.ts` 36 PNG 재캡처 완료 — light 모드 muted 흐려짐 시각 확인됨
  - 미적용 (Sprint B+ 로): Pretendard `<link rel="preload">` index.html (npm 패키지 자동 처리로 우선순위 낮음 / Sprint B 에서 검토)
- **2026-04-27 Sprint B~F 계획 단계 유지 결정 (사용자 판단)**:
  - Sprint A 완료 (Foundation 토큰 적용 + 검증 통과). Sprint B (Primitives + reka-ui + Tooltip) 부터 F (검증) 까지는 **plan 으로만 남기고 실제 코드 implementation 보류**.
  - 이유: plan/22 22-7 까지 진행하면서 BaseModal 14/18, aria-label 17, ContextMenu 11/17, V-5/F-I1/F-I2/Q-3/Q-4 등 점진적 적용이 이미 진행 중. plan/24 의 큰 visual refactor 보다 plan/22 점진 작업이 자연스러움. plan/24 는 향후 통합 visual refactor 가 필요한 시점에 참조용 SoT 로 보존.
  - § 11 implementation 진입 조건 (재개 트리거) 추가 — 하단 참조.
- **2026-04-28 미커밋 자산 commit 정리 (3 commits)**:
  - `f464545` `feat(c23)` — plan/23 Design System Extraction (docs/design-context/ 8 .md + 36 PNG + scripts/capture-screens.ts + apps/desktop/src/api/devMock.ts + invokeWithTimeout.ts isMockEnabled 분기 + root playwright devDep)
  - `5ffe151` `feat(c24-A)` — Sprint A Foundation 토큰 (Pretendard self-host + Color Q2 분리 + Status semantic + Elevation tier 3 + Z-index 6 layer + plan/24 본문 + CHANGELOG)
  - `3bffe5d` `chore(rust)` — Cargo.lock criterion bench deps drift 동기화 (Sprint A 무관, 별도 commit)
  - 검증: typecheck 0 / lint 0 / vitest 13 pass (재확인). Sprint B~F 보류 결정 유효 — § 11 재개 트리거 미충족.

## 11. Sprint B~F implementation 진입 조건 (재개 트리거)

다음 **2 조건 모두** 만족 시 Sprint B~F implementation 시작 검토:

| # | 조건 | 검증 방법 |
|---|------|----------|
| **A** | plan/22 점진 작업이 정체되거나 dogfood feedback 으로 visual 불일치 누적 | CHANGELOG 의 plan/22 sub-sprint 가 4주 이상 미진행 OR 사용자 unhappy 보고 ≥3건 |
| **B** | 디자인 SoT (Figma file) 와 코드 drift 가 의미 있게 벌어짐 | 36 PNG 재캡처 → Figma 60+ 아트보드와 visual diff ≥30% 불일치 |

**또는** 사용자 명시 트리거: "plan/24 visual refactor 시작" / "디자인 → 코드 통합 적용 진행"

### 11-1. 재개 시 진입점

1. 현 상태 점검: plan/22 의 Sprint 22-N 진행 현황 + Figma file vs 코드 visual diff
2. plan/24 § 4~8 의 Sprint B~F 중 어느 sub-sprint 부터 진입할지 결정
3. 보존 자산 활용:
   - `apps/desktop/src/api/devMock.ts` (IPC mock)
   - `scripts/capture-screens.ts` (재캡처 스크립트)
   - `docs/design-context/` 7 .md (디자인 SoT)
   - Figma file `git-fried Design System.html` (7 페이지 / 60+ 아트보드)
   - Sprint A 완료 (토큰 코드 적용됨 — 추가 작업 불필요)

### 11-2. 보류된 작업 (참조)

- Sprint B Primitives + reka-ui + 🔥 Tooltip primitive (2~3일)
- Sprint C Hub Screens (D11~D14 + D14b Onboarding + Tab overflow + Settings 2-level) (3~5일)
- Sprint D 18 Modal Audit (BaseModal 잔여 4 + 미캡처 5 신규 + ContextMenu 17/17) (2~4일)
- Sprint E UX Polish (Skeleton/Empty/DnD/Long-running/한글/a11y 47/Motion/Plugin slot/v0.4 placeholder) (3~5일)
- Sprint F 검증 (재캡처 36+ → Figma 60+ visual diff audit ≥95% 일치) (1~2일)

총 보류 작업량: ~11~19일.

### 11-3. 추가 디자인 후보 카탈로그 21건 (확장)

현재 Figma file 60+ 아트보드 외에 추가로 뽑을 가치 있는 영역. Figma Make 의 Sprint G/H/I 로 분류 — 한 번에 1 sprint 씩 prompt 발송.

#### Sprint G — Extension Pack HIGH (5건, 우선)

| # | 영역 | 흡수 sprint | 가치 |
|---|------|------------|------|
| 1 | **에러 / 인증 실패 catalog 8 패턴** — 401·403·offline·git 미설치·safe.directory·conflict·non-fast-forward·remote 권한 거부 | E (UX Polish) | dogfood 자주 만남, F-I2 한국어 가이드 시각화 |
| 2 | **AI flow UX spec** — Explain streaming · Composer plan · Code Review 결과·취소·불만족 피드백 | E 또는 신규 | Cursor/Copilot 차별화 가시화 |
| 3 | **Onboarding sub-screen 상세** — detect 결과 / dry_run 미리보기 / forge 토큰 / SSH key 가이드 | C (D14b 보강) | 첫 funnel 핵심 |
| 4 | **Settings complex form 5종** — RepoSpecificForm 13 키 / Forge PAT 등록 / Profile 만들기 step / Custom theme JSON / GitKraken Import preview | C (Settings) | 사용자 자주 보는 form |
| 5 | **Tauri 앱 icon set** — 64×64 / 128×128 / 256×256 / 512×512 / 1024×1024 + .ico + .icns + favicon | release prep | v0.3 release 필수 |

#### Sprint H — Extension Pack MEDIUM (5건)

| # | 영역 | 흡수 sprint |
|---|------|------------|
| 6 | Long-running progress 실제 시나리오 (GitKraken Importer 6분 / bulk fetch 159 / clone 큰 레포 / gc) | E (D21 보강) |
| 7 | 고밀도 edge case (50+ 레포 sidebar / 100+ commit graph / 충돌 다발 / 3-way merge) | C (D14 보강) |
| 8 | Empty state 확장 (forge 미연결 / 권한 없음 / 오프라인 / detached HEAD / no-upstream / fresh init) | E (D19 보강) |
| 9 | 컴포넌트 상태 매트릭스 보강 — primitive 외 hub 컴포넌트 (loading/error/empty/hover/active/disabled/focus 모두) | E |
| 10 | Settings 9 카테고리 detail — Profiles 외 8 (forge / general / ui / editor / repo-specific / 유지보수 / 마이그레이션 / about) | C (Settings 보강) |

#### Sprint I — Extension Pack LOW (11건, 선택)

| # | 영역 | 비고 |
|---|------|------|
| 11 | i18n 영문 layout audit (한국어 → 영문 1.3~1.5배 길이 overflow) | v0.3 i18n 시 |
| 12 | Storybook spec 환경 (props 조합 playground) | 팀 확장 시 |
| 13 | Custom theme 견본 5~10 (사용자 색 import 검증용) | Settings UI |
| 14 | Marketing assets — README hero / v0.3 release screenshot mock / 데모 영상 thumbnail | 정체성 anti-marketing 와 충돌 가능 |
| 15 | Component anatomy diagram (annotated spec sheet) | 디자이너 self-reference |
| 16 | Branding 패키지 — favicon / OG image / Open Graph card | 웹 배포 시 |
| 17 | Typography hierarchy 문서 (h1~h6 + display + caption) | 문서 페이지 도입 시 |
| 18 | Dashboard — performance bench 결과 시각 (plan/20) | About 페이지 |
| 19 | Release note / CHANGELOG 페이지 디자인 | 웹 배포 시 |
| 20 | Animation / motion spec (Lottie / Rive prototype) | E (D24 보강) |
| 21 | Localization 영문 + 일본어 fallback layout | v1.x i18n |

→ Figma Make 에 한 번에 1 Sprint 씩 prompt 발송. 각 prompt 는 § 11-4 에 보존.

### 11-4. Sprint G·H·I prompt (Figma Make 발송용 SoT)

#### Sprint G prompt — Extension Pack HIGH (Page 08~12 신규)

```
Sprint G — Extension Pack (HIGH ROI 5 영역)

기존 7 페이지 / 60+ 아트보드 + Sprint 1~5 산출물 그대로 보존. 다음 5 영역
신규 페이지 추가:

[Page 08 — Error & Auth catalog]
- 8 패턴: 401 token expired / 403 forbidden / offline / git 미설치 /
  safe.directory / conflict (rebase·merge) / non-fast-forward /
  remote 권한 거부
- 각 패턴: Toast (error) + 한국어 hint + action button (예: "Settings
  에서 토큰 재발급" / "Pull 후 재시도" / "Conflict 해결" deep link)
- humanizeGitError (api/errors.ts) 의 패턴 spec 시각화

[Page 09 — AI flow UX]
- AI Explain (CommitDiffModal ✨ 클릭) — streaming 진행 (3 frame:
  loading → tokens 누적 → 완료) + 재실행 / 취소 / 불만족 피드백
- AI Composer (commit 분할 plan) — count input → plan 결과 → 각 segment
  선택 적용
- AI Code Review (PrDetailModal Reviews) — head/base 입력 → review 진행
  → 결과 (Approve / Request Changes / Comment 분류 제안)
- 각 화면: 비활성 (CLI 미설치) state — F-I2 톤 안내

[Page 10 — Onboarding sub-screen]
- D14b 5 step 의 sub-screen 상세:
  • step 2 GitKraken detect — workspace N개 / repo M개 / favorites P개 /
    tabs Q개 미리보기 list
  • step 2 dry_run — workspacesToCreate / reposToAdd / reposToPin /
    tabsToOpen / skippedPaths 표
  • step 3 forge 토큰 — Gitea PAT input / GitHub PAT input + scope 안내
    + "토큰 발급 위치 열기" 링크
  • step 3-fallback SSH key 가이드 — `~/.ssh/id_ed25519` detect →
    "이 key 등록" 또는 "새로 생성"
  • step 4 완료 — 활성 레포 + 첫 커밋 메시지 가이드

[Page 11 — Settings complex form 5종]
- RepoSpecificForm 13 키 (hooksPath / commitEncoding / logOutputEncoding
  / gitflow 5 / commitGpgsign / userSigningkey / gpgFormat / userName /
  userEmail) — 4 fieldset + per-repo identity + dirty 추적
- Forge PAT 등록 모달 — Gitea/GitHub 분기 + base URL + 토큰 + whoami probe
- Profile 만들기 wizard — name + git user.name/email + signingKey +
  sshKeyPath + defaultForgeAccount
- Custom theme JSON import/export — 검증 (스키마 validation) + 미리보기
- GitKraken Import preview — dry_run 결과 detail (Page 10 과 통합)

[Page 12 — Branding & App icon]
- Tauri 앱 icon — 64×64 / 128×128 / 256×256 / 512×512 / 1024×1024
- Windows .ico (multi-resolution) / macOS .icns / Linux PNG (256×256)
- favicon.ico (16×16 / 32×32 / 48×48)
- 컨셉: g + git + frying pan 또는 dense IDE 톤. ❌ neon / playful /
  cute. JetBrains/Tower 분위기. 단색 또는 2색.
- light/dark 양쪽 (system theme 자동 변환)

[필수 제약]
- Sprint 1~5 토큰/primitive 100% 재사용
- 한국어 라벨 100% (영문 번역 금지)
- 미캡처 모달 7 임의 시각화 금지 (Sprint 4 spec)
- ❌ skip 기능 (Cloud / 자체 LLM / Diagram / Agent Session) 절대 X
- 정보 밀도 IDE-grade

[제출 형식]
- Page 08~12 신규
- 각 페이지 light + dark (icon set 만 단색/2색)
- self-assessment (5 영역 × HIGH ROI)
- Sprint H 진입 가능 여부

Sprint G 통과 후 Sprint H (MEDIUM 5) prompt 별도 발송 예정.
```

#### Sprint H prompt — Extension Pack MEDIUM

(Sprint G 통과 후 작성. 위 카탈로그 6~10 항목 기반.)

#### Sprint I prompt — Extension Pack LOW (11건 중 사용자 선택 분리)

(Sprint H 통과 후 + 사용자가 LOW 중 어느 항목 진행할지 결정 후 작성.)
