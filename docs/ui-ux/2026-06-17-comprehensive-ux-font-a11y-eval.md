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

## 다음 세션 우선순위 백로그 (착수 순서)

| 순위 | ID | 작업 | 파일:라인 | 효과 |
|---|---|---|---|---|
| **1** | C-1 | MiniStashList 행 `<button>` 화 또는 `role=button tabindex=0` + Enter/Space + focus ring | `MiniStashList.vue:112` | 키보드 사용자 stash 접근 복구 (HIGH a11y) |
| **2** | C-2 | MiniSubmoduleList 행 키보드 primary action(Enter→openAsRepo) 추가 | `MiniSubmoduleList.vue:98` | 동일 (HIGH a11y) |
| **3** | A-1 | submodule SHA → `text-2xs` 이상 + alpha 제거 | `MiniSubmoduleList.vue:114` | 2.31:1 → AA 통과 (HIGH 가독성) |
| **4** | C-3 | CommitDiffPanel icon 버튼 `aria-label` + `min-h-[24px] min-w-[24px]` | `CommitDiffPanel.vue:116` | a11y + 클릭 타깃 |
| **5** | A-2/A-3 | alpha-muted 메타데이터(commit body·stash time) full-opacity + ≥11px | 각 파일 | 복수 4.5:1 미달 해소 |
| 6 | C-4 | TerminalPanel `title`→`aria-label` + 24px | `TerminalPanel.vue:39` | a11y |
| 7 | C-5 | reset select `focus-visible:ring-2` | `CommitDiffPanel.vue:135` | 파괴적 컨트롤 focus 가시화 |
| 8 | 토큰 | `text-3xs(10px)` 213회 중 **중요 정보** loci 를 `text-2xs+` 로 점진 승급 (전수 audit 별도) | 광범위 | 가독성 floor 상향 |
| 9 | B-1 | Launchpad saved-view 삭제 confirm/undo + pending 비활성 | `launchpad.vue:244` | UX 안전 (LOW) |

### 권장 진입점
**1군(a11y HIGH, 빠른 수정)**: C-1 + C-2 + C-3 (Mini 리스트 키보드 + icon 버튼) — 패턴 동일(role/tabindex/keydown/aria-label), 한 sprint 일괄.
**2군(가독성)**: A-1 → A-2/A-3 → 토큰 전수(#8) — 디자인 토큰 결정(메타데이터 floor + alpha 정책) 선행 후 일괄 치환.

---

## 검증 메타 / 미검증 영역

- **검증**: ui:sweep 27 surface(console 0) + 정적 토큰 정량 + Codex 독립 감사(대비비 실측) + 핵심 HIGH finding spot-verify(C-1/C-2/A-1/C-5 코드 인용 확인).
- **Codex 페어**: 적극 페어 완주 (job `af53d136`, 558s). 내 정적 분석과 교차검증 일치 + a11y(키보드 접근) 신규 발견 추가.
- **미검증(다음 세션 보강 여지)**: 동적 상태(hover/focus/drag 후 시각) / 모달·오버레이 surface(sweep 미포함) / 실제 스크린리더(NVDA/VoiceOver) 통과 / 고DPI·색맹 시뮬레이션 / 폰트 렌더 실측 줌-크롭(다운스케일 썸네일 한계).
- **점수 성격**: 코드 정량 + 실앱 console + 휴리스틱 기반. 사용자 정성 평가(실사용 마찰)는 별도.
