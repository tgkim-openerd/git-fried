# 05. Figma Handoff Brief — Claude Design 작업 의뢰서

> **이 문서의 독자**: Claude Design (또는 외부 디자이너) — 이 한 문서만 보고 작업 시작 가능하도록.
> **앞 문서**: `00`~`04` 5문서가 컨텍스트. 이 문서는 그 위에서 **무엇을 만들어 달라는지** 명시.

---

## 0. Feature Parity Ambition (디자인 hard constraint)

> **"GitKraken 의 핵심 기능 ≈70개를 흡수, 4 약점 (Gitea / 한글 / Cloud / 메모리) 만 정조준."**

이건 단순 마케팅이 아니라 **layout / extensibility / placeholder 설계의 토대**. 상세 카탈로그: [`06-gitkraken-feature-parity.md`](./06-gitkraken-feature-parity.md).

**4 hard constraint** (모든 sprint 에서 검증):

1. **Layout extensibility** — 현재 7 탭 / 9 settings / 30+ commands / 18 modal 은 v1.0 까지 ~1.5배 증가 예정. overflow / "더 보기" / scroll / 2-level grouping 패턴 처음부터 설계
2. **Density 강제 정착** — minimal 은 anti-pattern. 1440×900 화면에 GitKraken 이상의 정보 밀도
3. **Plugin / Integration slot** — Sidebar 하단 `Integrations` / Settings `Plugin` / CommandPalette `Integration` 카테고리 placeholder 미리 디자인. Cloud Workspace 대체 영역
4. **미구현 placeholder 정책** — 🔜 v0.4~v1.0 예정 (06 의 ≈15 항목) 은 disabled + tooltip "v0.4 예정" 표시 OK. ❌ skip (≈10) 은 절대 표시 안 함

---

## 1. 한 페이지 컨텍스트

**제품**: git-fried — GitKraken 의 ≈70 핵심 기능을 흡수하는 데스크탑 Git 클라이언트.

**스택**: Tauri 2.1 (Rust 백엔드) + Vue 3.5 (`<script setup>` + TypeScript) + Tailwind 3.4 + reka-ui (헤드리스, 현재 미사용 — 디자인은 사용 전제로) + shadcn-vue 색 토큰.

**플랫폼**: Windows 11 (1차) + macOS / Linux (2차). 데스크탑 전용 (1280×800 기본 / 960×600 최소).

**페르소나**: 한국 풀스택 개발자 — 회사 50+ Gitea 레포 (한글 커밋 55~72%) + 개인 GitHub.

**톤**: Dense / calm / professional / instrumented (계기판 같은). JetBrains·Tower·Fork 분위기. **Anti**: marketing hero, neon, illustration, large transitions.

**현재 상태**: 48 컴포넌트 + 18 모달이 코드만 SoT. Figma 디자인 시스템 부재. 그래서 Claude Design 의뢰.

---

## 2. Deliverables (Figma 작업 목록)

### Sprint 1 — Foundations (필수, ~2~3일)

| # | 산출물 | 입력 source |
|---|--------|------------|
| **D1** | **Figma Variables 라이브러리 (light + dark)** — color (15) / typography (8) / spacing (6) / radius (4) | `01-design-tokens.md` § 9 W3C JSON |
| **D2** | **Color semantic 분리** — 현재 secondary == muted == accent 동일 HSL 인 결함 해결. status (success/warning/info) 토큰 추가 | `01-design-tokens.md` § 1, § 10 |
| **D3** | **Elevation tier 정의** — popover / modal / toast 3단계 shadow + z-index layer 6단계 spec | `01-design-tokens.md` § 5, § 6 |
| **D4** | **Typography spec** — Pretendard 명시 사용 가정 + self-host 권장. font-size scale 5단계 spec | `01-design-tokens.md` § 2 |

### Sprint 2 — Primitives & BaseModal (~3~5일)

