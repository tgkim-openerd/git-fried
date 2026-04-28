# 23. Design System Extraction — Claude Design 핸드오프 brief 패키지

작성: 2026-04-27 / 트리거: plan/22 (UI Polish v2) 시작 직후 — BaseModal / aria-label / Tooltip / Color 일관성 4건 디자인 SoT 부재로 코드만으로 정의 불가

> **목적**: 현재 git-fried 의 디자인이 코드(`tailwind.config.ts` + `src/styles/main.css` shadcn-vue 토큰 + reka-ui 헤드리스 + 48 컴포넌트) 에만 살아있는 상태에서, **Claude Design / Figma MCP 가 한 번에 읽어 디자인 시스템을 그릴 수 있는 표준 brief 패키지** 를 작성한다.
>
> **연계**: [plan/12 v3](./12-ui-improvement-plan.md) (UI 개선 43 항목 ✅), [plan/22](./22-ui-polish-v2.md) (§15 신규 UI 시스템 4 — BaseModal/aria-label/Tooltip/Color 일관성 — 미완), [plan/18](./18-dogfood-feedback.md) (사용자 friction 누적).
>
> **산출물 위치**: `docs/design-context/` (이 plan 본문과 별도). plan/23 = 작업 절차서, design-context/ = 디자이너가 직접 읽는 자료.

---

## 1. 30초 요약

| 항목 | 값 |
| ---- | ---- |
| Phase 수 | 3 (Discovery → Synthesis → Handoff) |
| 병렬 에이전트 | 4 (Explore × 3 + codex:rescue × 1) |
| 산출 문서 | 6 (`design-context/00`~`05.md`) |
| 예상 시간 (AI pair) | Phase 1: 10m / Phase 2: 20~30m / Phase 3: 사용자 결정 |
| 코드 변경 | **없음** — 문서 신설만 |
| Handoff 모드 | A (문서만) / B (+ 스크린샷) / C (+ Figma MCP) — 사용자 선택 |

---

## 2. 배경 / 왜 지금?

- plan/22 §15 의 4개 신규 UI 시스템 항목 (BaseModal, aria-label, Tooltip, Color 일관성) 은 **코드 일관성** 문제가 아니라 **디자인 SoT 부재** 문제다. 코드만 보고 BaseModal 을 만들면 18개 모달 각자 stylistic divergence 가 그대로 굳는다.
- 현재 컴포넌트 디자인은:
  - `tailwind.config.ts` — shadcn-vue 표준 색 토큰 + Pretendard/JetBrains Mono
  - `src/styles/main.css` — light/dark CSS variable
  - 48 컴포넌트가 토큰을 직접 사용 (디자인 의도가 grep 으로만 추출 가능)
- 디자이너가 Figma 에 토큰/컴포넌트 라이브러리를 그리려면 위 3 source 를 일일이 코드로 읽어야 한다 — 이걸 **structured brief 패키지** 로 미리 추출.

---

## 3. Phase 1 — Discovery (병렬 4 에이전트, ~10분)

| 에이전트 | 도구 | 책임 | 산출물 |
| ---- | ---- | ---- | ---- |
| **A. Token Extractor** | Explore | `tailwind.config.ts` + `src/styles/main.css` 의 모든 CSS variable + Tailwind 확장 토큰 + Tailwind class 빈도 분석으로 실효 색·spacing·radius·typography·shadow 추출. light/dark 매핑 포함 | `tokens-raw` (in-conversation) |
| **B. Component Inventory** | Explore | 48 .vue 컴포넌트 카탈로그 — 이름 / props / emit / slots / reka-ui base / 사용 페이지 / variants. 18 모달은 별도 분류 + 공통 패턴 차이점 | `components-raw` |
| **C. Screen Flow Mapper** | Explore | 3 페이지 (`index/launchpad/settings`) + 18 모달 entry trigger / state / exit. CommandPalette 단축키 catalog. plan/22 의 17 ContextMenu 위치 + 15 Click→Detail flow 흡수 | `flows-raw` |
| **D. Design Intent Reader** | **codex:rescue** | plan/00·12·18·19·22 cross-read → 디자인 의도, dogfood friction, 미해결 UI debt, 신규 UI 시스템 4건 의도 정리. 22개 plan 문서 long-context summarization 은 Codex 적합 | `intent-raw` |

