# Sidebar Micro-Gap 개선 계획 v0.2

- **일시**: 2026-05-18 / **버전**: v0.2 (Codex audit `afa27e8d62219ed53` 합류)
- **트리거**: 사용자 `"분석결과를 토대로 git-fried 개선 계획을 세워 줘 Codex와 함께"`
- **근거 보고서**: [docs/ux-eval/2026-05-18-sidebar-microdetail-diff.md](../ux-eval/2026-05-18-sidebar-microdetail-diff.md) — 38 신규 backlog (SB-012 ~ SB-049) + Codex 추가 2건 (SB-050/051)
- **합류 모델**: Claude (v0.1 draft) + Codex Independent Audit (`afa27e8d62219ed53`, 4 spot-check parent context 재검증 CONFIRMED)
- **v0.1 → v0.2 핵심 변경**:
  1. **Phase E 폐기** — Codex 검증: `useShortcuts.ts:238/262` + `HelpModal.vue` 이미 구현. 코드 추가 0, **검증/문서 정리만** (별도 wave 없이 Phase B 의 i18n + Phase A 의 doc 갱신과 통합)
  2. **SB-014 Phase A → Phase C 이동** — `useHiddenRefs` (persistent) vs solo (session) 두 레이어 충돌 회피, 의존성 정리 선행
  3. **SB-013 재정의** — greenfield 아님. `BranchPanel.vue:293-294` 이미 `opacity-40 line-through` (hidden) + `bg-orange-500/10 ring-1 ring-orange-500/40` (solo). **본 작업은 Mini list + CommitRefPill 일관성 확보**
  4. **SB-017 Rust 선행 명시** — `forge/model.rs:45` `PullRequest` struct 에 `ci_status` 필드 부재 → Rust 모델 + API 계약 변경 선행, Vue 만으로 못함
  5. **SB-048 needs-user → autonomous-safe 재분류** — Codex: `MiniPrList:22` `v-if="length > 0 || isFetching"` 패턴으로 scoped empty 메시지 한정 시 안전
  6. **SB-020/026 needs-user 추가** — bulk delete 정책 / Gitflow 강제 여부 사용자 워크플로우 의존
  7. **신규 micro-gap 2건**: SB-050 (useUserSettings shallow merge → SB-012 선행), SB-051 (MiniRemoteBranchList row click 비대칭)

---

## 0. Executive Summary (v0.2)

| Phase | 영역 | 항목 | Effort | Codex sequencing | 우선 |
|-------|------|------|--------|------------------|------|
| **A** | HIGH 자율 | SB-013, SB-017 | S+M | ✓ A 유지 | **즉시** |
| **A'** | HIGH needs-user | SB-012 (+ SB-050 선행) | S | needs-user 후 | 사용자 응답 후 |
| **B** | MED batch 1 (시각/hover/i18n) | SB-049, SB-015, SB-016, SB-030 | XS+S×3 | i18n 흡수 | **A 와 병렬** |
| **C** | MED batch 2 (인터랙션) | **SB-014** ✚, SB-019, SB-029 | M×3 | SB-014 이동 | A 후 |
| **C'** | MED needs-user | SB-020 (multi-select bulk-delete), SB-026 (branch groups) | M+L | needs-user 후 | 사용자 응답 후 |
| **D** | MED + LOW batch (메뉴/상태/a11y/worktree) | SB-033, SB-040, SB-031, SB-046 | S+S+M+S | F 흡수 | B 와 병렬 |
| ~~E~~ | ~~LOW 단축키~~ | (이미 구현 — 폐기) | - | Codex: 검증/문서만 | - |
| ~~F~~ | ~~LOW a11y+worktree~~ | (D 로 흡수) | - | - | - |
| ~~G~~ | ~~i18n cleanup~~ | (B 로 흡수) | - | - | - |
| **H** | needs-user batch | SB-027, SB-028, SB-048→A에 흡수 | - | SB-048 자율 가능 | 사용자 응답 후 |
| **deferred** | LOW / ROI 낮음 | 15건 (SB-049 흡수 제외) | - | - | 본 계획 외 |
| **거부** | GitKraken Agents/Cloud | 5건 | - | - | 의도적 (plan/01 §5) |

---

## 1. Phase A — HIGH 자율 진행 (2건, Codex audit 후 SB-014 분리)

