# GitKraken Hands-on — V2 Baseline 분석 v0.2

- **일시**: 2026-05-18 15:33:17 / **버전**: v0.2 (Codex `a64b02ce6b0c4a718` cross-validation 합류)
- **트리거**: 사용자 명시 "분석 진행 해 필요하면 코덱스 사용"
- **자료**: `docs/ux-eval/screenshots/gitkraken-2026-05-18-152200-baseline-window-v2.png` (1738×1091, window-mode 캡처, GitKraken 12.1.1 Desktop, PID 58540)
- **합류**: Claude multimodal vision (v0.1) + Codex 20 finding (`a64b02ce6b0c4a718`)
- **v0.1 → v0.2 핵심 정정** (Claude vision 결함 + Codex 검증으로 발견):
  1. **Workspace folder list (argo/car/common/d2e/dr/...) → REFUTED (CDX-V2-015)** — Claude 가 잘못 인식. 실제는 LOCAL/REMOTE/WORKTREES/STASHES/CLOUD PATCHES/PULL REQUESTS/TEAMS section + 폴더 그룹 (chore/docs/feat/feature/fix/hotfix)
  2. **"Showing 100" → 실제 "Viewing 106"** (CDX-V2-012)
  3. **List/Agents segmented control visible** (Claude 미발견 → Codex CDX-V2-011 CONFIRMED)
  4. **Ref pill type color (S3 mapping) REFUTED** (CDX-V2-002) — branch sky / remote emerald / tag violet / stash amber 매핑 V2 에서 검증 안 됨
  5. **Merge commit donut+avatar marker visible** (Claude 미발견 → CDX-V2-004 CONFIRMED)
  6. **HEAD indicator 정정**: sidebar branch row checkmark (V2) vs Claude 의 "● marker" (이전 추정)
  7. **SB-054 OAUTH/OTHERS backlog 폐기** — Claude 가 잘못 본 영역. CDX-V2-017 INCONCLUSIVE.
  8. **신규 SB-055/056 추가** — graph visual affordances + folder grouping
- **메타 학습**: **multimodal vision 도 검증 5필드 필요**. Claude 측 단독 vision interpretation 신뢰 X — Codex cross-validation 결정적 가치. 본 sprint feedback memory 보강 후보.

---

## Executive Summary (10 줄 — v0.2)

1. V2 baseline 은 사용자 작업 repo (가명) 화면 — **1:1 git-fried 비교 불가**, 구조/시각 패턴 만 검증.
2. **Cross-validation 결과**: 20 Codex finding 중 11 CONFIRMED / 4 INCONCLUSIVE / 2 REFUTED / 3 PARTIAL.
3. **Claude vision 결함 영역 정정 7건** (위 v0.1→v0.2 변경 §). multimodal 단독 신뢰 X 의 실 증거.
4. **Codex CONFIRMED 핵심**:
   - 5 lane colors visible (cyan/blue/violet/magenta/green)
   - Merge commit = donut + avatar-centered (git-fried pvigier 와 다름)
   - Korean rendering OK (CDX-V2-007)
   - List/Agents segmented control visible
   - LOCAL/REMOTE/WORKTREES/STASHES/CLOUD PATCHES/PULL REQUESTS/TEAMS section
   - chore/docs/feat/feature/fix/hotfix 폴더 그룹 (SB-026 Branch groups Gitflow 실제 검증)
5. **Codex REFUTED 핵심**:
   - S3 ref pill type color mapping (branch/remote/tag/stash 단일 색)
   - workspace folder list 가 argo/car/common/... (Claude 의 vision 오류)