**병렬 안전성**: A=토큰, B=컴포넌트 형태, C=흐름, D=문서 의도 — 4개 모두 책임 직교, 동일 파일 동시 수정 없음 (read-only).

---

## 4. Phase 2 — Synthesis (~20~30분)

Phase 1 결과 통합 → `docs/design-context/` 6 문서 작성:

### 4-1. `00-product-brief.md`
제품 정체성 (GitKraken 대체, 한글 1급, Gitea-first, Tauri-light), 타겟 유저 (회사 Gitea + 개인 GitHub 듀얼 포지 패턴), 디자인 톤앤매너 / 키워드. plan/00 과 plan/01 (positioning) 에서 직접 인용.

### 4-2. `01-design-tokens.md`
A 결과를 **Figma Variables 호환 JSON + 마크다운 표** 양식으로:
- Color (light + dark, semantic — primary/secondary/destructive/muted/accent/border/ring/background/foreground)
- Typography (font-family Pretendard / JetBrains Mono, scale, line-height)
- Spacing (4px grid 기반 Tailwind scale 채택 여부 검증)
- Radius (`--radius` CSS var → Tailwind 매핑)
- Shadow / Z-index
- 전부 `tailwind.config.ts` / `main.css` 1:1 매핑 보장

### 4-3. `02-component-inventory.md`
B 결과를 **컴포넌트 카드** 양식 — 각 컴포넌트마다:
- 이름 / 파일경로 / 사용 화면 (페이지/모달)
- props 시그니처 / variants / states (default/hover/active/disabled/focus)
- reka-ui 의존성 (있다면)
- 우선순위 (plan/22 §15 BaseModal 흡수 후보 / 그 외)

### 4-4. `03-screens-and-flows.md`
C 결과로 **페이지 3 + 모달 18 + Command Palette + ContextMenu 17 위치** 의 entry → state → exit 다이어그램. 각 flow 는 mermaid 또는 ASCII. plan/22 의 17 ContextMenu / 15 Click→Detail 카탈로그 흡수.

### 4-5. `04-interaction-patterns.md`
- 키보드 단축키 (`⌘⇧H` 외 catalog)
- Drag & drop 위치 (vue-draggable-plus 사용 지점)
- Toast dedup / focus trap / ESC / backdrop click 규칙
- 한글 visual-width 임계 (CJK=2 cell, 36자 = 영문 72자 = amber warning)
- IPC timeout UX (30s/5min, long-running prefix 자동)
- Loading / Skeleton / Empty state 패턴
- Error UX (`describeError` 8 패턴 + 한국어 휴먼화)

### 4-6. `05-figma-handoff-brief.md`
앞 5문서 한국어 요약 + Claude Design / Figma MCP 에 전달할 **작업 의뢰 prompt 초안**. Deliverable 명시:
1. Figma Variables 라이브러리 (light + dark) — `01-design-tokens.md` 기반
2. Figma 컴포넌트 라이브러리 — BaseModal / Tooltip / Toast / Button / Input 5개 우선
3. 18개 모달의 일관 spec (BaseModal 적용 후 모습)
4. 17 위치 ContextMenu 디자인
5. plan/22 §15 의 aria-label 가이드 / Color 일관성 audit / Micro-interaction spec

---

## 5. Phase 3 — Handoff (사용자 결정)

| 옵션 | 절차 | 시점 |
| ---- | ---- | ---- |
| **A. 문서만** | `docs/design-context/` 6개 .md → Claude Design 첨부 | 즉시 가능, 기본 권장 |
| **B. + 스크린샷** | A + `bun run dev` → 3 페이지 + 8 주요 모달 캡처 → `screenshots/` 추가. **사용자가 Tauri GUI 띄워줘야 캡처 가능** (Tauri WebView 는 외부에서 접근 불가) | 디자인 리뉴얼 의도면 추천 |
| **C. + Figma MCP** | A + Figma MCP `generate_diagram` 으로 component graph FigJam 생성 | Figma 파일 키 받은 후 |

**기본 진행**: Phase 2 까지 완료 후 사용자 review → handoff 옵션 결정.

