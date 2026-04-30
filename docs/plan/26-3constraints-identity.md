# Plan 26 — "3 Constraints" 기반 v0.4 정체성 강화

작성: 2026-04-30 (Sprint c33 종료 후)
원전: [Jordan Lord — 3 constraints before I build anything](https://jordanlord.co.uk/blog/3-constraints/) ([hada.io topic 28954](https://news.hada.io/topic?id=28954))

> **목적**: Sprint c33 까지 39 commits 누적 후 자율 진행 가능한 다음 사이클 (v0.4 prep) 의 방향 설정. 외부 의존 (EV 인증서 / GitHub secret / macOS / OAuth) 이 지연되는 동안 **사용자 인식 가능한 차별점 강화** 를 통해 내부 가치 누적.

---

## 1. 두 글의 비판적 요약

### 원전 핵심 주장 (3 constraints)

1. **One-pager 제약** — 모든 아이디어는 한 페이지에 담길 수 있어야 한다. 안 담기면 더 조사/계획/프로토타입 필요
2. **Core tech 분리** — 제품과 별개로 살아남을 수 있는 핵심 기술을 만들 것 (Skype P2P, HashiCorp HCL, Linus Git 예시)
3. **Defining constraint** — 사용자에게 계속 드러나는 하나의 정체성 제약 (Notion blocks / Excel cells / Minecraft blocks)

### 비판 (hada.io 댓글 + 자체)

| # | 비판 | 우리 대응 |
| - | ---- | ---- |
| C1 | **보편성 의문** — 모든 제품이 3 제약을 따라야 한다고 강요는 무리. Tana 처럼 단순 컨셉이라도 학습 복잡, Google Maps 처럼 컨셉 많아도 UX 견고 | 우리는 채택 가능한 부분만 추출. 절대 규칙 X |
| C2 | **맥락 의존** — 화성 비행 SW 같은 복잡 도메인엔 한 페이지 부족 | git-fried 는 mid-complexity GUI — 한 페이지 onboarding 가능하나 전체 manual 은 불가 |
| C3 | **사업 현실 무시** — Twitter 처럼 pivot 한 사례 다수. 불변 제약은 생존 방해 | git-fried 의 정체성 (한글 안전 + Gitea + AI) 자체가 강한 핵심이지만 보강 가능 |
| C4 | **배포/유통 검증 누락** — 기술 완벽해도 사용자 수요 없으면 무의미 | DOGFOOD.md 의 사용자 (tgkim) 검증 1순위 + dogfood 결과 반영 |
| C5 | **실패 사례 부재** — 글 자체가 성공 예시만 나열 | 우리는 c25/c27/c30 의 실패 (ContextMenu reka-ui 보류 / CommitGraph drawGraph 보류) 도 명시적 plan 에 기록 |

### 채택 가능 부분

- **One-pager** ✓ — 신규 진입점 (5분 안에 "이게 뭐고 왜 만들었나" 이해)
- **Core tech 분리** ⊕ — Rust mod 경계만 명확히 (라이브러리 publish 는 v1.x 시점)
- **Defining constraint** ✓✓ — git-fried 이미 3개 후보 보유 (한글 안전 / Gitea first-class / AI CLI subprocess) — 사용자 인식 가능 형태로 노출 부족

---

## 2. git-fried 의 현재 상태 (3 제약 평가)

### One-pager (현재: ⚠ 부분)

| 문서 | LOC | 역할 | one-pager 적합 |
| ---- | ----: | ---- | ---- |
| `README.md` | 247 | 종합 소개 | 너무 길음 (5분 ↑) |
| `DOGFOOD.md` | 270+ | 자체 사용 가이드 | 사용자 본인용, 신규자 X |
| `CHANGELOG.md` | 1300+ | 버전 이력 | 진입점 X |
| `docs/IMPLEMENTATION-STATUS.md` | 313 | 인벤토리 | 개발자용, 사용자 X |
| `docs/plan/00-overview.md` | (있음) | 비전 / 결정 사항 | 메타 plan |

→ **갭**: "5분 안에 git-fried 가 뭐고, 왜 만들었고, 어떻게 시작" 문서 부재.

### Core tech 분리 (현재: ✓ 양호 — 단 publish 미진입)

| Core tech | 위치 | 분리도 | publish 가치 |
| ---- | ---- | ---- | ---- |
| 한글 normalization | `src-tauri/src/git/path.rs` (encoding_rs + unicode-normalization) | 부분 (utility 산재) | 중 — 한글 git tool 공통 문제 |
| AI CLI subprocess | `src-tauri/src/ai/runner.rs` (Claude/Codex 통합) | 명확 (`AiCli` trait 후보) | 중 — git/non-git 도구 모두 활용 가능 |
| Multi-forge profile | `src-tauri/src/forge/` (Gitea + GitHub OAuth) | 명확 (4 sub-mod) | 낮 — git 도구 한정 |
| Tauri keyring 통합 | `src-tauri/src/storage/auth.rs` | 부분 | 낮 |
| Reflog-based undo/redo | `src-tauri/src/git/reflog.rs` | 명확 | 중 — 다른 git GUI 가 차용 가능 |

→ **결론**: v0.x 는 publish 보류. v1.x 에서 한글 normalization + AI CLI subprocess 를 별도 crate 로 추출 가능성 평가.

### Defining constraint (현재: ✓ 강함 — 단 인식 부족)

git-fried 의 후보 3개:

| 제약 | 강도 | 사용자 인식 노출 |
| ---- | ---- | ---- |
| **한글 안전 (encoding + normalization)** | ★★★ | README 1줄 / 실제 UI 노출 0 |
| **Gitea first-class (회사 환경)** | ★★★ | README 1줄 / 시작 화면 미강조 |
| **AI CLI subprocess (외부 LLM 명시 confirm)** | ★★ | Sprint c33 ConfirmDialog 로 처음 인식 가능 ✓ |
| GitKraken 대체 (UX) | ★★ | 시각 비교 부재 |
| Tauri-light (메모리 / 바이너리) | ★ | dev 만 인지, 사용자 X |

→ **갭**: 한글 / Gitea 정체성이 사용자 첫 진입에 노출 안 됨 (시작 화면이 generic git GUI).

---

## 3. 추가 Plan (v0.4 정체성 강화)

### Phase 1 — One-pager 진입점 (1 sprint, ROI ★★★)

**산출물**: `docs/QUICK_START.md` (1 페이지, 5분 내 읽기)

```markdown
# git-fried 1분 요약 (QUICK_START)

## 왜 만들었나
- 회사 Gitea + 개인 GitHub 듀얼 환경에서 한글 commit 메시지 안전
- GitKraken 의 무거움 (Electron) + 라이선스 부담 → Tauri light + MIT
- AI CLI 직접 호출 (Claude / Codex) — 외부 SaaS 의존 없음

## 5분 시작
1. 다운로드 (v0.3.x) → 첫 실행 시 GitKraken 데이터 자동 import 안내
2. Settings → Forge 계정 (Gitea PAT / GitHub PAT) 등록
3. Sidebar → 레포 선택 → Commit Graph + Diff 에서 작업

## 차별점 (한 줄씩)
- ✓ 한글 안전 (encoding_rs + NFC normalization)
- ✓ Gitea first-class (회사 환경 직격)
- ✓ AI CLI subprocess (Claude / Codex — 명시 confirm)
- ✓ Multi-profile (개인 ↔ 회사 1-click toggle)
- ✓ Worktree native (다중 작업 디렉토리)

## 다음 단계
- DOGFOOD.md — 자체 사용 가이드
- docs/IMPLEMENTATION-STATUS.md — 개발자용 인벤토리
- README.md — 전체 기능
```

**작업 size**: 1 commit, ~150 LOC.

### Phase 2 — Settings 차별점 패널 (1 sprint, ROI ★★)

**위치**: `apps/desktop/src/pages/settings.vue` 의 "About" 카테고리 강화 (현재 placeholder).

**컴포넌트**: `IdentityCard.vue` (신규, ~80 LOC)

내용:
- 3 차별점 시각화 (icon + 1줄 설명)
- "이 기능 사용 중" 자동 체크 (활성 forge / 한글 commit 카운트 / AI mut 호출 카운트 — 통계)
- README + QUICK_START 링크

**작업 size**: 1 commit, ~100 LOC + i18n 키 ~10 추가.

### Phase 3 — Onboarding tour (2 sprint, ROI ★)

**위치**: 첫 실행 시 (localStorage `git-fried.onboarded.v2` 부재).

3 step:
1. "한글 안전" — 현재 활성 레포의 한글 commit 메시지 카운트 표시 (있으면 "✓ 안전 보호됨")
2. "Forge 듀얼" — 등록된 forge 계정 카운트 (Gitea / GitHub)
3. "AI CLI" — Claude / Codex 설치 여부 자동 감지

**작업 size**: 2 commits (`OnboardingTour.vue` + `useOnboarding.ts`), ~200 LOC + i18n + skip/replay.

**위험**: 사용자 (tgkim) 는 기존 사용자라 onboarding 안 봄. 대신 신규 GitHub public release 시점에 가치.

### Phase 4 — Core tech 경계 정리 (검토만, 코드 수정 0)

**산출물**: `docs/plan/26-core-boundaries.md` 문서 (이 plan/26 의 sub-doc)

각 core tech 의 publish 가능성 평가:
- 한글 normalization → v1.x publish 후보 (`encoding_rs` 의 git path 특화)
- AI CLI subprocess → v1.x publish 후보 (Claude/Codex/추후 Gemini 통합)
- Reflog-based undo → v1.x 검토 (git2 wrapper)
- Multi-forge profile → publish 비추 (git GUI 한정)

**작업 size**: 0 commit (분석만). 결과는 plan/17 v1.x roadmap 에 흡수.

---

## 4. 비판 self-check (Plan 26 자체)

### 이 plan 이 over-engineering 일 수 있는가?

| 위험 | 대응 |
| ---- | ---- |
| **사용자 1명 (tgkim) 만 사용 중** — onboarding ROI 낮음 | Phase 3 우선순위 낮춤. v0.4 release prep 시점에 진입 |
| **README + DOGFOOD 이미 존재** — QUICK_START 중복 | 차별점: README 247 LOC vs QUICK_START 1 페이지 (5분). 진입점 분리 |
| **차별점 패널이 마케팅성** — 기능 가치 X | 통계 (한글 commit 카운트 등) 으로 dogfood 입증 — 실제 사용 데이터 |
| **3 constraints 자체가 보편성 부족** | 채택 부분만. Phase 4 는 코드 수정 0 — risk free |

### 우선순위

1. **Phase 1 (QUICK_START)** — ★★★ ROI, 1 commit. **즉시 진행 가능**
2. **Phase 2 (Settings 차별점 패널)** — ★★ ROI, 1 commit. **dogfood 후 진입**
3. **Phase 3 (Onboarding tour)** — ★ ROI (신규 사용자 부재). **v0.4 release 시점**
4. **Phase 4 (Core boundaries 문서)** — 0 commit, 분석만. **v0.4 prep 시 plan/17 통합**

---

## 5. 다음 sprint 진입 권장

### Sprint c34 후보 (자율 가능)

| # | 작업 | 가치 | 위험 |
| - | ---- | ---- | ---- |
| **A** | Phase 1 — QUICK_START.md 작성 + README 정체성 첫 화면 강화 | ★★★ | 낮 |
| B | Phase 4 — core tech publish 가능성 분석 (plan/17 sub-doc) | ★★ | 0 |
| C | dogfood 후 Phase 2/3 결정 (사용자 입력 대기) | ★★ | 0 |

### 외부 의존 잔존

- I (EV 인증서) — 사용자 timing
- J (`git tag v0.3.0` push) — 사용자 timing
- K (macOS / Linux / OAuth / Sentry) — plan/17 v1.x

---

## 6. 결론

**3 constraints 원칙은 git-fried 에 부분적으로 이미 적용되어 있다.** Sprint c31~c33 에서 god component 분리 (Centers 패턴 mirror) / i18n 318 키 / ConfirmDialog 표준화 (3 constraints 의 "defining constraint" mirror) 가 자연스럽게 충족됨.

**잔여 갭은 사용자 인식 부족** — 차별점 (한글 / Gitea / AI) 이 코드 안에는 있으나 첫 진입 사용자가 즉시 인지하지 못함. Phase 1 (QUICK_START) 하나로 ROI 가장 큼.

**v0.4 theme 제안**: "정체성 강화 — 차별점 시각화 + dogfood 통계". 외부 의존 (EV / OAuth) 대기 동안 내부 가치 누적.

> Phase 1 진행 여부는 사용자 결정. 이 plan 자체는 대기 상태.