### A-1. SB-013 — Hide/Solo 시각 토큰 **통일** (greenfield 아님)

**Codex 정정**: `BranchPanel.vue:293-294` 이미 다음 구현:
```vue
isHidden(b.name) ? 'opacity-40 line-through' : '',
soloRef === b.name ? 'bg-orange-500/10 ring-1 ring-orange-500/40' : '',
```

**본 작업의 실제 범위 (토큰 일관성 확보)**:
- ✅ BranchPanel — 이미 구현 (no-op)
- ❌ **MiniBranchList.vue** — opacity-40 / line-through / orange ring **미적용**
- ❌ **MiniRemoteBranchList.vue** — 동일
- ❌ **MiniTagList.vue** — 동일
- ❌ **CommitRefPill.vue** — hidden/solo 상태 반영 여부 검증 + 적용
- (선택) Tailwind config 의 semantic 토큰 통일: `--vis-hidden` / `--vis-solo` named class

**구체 작업**:
- BranchPanel 의 class 표현을 그대로 4 컴포넌트에 복제
- `isHidden(name)` / `soloRef === name` 헬퍼는 컴포넌트 별 `useBranchVisibilityActions` 호출
- i18n title attribute 4 키 추가 (`branchList.hiddenTitle`, `branchList.soloTitle` × 2)

**Effort**: **S** (~80 LOC × 4 컴포넌트 + i18n 4 키)

**Verification**:
- vitest: useBranchVisibilityActions.test.ts 회귀 + Mini list 시각 회귀 (snapshot)
- e2e: `e2e/actions.spec.ts` 에 hide → mini list opacity 확인
- 수동: light/dark mode 양쪽 + WCAG contrast (opacity 40 + line-through 가 AA 통과하는지)

**회귀 영역**:
- BranchPanel 의 표현이 이미 SoT — 본 작업은 그것을 4 컴포넌트로 fan-out 만
- CommitRefPill 의 기존 색 분기 (branch sky / remote emerald / tag violet / stash amber) 와 hidden 의 opacity 합산이 OK 한지

### A-2. SB-017 — PR CI 4 아이콘 (**Rust 선행 필수**)

**Codex 정정**: `forge/model.rs:45` `PullRequest` struct 에 `ci_status` 필드 **없음**. Vue 만으로 못함 — Rust API 계약 변경 + Forge API 호출 보강 선행 필수.

**Phase A-2-1: Rust 모델 + API 보강 (선행)**:
- `forge/model.rs` `PullRequest` 에 필드 추가:
  ```rust
  #[serde(default, rename_all = "camelCase")]
  pub struct PullRequest {
      // ... 기존 필드 ...
      pub ci_status: Option<CiStatus>,       // 신규
      pub approval_state: Option<ApprovalState>, // 신규
  }

  #[derive(Serialize, Deserialize, Debug, Clone)]
  #[serde(rename_all = "snake_case")]
  pub enum CiStatus { Success, Pending, Failure, Unknown }

  #[derive(Serialize, Deserialize, Debug, Clone)]
  #[serde(rename_all = "snake_case")]
  pub enum ApprovalState { Approved, ChangesRequested, ReviewRequested, None }
  ```
- `forge/gitea_pr.rs` — `head_sha` 의 `/repos/{owner}/{repo}/statuses/{sha}` 호출 + 매핑
- `forge/github_pr.rs` — `/repos/{owner}/{repo}/commits/{sha}/check-runs` + `/pulls/{n}/reviews` 호출 + 매핑
- 4 상태 frontend 매핑:
  - `ci=Success` + `approval=Approved` → 🟢 green check
  - `ci=Pending` 또는 `approval=ReviewRequested` → 🟡 yellow dot
  - `ci=Failure` 또는 `approval=ChangesRequested` → 🔴 red X
  - `PR.draft=true` → ⚫ gray D (CI/approval 무관 최우선)

**Phase A-2-2: Vue 렌더링**:
- `MiniPrList.vue` row 좌측에 status icon (text-[10px], shrink-0, w-3)
- `PrDetailModal.vue` 도 동일 시각 (parity)
- i18n `pr.ciStatus.{passed,pending,failed,draft}` × ko/en (8 키)

**Effort**: **M** (Rust ~120 LOC + Vue ~80 LOC + i18n 8 키)