---

## 6. Done 기준

### 6-1. Phase 1~3 (이번 sprint — ✅ 완료)

- [x] `docs/plan/23-design-system-extraction.md` 작성
- [x] Phase 1: 4 에이전트 raw 결과 수령
- [x] Phase 2: `docs/design-context/00`~`06.md` 7 문서 작성
- [x] Phase 3 옵션 B: Playwright 자동 캡처 36 화면
- [x] CHANGELOG `[Unreleased] Added` 갱신
- [x] Figma Make Sprint 1 (Foundations) 통과 — Q1~Q8 + 5-1~5-4 자체 검증 ✓

### 6-2. Sprint 2~5 (✅ 완료 — Iteration 4)

- [x] Sprint 2 Primitives + 🔥 BaseModal/Tooltip/ContextMenu/Toast
- [x] Sprint 3 Hub Screens (CommitDiff/PrDetail/StatusPanel/Sidebar/Onboarding)
- [x] Sprint 4 18 Modal Audit + 17 ContextMenu Map (12 위치 / 86 actions) + 미캡처 신규 3 (MergeEditor/HunkStage/RemoteManage)
- [x] Sprint 5 UX Polish D18~D27 (Skeleton/Empty/DnD/Long-running/한글/a11y 47/Micro-interaction/Layout audit/Plugin slot/v0.4 placeholder)

> § 9 의 재개 트리거 조건은 **무효화**. 사용자가 "모든 디자인 뽑고 싶어" 결정으로 보류 해제.

### 6-3. Visual Refactor (다음 단계) — [plan/24](./24-visual-refactor.md) 작성 ✅

[plan/24-visual-refactor.md](./24-visual-refactor.md) 작성 완료 (2026-04-27). 6 sub-sprint:

- [ ] Sprint A Foundation 토큰 (Pretendard self-host / 색 분리 / Elevation / Z-index)
- [ ] Sprint B Primitives + reka-ui (🔥 Tooltip / ContextMenu / Button matrix / Form 6)
- [ ] Sprint C Hub Screens (D11~D14 + D14b Onboarding + Tab overflow + Settings 2-level)
- [ ] Sprint D Modal Audit (BaseModal 잔여 7 + 미캡처 5 신규 + ContextMenu 17/17)
- [ ] Sprint E UX Polish (Skeleton/Empty/DnD/Long-running/한글/a11y 47/Motion/Plugin slot/v0.4 placeholder)
- [ ] Sprint F 검증 & 마무리 (재캡처 36+ → Figma 60+ visual diff audit ≥95% 일치)

총 12~18일 (3주). plan/22 22-7 와 병행 가능 (BaseModal 7 마이그레이션 plan/24 Sprint D 로 이전).

---

## 9. Sprint 2~5 재개 조건 (트리거) — ⚠️ **무효화 (2026-04-27 결정 번복)**

> 아래 트리거는 사용자의 "모든 디자인 뽑고 싶어" 결정으로 무효. 기록만 남김. Sprint 2~5 모두 코드 stabilize 대기 없이 진행.

다음 **3 조건 중 2개 이상** 만족 시 Sprint 2 재개 (~~원래 룰~~):

| # | 조건 | 검증 방법 |
|---|------|----------|
| **A** | plan/22 6 sub-sprint (22-2 ~ 22-7) 완료 또는 ≥80% 완료 | CHANGELOG `Sprint 22-7` 등장 + plan/22 backlog 잔여 ≤20% |
| **B** | dogfood friction (plan/18 + plan/22 §5) 13 항목 완료 또는 ≥10/13 | plan/22 §5 의 IMPORTANT 4 + POLISH 4 중 ≥6 완료 |
| **C** | BaseModal · ContextMenu · Tooltip 신규 컴포넌트 코드 implementation 완료 | grep `BaseModal\|useFocusTrap\|Tooltip primitive` ≥3 매치 |

### 9-1. 현재 트리거 진행 상황 (2026-04-27 기준 — 트리거 무효 상태이지만 기록)