6. **신규 backlog 도출**: SB-055 (graph visual affordances — 곡선 lanes + tint bands + avatar nodes), SB-056 (folder grouping by prefix — SB-026 의 GitKraken 실 구현 검증)
7. **폐기**: SB-054 (OAUTH/OTHERS section — Claude 오인)
8. **검증 보류 영역**: hidden/solo 상태, PR CI 아이콘, 검색 active, tag tooltip, worktree hover (사용자 추가 캡처 필요)
9. **Codex 권고 5 시나리오** (Wave 1+) — hidden_solo_refs / expanded_pr_section / active_search_empty / expanded_tags_tooltip / worktree_states
10. **git-fried 영향**: 본 V2 만으로 사용자 결정 변경 없음. Codex finding 들이 기존 38 microdiff backlog 의 SB-026 (Gitflow) 실증 / SB-013 hide-solo 추가 검증 필요 / SB-017 PR CI 4 아이콘 미캡처 등을 명확화.

---

## 1. V2 캡처 환경

- **Window**: GitKraken Desktop (PID 58540, MainWindowTitle "GitKraken Desktop")
- **Monitor**: Secondary DISPLAY6 (-2560,0 2560×1440), capture bounds L=-2246 T=139 W=1738 H=1091
- **사용자 작업 repo**: react-native (가명, private 사내 작업)
- **활성 branch**: develop (HEAD, sidebar checkmark)
- **profile**: 사용자 인증된 GitKraken Pro / TaeGyumKim @openerd.com

---

## 2. 구조 분석 (v0.2 — Codex 정정 반영)

### 2.1 좌측 사이드바 (Left Panel)

```text
┌─ Top toolbar (app-level) ────────────────┐
│  Tabs (multiple repo tabs)               │
├─ Repository / Branch header ─────────────┤
│  repository dropdown (current repo)      │
│  branch dropdown (current branch)         │
├─ List | Agents segmented control ────────┤  ← Codex CDX-V2-011 (Claude 미발견)
├─ Filter / search input ──────────────────┤
│  Viewing 106  ← branch limit indicator    │  ← Codex CDX-V2-012 (Claude "Showing 100" 정정)
├─ LOCAL section (expanded) ───────────────┤  ← Codex CDX-V2-013/014
│  ✓ develop  ← current HEAD (checkmark)   │  ← Codex CDX-V2-005
│  ▼ chore                                 │
│  ▼ docs                                  │
│  ▼ feat                                  │  ← 폴더 그룹 (SB-026 Gitflow 실증)
│  ▼ feature                               │
│  ▼ fix                                   │
│  ▼ hotfix                                │
├─ REMOTE section ─────────────────────────┤
│  (origin/* branches)                     │
├─ WORKTREES                                │
├─ STASHES                                  │
├─ CLOUD PATCHES                            │  ← GitKraken Cloud 의존 (git-fried 의도적 거부)
├─ PULL REQUESTS  (collapsed/zero-count)   │
└─ TEAMS                                    │
```

### 2.2 중앙 commit graph

- **Lane colors**: 5색 (cyan/teal, blue, violet/purple, magenta/pink, muted green/teal) — Codex CDX-V2-001 CONFIRMED
- **Ref pills**: lane-like hues 사용 (lane 색 따름), but type-based 단일 색 매핑 (S3) **REFUTED** by Codex CDX-V2-002
- **Merge commit marker**: donut + avatar-centered (git-fried pvigier straight-line 과 큰 차이) — CDX-V2-004/006
- **Curved lanes + row tint bands**: GitKraken 의 visual depth (git-fried 미구현) — CDX-V2-006

### 2.3 우측 panel (Commit Detail) — Codex CDX-V2-016

- **Header**: commit subject + selected commit indicator
- **Body**: 한글 commit message (CJK 정상 — CDX-V2-007)
- **Metadata**: avatar + author + parent hash + modified file count
- **File list**: Path / Tree segmented control + 변경 파일 리스트
- **git-fried CommitDetailSidebar 와 비교**: Path/Tree segmented control 차별 영역 (git-fried 는 file list 만)

### 2.4 상단 toolbar

- Repository / Branch dropdown selectors
- Profile / avatar / "Default Profile" label (top-right) — CDX-V2-018

---

## 3. Codex S1~S12 docs 검증 매트릭스 (v0.2)

