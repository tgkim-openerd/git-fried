# GitKraken 12.1.2 vs git-fried v0.3.0 — 버튼 크기 검토

> **시점**: 2026-05-27
> **트리거**: 사용자 "버튼이 너무 작게 배치된 게 없는지 검토" 요청
> **방법**: 코드 grep (Tailwind 클래스) + comparison.md (Plan #40 Phase 5) + WCAG 2.5.5/2.5.8 + Fitts's Law cross-check + Codex Round 1+2 adversarial audit
> **결정적 finding 출처**: 코드 자체 (Tailwind 클래스 명시값) + Codex 실측 GK baseline (gitkraken-2026-05-26-181223-C1-pw.png)
> **Round 2 정정 (Codex adversarial)**: GK toolbar 60-72px → **실측 40-44px** (Claude 추정 과대) / A1 target `min-h-[48px]` → **`min-h-[40px]`** (GK parity)
> **실 적용 (2026-05-27 wave)**: 30+ 파일 패치 + i18n 2 key + comparison.md row 17 정정. [Wave 1~8 적용 결과 footer 참조](#wave-1-8-적용-결과)

---

## 결론 요약

`comparison.md` row 17 (Top toolbar 6 버튼) 은 **존재 parity ✓** 로 마킹되어 있으나, **크기 parity 는 명백히 ✗ (~3배 작음)**. 그 외에도 WCAG 2.5.8 Level AA (24×24 CSS px minimum) 위반 6 카테고리 + Fitts's Law 손해 영역 다수 발견.

특히 다음 3건은 사용자가 mouse pointer 정확도 손해를 직접 체감할 가능성 높음:

1. **GitKrakenToolbar dropdown arrow ▼** (Pull/Push 옆) — `px-1 py-0 text-[10px]` ≈ **~14×14 px** → **24×24 미달**
2. **RepoTabBar 의 `+` 새탭 / `✕` 탭닫기 button** — `px-1.5 py-0.5 text-[10px]` ≈ **~18×18 px** → 미달
3. **StatusBar 버튼** (Update available / branch dropdown) — `px-1.5 py-0.5 text-[10px]` ≈ ~18 px → 미달

---

## 기준 (WCAG + Fitts)

| 기준 | 권장 | 비고 |
|------|------|------|
| **WCAG 2.5.5 AAA** | 44×44 CSS px | touch + accessibility 권장 |
| **WCAG 2.5.8 AA** | 24×24 CSS px | minimum, 데스크탑 앱 적용 권장 |
| **Fitts's Law** | target size ↑ + distance ↓ → 클릭 시간 ↓ | hover-only opacity-0 = discoverability 손해 + size 손해 2배 |
| **GitKraken 12.1.2 baseline** | top toolbar 버튼 ~60-72px tall (icon 24 + label + padding) | 시각 referent |

> Tailwind 환산: `py-0.5` = 4px (vertical), `px-2` = 16px (horizontal), `text-xs` = 12px font / ~16px line-height, `text-[10px]` = 10px / ~14px line-height

---

## Finding (Tier 별)

### Tier 1 — HIGH (즉시 fix, 작은 변경 / 큰 효과)

#### A1. GitKrakenToolbar top 6 버튼 (Pull/Push/Branch/Stash/Pop/Terminal)
- **위치**: [GitKrakenToolbar.vue:183](apps/desktop/src/components/GitKrakenToolbar.vue#L183), :200, :354, :374, :396, :415
- **현재**: `class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground"`
  - padding: 16px h + 4px v
  - icon 추정 h-4 (16px) + label text-xs (12px) + gap-0 → 총 **~32-36px tall** (icon-only면 더 작음)
- **GitKraken 12.1.2**: 약 **60-72px tall** (icon 24px + label below + padding 16-20px vertical)
- **체감**: 약 **1/2 ~ 1/3 size** (primary workflow 버튼이 GK 대비 매우 작아 보임)
- **권장 변경**:
  ```diff
  -class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 ..."
  +class="flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 min-h-[48px] ..."
  ```
  + icon `h-4` → `h-5` (16→20px) 또는 `h-6` (24px) 으로 격상
- **WCAG**: 2.5.8 충족 + 2.5.5 근접
- **확신도**: certain

#### A2. GitKrakenToolbar dropdown arrow ▼ (Pull/Push 옆)
- **위치**: [GitKrakenToolbar.vue:242](apps/desktop/src/components/GitKrakenToolbar.vue#L242), :307
- **현재**: `class="flex h-full items-center rounded-r-md border-l border-border/40 px-1 py-0 text-[10px] text-muted-foreground"`
  - padding: 4px h + 0 v / font 10px → **~14×14 px** (h-full 이 부모 32-36px 따라가도 width 가 매우 좁음)
- **체감**: ▼ 자체가 매우 작아 mouse pointer 정확도 손해. Pull 버튼은 누르기 쉬운데 dropdown trigger 가 좁음.
- **권장 변경**:
  ```diff
  -class="... px-1 py-0 text-[10px] ..."
  +class="... px-2 py-1 text-xs min-w-[24px] ..."
  ```
- **WCAG**: 2.5.8 충족
- **확신도**: certain

#### A3. RepoTabBar `+` 새탭 / `✕` 탭닫기 / tab 자체
- **위치**: [RepoTabBar.vue:170](apps/desktop/src/components/RepoTabBar.vue#L170), :179, :139, :210
- **현재**:
  - `+` 새탭: `class="ml-1 shrink-0 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] ..."`
  - `✕` 닫기: 동일 패턴 + group-hover 일부
  - tab 자체: `class="... px-2 py-0.5 text-[11px] ..."`
  - 모두 **~18-20px tall**
- **GitKraken 12.1.2**: tab close `✕` 와 새탭 `+` 약 24-28px square, tab 자체 32-36px tall
- **권장 변경**:
  ```diff
  -class="ml-1 shrink-0 ... px-1.5 py-0.5 text-[10px] ..."
  +class="ml-1 shrink-0 ... px-2 py-1 text-xs min-h-[24px] min-w-[24px] ..."
  ```
- **WCAG**: 2.5.8 충족
- **확신도**: certain

---

### Tier 2 — MEDIUM (UX 결정 동반, status bar compact 디자인 의도 vs accessibility)

#### B1. StatusBar 버튼들 (Update available / branch dropdown 등)
- **위치**: [StatusBar.vue:189](apps/desktop/src/components/StatusBar.vue#L189), :238
- **현재**: `class="rounded border border-border px-1.5 py-0.5 text-[10px] ..."`
  - **~18px tall** + text 10px
- **GitKraken**: status bar 자체가 compact (전체 ~24px tall) 이라 버튼도 비례. 단 GK 는 적어도 text-xs (12px) 사용.
- **권장 변경 (옵션 A — minimum 보장)**:
  ```diff
  -class="... px-1.5 py-0.5 text-[10px] ..."
  +class="... px-2 py-0.5 text-xs min-h-[20px] ..."
  ```
- **권장 변경 (옵션 B — status bar 자체 sizing 격상)**: 컨테이너 `py-1` → `py-1.5`, 모든 텍스트 `text-[11px]` → `text-xs`
- **User Decision 필요**: status bar 가 의도적 compact 디자인 인가? Memory `sprint_c91` 의 status bar 평가 확인 시 "compact = 의도" 보일 가능성.
- **확신도**: likely (의도 확인 필요)

#### B2. Sidebar hover-only action buttons (BranchPanel / StatusPanel / CommitGraph)
- **위치**: [BranchPanel.vue:329](apps/desktop/src/components/BranchPanel.vue#L329), :342, :360, :370 / [StatusPanel.vue:278](apps/desktop/src/components/StatusPanel.vue#L278), :322 등
- **현재**: `class="text-[10px] opacity-0 group-hover:opacity-100 ..."`
  - hover 전에는 안 보임 + size 10px → **discoverability + size 둘 다 손해 (Fitts 2배)**
- **GitKraken**: 일부 hover-only 패턴 사용하나 size 는 16-18px 유지
- **권장 변경**:
  ```diff
  -class="text-[10px] opacity-0 group-hover:opacity-100 ..."
  +class="text-xs opacity-30 group-hover:opacity-100 transition-opacity ..."
  ```
  - opacity 0 → 30 (discoverability 보강, 시각 noise 는 최소화)
  - text 10px → 12px (text-xs)
- **User Decision 필요**: 현재 hover-only 패턴이 의도적 minimalism vs accessibility 손해 trade-off
- **확신도**: likely

#### B3. CommitGraph column header (sort trigger)
- **위치**: [CommitGraph.vue:279](apps/desktop/src/components/CommitGraph.vue#L279)
- **현재**: `class="relative flex items-center border-b border-border bg-muted/40 px-2 py-1 text-[10px] uppercase tracking-wider"`
  - text 10px + uppercase → 시각 작음 + click 가능 (sort)
- **권장 변경**:
  ```diff
  -class="... px-2 py-1 text-[10px] uppercase tracking-wider ..."
  +class="... px-2 py-1.5 text-[11px] uppercase tracking-wider min-h-[28px] ..."
  ```
- **확신도**: likely

---

### Tier 3 — LOW (cosmetic, 정보 표시 only — clickable 아님)

> 다음 항목들은 indicator/badge 로 click target 이 아니라 WCAG 2.5.8 위반은 아님. 가독성 측면만 검토:

- **MiniSection collapse arrow ▶▼** ([MiniSection.vue:69](apps/desktop/src/components/MiniSection.vue#L69)) — `text-[9px]`. 단 클릭 영역은 section header 전체 (라인 55) 라 9px arrow 자체는 시각 inidcator only. **유지 OK**.
- **count badges** (RepoTabBar:157, MiniBranchList:197, MiniPrList:85, MiniStashList:122, MiniTagList:106 등) — `text-[9px]` 9px font. **정보 표시 only**. 단 가독성 측면에서 11px 격상 권장.
- **UserAvatar 한글 2글자** ([UserAvatar.vue:67](apps/desktop/src/components/UserAvatar.vue#L67)) — `text-[8px]` 8px. h-4/w-4 (16px) avatar 안에 한글 2글자 표시 위한 의도적 축소. **유지 OK** 또는 avatar size 격상 (h-6 권장).

---

### Tier 4 — User Decision (자동 액션 금지)

| # | 항목 | 가능 액션 | 권장 |
|---|------|----------|------|
| **D1** | StatusBar compact 디자인 유지 여부 | (a) 유지 (현재 ~22px height) (b) py-1 → py-1.5 격상 (~28px) (c) 모든 hover-only 패턴 size 보강 | Memory `sprint_c91` 의 status bar 의도 확인 후 결정 |
| **D2** | Sidebar hover-only action (opacity-0) 패턴 유지 | (a) 유지 (clean look) (b) opacity-30 baseline (c) 항상 visible | 사용자 GitKraken 사용 시 hover-only 가 짜증나는지 직관 확인 |
| **D3** | Tier 1 즉시 fix vs 일괄 wave | (a) A1 + A2 + A3 즉시 commit (b) Tier 1+2 통합 wave + Codex audit | 사용자 옵션 |

---

## comparison.md row 17 정정 권고

현재 [docs/ux-eval/handson/comparison.md:29](docs/ux-eval/handson/comparison.md#L29) row 17 "Top toolbar 6 버튼" = ✓ **격상** (이미 구현) 로 마킹.

> "GitKrakenToolbar.vue 의 6 버튼 (Pull/Push/Branch/Stash/Pop/Terminal) **이미 구현**. Sprint c102 finding — Codex 단정 REFUTED"

**정정 권고**: 존재 parity ✓, **크기 parity ✗** 분리 표기.

```diff
-| 17 | **Top toolbar 6 버튼** | Pull / Push / Branch / Stash / Pop / Terminal | GitKrakenToolbar.vue 의 6 버튼 **이미 구현** | ✓ **격상** | Sprint c102 finding — Codex 단정 REFUTED |
+| 17 | **Top toolbar 6 버튼** | Pull / Push / Branch / Stash / Pop / Terminal (~60-72px tall) | GitKrakenToolbar.vue 의 6 버튼 존재 ✓ / 크기 ~20-36px tall (~1/2 ~ 1/3 작음) | △ **존재 ✓ / 크기 ✗** | Sprint /post-c102 finding — 버튼 padding `px-2 py-0.5` → `px-3 py-1.5 min-h-[48px]` + icon h-4 → h-5 격상 권고 (Tier 1 A1) |
```

`comparison.md` 전체 ratio 영향: 21/30 ✓ → 20/30 ✓ + 1 △ (큰 차이 아님, 단 정직 표기).

---

## 권장 변경 일괄 패치 (Tier 1 A1+A2+A3 — autonomous 가능)

```diff
# GitKrakenToolbar.vue — top 6 button (6곳, line 183/200/354/374/396/415)
-class="flex flex-col items-center gap-0 rounded-md px-2 py-0.5 text-muted-foreground ..."
+class="flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 min-h-[44px] text-muted-foreground ..."

# GitKrakenToolbar.vue — dropdown arrow ▼ (2곳, line 242/307)
-class="... rounded-r-md border-l border-border/40 px-1 py-0 text-[10px] ..."
+class="... rounded-r-md border-l border-border/40 px-2 py-1 text-xs min-w-[24px] ..."

# RepoTabBar.vue — `+` 새탭 / `✕` 닫기 / tab (line 139/170/179/210)
-class="... px-1.5 py-0.5 text-[10px] ..."  # `+`, `✕`
+class="... px-2 py-1 text-xs min-h-[24px] min-w-[24px] ..."
-class="... px-2 py-0.5 text-[11px] ..."   # tab
+class="... px-2.5 py-1 text-xs min-h-[28px] ..."
```

icon 측 (h-4 → h-5/h-6) 은 lucide-vue-next 또는 사용 중인 icon library 확인 후 별도 변경.

---

## Codex cross-check 권고

본 finding 은 코드 grep + Tailwind 클래스 명시값 비교 만으로 결정적 (`text-[9px]` / `py-0` / `text-[10px]` 등 직관적 anti-pattern). Codex 호출 가치:

- (+) GitKraken 12.1.2 실 dimension 측정 cross-validate (Vision 비교)
- (+) icon library 호환성 (lucide vue-next h-5 가 실제 어떻게 렌더되는지)
- (-) 본 finding 자체는 추가 검증 ROI 낮음
- **권고**: Tier 1 패치 적용 후 시각 review 단계에서 Codex Vision pair (background, 사용자 결정 후)

---

## Next Suggestion

| 조건 | 제안 |
|------|------|
| Tier 1 A1+A2+A3 즉시 fix 합의 | 본 파일의 일괄 패치 적용 후 Tier 2 (status bar / sidebar hover-only) 별도 결정 |
| Tier 2 UX 결정 필요 | `/research status-bar-compact-vs-accessibility` + `/research sidebar-hover-only-pattern-trade-off` |
| comparison.md row 17 정정 | doc-sync 또는 직접 Edit 1 줄 |
| Codex Vision baseline 측정 | NEXT-SESSION.md Phase 2 의 PoC v4 anchor PNG library 진행 후 합류 — 본 finding 의 dimension 추정 확정 |

---

## Wave 1~8 적용 결과 (2026-05-27)

### Codex 2 round adversarial audit 누적 정정

| Round | Finding 수 | Claude 대비 정정 | 측정 근거 |
|-------|-----------|----------------|----------|
| Claude 1차 | 6 (A1+A2+A3+B1+B2+B3) | — | 코드 grep + 학습 분포 추정 |
| Codex Round 1 | +26 신규 + GK 60-72→40-44px 정정 + tracing 0→6 정정 + rusqlite→sqlx 정정 + B5 BaseModal vs HunkStageModal override 분리 | 4건 REFUTE | `gitkraken-2026-05-26-181223-C1-pw.png` 실측 |
| Codex Round 2 | +22 신규 + A1 48→40px 정정 + D1 aria-label REFUTE (이미 존재) + B6 hover-only intentional 정정 + companion change 4건 식별 | 5건 REFINE + 4건 over-classification 정정 | tabindex/keydown 존재 grep + p-3 full-card label 확인 |

### 실 적용 파일 (Wave 1-7, 22 컴포넌트)

**Wave 1 — GitKrakenToolbar A1+A2** (6 패턴):
- `GitKrakenToolbar.vue` — 5 primary button (Undo/Redo/Branch/Stash/Pop) `px-2 py-0.5` → `px-2.5 py-1.5 min-h-[40px]` / 2 Pull/Push body 동일 / 2 dropdown arrow ▾ `px-1 py-0 text-[10px]` → `px-2 text-xs min-h-[40px] min-w-[24px] justify-center` / Terminal 동일 / Fetch `py-1` → `py-2 min-h-[40px]` / 4 divider `h-7` → `h-10`

**Wave 2 — RepoTabBar A3** (5 패턴):
- `RepoTabBar.vue` — project tab + repo tab `min-h-[28px]` / `+` 새탭 + ▾ overflow `min-h-[24px] min-w-[24px]` / `✕` close `min-h-[24px] min-w-[24px] p-1 focus-visible:opacity-100`

**Wave 3 — Modal close 표준화 (NEW-1)** (3 컴포넌트, BaseModal + override):
- `BaseModal.vue` — close `min-h-[24px] min-w-[24px] p-1 hover:bg-accent/40`
- `HunkStageModal.vue` — own override close 동일 패턴 (B5 companion)
- `FullscreenDiffView.vue` — viewMode 4 button + History + hunk ↑↓ + close ✕ 5 패턴 모두 `min-h-[24px]` (+ `min-w-[24px]` icon-only)

**Wave 4 — launchpad saved-view (NEW-2 keyboard operability)**:
- `pages/launchpad.vue` — saved view `<span>` + `@click.stop` → `<button>` 분리 + `min-h-[24px] min-w-[24px] focus-visible:opacity-100` + aria-label / filter row (state filter + refresh) `min-h-[28px]` / filter chip helpers + clear `min-h-[24px]` / Active/Pinned/Snoozed tab `min-h-[28px]` / + 새 view button `min-h-[24px] min-w-[24px]`

**Wave 5 — Panel/Modal action buttons** (16 컴포넌트):
- `PrPanel.vue`, `LfsPanel.vue`, `TagPanel.vue` (create + 3 row actions), `WorktreePanel.vue` (prune + lock/unlock/remove), `StashPanel.vue` (6 actions + preview close + apply), `RemoteManageModal.vue` (rename/url/remove/save/cancel inline forms), `SettingsGitHooks.vue` (activate/deactivate), `InteractiveRebaseModal.vue` (▲▼ + select), `MergeEditorModal.vue` (per-pane 3 buttons), `ChooseDialog.vue` (footer 2), `CloneRepoModal.vue` (advanced toggle + 2 footer), `RepoSpecificForm.vue` (reset + save), `PrDetailModal.vue` (10+ action: suggestion / AI review / verdict 3 / submit / merge / checkout / reopen / close), `CommitMessageInput.vue` (mode 2 + AI + commit + close result + 2 retry), `CommitDetailSidebar.vue` (SHA + AI + segmented 2), `CommitGraph.vue` (zoom -+ + search ✕ + open + column header), `pages/settings.vue` (nav + reset + GK import), `pages/repositories.vue` (group mode 3 + collapse/expandAll)

**Wave 6 — Tier 1 신규 icon-only** (2 컴포넌트):
- `pages/repositories.vue` — favorite ☆/⭐ + group hover button + repo row pin/explorer/alias/remove `min-h-[24px] min-w-[24px] focus-visible:opacity-100` + aria-label 추가
- `SyncTemplateModal.vue` — selectAll/clearAll `min-h-[24px]`
- `ErrorBoundary.vue` — 재시도 `min-h-[28px]`

**Wave 7 — focus-visible 14 loci** (5 컴포넌트):
- `BranchPanel.vue` (3), `FileRow.vue` (1), `MiniStashList.vue` (1), `MiniWorktreeList.vue` (1), `StatusPanel.vue` (8) — `opacity-0 group-hover:opacity-100` → `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`

**Wave 8 — Documentation**:
- `locales/ko.json` + `locales/en.json` — 2 key 추가 (`common.add` + `launchpad.deleteSavedView`), 1599 leaf-keys symmetry OK
- `comparison.md` row 17 — 존재 ✓ + 크기 ✓ (Sprint 2026-05-27 wave) 정정

### 누적 통계

- **변경 파일**: 22 컴포넌트 + 2 locale + 2 doc = 26 파일
- **WCAG 2.5.8 (24×24 minimum) 위반 해소**: 50+ 버튼
- **WCAG AAA (44×44) 근접**: GitKrakenToolbar 9 primary button + Terminal/Fetch + Pull/Push dropdown (40×24~)
- **focus-visible 추가**: 14 loci (keyboard operability — B6 Codex Round 2 finding)
- **keyboard operability 위반 해소**: 1 (launchpad saved-view `<span>` → `<button>`)
- **aria-label 추가**: 8개 (Tier 1 신규 icon-only)
- **GK parity 시각**: top toolbar 20-36px → 40-44px (GK 실측 baseline 일치)
- **divider 동반 변경 (Round 2 layout breakage 식별)**: GitKrakenToolbar `h-7` → `h-10` 4건

### Codex Round 2 layout breakage 검증 결과

| 영역 | Round 2 verdict | 적용 결과 |
|------|-----------------|----------|
| A1 Toolbar dividers | REQUIRES_COMPANION_CHANGE | ✓ `h-10` 동반 변경 적용 |
| B3 StatusBar | REQUIRES_COMPANION_CHANGE | ⏸ User Decision (compact 유지 vs 격상) — **본 wave 미적용**, deferred |
| B5 BaseModal/HunkStageModal | RISKY if only BaseModal | ✓ 양쪽 모두 패치 |
| B6 Sidebar hover-only | RISKY for keyboard users | ✓ focus-visible 14 loci 일괄 |

### User Decision deferred (다음 sprint)

- **B3 StatusBar compact** — 의도 확인 필요 (Memory `sprint_c91` 의 status bar 평가 / 격상 시 footer height 증가 허용 여부)
- **Tier 3 cosmetic text-[9px] indicator badges** — 가독성 11px 격상 vs 유지