| # | 산출물 | 비고 |
|---|--------|------|
| **D5** | **Button library** — 4 variant (primary / secondary / ghost / destructive) × 4 state (default/hover/active/disabled) × 3 size (sm/md/lg) | shadcn-vue 표준 |
| **D6** | **Input / Textarea / Checkbox / Radio / Select / Tabs** primitive | shadcn-vue 표준, reka-ui 래핑 가정 |
| **D7** | **🔥 BaseModal 시스템** — size tier (sm/md/lg/xl) × Header/Body/Footer 슬롯 × confirm vs destructive 패턴 + ESC/backdrop/X 일관 | `02-component-inventory.md` § 3-3 |
| **D8** | **🔥 Tooltip primitive** — delay 500ms / position auto / arrow / shortcut hint 변형 | `04-interaction-patterns.md` § 6 |
| **D9** | **🔥 ContextMenu primitive** — items / submenu / separator / destructive 그룹 / shortcut display | `03-screens-and-flows.md` § 4 |
| **D10** | **Toast 시스템** — severity 4 + close + dedup badge spec | `04-interaction-patterns.md` § 7 |

🔥 = plan/22 §15 미완 시스템 — 디자인이 SoT 가 되어야 할 영역.

### Sprint 3 — Hub Screens (~5~7일)

4개 "허브" 화면 (자식 컴포넌트 끌고 가는 부모) 우선:

| # | 화면 | 주요 영역 |
|---|------|---------|
| **D11** | **CommitDiffModal** | header (sha + author + actions group) / mode toggle (4) / diff body / AI Explain ✨ + nested AiResultModal |
| **D12** | **PrDetailModal** | tabs (Body / Files / Reviews / Comments) / each tab spec / merge button footer |
| **D13** | **StatusPanel** | 4 collapsible sections (Staged/Unstaged/Untracked/Conflicted) / row + actions / hunk-stage entry / 검색 input (IMPORTANT F-I1 미완) |
| **D14** | **Sidebar + main layout** | workspace → org → repo 2-level tree / color picker / virtualization (50+ 레포 대응) |

### Sprint 4 — Modal Audit (~3~5일)

| # | 산출물 | 비고 |
|---|--------|------|
| **D15** | **18 모달 BaseModal 적용 후 모습** | 각 모달의 divergence 흡수 spec — `02-component-inventory.md` § 3-2 |
| **D16** | **InteractiveRebaseModal step indicator** | step indicator 컴포넌트 신규 (BisectModal 도 후보) |
| **D17** | **MergeEditorModal 3-way 레이아웃** | ours / theirs / result 패널 spec |

### Sprint 5 — UX Polish (~3~5일)

| # | 산출물 | 비고 |
|---|--------|------|
| **D18** | **Skeleton UI 4 화면** | CommitGraph / BranchPanel / StatusPanel / PrDetailModal — `04-interaction-patterns.md` § 4-2 |
| **D19** | **Empty state spec** | onboarding hero (레포 0 시) + minimal empty (검색 0 등) |
| **D20** | **Drag & drop spec** | ghost / drop highlight / cancel — 4 종 (Branch→Branch / Commit→Branch / File→Stash / Tab reorder) |
| **D21** | **Long-running progress** | 5min IPC 작업 30s/1m/4m 단계별 UI |
| **D22** | **한글 처리 spec** | ellipsis (좌측/우측) / tooltip expand / encoding 신뢰 표시 |
| **D23** | **a11y 가이드** | aria-label 한국어 권장 카탈로그 (47 icon-only 버튼 대상) |
| **D24** | **Micro-interaction** | enter/exit/hover/focus transition 매트릭스 |
| **D25** | **Layout extensibility audit** | 06 의 v1.0 카운트 (모달 25 / settings 12 / 탭 10 / commands 60) 시뮬레이션 — overflow 패턴이 깨지지 않는지 검증 |
| **D26** | **Plugin / Integration slot 디자인** | Sidebar `Integrations` 섹션 + Settings `Plugin` 카테고리 + CommandPalette `Integration` 카테고리 placeholder |
| **D27** | **미구현 placeholder 패턴** | disabled + tooltip "v0.4 예정" + 클릭 시 toast.info 시각 spec |

---

## 3. Claude Design 에 전달할 prompt (초안)

> 아래 prompt 는 Claude Design / Figma MCP / 외부 디자인 협업 시 **그대로 복사** 해서 시작 prompt 로 사용 가능.

