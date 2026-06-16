# git-fried 실 가동 UI/UX 점수 리포트 — plan #45 실측

- **일자**: 2026-06-16
- **방법**: 실 Tauri 앱(WebView2 CDP) 가동 → `ui:sweep` 로 27 surface 캡처 + DOM geometry smoke + console error 수집 → 핵심 8 surface vision 검사 → §UI Breakage 13범주 + UX 품질 차원 점수화
- **빌드/런타임**: WebView2 149.0.4022.69, `tauri dev` 실 백엔드(git2 vendored), 실 워크스페이스(163 repo) 로드
- **산출물**: `<TEMP>/gitfried-ui-sweep/*.png` (27) + `report.json`

---

## Executive Summary

| 지표 | 결과 |
|---|---|
| 캡처 surface | **27** (routes 3 + settings 16 + main-nav tabs 7 + settings shell 1) |
| console / pageerror | **0** (전 surface) |
| DOM smoke flagged | 20 surface — **전부 heuristic false positive** (의도된 truncate/sr-only/스크롤-fold) |
| §UI Breakage 13범주 실제 위반 | **0** (vision 검사 8 surface + 잔여 19 surface 의 flag 요소 class 분석) |
| 종합 UI/UX 점수 | **92 / 100** (GitKraken 대체 가능 수준 유지) |

**결론**: 실제 가동에서 런타임 에러 0, 시각 깨짐 0. plan #45 변경(clone 취소 UI / Git Hooks / Sparse / 그래프 rAF)이 기존 GitKraken 스타일 3-pane 레이아웃을 회귀 없이 유지. DOM smoke 의 20 flag 는 모두 정상 예외(§UI Breakage false-positive 규칙)로 판정.

---

## 1. 깨짐 검사 (§UI Breakage 13범주)

### 1.1 DOM geometry smoke 결과

`ui:sweep` 는 surface 별로 `rootOverflow / wrapped / clipped / offscreen` 을 측정. flagged=20 이나 요소 class 를 전수 분석한 결과 **전부 정상 예외**:

| flag 유형 | 검출 요소 | 판정 | §UI Breakage 근거 |
|---|---|---|---|
| `clipped` settings 공통 | `button.w-full truncate ... text-left` (카테고리 사이드바) | **FP** | 의도된 ellipsis (긴 카테고리명 `truncate`) |
| `clipped` `span.sr-only` | LFS surface | **FP** | a11y 표준 패턴 (screen-reader-only 의도된 clip) |
| `clipped` graph | `span.flex-1 truncate` / `span.w-32 overflow-hidden` / `button.ref-pill-body truncate` | **FP** | 커밋 메시지/고정폭 컬럼/CommitRefPill 의 의도된 절단 (Sprint 2026-06-04 nowrap+truncate fix 자체) |
| `offscreen` 전반 | repo 리스트 항목 / 카테고리 버튼 / 저장·되돌리기 버튼 | **FP** | 스크롤 가능 리스트의 fold 아래 항목 (정상 overflow) |

→ **wrapped=0 전 surface** (단일행 chip/label wrap 없음). **rootOverflow=false 전 surface** (루트 가로 overflow 없음).

### 1.2 Vision 검사 (8 surface, 13범주 대조)

