# git-fried 종합 UI/UX·폰트 가독성·접근성 전수 평가 (다음 세션 작업 기준)

- **일자**: 2026-06-17
- **상태 기준**: plan #45 B 전부 반영 (HEAD `cd65ccd` 이후, B-1/B-2/B-3 + review fix 포함)
- **방법**: 실 Tauri 앱(WebView2 CDP) `ui:sweep` 27 surface 전수 캡처(console error 0) + 정적 토큰 분석(폰트 스케일·대비·a11y 정량) + **Codex 독립 코드 감사**(typography/UX/a11y, 실제 대비비 계산) 적극 페어
- **목적**: 다음 세션이 이 리포트만 보고 바로 착수할 수 있는 **우선순위 백로그**

---

## Executive Summary — 축별 점수

| 축 | 점수 | 한줄 |
|---|---|---|
| ① 시각 깨짐 (§UI Breakage 13범주) | **100** | 27 surface console 0, 실제 위반 0 (flag 전부 의도된 truncate/overflow-hidden/scroll-fold FP) |
| ② UX 휴리스틱 (Nielsen) | **90** | feedback/error-prevention/empty-state/keyboard 강함. 파괴적 git op 전부 confirm-gated |
| ③ 폰트 가독성 | **74** | ⚠ 10px(text-3xs) 213회 광범위 + 초소형×저대비 8곳 WCAG AA 미달 |
| ④ 접근성 (a11y) | **78** | 🟡 aria 139·focus-visible 33 양호하나 Mini 리스트 행 **키보드 접근 불가**(HIGH) + icon-only 버튼 무라벨 |
| **종합** | **~85** | 깨짐·UX 견고, **폰트 대비 + Mini 리스트 키보드**가 다음 세션 핵심 |

> 이전 92/100 리포트(`2026-06-16`)는 **깨짐 단일 축**. 본 리포트는 폰트·a11y 까지 넓혀 실제 개선 갭을 드러냄.

---

## 2026-06-17 후속 적용 (같은 세션, commit `56c350f`)

평가 직후 백로그 **9건 해소** (Codex 페어 + ui:sweep 회귀 0 검증). 갱신 점수: 폰트 74→**~84**, a11y 78→**~86**, 종합 ~85→**~90**.

- **Pretendard 적용 여부 — 런타임 확정**: "적용 안 됨" 체감 검증 위해 실 앱 CDP `document.fonts` 프로브 실행 → `checkVar=true` / `loaded:["Pretendard Variable [loaded w=45 920]"]` / body 실 적용 = Pretendard 최우선 / 렌더 폭이 fallback 과 상이. **Pretendard Variable 은 2026-06-02 부터 실제 로드+적용 중**. 체감 원인은 폰트 *family* 가 아니라 *size(10/9px)+contrast(alpha muted)* — 아래 A-1~A-3 가 정답이었음. (메모리 pitfall: 적용 여부는 config 추측 금지, 실 앱 SoT.)
- **해소 9건**: C-1·C-2(Mini 행 키보드) / C-3·C-4(icon 버튼 aria-label + 24px) / C-5(reset select focus-ring) / A-1·A-3(SHA·stash time 9px→11px full muted, 2.31:1→AA) / A-2(graph body 대비) / B-1(saved-view 삭제 pending-disable). 폰트 floor 정책 결정 적용: **9px=장식 전용 / 초소형 alpha 금지 / 의미 메타 ≥11px**.
- **잔여 (다음 세션)**:
  - **#8 `text-3xs(10px)` 213회 floor 상향** — 토큰 정책(11/12px·dense 유지) 결정 후 전수 audit (별도 sprint, 사용자 디자인 판단).
  - **button-in-button 통일 a11y refactor (NEW, Codex)** — `<li role="button">` + 내부 `<button>` 패턴이 **10+ 컴포넌트**(FileRow/StatusFileRow/MiniStashList/BranchPanel...)에 퍼져 있음. ARIA 엄밀히는 nested-interactive 부적절 → 내부 full-width `<button>` 래퍼로 통일하는 codebase-wide pass 권장 (현재 9건 수정은 기존 패턴 일관 유지 + 키보드 접근 net 개선). MED, 전역 패턴 결정 필요.