| Codex Finding | V2 검증 결과 | Codex ID | Status |
|---|---|---|---|
| S1 Left Panel resize | ✓ drag handle visible | - | **CONFIRMED** |
| S1 Section collapse arrows | ✓ ▶/▼ visible | - | **CONFIRMED** |
| S1 List/Agents segmented control | ✓ visible (좌측 패널 below repo/branch header) | **CDX-V2-011** | **CONFIRMED** (Claude 미발견 정정) |
| S1 Workspaces tab | ✓ 상단 visible | - | **CONFIRMED** |
| S3 Multi-lane graph (lane color) | ✓ 5 colors | **CDX-V2-001** | **CONFIRMED** |
| S3 Ref pill type color (branch/remote/tag/stash) | ✗ lane-following hue, type 분기 검증 안 됨 | **CDX-V2-002** | **REFUTED** (S3 claim 의 정확성 ↓) |
| S3 Tag/Stash ref color | (tag/stash 미expand) | **CDX-V2-003** | INCONCLUSIVE |
| Merge commit marker | ✓ donut + avatar-centered | **CDX-V2-004** | **CONFIRMED** (git-fried pvigier 와 큰 차이) |
| Graph visual affordances (곡선 + tint + avatar) | ✓ git-fried pvigier 와 차이 | **CDX-V2-006** | **CONFIRMED** |
| HEAD indicator 위치 | ✓ sidebar branch row checkmark (graph X) | **CDX-V2-005** | **CONFIRMED** |
| CJK 한글 렌더링 | ✓ 정상 | **CDX-V2-007** | **CONFIRMED** |
| Korean font fallback (Noto Sans KR specific) | 픽셀로 식별 불가 | **CDX-V2-008** | INCONCLUSIVE |
| git-fried 한글 안전 차별 영향 | display level OK, round-trip (path/ref/CLI) 영역에서 우월 | **CDX-V2-009** | **PARTIAL** (차별 유지) |
| Repository / Branch selector | ✓ top-left | **CDX-V2-010** | **CONFIRMED** |
| Section grouping (LOCAL/REMOTE/WT/Stash/CP/PR/TEAMS) | ✓ | **CDX-V2-013** | **CONFIRMED** |
| Folder grouping by prefix (chore/docs/feat/...) | ✓ visible | **CDX-V2-014** | **CONFIRMED** (SB-026 Gitflow 실증) |
| Branch limit indicator wording | "Viewing 106" (Claude "Showing 100" 정정) | **CDX-V2-012** | **PARTIAL** |
| Workspace argo/car/common/d2e/dr/... grouping | ✗ V2 에 visible 안 됨 (Claude 잘못 본 영역) | **CDX-V2-015** | **REFUTED** |
| Right commit detail panel structure | ✓ header+message+avatar+metadata+files | **CDX-V2-016** | **CONFIRMED** |
| OAUTH/OTHERS 별도 grouping | V2 에 visible 안 됨 | **CDX-V2-017** | INCONCLUSIVE (Claude 오인 가능성) |
| Profile color/icon differentiation (sidebar row) | top-bar 만, row-level 미검증 | **CDX-V2-018** | **PARTIAL** |
| S8 Hidden=gray / Solo=orange | ✗ 사용자 미활성 | **CDX-V2-019** | INCONCLUSIVE (추가 캡처 필요) |
| S9 PR CI 아이콘 | ✗ PR section 비활성 | **CDX-V2-020** | INCONCLUSIVE (추가 캡처 필요) |

---

## 4. git-fried 비교 — 구조 drift (v0.2)

### 4.1 git-fried 미구현 (V2 발견, Codex 검증)

