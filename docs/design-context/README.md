# `docs/design-context/` — Claude Design 핸드오프 패키지

> **목적**: git-fried 의 디자인 시스템 / 화면을 외부 디자이너 (Claude Design / Figma / 협업자) 가 처음부터 그릴 수 있도록 코드에 흩어진 디자인 의도를 표준 brief 패키지로 추출.
>
> **출처**: `docs/plan/23-design-system-extraction.md` (작업 절차서) — Phase 1 4 에이전트 병렬 (Token / Component / Flow / Codex Intent) → Phase 2 통합 작성.
>
> **작성일**: 2026-04-27
>
> ## 🟢 현재 상태 (2026-04-27) — **디자인 100% 완료**
>
> **Sprint 1~5 모두 완료 (Iteration 4)** — Figma file `git-fried Design System.html` 7 페이지 / 60+ 아트보드 / Self-assessment 8/8 ✓
>
> | Sprint | 산출물 |
> |--------|-------|
> | 1 Foundations | Page 01 (Color/Typo/Spacing/Radius/Elevation/Z-index) + 01b Layout Extensibility |
> | 2 Primitives + 4 시스템 | Page 02 (Button/Form 6) + 03 (BaseModal 5 size + 5 sim) + 04 (Tooltip/ContextMenu P0/Toast) |
> | 3 Hub Screens | Page 05 (CommitDiff/PrDetail/StatusPanel/메인 layout/Onboarding) |
> | 4 Modal Audit | Page 06 (18 modal audit + 17 ContextMenu 12 위치 86 actions + 미캡처 신규 3) |
> | 5 UX Polish | Page 07 (D18~D27: Skeleton/Empty/DnD/Long-running/한글/a11y 47/Motion/Layout audit/Plugin slot/v0.4 placeholder) |
>
> **다음 단계**: Visual Refactor — 코드 → 디자인 적용 (plan/24 신규 후보). 토큰 → primitives → hub screens → modals → polish 순서.

---

## 문서 인덱스

| # | 파일 | 독자 | 핵심 |
|---|------|------|------|
| 00 | [`00-product-brief.md`](./00-product-brief.md) | 모든 디자이너 | 제품 정체성 / 페르소나 / 톤앤매너 / **Feature Parity Ambition** |
| 01 | [`01-design-tokens.md`](./01-design-tokens.md) | Figma Variables 작성자 | color / typography / spacing / radius (W3C JSON) |
| 02 | [`02-component-inventory.md`](./02-component-inventory.md) | 컴포넌트 라이브러리 작성자 | 48 컴포넌트 + 18 모달 카탈로그 |
| 03 | [`03-screens-and-flows.md`](./03-screens-and-flows.md) | 와이어프레임 / flow 작성자 | 3 페이지 + 17 ContextMenu + 15 Click→Detail |
| 04 | [`04-interaction-patterns.md`](./04-interaction-patterns.md) | micro-interaction / a11y / Korean | 키보드 / 한글 / drag / loading / a11y |
| 05 | [`05-figma-handoff-brief.md`](./05-figma-handoff-brief.md) | Claude Design / 외부 디자이너 | **작업 의뢰서 (prompt 포함)** |
| **06** | [`06-gitkraken-feature-parity.md`](./06-gitkraken-feature-parity.md) | 모든 디자이너 (Sprint 진입 전) | **GitKraken ~87 기능 카탈로그** (✅52 / ⚠️10 / 🔜15 / ❌10) + 4 hard constraint (Layout extensibility / Density / Plugin slot / placeholder 정책) |

## 권장 읽기 순서

- **빠른 파악**: 00 (10분) → 05 (15분, prompt 포함) → 끝
- **Figma 작업 시작 전**: 00 → 01 → 02 → 05
- **상세 spec 필요 시**: 03 + 04
- **AI 디자인 도구에 한 번에 넣기**: 6 문서 모두 + `apps/desktop/tailwind.config.ts` + `src/styles/main.css`

## 관련 문서

- [`docs/plan/23-design-system-extraction.md`](../plan/23-design-system-extraction.md) — 본 패키지 작성 절차 + Phase 진행 로그
- [`docs/plan/22-ui-polish-v2.md`](../plan/22-ui-polish-v2.md) — UI Polish v2 backlog (§15 신규 4 시스템 의도)
- [`docs/plan/12-ui-improvement-plan.md`](../plan/12-ui-improvement-plan.md) — UI v3 결정 history (43 항목)
- [`docs/plan/00-overview.md`](../plan/00-overview.md) — 제품 종합 기획

## Handoff 옵션

| 옵션 | 절차 | 상태 |
|------|------|-----|
| **A. 문서만** | 6 .md 를 Claude Design / Figma 협업자에게 첨부 | ✅ 준비됨 |
| **B. + 스크린샷** | A + Playwright 자동 캡처 (12 화면) | ✅ **완료** — [`screenshots/`](./screenshots/) 12 PNG |
| **C. + Figma MCP** | A + `generate_diagram` 으로 component graph FigJam 생성 (Figma 파일 키 필요) | 옵션 |

## 캡처 환경 (옵션 B 구현)

- **데이터 source**: [`apps/desktop/src/api/devMock.ts`](../../apps/desktop/src/api/devMock.ts) — 25+ command fixture (한글 commit / 듀얼 워크스페이스 / ahead-behind / conflict / 한글 파일명)
- **활성 조건**: `import.meta.env.DEV` AND `window.__TAURI_INTERNALS__` 부재 — 실 Tauri webview / production 자동 우회
- **캡처 스크립트**: [`scripts/capture-screens.ts`](../../scripts/capture-screens.ts) — Playwright + Chromium, 1440×900, ko-KR locale
- **재현**: `bun run --cwd apps/desktop dev` (background) → `bunx tsx scripts/capture-screens.ts`

## 캡처된 36 화면

상세 인덱스: [`03-screens-and-flows.md` § 0](./03-screens-and-flows.md#0-스크린샷-인덱스--36-화면-playwright--ipc-mock-fixture)

요약:

| 카테고리 | 개수 | 비고 |
|---------|------|------|
| 페이지 × light/dark | 6 | 메인 / Launchpad / Settings(Profiles) |
| 우측 메인 탭 패널 | 6 | Branch · Stash · PR · Submodule · LFS · Worktree |
| ForgePanel sub-tab | 3 | Tag · Issue · Release |
| Settings 카테고리 (light) | 8 | Forge PAT · General · UI · Editor · Repo-Specific · 유지보수 · 마이그레이션 · About |
| Modal | 13 | CommandPalette · Help · CommitDiff (Inline+Split) · CreatePr · FileHistory · RepoSwitcher · Bisect · Compare · Reflog · Rebase · SyncTemplate · CloneRepo |
| **합계** | **36** | dark 28 + light 8 |

> **주의 — fixture 한계**: mock 데이터는 디자인 자료용 시드. 실제 Tauri webview 의 font-rendering, scrollbar, native 메뉴 등은 일부 차이가 있을 수 있음 (브라우저 Chromium vs WebView2). 디자이너 review 시 이 차이는 명시적으로 표시.