| 트리거 | 진행 | 비고 |
|--------|-----|-----|
| A plan/22 6 sub-sprint | **5/6** (22-2 ✅ / 22-3 ✅ / 22-4 ✅ / 22-5 ✅ / 22-6 ✅ / 22-7 대기) | 83% — 충족 |
| B dogfood friction 13 | CRITICAL 5 ✅ + F-I1 ✅ + F-I2 ✅ + (Q-4 LoadingSpinner / EmptyState) | 7~9/13 — 충족 가까움 |
| **C** BaseModal/ContextMenu/Tooltip implementation | **2/3** (BaseModal ✅ 11/18 적용 / useFocusTrap ✅ / ContextMenu ✅ / **Tooltip ❌**) | 67% |

**판정**: § 9 트리거 무효화로 중단된 상태이나, 실제로 22-6 머지로 트리거 A·B 모두 충족 도달. Tooltip 만 남음. visual refactor (plan/24) 진입 자연스러운 타이밍.

**재개 시 첫 작업**:
1. `bun run --cwd apps/desktop dev` background → `bunx tsx scripts/capture-screens.ts` 재실행 (변경된 컴포넌트 반영된 신규 36+ 화면)
2. `docs/design-context/02-component-inventory.md` + `03-screens-and-flows.md` 갱신 (BaseModal/ContextMenu 도입 후 architecture 변경 반영)
3. Figma Make 에 신규 PNG + 갱신 .md 업로드 → Sprint 2 prompt 그대로 재발송 (이미 작성된 prompt 사용)
4. 미해결: Settings 2-level 6 그룹 구성 / Modal `full` size 추가 사용처 / Integrations slot element 3 질문 답변 받기

## 10. 비용 / 리스크

- **비용**: Phase 1 = Sonnet × 3 (Explore) + Codex × 1 (intent). Phase 2 = Opus 직접 작성. 총 의존 ~30~45분.
- **리스크**:
  - (a) Phase 1 의 codex:rescue 가 plan 22개 cross-read 중 의도 누락 → mitigated by Phase 2 에서 직접 plan/00·01·12·22 verify
  - (b) Phase 2 의 토큰 JSON 이 Figma Variables import 형식과 미세 불일치 → handoff 시 조정, 본 plan 범위 외
  - (c) 18 모달 inventory 가 코드 수정 없이 진행 — 실제 BaseModal 도입은 plan/22 §15 R-2B 에서 진행

---

## 11. 진행 로그

- 2026-04-27 작성 + Phase 1 (4 병렬 에이전트) 완료
  - Agent A (Explore): tokens — shadcn-vue 15 색 + 4 radius + spacing top5 + Pretendard fallback
  - Agent B (Explore): 48 components + 18 modals + BaseModal/aria/reka-ui 부재 검증
  - Agent C (Explore): 3 pages + 18 modal flow + 37 CommandPalette + 17 ContextMenu + 15 Click→Detail
  - Agent D (Codex): plan/00·01·02·12·18·19·22 cross-read + 디자인 우선순위 Top 5
- 2026-04-27 Phase 2 — `docs/design-context/` 6 문서 + README 작성
- 2026-04-27 Phase 3 옵션 1 (Playwright 자동 캡처) 진행:
  - `apps/desktop/src/api/devMock.ts` 신규 (25+ command fixture, 한글 commit / 듀얼 워크스페이스 / ahead-behind / conflict)
  - `apps/desktop/src/api/invokeWithTimeout.ts` dev-only mock branch 추가 (`isMockEnabled()` 가드 — production 자동 우회)
  - `bun add -D playwright` + `bunx playwright install chromium`
  - `scripts/capture-screens.ts` 신규 (1440×900 ko-KR, light/dark) — 단축키 dispatch + palette fuzzy + 탭 click + settings nav click
  - **36 PNG** → `docs/design-context/screenshots/`:
    - 페이지 3 × light/dark = 6장
    - 우측 메인 탭 패널 6장 (Branch / Stash / PR / Submodule / LFS / Worktree)
    - ForgePanel sub-tab 3장 (Tag / Issue / Release)
    - Settings 카테고리 8장 light (Profiles 외 8 카테고리)
    - Modal 13장 (CommandPalette / Help / CommitDiff Inline+Split / CreatePr / FileHistory / RepoSwitcher / Bisect / Compare / Reflog / Rebase / SyncTemplate / CloneRepo)
    - 미캡처 5: AiResult / BulkFetchResult / GitKrakenImport / HunkStage / MergeEditor / PrDetail / RemoteManage — 다음 sprint 보강 후보
  - `03-screens-and-flows.md` § 0 5-구획 스크린샷 인덱스 + § 1·2·3 인라인 임베드
  - `README.md` Handoff 옵션 B 완료 표기 + 36 화면 카테고리 요약 표