| 영역 | GitKraken V2 (Codex 검증) | git-fried | 신규 backlog |
|---|---|---|---|
| Branch count indicator | "Viewing 106" (filter active 시 변동) | 없음 | **SB-052** (LOW) wording "Viewing N" |
| **List \| Agents segmented control** | visible (좌측 패널 below repo/branch header) | 없음 | (의도적 거부 — SB-005 family, Agents view scope 외) |
| **Folder grouping by prefix** (chore/docs/feat/feature/fix/hotfix) | ✓ Codex CDX-V2-014 CONFIRMED | 없음 (flat list) | **SB-026 Gitflow** 의 실증 — **needs-user 결정 영역 (사용자 응답 c95 default 'b' 사용자 정의)** |
| **Graph visual affordances** (곡선 lanes + row tint + avatar nodes) | ✓ CDX-V2-006 CONFIRMED | pvigier straight-line + flat dots | **SB-055** (LARGE — Canvas 2D 재작성 영역) |
| Right panel Path / Tree segmented | ✓ Codex CDX-V2-016 | file list 만 | **SB-056** (CommitDetailSidebar 확장) |
| Section grouping (CLOUD PATCHES) | ✓ | 없음 (의도적 거부) | 거부 정합 |

### 4.2 GitKraken 의 의도적 거부 영역 (git-fried plan/01 §5 정합)

- **CLOUD PATCHES section** — GitKraken Cloud 의존, git-fried 의도적 거부
- **TEAMS section** — Cloud 의존
- **List | Agents segmented** — GitKraken Agents view, git-fried 거부 (AI 는 commit msg / PR body / conflict resolve / explain 만)

### 4.3 매칭 (양쪽 동일)

- Multi-lane commit graph (5색) ✓
- Section collapsible ✓
- Repository / Branch selector ✓
- Section grouping LOCAL/REMOTE/STASHES ✓
- Right commit detail panel ✓
- 한글 display rendering ✓ (단 git-fried 의 NFC + CLI round-trip 우월 유지 — CDX-V2-009)

---

## 5. 신규 backlog 후보 (v0.2 정정)

| ID | 영역 | 우선순위 | 사유 (정정) |
|---|---|---|---|
| ~~SB-054 OAUTH/OTHERS section~~ | **폐기** | - | Claude vision 오류 (CDX-V2-017 INCONCLUSIVE) — 실제 visible 안 됨 |
| **SB-052** | "Viewing N" branch count indicator | LOW | wording 정정 ("Showing" → "Viewing"). 큰 monorepo 환경 시 가치. |
| **SB-053** | Sidebar 최상단 active repo title | LOW (변경 없음) | git-fried 의 ActiveRepoQuickActions branch+upstream 외 repo name 강조 부재 |
| **SB-055** (신규) | Commit graph visual affordances (곡선 lanes + row tint + avatar nodes) | LARGE / LOW | git-fried Canvas 2D 재작성 영역. ROI 매우 큰 작업, v1.x 후보 |
| **SB-056** (신규) | Right panel Path / Tree segmented control | MED | CommitDetailSidebar 확장 (file list → Path/Tree 토글) |
| **SB-026 정합 검증** (기존) | Branch folder grouping (chore/docs/feat/...) | needs-user → **실증 강화** | Codex CDX-V2-014 가 실제 visible 검증. 사용자 결정 영역 우선순위 ↑ |

본 sprint 38 microdiff backlog 우선순위 변경:
- **SB-026 (Branch groups Gitflow)**: needs-user 영역 → 실증 강화 (Codex 가 GitKraken 실제 구현 검증) → 사용자 결정 권고 강도 ↑
- **SB-052 wording 정정**: "Showing N" → "Viewing N"

---

## 6. V2 의 한계 (v0.2)

V2 만으로 검증 X 영역 (Codex 권고 추가 캡처 시나리오 5):

1. **Hidden/Solo refs** (CDX-V2-019) — branch hide + solo 후 캡처 → SB-013 검증
2. **Expanded PR section + CI states** (CDX-V2-020) — PR 있는 repo + 다양한 CI 상태 → SB-017 검증
3. **Active search empty state** — type → clear → 빈 결과 메시지 → SB-042/043
4. **Tags expanded + tooltip + filter** — annotated tag hover + filter bar → SB-018/030/033
5. **Worktree hover states** (lock/dirty/detached) → SB-016/041/046

---