```
당신은 git-fried 의 디자인 시스템을 처음부터 잡는 Senior Product Designer
입니다. git-fried 는 Tauri+Vue3 기반 GitKraken 대체 데스크탑 Git 클라이
언트입니다 — 한국 풀스택 개발자(회사 Gitea + 개인 GitHub) 를 페르소나로
합니다.

작업 컨텍스트는 docs/design-context/ 에 7 문서로 정리되어 있습니다:

- 00-product-brief.md — 제품 정체성 / 톤앤매너 / 페르소나 / Feature Parity Ambition
- 01-design-tokens.md — 색·타이포·spacing·radius 토큰 (W3C JSON 포함)
- 02-component-inventory.md — 48 컴포넌트 + 18 모달 카탈로그
- 03-screens-and-flows.md — 3 페이지 + 18 모달 + 17 ContextMenu + 15 Click→Detail flow
- 04-interaction-patterns.md — 키보드 / 한글 / drag / loading / a11y
- 05-figma-handoff-brief.md — 이 문서 (작업 의뢰)
- **06-gitkraken-feature-parity.md** — GitKraken ~87 기능 카탈로그 (✅52 / ⚠️10 / 🔜15 / ❌10) + 4 design hard constraint

이 문서들을 모두 읽고 다음 우선순위로 Figma 라이브러리를 작성해주세요:

[Sprint 1] Foundations (D1~D4): 토큰 라이브러리 + color semantic 분리 + 
elevation/z-index layer + typography spec.

[Sprint 2] Primitives + 미완 4 시스템 (D5~D10): Button/Input/Tabs primitive
+ 🔥 BaseModal / Tooltip / ContextMenu / Toast 시스템.

[Sprint 3] Hub Screens (D11~D14): CommitDiffModal / PrDetailModal /
StatusPanel / Sidebar 4 화면 — 자식 컴포넌트 끌고 가는 부모.

[Sprint 4] Modal Audit (D15~D17): BaseModal 적용 후 18 모달.

[Sprint 5] UX Polish (D18~D24): Skeleton / Empty / Drag / Long-progress /
Korean / a11y / Micro-interaction.

핵심 제약:
1. Tone = dense / calm / professional / instrumented. JetBrains·Tower 분
   위기. Marketing hero, neon, illustration, 큰 transition 지양.
2. Korean-safe 가 정체성. 한글 visual width (CJK=2 cell), Pretendard 폰트,
   ellipsis 정책 신중.
3. Multi-repo native — 50+ 레포 + 듀얼 포지(회사 Gitea / 개인 GitHub) 패
   턴 배려. 색은 정체성 분리 도구로 사용.
4. Tauri-light — 가벼움이 정체성. 큰 graphic / parallax 배제.
5. shadcn-vue + reka-ui 헤드리스 가정. Foundation 토큰은 shadcn 표준 100%
   준수.
6. **Feature parity ambition** (06 참조): GitKraken ≈70 기능 흡수가 목적.
   minimal 은 anti-pattern. v1.0 까지 모달 25 / settings 12 / 탭 10 /
   commands 60 까지 견딜 overflow 패턴 처음부터. Plugin / Integration
   slot 미리 확보. 🔜 미구현 기능 placeholder 표시 OK / ❌ skip 기능
   (Cloud Workspace / 자체 LLM / Diagram / Agent Session 등) 은 절대
   표시하지 말 것.

각 Sprint 완료 시 사용자(tgkim) 에게 review 의뢰 후 다음 Sprint 진행.
질문이 있으면 sprint 시작 전에 먼저 묻기.

작업 시작: Sprint 1 부터.
```

---

## 4. Acceptance Criteria (sprint 별)

### Sprint 1 done 기준

- [ ] Figma file 1개 (`git-fried-design-system`) 에 Variables → Color (light/dark, 15+) / Typography (8) / Spacing (6) / Radius (4) 정의
- [ ] secondary / muted / accent 의 의미적 분리 결정 — 현재 동일 HSL 인 이유 검토 + 분리 spec
- [ ] Elevation tier (popover/modal/toast) 와 z-index layer (6 단계) 정의
- [ ] tgkim review 통과

### Sprint 2 done