- 2026-04-27 Feature Parity Ambition 보강 (사용자 요청):
  - `docs/design-context/06-gitkraken-feature-parity.md` 신규 — GitKraken ≈87 기능 catalog (✅52/⚠️10/🔜15/❌10) + plan/03 M/N/L/S 분류 흡수 + plan/14 22 항목 + plan/22 §3·§4·§5·§15 합본. 4 hard constraint: Layout extensibility / Density 강제 / Plugin slot / 미구현 placeholder 정책
  - `00-product-brief.md` § 4-2 "Feature Parity Ambition" + § 8 Anti-Goals 보강 (minimal / GitKraken visual / 고정 카운트 가정 anti)
  - `05-figma-handoff-brief.md` § 0 hard constraint + Sprint 5 D25~D27 추가 (Layout extensibility audit / Plugin slot 디자인 / 미구현 placeholder 패턴)
- 2026-04-27 Figma Make Iteration 1 인사이트 흡수:
  - 5-2 AI CLI 위임의 시각 함의 → 06 § 8-5 (Settings AI 카테고리는 BYOK SaaS UI 가 아닌 dev-tooling 시각)
  - 5-3 Cloud-Free 정체성 시각화 → 06 § 8-6 (빈 공간 = Integrations + 로컬 통계, Cloud-first 마케팅 anti)
  - 5-4 Migration UX onboarding 격상 → 06 § 8-7 (GitKrakenImportModal = 첫 실행 onboarding 1차 funnel)
- 2026-04-27 Sprint 1 Foundations (Figma Make Iteration 2) ✅ 통과:
  - Page 01 Foundations 8 카드 (Color light+dark Q2 분리 / Pretendard self-host / Spacing·Radius / Elevation·Z-index / Q1~Q8 + 5-1~5-4 self-assessment)
  - Page 01b Layout Extensibility 5 와이어프레임 (Tab overflow / Settings 2-level / Palette 60+ / Modal 5 size tier / Sidebar Integrations slot)
  - Caveat: Pretendard prototyping CDN 사용 — production woff2 self-host 교체 대기
- **2026-04-27 Sprint 2~5 보류 결정 (사용자 판단)**:
  - 이유: plan/22 22-3·22-4 코드 작업 중 BaseModal/ContextMenu/Tooltip 부채 stabilize 안 됨. dogfood friction 13 중 IMPORTANT 4 + POLISH 4 미해결 — 사용자 피드백 더 누적 후 디자인 결정 근거 확보. 미캡처 모달 7 도 코드 변경 진행 중. 한 번에 visual refactor 가 fragmented 변경보다 결과 일관성 ↑
  - 보존 자산:
    - `docs/design-context/00~06.md` 7 문서 + README + 36 screenshots (Figma Make 에 그대로 잔존)
    - `apps/desktop/src/api/devMock.ts` + `invokeWithTimeout.ts` mock branch + `scripts/capture-screens.ts` (재캡처 가능 인프라)
    - Figma file `git-fried-design-system` (Page 01 Foundations + 01b Layout Extensibility 까지 그대로 유지 — 디자이너 work-in-progress)