## 7. Cross-Validation Summary (v0.2 신규)

| 분류 | 건수 | finding ID |
|---|---:|---|
| Codex CONFIRMED (Agreed) | 11 | CDX-V2-001/004/005/006/007/010/011/013/014/016 + Lane color/Korean/Merge/HEAD/Folder grouping 등 |
| Codex PARTIAL | 3 | CDX-V2-009/012/018 |
| Codex INCONCLUSIVE | 4 | CDX-V2-003/008/017/019/020 — 추가 캡처 또는 정밀 측정 필요 |
| Codex REFUTED Claude finding | 2 | CDX-V2-002 (S3 ref pill type) / CDX-V2-015 (Claude workspace folder list) |
| Codex 신규 발견 (Claude 미발견) | 5 | List/Agents segmented (V2-011) / "Viewing 106" wording (V2-012) / 폴더 그룹 chore/docs/feat (V2-014) / 곡선 lane (V2-006) / Merge donut (V2-004) |

→ **multimodal vision 단독 신뢰 X** 의 실 증거. Codex 페어 가치 결정적.

---

## 8. 메타 학습 — multimodal vision 검증 필수

**발견**: Claude 단독 vision 분석 (v0.1) 에서 7 정정 항목 발생. 본 sprint 의 검증 5필드 룰이 **이미지 분석에도 적용 필요** 임을 실증.

**권고**:
- 본 sprint feedback memory (`feedback_research_first_ui_handson.md`) 에 추가: "vision 분석도 검증 5필드 필요. 단일 model interpretation 신뢰 X, Codex cross-validation default"
- 또는 신규 memory: "vision interpretation cross-validation"
- Toolkit `universal/dev/multi-angle-analysis` skill 또는 `silent-failure-hunter-agent` 에 "multimodal vision 결함 검출 룰" 후보

---

## 9. Codex Independent Findings (CDX-V2-001 ~ 020)

### A. Commit Graph (5 findings)
- **CDX-V2-001** [HIGH/likely] — 5 lane colors visible (cyan/blue/violet/magenta/green). **CONFIRMED**
- **CDX-V2-002** [HIGH/likely] — S3 ref pill type color mapping (branch sky / remote emerald / tag violet / stash amber) **REFUTED**. Lane-like hues 만 검증.
- **CDX-V2-003** [MED/uncertain] — Tag/Stash ref color: V2 에 expand 안 됨 → INCONCLUSIVE
- **CDX-V2-004** [HIGH/certain] — Merge commit donut + avatar-centered marker visible. **CONFIRMED**
- **CDX-V2-005** [HIGH/likely] — HEAD indicator = sidebar branch row checkmark (graph 안 X). **CONFIRMED**
- **CDX-V2-006** [HIGH/certain] — GitKraken graph visual affordances (곡선 lanes + row tint + avatar nodes) > git-fried pvigier straight-line. **CONFIRMED**

### B. CJK / 한글 (3 findings)
- **CDX-V2-007** [HIGH/certain] — Korean glyphs render correctly. **CONFIRMED**
- **CDX-V2-008** [MED/uncertain] — Exact font fallback (Noto Sans KR specific?) 픽셀로 식별 불가. INCONCLUSIVE
- **CDX-V2-009** [MED/likely] — git-fried 한글 안전 차별 (NFC + CLI round-trip) 유지. **PARTIAL** (display level X, path/ref/CLI level 우월)