---

## ① 시각 깨짐 — ✅ 0 (회귀 없음)

- 27 surface `CONSOLE_ERRORS=0` (3회 sweep 일관: baseline / B-1 / 본 평가).
- DOM smoke flag 는 전부 **의도된 FP** (요소 class 전수 분석 + vision):
  - 루트 `main.flex flex-col overflow-hidden` — 앱 shell 의도된 클립(내부 pane 스크롤)
  - `truncate` — commit message / 파일 경로 / `ref-pill-body` / settings 카테고리명 (의도된 ellipsis)
  - `span.w-32 overflow-hidden` — 고정폭 branchTag 컬럼 (의도)
  - `span.sr-only` — a11y 표준 / 스크롤-fold 아래 항목 / nav-tab viewport-edge
- B-1/B-2/B-3 추출은 DOM-identical — graph/status/PR 모달 렌더 동일, 회귀 0.

---

## ② UX 휴리스틱 (Nielsen) — ✅ 90

| 휴리스틱 | 근거 (코드 정량) | 판정 |
|---|---|---|
| 가시적 피드백 | `toast.*` 396회 / 93 파일 | ✅ |
| 에러 예방 | `confirmDialog/chooseDialog` 158회 — branch delete/reset/rebase/stash drop/discard/force push/worktree remove 전부 gated (Codex 확인) | ✅ |
| 빈 상태 | empty-state 처리 230회 (repo list/graph/branch/commit table) | ✅ |
| 사용자 제어 | 단축키 @keydown 37 + clone 취소(M4c) + 되돌리기 | ✅ |
| 보안/안전 | `v-html` 0 (XSS 표면 없음) | ✅ |

**유일 갭 (B-1/LOW)**: Launchpad saved-view 삭제(`launchpad.vue:244`)는 confirm/undo/pending 비활성 없음 → 단일 클릭 즉시 삭제.

---

## ③ 폰트 가독성 — ⚠ 74 (다음 세션 핵심)

### 토큰 사실 (`tailwind.config.ts:84-91`)
`text-2xs=11px / text-3xs=10px / text-4xs=9px`. Pretendard(한글 cover) + line-height 1.55 + letter-spacing -0.003em → **한글 줄간/자간은 양호**.

### 사용 분포 (`apps/desktop/src/components`)
- **text-3xs (10px): 213회** — git 에러/파일 히스토리 메타/commit body 스니펫/경로/브랜치·상태 라벨/액션 컨트롤 등 **중요 정보 다수 포함**. 데스크탑 보조텍스트 권장(~11-12px) 미만.
- text-4xs (9px): 14회 — 다수는 장식(▶/▼/●/🏷/avatar initial)이나 **메타데이터(submodule SHA/stash time/ahead-behind/PR comments)도 포함**.
- text-2xs (11px): 85회 — 하한선.

### 대비 (Codex 실측 계산)
`--muted-foreground` light 46.1%L → **full 4.83:1 (본문 AA 겨우 통과)**, **`/70` 2.73:1 (FAIL)**, **`/60` 2.31:1 (FAIL)**. dark 도 `/70` 4.23:1 / `/60` 3.38:1 미달.

### 초소형 × 저대비 중첩 (WCAG AA 미달 — 우선 수정)
| ID | 위치 | 내용 | 대비 | sev |
|---|---|---|---|---|
| A-1 | `MiniSubmoduleList.vue:114` | submodule SHA 7자 `text-4xs(9px) /60` | **2.31:1** | HIGH |
| A-3 | `MiniStashList.vue:122` | stash 타임스탬프 `text-4xs(9px) /70` | 2.73:1 | MED |
| A-2 | `CommitGraphRow.vue:144` | commit body 미리보기 `text-2xs(11px) /70` | 2.73:1 | MED |

**권고 방향**: (a) 의미있는 메타데이터의 floor 를 `text-2xs(11px)` 이상으로, (b) alpha-muted(`/70`,`/60`)를 full `text-muted-foreground` 또는 대비 검증 토큰으로 교체, (c) 9px(`text-4xs`)는 순수 장식(아이콘/화살표)에만 한정.

---

## ④ 접근성 (a11y) — 🟡 78

