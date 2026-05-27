# Next Session — 2026-05-28 이후 진입점

> 직전 session (2026-05-27): `/analyze` → credential helper fix → GitKraken vs git-fried button-size
> wave (Codex Round 1+2 adversarial audit) → `/compound` cross-project pattern → `/teach` 글로벌
> toolkit 보강 → push (origin/upstream/toolkit 3건 모두 성공).
> commit `91992ef` (36 files +690 −150) + toolkit `8753ae0` (6 files +304 −4).

## Phase 0: 진입 즉시 (5분)

1. 본 문서 read — 잔여 작업 priority queue
2. (선택) `/analyze` — 본 session 의 변경이 큰 patch wave 후 baseline 재측정

## Phase 1: Quick fix (잔여 1건)

### 1.1 ✅ DONE — local `.git/config` credential `useHttpPath=true`

직전 session 적용 완료. upstream push `ed0d853..91992ef` 성공 (`91992ef` 본 sprint 까지 동기화).

### 1.2 `~/.gitconfig` line 71-72 (사용자 직접 1라인 — Claude classifier 차단)

여전히 잔여:

```diff
 [includeIf "hasconfig:remote.*.url:https://github.com/tgkim-openerd/**"]
-    path = ~/.gitconfig-roastfried
+    path = ~/.gitconfig-tgkim-openerd
```

`~/.gitconfig-tgkim-openerd` 신규 생성 + 1라인 변경 — 사용자가 직접 1회 처리.

## Phase 2: Sprint 2026-05-27 button-size wave Deferred 항목

### B3 StatusBar compact User Decision (HIGH 가치)

직전 sprint wave 에서 deferred — Memory `sprint_c91` status bar 의 의도 확인 필요:

- **옵션 A**: 현재 compact 디자인 유지 (~22px height) — 모든 status bar 버튼 `text-[10px] px-1.5 py-0.5` 그대로
- **옵션 B**: container `py-1` → `py-1.5` 격상 (~28px) + 모든 버튼 `text-xs min-h-[24px]` 격상 → WCAG 2.5.8 충족
- **옵션 C**: hover-only 패턴만 size 보강 + container 유지

위치: [StatusBar.vue:150 / :189 / :238 / :226](apps/desktop/src/components/StatusBar.vue#L150)

### Tier 3 cosmetic indicator badges (LOW)

`text-[9px]` count badges 가독성:
- RepoTabBar:157 / MiniBranchList:197 / MiniPrList:85 / MiniStashList:122 / MiniTagList:106 / 등

옵션: 11px 격상 vs 유지 (정보 표시 only, click target 아니라 WCAG 위반 아님).

## Phase 3: PoC v4 UI 흡수 cycle (잔여 — Plan #40 Phase 7)

### 3.1 Anchor PNG library (effort M)

```
bench/gitkraken-spike/anchors/
├── gitkraken-12.1.2/
│   ├── toolbar-pull-button.png       (40x20)
│   ├── sidebar-local-header.png      (80x18)
│   └── ... (12 critical button)
└── git-fried-v0.3.0/
    └── ... (대응 12)
```

### 3.2 AHK ImageSearch + Click 자동화 (effort S)
`bench/gitkraken-spike/ahk-v2/imagesearch-click.ahk` 작성 + tolerance `*50` 실측 조정.

### 3.3 Button matrix BFS cycle 진입 (effort XL)
`docs/ux-eval/handson/exploration-2026-05-26/TODO.md` 의 B1~B32 priority 1~3 순회.

### Setup 재진입 시
- test repo `C:\Users\tgkim\test-gitkraken-vs-git-fried` 보존
- `bun run tauri:dev` (PATH 우선)
- GitKraken Desktop 12.1.2 + git-fried 양쪽 resize 1920x1080 + dark + test repo

## Phase 4: 메모리 drift 정정 후속 (사용자 결정)

직전 /analyze 에서 발견:
- `god comp 0` 마일스톤 (Sprint c75) → 실측 22건 ≥200 LOC 발견 (components/ 19 + pages/ 3)
- `#[tracing::instrument]` 0 보고 → 실측 6개 (ipc/commit/repo/sync_commands)

→ 옵션:
- (a) 메모리 [sprint_2026_05_12_c75] 업데이트만 (drift 정정)
- (b) god comp threshold 200 → 300 재정의 + 신규 god comp 5건 (StatusPanel 670 / CommitGraph 637 / PrDetailModal 523 / GitKrakenToolbar 472 / FullscreenDiffView 433) refactor 결정

## Phase 5: 누적 backlog

이전 NEXT-SESSION.md (2026-05-27 작성) 잔여:

- C2 HIGH 2 (사용자 결정 필요 — UI 흡수)
  - A: Sidebar parity mode (conditional mini section vs GK 항상 7 섹션 + count)
  - C: Multi-repo tab model (2-level vs flat 12+)
- C2 MED 4 (디자인 결정)
  - D2 column 순서 / E2 WIP pencil / H1 status bar 의도

## Sprint 2026-05-27 성과 (참조)

- 본 session commit: `91992ef` 36 files +690 −150
- 보안 6 wave (직전 session): `24fa100..1332a6e`
- Codex pair 9배 finding (Claude 6 → 54+) + GK baseline 60-72→40-44px 정정 + companion change 4건
- 50+ button WCAG 2.5.8 24×24 충족 / GitKraken parity 40px / focus-visible 14 loci / keyboard operability fix 1건
- comparison.md row 17 정정 (존재 ✓ → 존재 + 크기 ✓)
- toolkit 보강: `comparison-matrix-existence-vs-quality-parity-gap` solution (cross-project) + `codex-multi-round-substrate-pair` Round N self-REFUTE pattern + `desktop-app-ui-comparison-automation` parity matrix dimension 분해 룰
- 3 push 성공 (origin / upstream / toolkit)

## Session Continuity

- 다음 session 진입 시 본 문서 SoT
- 메모리 entry: `~/.claude/projects/d--01-Work-08-rf-git-fried/memory/sprint_2026_05_27_button_size_wave.md` 참조
- cross-project pattern: `~/.claude/docs/solutions/comparison-matrix-existence-vs-quality-parity-gap.md`