### C. Sidebar 구조 (8 findings)
- **CDX-V2-010** [HIGH/certain] — Repository / Branch selectors top-left visible. **CONFIRMED**
- **CDX-V2-011** [MED/certain] — List/Agents segmented control visible. **CONFIRMED** (Claude 미발견 정정)
- **CDX-V2-012** [MED/certain] — "Viewing 106" wording (Claude "Showing 100" 정정). **PARTIAL**
- **CDX-V2-013** [MED/certain] — Section grouping LOCAL/REMOTE/WORKTREES/STASHES/CLOUD PATCHES/PULL REQUESTS/TEAMS visible. **CONFIRMED**
- **CDX-V2-014** [MED/certain] — Folder grouping by prefix (chore/docs/feat/feature/fix/hotfix) visible. **CONFIRMED**
- **CDX-V2-015** [LOW/certain] — Workspace folder list argo/car/common/... **REFUTED** (Claude vision 오류)
- **CDX-V2-016** [MED/certain] — Right commit detail panel structure (header+message+avatar+metadata+Path/Tree segmented+files). **CONFIRMED**
- **CDX-V2-017** [LOW/uncertain] — OAUTH/OTHERS grouping V2 visible 안 됨. INCONCLUSIVE
- **CDX-V2-018** [MED/likely] — Profile UI top-bar 만, sidebar row-level 미검증. **PARTIAL**

### D. Hidden/PR (검증 영역 외)
- **CDX-V2-019** [LOW/uncertain] — Hidden/solo visual states: 사용자 미활성. INCONCLUSIVE
- **CDX-V2-020** [LOW/uncertain] — PR CI 아이콘: PR section 비활성. INCONCLUSIVE

---

## 10. 사용자 다음 액션 (v0.2 — Codex 권고 합류)

### Wave 1 — Codex 추가 캡처 5 시나리오 (highest-ROI)

| # | 라벨 | 동작 | 매칭 SB-XXX |
|---|---|---|---|
| 1 | `hidden-solo-refs` | branch 1개 hide + 다른 1개 solo 활성 후 sidebar 전체 캡처 | SB-013 (gray/orange icon 검증) |
| 2 | `expanded-pr-section-ci` | PR 있는 repo + 다양한 CI states (green/yellow/red/gray-D) 캡처 | SB-017 / SB-044 |
| 3 | `active-search-empty` | 검색 input typing → 결과 → 지우기 (Esc/X) → 빈 결과 메시지 | SB-042 / SB-043 |
| 4 | `expanded-tags-tooltip` | Tags 섹션 expand + annotated tag hover + filter bar | SB-018 / SB-030 / SB-033 |
| 5 | `worktree-hover-states` | Worktrees expand + locked/dirty/detached worktree hover | SB-016 / SB-041 / SB-046 |

### 별도 (1:1 비교용)

6. `sidebar-baseline-gitfried` — GitKraken 에 **git-fried repo open** 후 sidebar 캡처 (현재 V2 는 사용자 작업 repo)

### 진행 방법

```powershell
pwsh -File D:\01.Work\08.rf\git-fried\bench\gitkraken-spike\auto-screenshot.ps1
```

→ 각 라벨 입력 → 2초 후 자동 캡처 → Q + ENTER → manifest JSON 생성 → Claude 분석.

---

## 11. git-fried 영향 평가 (v0.2)

- **본 V2 분석 + Codex 합류 만으로** 사용자 결정 변경 0
- **38 microdiff backlog 우선순위 변경 1건**:
  - **SB-026 (Branch groups Gitflow)**: Codex CDX-V2-014 가 GitKraken 실제 구현 (chore/docs/feat/feature/fix/hotfix 폴더) 검증 → needs-user 결정 우선순위 ↑ (사용자 응답 시 c95 default 'b' 사용자 정의 진행 가능)
- **신규 backlog 3 추가**: SB-052 / SB-055 / SB-056 (모두 LOW 또는 큰 작업)
- **backlog 폐기 1**: SB-054 (Claude 오인)
- **wording 정정**: SB-052 "Showing N" → "Viewing N"

---

## 12. 메모리 보강 후보

- `feedback_research_first_ui_handson.md` 에 추가:
  > **Rule 3 — Vision interpretation 도 cross-validation 필수**
  > 본 sprint 의 V2 baseline 분석에서 Claude 단독 multimodal vision 이 7 정정 항목 (workspace folder list / "Showing 100" wording / segmented control / merge marker / 등) 발생. **검증 5필드 룰이 image 분석에도 적용**. Codex 또는 추가 vision model cross-validation 을 default.