**Verification**:
- cargo test: `forge/gitea_pr.rs` + `forge/github_pr.rs` 의 ci_status 파싱 (httpmock fixture, 4 상태 각)
- vitest: MiniPrList.test.ts 4 상태 시각 회귀
- 수동: dogfood — git-fried 자체 PR + GitHub PR 양쪽

**회귀 영역**:
- Forge API rate limit (CI status 호출이 fetch 빈도 증가 가능 — Codex finding: `forge/github_pr.rs` rate limit 고려)
- 기존 PullRequest serde deserialization 회귀 (필드 추가는 `#[serde(default)]` 로 backward-compat)

---

## 2. Phase A' — HIGH needs-user (SB-012 + SB-050 선행)

### A'-0. SB-050 — `useUserSettings` deep merge 보강 (SB-012 선행)

**Codex 신규 발견**: `useUserSettings.ts:47,85,150` 에서 `{ ...defaultUi(), ...obj }` 얕은 병합. nested `miniSidebarSections` 의 일부 키만 사용자 저장된 경우 default 의 다른 키가 날아갈 위험.

**증거**:
```ts
// useUserSettings.ts:47 — 얕은 병합
const ui = ref<UiSettings>({ ...defaultUi(), ...storedUi })
// miniSidebarSections: { branch:true, ... } 가 storedUi 에 { tag:false } 만 있으면
// 결과는 { tag:false } 만 남음 (branch/remote/... 모두 undefined)
```

**WHAT**:
- `useUserSettings.ts` 의 3 위치 (`:47, :85, :150`) 모두 deep merge 로 교체
- `lodash.merge` 또는 자체 helper (의존성 추가 회피)
- 신규 `useUserSettings.test.ts` — nested 객체 보존 케이스
- SB-012 의 `uiSettings.branchClickAction` 추가 전에 본 작업 선행

**Effort**: XS (~30 LOC + 신규 test 3-5건)

**Verification**: vitest — partial storage 시 default 의 모든 nested 키 보존 확인

### A'-1. SB-012 — Branch click 동작 (`checkout` vs `select`)