- [ ] 6 primitive (Button/Input/Textarea/Checkbox/Radio/Select/Tabs) variant matrix 완성 (Auto Layout + Variants)
- [ ] BaseModal — size 4 tier × Header/Body/Footer 슬롯 × confirm/destructive 패턴 spec
- [ ] Tooltip — 4 종류 (action hint / truncated expand / status meta / disabled reason)
- [ ] ContextMenu — items + submenu + destructive 그룹 + shortcut display
- [ ] Toast — 4 severity + dedup spec
- [ ] tgkim review 통과

### Sprint 3 done

- [ ] CommitDiffModal / PrDetailModal / StatusPanel / Sidebar 4 hub 화면 high-fidelity
- [ ] 각 화면 내부의 child 컴포넌트가 D5~D10 primitive 로 100% 구성
- [ ] Sidebar 50+ 레포 시나리오 mock 포함

### Sprint 4 done

- [ ] 18 모달이 모두 BaseModal 위에 그려짐 — divergence 명시 (왜 다른지 / 통합 가능 여부)
- [ ] InteractiveRebaseModal step indicator + MergeEditorModal 3-way 레이아웃 spec

### Sprint 5 done

- [ ] Skeleton 4 / Empty 5+ / Drag 4 / Long-progress 3 단계 / Korean / a11y / Motion 매트릭스 모두 spec
- [ ] dev handoff 가능한 상태 (Auto Layout, constraint, naming convention 일관)

---

## 5. 의문 / 결정 필요 (디자이너가 묻고 답해야 할 것)

| # | 질문 | 답변자 |
|---|------|-------|
| Q1 | Pretendard self-host 여부 (CDN 또는 local woff2)? | tgkim |
| Q2 | secondary/muted/accent 분리 시 어느 방향? (muted 만 더 흐리게 / 또는 accent 만 brand-색) | tgkim |
| Q3 | Sidebar 의 workspace color picker 가 회사/개인 분리에 충분한가? 추가 forge 색 필요? | tgkim |
| Q4 | 다크모드를 시스템 자동 (`prefers-color-scheme`) 따라가게 할지 / 수동 토글만? | tgkim |
| Q5 | Empty state 에 illustration 도입할지 / 100% minimal 유지? (정체성과 충돌 가능) | tgkim |
| Q6 | shortcut hint 표기 — ⌘ 직접 표시 vs Cmd / Win 별 자동 변환? | tgkim |
| Q7 | 한글 파일명 encoding 신뢰 표시는 항상 표시 / 의심 시만? | tgkim |
| Q8 | reka-ui 사용 전제로 spec 잡는 것 OK? (아니면 vanilla HTML 가정) | tgkim |

---

## 6. 인접 자료 (디자이너가 추가로 볼 것)

| 위치 | 용도 |
|------|------|
| `apps/desktop/tailwind.config.ts` | 토큰 1차 SoT |
| `apps/desktop/src/styles/main.css` | shadcn-vue light/dark CSS variable |
| `apps/desktop/src/components/*.vue` | 48 컴포넌트 코드 |
| `docs/plan/12-ui-improvement-plan.md` | UI v3 — 43 항목 결정 history |
| `docs/plan/22-ui-polish-v2.md` | 미완 UI debt (P1 19 / P2 17 / P3 4) |
| `docs/plan/18-dogfood-feedback.md` | 사용자 friction 누적 |
| `CHANGELOG.md` | sprint 단위 결정 history |

---

## 7. 산출물 위치 / 명명 규칙

- Figma file 명: `git-fried-design-system` (메인) + `git-fried-screens` (high-fi 화면)
- 페이지 분리: `01 Foundations` / `02 Primitives` / `03 Components` / `04 Modals` / `05 Screens` / `06 Patterns` / `07 Archive`
- Frame 명: `[Component] [Variant] [State]` (예: `Button / primary / hover`)
- Variables: shadcn-vue 토큰명 100% 준수 (`background`, `foreground`, `primary` …)
- Components: PascalCase (`BaseModal`, `ContextMenu`, `Tooltip`)

---

## 8. 다음 단계

1. tgkim 이 § 5 의 Q1~Q8 답변 → 디자이너 작업 가능
2. Sprint 1 진입 → Variables 라이브러리 작성
3. Sprint 1 review 통과 후 Sprint 2~5 순차 진행
4. 각 Sprint 완료 시 코드 측 implementation plan (`docs/plan/24-design-system-implementation.md`?) 작성