- 2026-04-27 Sprint 2 산출물 도착 (보류 결정 prompt 도달 전 Figma Make 가 이미 작업 완료한 상태로 도착) — 옵션 A (보류 유지) 채택, 산출물만 보존:
  - Page 02 Primitives — D5 Button (4 variant × 5 state × 3 size + icon-only with 한국어 aria-label) / D6 Form (Input·Textarea visualWidth ≤50/50~72/>72·Checkbox·Radio·Select·Tabs scrollable)
  - Page 03 Modals — D7 BaseModal spec (5 size tier + a11y + Confirm/Destructive) + 5 시뮬레이션 (CommandPalette/Bisect/RepoSwitcher/CreatePr/CommitDiff)
  - Page 04 Floating — D8 Tooltip 4 variant + reka-ui 매핑 / D9 ContextMenu P0 3개 (CommitGraph 10 / StatusPanel 9 / BranchPanel 11) / D10 Toast 4 severity + dedup count badge + action button
  - a11y 카탈로그 13 icon-only 한국어 aria-label
  - **Q1~Q3 confirm**:
    - Q1 Settings 6 그룹 ✓ 계정 / 워크스페이스 / 에디터·터미널(★AI CLI 통합) / UI / 유지보수 / 시작·마이그레이션
    - Q2 Modal `full` ✓ GitKrakenImport onboarding · MergeEditor · InteractiveRebase 만, 나머지 xl 권장
    - Q3 Integrations slot ✓ collapsed group + ✓/↻/🔜/✕ status row, marketing 0
  - **Sprint 3 진입 보류** — § 9 트리거 후 재개 결정. Page 01·01b·02·03·04 모두 work-in-progress 상태로 보존
- **2026-04-27 결정 번복 — Sprint 2~5 보류 해제, 모든 디자인 끝까지 진행**:
  - 사용자 의도: "모든 디자인 뽑고 싶어" — 코드 stabilize 대기 안 하고 Figma 측 디자인을 끝까지 완성. 코드 implementation 은 디자인 완성 후 한 번에 visual refactor 로 진행
  - § 9 트리거 조건 무효화. § 6-2 도 진행으로 전환
  - Sprint 3 prompt 즉시 발송 — Hub Screens (CommitDiff/PrDetail/StatusPanel/Sidebar)
  - 미캡처 모달 7 (PrDetail/MergeEditor/HunkStage/AiResult/BulkFetchResult/GitKrakenImport/RemoteManage) 도 02-component-inventory.md spec 따라 디자인 진행 (코드 stabilize 후 재캡처/조정은 추후)
- **2026-04-27 Sprint 3·4·5 완료 (Iteration 4) — 디자인 100% 완성**:
  - **Page 05 Hub Screens**: D11 CommitDiffModal (xl, 3 frame: default·AI streaming·light) / D12 PrDetailModal (xl, 3 tab + Merge dropdown footer) / D13 StatusPanel (5 frame: default·empty·context 9 actions·detail V-5·light) / D14 메인 layout 1440×900 (sidebar+graph+status+topbar+statusbar, ★ Integrations slot + workspace color + virtualization hint) / D14b Onboarding (full, 5 step: 환영·GitKraken 발견+dry_run·fallback·forge 토큰·완료)
  - **Page 06 Modal Audit**: 18 Modal audit table (13 캡처 + 5 미캡처, divergence ★ 표시) + 17 ContextMenu locations (P0 3 + P1 6 + P2 3 = 12 위치, 86 actions) + 미캡처 신규 3 (MergeEditor 3-pane full / HunkStage left-list+right-picker full / RemoteManage md)
  - **Page 07 UX Polish D18~D27**: Skeleton 4 / Empty 4 / DnD 4 시나리오 / Long-running 30s·1m·4m 단계 / 한글 visualWidth + ellipsis + 인코딩 ⚠ / **a11y 47 aria-label 카탈로그** (툴바 13 + StatusPanel 8 + Graph 7 + Sidebar 7 + Diff 8 + Ctx 3 + 추가 1) / Micro-interaction 12 transition + reduced-motion / **Layout audit (Modal 25 / Settings 12 / Tab 10 / Command 60 / Ctx 12 검증) — Tab 7→10 → ⌘8+ overflow dropdown 결론** / Plugin/Integration 3 slot (Sidebar collapsed + Settings 리스트+토글 + Palette 카테고리) / v0.4 placeholder pattern (disabled+tooltip / click→toast.info 2 frame, 06 의 🔜 15 항목 카탈로그)
  - Self-assessment 8 항목 모두 ✓ (토큰 재사용 / Q1·Q2·Q3 / 미캡처 placeholder / skip 0 / 한국어 100% / 정보 밀도)
  - Figma file `git-fried Design System.html` — 7 페이지 / 60+ 아트보드