정량: focus-visible 33 · aria-label 139 · role=button 12 · 터치타깃 min-h `24px×56`(WCAG 2.5.8 바닥 충족) / `28px×29` / `32px×9`.

| ID | 위치 | 문제 | sev |
|---|---|---|---|
| C-1 | `MiniStashList.vue:112` | 클릭 가능 `<li>` 에 role/tabindex/@keydown 부재 → **키보드 완전 차단** | HIGH |
| C-2 | `MiniSubmoduleList.vue:98` | 행 `@dblclick`+`@contextmenu` 만 — 키보드로 submodule 열기 불가 | HIGH |
| C-3 | `CommitDiffPanel.vue:116` | icon-only 🍒/↩/⏮(cherry-pick/revert/reset) 무 aria-label + 높이 24px 미만 | MED |
| C-4 | `TerminalPanel.vue:39` | `title`-only icon 버튼(⟳/✕) — title 은 신뢰 가능한 accessible name 아님 | MED |
| C-5 | `CommitDiffPanel.vue:135` (+`CommitDiffModal.vue:153`) | reset-mode `<select>` `focus:outline-none` + 링 대체 없음 → 파괴적 컨트롤 focus 비가시 | MED |

**확인된 안전(non-finding)**: 주요 파괴적 git op 전부 confirm-gated / 빈 상태 존재 / `aria-hidden` 오용 없음 / `tabindex=-1` 은 modal focus-target·roving 패턴.

---

## 백로그 (2026-06-17 갱신 — 9건 해소 후 실 상태)

> ⚠️ 아래 표의 C-1~C-5 / A-1~A-3 / B-1 (9건) 은 **commit `56c350f` 에서 모두 해소** (라이브 코드 재확인: MiniStashList role/tabindex/keydown ✓, MiniSubmoduleList SHA→`text-2xs` full muted ✓, CommitDiffPanel aria-label 5개 ✓). 아래는 이력 보존용 + **실 남은 작업(WL-1/WL-2 + 검증 4건)** 강조.

### ✅ 해소 완료 (commit `56c350f`)
| ID | 작업 | 상태 |
|---|---|---|
| C-1/C-2 | Mini 리스트 행 `role=button tabindex=0` + Enter/Space + focus ring | ✅ |
| C-3/C-4 | icon 버튼 `aria-label` + `min-h/min-w 24px` | ✅ |
| C-5 | reset select `focus-visible:ring-2` | ✅ |
| A-1/A-3 | submodule SHA·stash time → `text-2xs(11px)` full muted (2.31:1→AA) | ✅ |
| A-2 | commit body 미리보기 대비 | ✅ |
| B-1 | Launchpad saved-view 삭제 pending-disable | ✅ |

### 🔄 세션 2 추가 진행 (2026-06-17 오후 — 자율, sweep 검증)
평가 백로그를 "순차 자율 진행" 지시로 받아 **검증 가능한 안전 범위**만 처리:

- **WL-1 부분 (안전 subset)** — 초소형(text-3xs/4xs)+text-alpha(`/70`) 대비 위반 **6곳** full `text-muted-foreground` 로 교체(2.73:1→4.83:1 AA): CommitGraph.vue:484 / StatusPanel.vue ×4 (hunk stage·unstage 버튼) / repositories.vue:518. **레이아웃 변화 0** (대비만). 잔여 232회 `text-3xs(10px)` density 승급은 **디자인 결정(사용자) 대기** — blind 일괄 변경 시 행높이/컬럼 회귀 위험이라 미진행.
- **WL-2 부분 (clean file-row 패턴)** — `FileRow` + `StatusFileRow` 를 full-width 내부 `<button>` 패턴으로 통일 (행 `<li>` 비상호작용화, primary select=내부 button, action/slot=형제). `FileRow.test.ts` +1 (nested-interactive 회귀 test) → **vitest 930 / typecheck 0**. **CommitGraphRow·BranchPanel 은 미진행** — nested-interactive 가 컬럼 내부 깊숙한 `CommitRefPill`(solo/hide) 이라 clean 분리 불가 → 그래프 행 구조 재설계 필요(큰 UI 결정, hands-on 검토 권장). Mini 리스트/모달은 sweep 가 빈 상태라 시각 검증 불가 → 동일 패턴 적용은 hands-on.
- **WL-4 부분** — `ui:sweep` 에 **nested-interactive DOM detector 추가**(상호작용 요소 안의 상호작용 요소 검출). 현재 인벤토리: `maintab-00-graph=1`(CommitGraphRow), `maintab-01-branches=1`(BranchPanel). 빈 상태 리스트(stash/submodule/pr)는 0(미렌더). 모달 capture 자동화는 per-modal 트리거 맵 필요 → follow-up.
- **검증**: typecheck 0 / vitest **930** / `ui:sweep` 27 surface **console 0 · wrap 0 · rootOverflow 0**(회귀 없음, clip/off 는 기존 의도 FP). 단 status-panel·Mini 행은 sweep 가 빈 저장소라 populated 시각 검증은 미실시(hands-on 사인오프 권장).
- **WL-5 (NVDA)**: headless 환경에서 실 스크린리더 구동 불가 → **자율 검증 blocker**, 사용자 수동 통과 필요(코드 정량 aria-label 139·focus-visible 33 은 충족).
- **WL-3/6**: sweep 정적 캡처 한계 — 동적 상태(WL-3)·고DPI deviceScaleFactor(WL-6)는 sweep 확장 follow-up.

### 🔲 남은 작업 (세션 2 이후 갱신)
| ID | 작업 | 범위 | Tier·사이즈 | 선행 결정 |
|---|---|---|---|---|
| **WL-1** | `text-3xs(10px)` floor audit — 중요 정보 loci 를 `text-2xs+` 승급 | **라이브 232회** (components+pages) | HIGH·L | 메타데이터 floor(11/12px) + dense 예외 범위 + alpha 정책 (디자인 판단) |
| **WL-2** | button-in-button nested-interactive 통일 (내부 full-width `<button>` 래퍼) | **13 컴포넌트** (BranchPanel/CommitGraphRow/FileRow/FullscreenDiffView/GlobalSearchModal/IssuesPanel/MiniPrList/MiniStashList/MiniSubmoduleList/ProfileSwitcher/PrPanel/StatusFileRow/WipRow) | MED·M | 전역 패턴 결정 |
| WL-3 | 동적 상태(hover/focus/drag 후) 시각 검사 | sweep 정적 한계 (§UI Breakage #10) | MED·M | — (자율) |
| WL-4 | 모달·오버레이 sweep 편입 | 현 27 surface 모달 미포함 (§#6) | MED·M | — (자율) |
| WL-5 | 실 스크린리더(NVDA) 통과 | 정량만, 실 reader 미검증 | LOW·M | headless 불가 — 수동 |
| WL-6 | 고DPI·색맹 시뮬 + 폰트 줌-크롭 실측 | 썸네일 한계 | LOW·S | — (자율) |

### 권장 진입점
- **즉시 자율**: WL-4(모달 sweep 편입) → WL-3(동적 상태) — 결정 불요, 깨짐 사각 보강.
- **디자인 결정 후 일괄**: WL-1 토큰 정책 → 232회 audit. WL-2 는 같은 컴포넌트군이라 묶어 처리.

---

## 검증 메타 / 미검증 영역

- **검증**: ui:sweep 27 surface(console 0) + 정적 토큰 정량 + Codex 독립 감사(대비비 실측) + 핵심 HIGH finding spot-verify(C-1/C-2/A-1/C-5 코드 인용 확인).
- **Codex 페어**: 적극 페어 완주 (job `af53d136`, 558s). 내 정적 분석과 교차검증 일치 + a11y(키보드 접근) 신규 발견 추가.
- **미검증(다음 세션 보강 여지)**: 동적 상태(hover/focus/drag 후 시각) / 모달·오버레이 surface(sweep 미포함) / 실제 스크린리더(NVDA/VoiceOver) 통과 / 고DPI·색맹 시뮬레이션 / 폰트 렌더 실측 줌-크롭(다운스케일 썸네일 한계).
- **점수 성격**: 코드 정량 + 실앱 console + 휴리스틱 기반. 사용자 정성 평가(실사용 마찰)는 별도.