(v0.1 §2.A'-1 와 동일) — 사용자 결정 영역. SB-050 선행 후 진행.

> Codex 신규 발견 SB-051 (MiniRemoteBranchList row click 비대칭) 은 본 결정과 함께 처리 — 사용자가 click 정책 선택하면 remote row 도 동일 정책 적용.

---

## 3. Phase B — MED 시각/hover/i18n batch (4건, A 와 병렬)

### B-1. SB-049 — i18n cleanup (v0.1 §8 의 Phase G 흡수)

**WHAT**: "전체 →" 4곳 한글 hardcode 마이그
- `MiniSection.vue:61` `"전체 →"` → `t('miniSection.viewAll')`
- `MiniSection.vue:48` title attr template literal → t()
- `MiniWorktreeList.vue:96` "+N more" → t()
- `MiniPrList.vue:56` "+N more" → t()
- i18n 5 키 (ko/en 각 → leaf 1343 → 1348)

**Effort**: XS (~30 LOC)

### B-2. SB-015 — Section header double-click maximize

(v0.1 §3.B-1 와 동일) — `MiniSection.vue` 의 header `@dblclick` → 해당 section 만 expanded.
**Effort**: S (~50 LOC)

### B-3. SB-016 — Worktree hover popover (full path)

(v0.1 §3.B-2 와 동일) — BaseTooltip 활용, delay 300ms.
**Effort**: S (~70 LOC + i18n 1 키)

### B-4. SB-030 — Annotated tag hover popover + tag click 동작 명시

(v0.1 §3.B-4 와 동일) — annotation 메시지 popover + click=jump to commit.
**Effort**: S (~80 LOC + i18n 1 키)

> Codex: SB-018 (Per-section filter) 는 본 batch 에서 제외 → Phase D 로 이동 (메뉴/상태와 함께, Tag 영역 응집도)

---

## 4. Phase C — MED 인터랙션 batch (3건, A 후 진행)

### C-1. SB-014 — Smart Branch Visibility ✚ (v0.1 §1.A-2 에서 이동)

**Codex 권고 사유**: `useHiddenRefs` (persistent, DB 저장) ↔ solo (session memory) ↔ smart (computed layer) 3 레이어 의존성 정리 필요. Phase A 동시 진행 시 layering bug 위험. **A-1 (시각 토큰 통일) 후 → C 에서 진행**.

**WHAT**: (v0.1 §1.A-2 와 동일 — 신규 composable `useSmartBranchVisibility` + Commit Graph header gear + uiSettings 영속화)

**Codex 추가 권고**: 본 작업 전에 `useHiddenRefs` 의 persistent layer 와 `useSoloRef` 의 session layer 의 priority order 명문화. Smart 는 가장 외곽 (computed only — 두 inner layer 를 read 만).

**Effort**: **M** (~200 LOC + i18n 6 키)

### C-2. SB-019a/b — Branch → Remote drag (push / PR)

(v0.1 §4.C-1 와 동일)
**Effort**: M (~150 LOC + 시각 토큰)

### C-3. SB-029 — Inline rename (F2)

(v0.1 §4.C-3 와 동일)
**Effort**: M (~100 LOC)

---

## 5. Phase C' — MED needs-user (SB-020, SB-026)

### C'-1. SB-020 — Multi-select + bulk delete (Codex needs-user 재분류)

**Codex 권고 사유**: bulk delete 시 어느 ref 가 삭제 대상인지 product 정책 부재.
- Local branch only?
- Remote branch 포함? (force-delete remote 위험)
- Tag 포함?
- 삭제 confirmation 모달 정책 (1건 vs N건)

**사용자 응답 대기**:
- [ ] (a) Local branch 만 bulk delete (안전)
- [ ] (b) Local + Remote (remote 는 별도 confirm)
- [ ] (c) Local + Remote + Tag (full bulk)
- [ ] (d) bulk delete 거부 — multi-select 만 (다른 bulk action 추후)

### C'-2. SB-026 — Branch groups/folders (Gitflow)

**Codex 권고 사유**: Gitflow (develop/feature/hotfix/release) 강제 여부 사용자 워크플로우 의존성 큼. git-fried 의 multi-forge / multi-repo 환경에서 fork 별 정책 다를 수 있음.

**사용자 응답 대기**:
- [ ] (a) Gitflow auto-grouping (feature/* → "Features" folder)
- [ ] (b) 사용자 정의 grouping (drag&drop 으로 folder 생성)
- [ ] (c) 둘 다 지원
- [ ] (d) 거부 (현재 flat 유지)

---

## 6. Phase D — MED + LOW batch (4건, B 와 병렬 가능)

> v0.1 의 Phase D (메뉴/상태) + Phase F (a11y + worktree state) 통합. SB-018 (Per-section filter) 추가.

### D-1. SB-018 — Per-section filter (Tag mini 별도 filter bar)

(v0.1 §3.B-3 에서 Phase B → Phase D 이동, Tag 영역 응집도)
**Effort**: S (~60 LOC + i18n 2 키)

### D-2. SB-033 — Annotate tag 모달

(v0.1 §5.D-1 와 동일) — Tag context menu "Annotate tag" + 모달 + Rust IPC.
**Effort**: S (~80 LOC + i18n 4 키)

### D-3. SB-040 — Conflict branch row red dot

(v0.1 §5.D-2 와 동일) — `useConflictPrediction` 결과를 sidebar 까지 확장.
**Effort**: S (~50 LOC)

### D-4. SB-031 — List row 키보드 nav (↑/↓) (v0.1 §7.F-1)

(7 Mini 컴포넌트 동시)
**Effort**: M (~120 LOC)

### D-5. SB-046 — 새 worktree state 상속 (v0.1 §7.F-2)

**Codex 보강**: 본 작업은 SB-050 (deep merge) 후 안전 — 부모 worktree 의 nested settings 가 shallow merge 로 일부만 복사되는 회귀 차단.
**Effort**: S (~50 LOC + 가능 DB migration)

### D-6. SB-051 — MiniRemoteBranchList row click 대칭성 (Codex 신규)

**Codex 발견**: `MiniRemoteBranchList.vue:70-73` remote rows 는 `<div>` + context menu 만. local rows 의 click=checkout (`MiniBranchList.vue:155`) 과 비대칭. 사용자 SB-012 click 정책 결정 시 remote 도 동일 정책 적용 필요.

**WHAT**:
- SB-012 결정 후 (a) `click=checkout` 이면 remote 도 click → "create local tracking branch + checkout"
- (b) `click=select` 이면 둘 다 select
- 현재 비대칭은 의도적 (remote 는 dblclick 만 — 사용자가 확인하지 못함)

**Effort**: XS (~20 LOC, SB-012 결정 후)

---

## 7. ~~Phase E~~ — LOW 단축키 (폐기, Codex 검증 결과)

> **Codex 발견**: `useShortcuts.ts:238/262` 의 `'l' → 'fetch'`, `'j' → 'toggleSidebar'` + `HelpModal.vue` 컴포넌트 모두 **이미 구현**.
>
> spot-check 결과 (parent context 재검증):
> - `useShortcuts.ts:262` — `if (k === 'j' && !e.shiftKey) action = 'toggleSidebar'` ✓
> - `useShortcuts.ts:238` — `if (k === 'l' && !e.shiftKey) action = 'fetch'` ✓
> - `apps/desktop/src/components/HelpModal.vue` ✓
>
> **본 wave 의 실제 작업**: 코드 추가 0. **검증 + 문서 정리만**.
> - `e2e/shortcuts.spec.ts` 에 Ctrl+J / Ctrl+L 검증 추가 (없으면)
> - README 또는 docs/IMPLEMENTATION-STATUS 에 단축키 표 갱신
> - SB-021/022/023 backlog status → CLOSED (구현됨)
>
> **Effort**: XS (~검증 spec 3건, 문서 1-2 file 갱신)
> **분류**: Phase B 의 i18n cleanup 과 함께 단일 commit 흡수 가능

---

## 8. Codex Independent Audit 결과 (요약, v0.2 합류)

> 원본 inline (Codex agent `afa27e8d62219ed53`, 600 LOC 이내, duration 286 초)

### 8.1 Wave sequencing 권고 (Claude v0.1 → v0.2)

| Phase | Claude v0.1 | Codex 권고 → v0.2 |
|-------|-------------|-------------------|
| A | SB-013/014/017 + SB-012 | **SB-013 + SB-017 only** (SB-014 → C 로 이동) |
| B | SB-015/016/018/030 | **SB-049 + SB-015/016/030** (SB-018 → D 이동, SB-049 흡수) |
| C | SB-019/020/029 | **SB-014 ✚ + SB-019/029** (SB-020 → needs-user) |
| D | SB-033/040 | **SB-033/040 + SB-031/046 + SB-018/SB-051** (F/일부 B 흡수) |
| E | SB-021/022/023 | **폐기** — 이미 구현, 검증/문서 정리만 |
| F | SB-031/046 | **폐기** — D 로 흡수 |
| G | SB-049 | **폐기** — B 로 흡수 |

### 8.2 HIGH 4건 risk audit

- **SB-012**: `useUserSettings` shallow merge (SB-050) 선행 필수. 사용자 muscle memory 충돌은 default 보존으로 회피.
- **SB-013**: greenfield 아님. BranchPanel 의 SoT 를 Mini list + CommitRefPill 4 컴포넌트에 fan-out. light/dark mode 양쪽 contrast AA 확인.
- **SB-014**: `useHiddenRefs` (persistent) ↔ solo (session) ↔ smart (computed) 3 레이어 priority 명문화 선행. Phase A 동시 진행 시 layering bug 위험 → C 로 이동.
- **SB-017**: Rust `forge/model.rs:45` PullRequest 에 `ci_status` 필드 부재 → Vue 만으로 못함. Gitea / GitHub 별 CI status 데이터 가용성 확인 (Gitea `/statuses/{sha}`, GitHub `/commits/{sha}/check-runs`).

### 8.3 needs-user 재평가

- **SB-048 → autonomous-safe 재분류** (`MiniPrList:22` 의 `v-if="length > 0 || isFetching"` 패턴으로 scoped empty 메시지 한정 시 안전)
- **SB-020 needs-user 추가** (bulk delete 정책 product decision)
- **SB-026 needs-user 추가** (Gitflow 강제 여부 워크플로우 의존)
- 최종 needs-user 5건: SB-012 + SB-020 + SB-026 + SB-027 + SB-028

### 8.4 ROI Top 5 / Bottom 5

**Top 5 (즉시 ROI)**:
1. **SB-013** (S) — 토큰 통일, 시각 일관성 즉시
2. **SB-017** (M) — PR CI 4 아이콘, dogfood 환경 큰 효과
3. **SB-014** (M) — Smart Visibility, 큰 monorepo ROI
4. **SB-016** (XS — Codex 재평가, S → XS) — Worktree hover popover
5. **SB-049** (XS) — i18n cleanup, 30분 win

**Bottom 5 (deferred 권고 추가)**:
- SB-031 (List row 키보드 nav) — 7 컴포넌트 수정 비용 vs 사용 빈도 검토
- SB-026 (Branch groups Gitflow) — L effort + product 결정
- SB-019b (Branch → 다른 remote PR drag) — 시각 + UX 결정 복잡
- SB-029 (Inline rename) — 모달 이미 있음, 빠른 진입로의 ROI 검증 필요
- SB-018 (Per-section filter) — 통합 search 와 중복 가능성

### 8.5 회귀 차단 strategy

- **vitest 901 보존**: 각 신규 composable 의 .test.ts + SB-050 deep merge test 선행
- **e2e 48 보존**: 잔존 2 fail 우선 회복 (sprint c93 보류), 신규 SB-013/017 시각 회귀 차단
- **cargo 261 보존**: SB-017 Rust 보강 시 httpmock 4 fixture 추가 (success/pending/failure/draft)
- **i18n 1343 → 1381**: raw regex dup-key 가드 자동 검증

### 8.6 신규 micro-gap (Codex 발견)

1. **SB-050** — `useUserSettings.ts:47,85,150` shallow merge → nested `miniSidebarSections` 기본값 누락 위험. SB-012 선행 필수.
2. **SB-051** — `MiniRemoteBranchList.vue:70-73` remote row click 비대칭 (local 은 click=checkout, remote 는 dblclick 만). SB-012 결정 시 함께 처리.

---

## 9. needs-user 결정 영역 (v0.2: 5건)

| ID | 영역 | 옵션 | Codex 권고 default |
|----|------|------|---------------------|
| **SB-012** | Branch click 동작 | (a) Default 유지+toggle (b) Default 변경+toggle (c) toggle 거부 | (a) 안전 |
| **SB-020** | bulk delete 정책 | (a) Local only (b) Local+Remote (c) Local+Remote+Tag (d) 거부 | (a) 안전 |
| **SB-026** | Branch groups (Gitflow) | (a) Gitflow auto (b) 사용자 정의 (c) 둘 다 (d) 거부 | (b) flexible |
| **SB-027** | WIP indicator 위치 | (a) row 좌측 dot (b) row 우측 badge (c) IdentityCard (d) 거부 | (a) GitKraken parity |
| **SB-028** | Auto-fetch default | (a) 1분 (parity) (b) 5분 (c) disabled (d) manual 만 | (b) battery/network |

→ 본 5건 응답 후 Phase A' / C' / H 진행.

---

## 10. Deferred Backlog (v0.2, 15건)

LOW ROI / 작은 가치. 추후 사용자 요청 시 별도 sprint:
- SB-025 Pin to left, SB-032 Tag Fast-forward, SB-034 Stash Edit msg, SB-035 Worktree Remove+delete combo, SB-036 Submodule Edit, SB-037 Ctrl+K Commit Detail toggle, SB-038 Ctrl+F standard search, SB-039 Esc 일관 처리, SB-041 Worktree 삭제 진행 시각, SB-042 Result highlight, SB-043 Empty result 메시지, SB-044 PR filters predefined+custom, SB-045 Profile-tied tabs, SB-047 Profile color row 차별화, SB-048 → Phase D 흡수 자율 가능 (v0.1 deferred 에서 제외)

---

## 11. 의도적 거부 (5건, plan/01 §5)

GitKraken Agents view / Cloud sync / Share stash / Multi-active workspace (SB-005) / Saved views sync.

---

## 12. 전체 sequencing (의존성 그래프 v0.2)

```
[독립 시작 가능 — 병렬]
  ├─ Phase B (i18n+시각+hover) ─────────────────┐
  ├─ Phase D (메뉴+상태+a11y+worktree) ─────────┤
  └─ Phase A (HIGH 자율 2건) ──┐                │
                                ↓                │
                            Phase C (인터랙션)
                                ↓
                      [사용자 응답 후]
                                ↓
                            Phase A' (SB-012 + SB-050 선행)
                                ↓
                            Phase C' (SB-020, SB-026)
                                ↓
                            Phase H (SB-027, SB-028)
```

- Phase B / D / A 독립 (병렬 가능 — 별도 commit)
- Phase C (SB-014) 는 A-1 (시각 토큰) 완료 후 — `useHiddenRefs` ↔ solo ↔ smart layering
- Phase A' 는 SB-050 → SB-012 → SB-051 순 의존
- Phase C' (SB-020/026) 는 needs-user 응답 후
- 이미 구현된 Phase E (Ctrl+J/L + HelpModal) 는 검증/문서만 — Phase B 의 i18n 과 단일 commit 흡수

---

## 13. 회귀 차단 strategy (v0.2 강화)

### vitest 901 → 950+ 목표
- SB-050 useUserSettings deep merge test (3-5건)
- SB-013 시각 회귀 — Mini 4 컴포넌트 snapshot 또는 query test
- SB-014 useSmartBranchVisibility test (smart set 계산 + 사용자 unhide 보존)
- SB-017 MiniPrList 4 상태 시각 회귀

### e2e 48 → 51 (잔존 2 fail 회복 + 신규)
- `e2e/actions.spec.ts` 의 잔존 2 fail 우선 회복 (sprint c93 보류)
- 신규: hide/solo 시각 회귀 (SB-013), PR CI 4 아이콘 (SB-017), Ctrl+J/L 검증 (Phase E 폐기)

### cargo 261 → 265 (SB-017)
- httpmock 4 fixture (success/pending/failure/draft) per forge (Gitea/GitHub)

### i18n 1343 → 1381
- 본 계획 신규 키 합산: A-1 (4) + A-2 (8) + B-1 (5) + B-3 (1) + B-4 (1) + D-1 (2) + D-2 (4) + 기타 = ~38 키 (ko/en symmetry 유지)

### typecheck 0 errors 보존
- SB-050 deep merge helper 의 generic type 명시
- SB-017 CiStatus / ApprovalState enum frontend mapping 타입 안전

---

## 14. 권장 진행 순서 (v0.2 final)

### 즉시 (사용자 응답 불요, 3 wave 병렬 가능)
1. **Phase B** (XS+S×3) — SB-049 i18n cleanup + SB-015 maximize + SB-016 worktree hover + SB-030 tag hover. 가장 안전한 wave.
2. **Phase D** (S+S+M+S+S+XS) — SB-018 Tag filter + SB-033 Annotate + SB-040 conflict dot + SB-031 ↑/↓ + SB-046 worktree state + SB-051 remote symmetry (SB-051 은 A' 결정 후)
3. **Phase A** (S+M) — SB-013 토큰 통일 + SB-017 PR CI (Rust 선행)
4. **Phase E 검증/문서** — Phase B 의 i18n commit 에 흡수 (Ctrl+J/L e2e + IMPLEMENTATION-STATUS)

### Phase A 완료 후
5. **Phase C** (M+M+M) — SB-014 Smart Visibility + SB-019a/b drag + SB-029 inline rename

### 사용자 응답 후
6. **Phase A'** — SB-050 deep merge → SB-012 click toggle → SB-051 remote click (대칭)
7. **Phase C'** — SB-020 bulk delete + SB-026 branch groups
8. **Phase H** — SB-027 WIP indicator + SB-028 auto-fetch default + SB-048 empty 정책 (재분류로 자율 가능, 다만 사용자 옵션 권장)

### 예상 사이즈
- Phase B: 1-2 commit, vitest +5, i18n +5 키
- Phase D: 2-3 commit, vitest +10, i18n +6 키
- Phase A: 2 commit (Rust + Vue 분리), vitest +5, cargo +4, i18n +12 키
- Phase C: 2-3 commit, vitest +10, i18n +6 키
- 합계: **7-10 commit**, vitest **+30**, cargo **+4**, i18n leaf **+38**

---

## 15. Next

- 사용자 needs-user 5건 응답 받으면 A' / C' / H 진행 (Codex 권고 default 명시)
- **Phase B + D + A 즉시 진행 가능** — 사용자 confirm 시 시작
- Codex audit 합류 완료 — v0.2 final. v0.3 patch 는 Phase A 완료 후 (Rust ci_status 구조 fix 결과 합류 시점)