| Surface | 1겹침 | 2오버플로 | 3wrap | 4미렌더 | 5정렬 | 6오버레이 | 7스타일/a11y | 8런타임에러 | 판정 |
|---|---|---|---|---|---|---|---|---|---|
| route-01-index (주 3-pane) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| maintab-00-graph (커밋 그래프) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| route-04-settings (설정 shell) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| route-02-repositories (163 repo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| settings-02-repoSpecific (git config 폼) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| route-03-launchpad (PR 대시보드) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| maintab-01-branches (브랜치) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| settings-08-gitHooks (M-1 surface) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |

(9~13범주: 반응형/상호작용/가상스크롤/상태잔존/상태피드백 — 본 sweep 은 기본 viewport·로드 후 정적 캡처라 부분 cover. console 0 + 상태바 "Up to Date"/COMMIT 폼 정상 표시로 상태 피드백은 정상. 동적 리사이즈·hover·drag 후 상태는 미검증 — 아래 §4 한계.)

**diff 원인 분리** (§UI Breakage 필수): "현재 깨져있나" = **NO** (0 위반). "내 plan #45 변경이 새로 깨뜨렸나" = **NO** — 변경 surface(clone 모달/Git Hooks/그래프)가 모두 정상 렌더, 그래프 rAF 변경은 CONSOLE_ERRORS=0 으로 회귀 없음 확인.

---

## 2. UX 품질 점수 (차원별)

| 차원 | 점수 | 근거 |
|---|---|---|
| **시각 깨짐 부재** | 100 | 13범주 위반 0, console 0 |
| **레이아웃/정보 위계** | 95 | GitKraken 3-pane(좌 브랜치트리·중 그래프/탭·우 변경/커밋) 명확. 상단 툴바 + 하단 상태바 일관 |
| **일관성** | 94 | 다크 테마·타이포·간격·아이콘 전 surface 통일. 16 설정 서브탭 동일 shell |
| **Empty state** | 95 | Launchpad "PR 없음 + Forge 계정 열기/저장소 관리" 액션 버튼. 명확한 다음 단계 |
| **정보 밀도** | 90 | 163 repo 그룹화, 브랜치 feat/ prefix 그룹, Git Hooks byte+분류 배지 — 밀집하나 정돈 |
| **접근성 단서** | 88 | sr-only 사용, focus-visible(Sprint c27 wave), min-h-[24/28/32px] 터치타깃. 동적 a11y 미검증 |
| **plan #45 신규 UX** | 90 | clone 취소 버튼·Git Hooks 활성/비활성 토글·Sparse·repoSpecific 폼 자연스럽게 통합 |
| **종합** | **92** | GitKraken 대체 가능 수준(메모리 baseline 9.2+) 유지 |

### 표면별 하이라이트
- **route-01-index**: PR 패널의 "keychain 토큰 없음" 검증 배너 = 테스트 환경 정상 에러 표시(토큰 미설정). UI 깨짐 아님.
- **Launchpad**: 쿼리 문법 힌트(`author:tg state:open repo:foo is:pinned`) + 필터 토큰 칩 — 파워유저 친화.
- **Git Hooks (M-1)**: 활성 hook 8개(byte 표시 + 비활성화 버튼) + 비표준 배지 + Sample 9개(활성화 버튼) — H(core.hooksPath) 기능이 정확히 hook 분류·노출.
- **repoSpecific**: B1 Git Hooks ~ B4 Commit Signing + 저장소별 계정까지 `.git/config` 직접 편집 폼 정연.

---

## 3. 코드리뷰 수렴 (codereview all → 0)

| 리뷰어 | 신규 finding | 처분 |
|---|---|---|
| Claude quality | 9 | #2/#5/#6/#7 수정(commit a5039bb), #1/#4 스코프밖(pre-existing), #8 acceptable-dup, #3/#9 양호 |
| Claude security | 0 Critical/High (+2 LOW) | LOW 2건(hooks canonicalize cosmetic, RedactingWriter UTF-8) = documented-safe |
| Claude silent-failure | 1 CRITICAL + 1 HIGH + 3 MEDIUM | C-1/H-1 수정(CRITICAL), M-2 수정, M-3 refuted(LC_ALL=C 강제), M-1 documented-safe |
| Codex per-phase (구현 중) | M2/M6.1/M6.2/H/FixA | 전부 구현 중 반영(db.rs 144-150 doc 가 Codex M6.1/M6.2 인용) |
| Codex full re-review | **hang ~20분 무결과** (task-mqgh095e, plugin issue #18) | inconclusive — per-phase Codex + 3 Claude 로 0 수렴 이미 확립, redundant bonus 라 미훼손 |
| **재리뷰** | **0 findings** | 3 fix 전부 RESOLVED, regression 0 |

**핵심 수정 (commit a5039bb)**:
1. **C-1 (CRITICAL)** CloneRepoModal `cancelClone`: `cancelGitOp` 의 `boolean` 반환을 무시 → `false`(이미 완료/미등록)/IPC throw 시에도 `cloneCancelled=true` 잔존 → 진짜 실패를 "취소됨" 위장. `if (await cancelGitOp(id)) cloneCancelled=true` + `catch` surface 로 수정.
2. **M-2 (MEDIUM)** db.rs `quarantine_corrupt`: `as_nanos().unwrap_or(0)` 단독 → 같은 tick/시계스큐 dst 충돌. process-lifetime `AtomicU64 seq` tiebreaker → `.corrupt-{ts}-{seq}` 유일성.
3. **quality #2** CommitGraph M3 watch: `nextTick` 이중 지연 제거.
4. **quality #5/#7** CloneRepoModal: `cloneCancelled`/`canSubmit` 제네릭 명시.

**검증 evidence**: `vue-tsc --noEmit` exit 0 / `eslint` exit 0 / `cargo test` exit 0 (storage 포함) / `vitest` 929 passed / 재리뷰 0 findings.

---

## 4. 미검증 영역 (정직 표기)

- **동적 상태**: hover/focus/selected/drag 후, viewport 리사이즈(좁음/넓음), 가상 스크롤 점프 — `ui:sweep` 는 기본 viewport 정적 캡처라 §UI Breakage 9~12범주는 부분 cover.
- **모달/오버레이**: clone 모달·PR 상세·커밋 상세 사이드바 등은 sweep 경로(routes+settings+main-nav)에 미포함 — 별도 trigger 필요.
- **실 백엔드 시나리오 e2e**: `.tauri.spec` 직렬/동시 invoke 교차입증은 본 run 에 미포함(이전 Sprint 2026-06-04 에서 3 passed 확인).
- **Codex full re-review**: task-mqgh095e 가 ~20분 무결과 hang (plugin issue #18 의 process_died/hang 패턴) → inconclusive. 단 per-phase Codex(M2/M6.1/M6.2/H/FixA 구현 중 반영) + 3 Claude 적대적 리뷰 + fix 재리뷰 0 findings 로 0 수렴은 이미 확립 — full re-review 는 redundant 교차검증이라 hang 이 결론을 바꾸지 않음.

---

## 5. B (god-comp 템플릿 추출) — 처분

god-comp-check(WARNING 모드, 비차단)가 플래그: CloneRepoModal(script 211), CommitGraph(script 231), StatusPanel(추정 ≥300). 후보 추출(StatusFileRow / PrConversationTab / CommitGraphRow)은 **각각 heavily-wired god 컴포넌트의 delicate 리팩터**(5개 divergent row 변형 / 대량 conversation-tab state / 25-dep row). DOM-identical 설계라 **기능·UX·본 점수에 영향 0**. plan #45 의 실질 항목(M2~M9·H/F/G/E 보안/복구/정확성)은 전부 구현+리뷰0+실가동 검증 완료. B 는 회귀 위험 대비 가치(maintainability only)가 낮아, **시각 검증(ui:sweep) 안전망을 갖춘 전용 후속 작업**으로 분리 권고 — 본 마라톤 말미 일괄 강행 대신.
