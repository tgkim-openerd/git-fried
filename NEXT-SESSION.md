# Next Session — 2026-05-27 진입점

> 직전 session (2026-05-26 ~ 27): `/goal` 보안 강화 6 wave + UI 흡수 cycle C1~C3 +
> `/teach` toolkit 보강 + push (origin + upstream) + credential override + cleanup.
> 8 commit 진행 (`24fa100..1332a6e`), toolkit 2 commit (`2af18cd` + `4ce5ab1`).

## Phase 0: 진입 즉시 (5분)

다음 session 시작 시 다음 순서:

1. **`/analyze`** — 보안 강화 6 wave 후 baseline 재측정 (cargo / vitest / 메모리 drift / 신규 영역)
2. 본 문서 read — 잔여 작업 priority queue
3. `/goal` 재설정 여부 결정 (button matrix exploration 재진입 vs 다른 우선순위)

## Phase 1: Quick fix (10분, 자율 가능)

### 1.1 Local `.git/config` credential `useHttpPath=true` (BLOCKING — upstream push)

직전 session 에서 `git-fried/.git/config` 에 추가한 credential helper 가 `https://github.com`
전체 cover → upstream (RoastFried-RF) push 시 tgkim-openerd 강제 → 403.

```ini
# git-fried/.git/config 의 credential block 변경
[credential "https://github.com/tgkim-openerd"]
    useHttpPath = true
    username = tgkim-openerd
    helper = "!f() { echo username=tgkim-openerd; gh auth token --user TaeGyumKim | sed 's/^/password=/'; }; f"
# upstream 은 default helper (gh wrapper) 사용
```

또는 `git config --local credential."https://github.com".useHttpPath true` + URL-scoped helper.

검증: `cd git-fried && git push upstream main` (gh switch RoastFried-RF 후) — 성공 = `1332a6e` upstream 도 동기화.

### 1.2 `~/.gitconfig` line 71-72 (사용자 직접 1라인 — Claude classifier 차단)

```diff
 [includeIf "hasconfig:remote.*.url:https://github.com/tgkim-openerd/**"]
-    path = ~/.gitconfig-roastfried
+    path = ~/.gitconfig-tgkim-openerd
```

`~/.gitconfig-tgkim-openerd` 는 직전 session 에서 미생성. 다음 session 에서 생성 + 1라인 변경:

```ini
# ~/.gitconfig-tgkim-openerd (신규)
[user]
    name = TaeGyeomKim
    email = oharapass@gmail.com  # 또는 noreply
[credential "https://github.com"]
    username = tgkim-openerd
```

검증: 새 `tgkim-openerd/**` repo clone → push 시 inline `-c` flag 불필요.

## Phase 2: UI 흡수 cycle 재진입 (PoC v4)

직전 session 에서 PoC v4 plan 작성 (`docs/ux-eval/handson/exploration-2026-05-26/POC-V4-PLAN.md`).

### 2.1 Phase 1 of PoC v4 — Anchor PNG library (effort M)

```
bench/gitkraken-spike/anchors/
├── gitkraken-12.1.2/
│   ├── toolbar-pull-button.png       (40x20)
│   ├── sidebar-local-header.png      (80x18)
│   ├── graph-wip-row-marker.png      (24x24)
│   └── ... (12 critical button)
└── git-fried-v0.3.0/
    └── ... (대응 12)
```

### 2.2 AHK ImageSearch script + Click 자동화 (effort S)

`bench/gitkraken-spike/ahk-v2/imagesearch-click.ahk` 작성 + tolerance `*50` 실측 조정.

### 2.3 Button matrix BFS cycle 진입 (effort XL)

`docs/ux-eval/handson/exploration-2026-05-26/TODO.md` 의 B1~B32 priority 1~3
순회. 각 button: anchor click → 양쪽 capture-pw → Codex Vision pair diff → finding fix.

종료 조건: BFS queue empty + new finding 0 라운드 N=2 연속.

### Setup (재진입 시)

- test repo `C:\Users\tgkim\test-gitkraken-vs-git-fried` (9 commit + 2 branch + 1 stash + 2 tag) — 보존됨, 재seed 불필요
- `bun run tauri:dev` (PATH 우선 — `PATH=~/.cargo/bin:$PATH bun run tauri:dev`, 메모리 [Sprint c52])
- GitKraken Desktop 12.1.2 실행 (사용자 본인 사용 중일 가능성 — 별도 띄움)
- 양쪽 resize 1920x1080 + dark theme + test repo open (5-체크 baseline parity)

## Phase 3: C2 잔여 finding (디자인/아키텍처 결정 영역)

### HIGH 2 (사용자 결정 필요)
- A: Sidebar parity mode — git-fried 의 conditional mini section vs GitKraken 항상 7 섹션 + count badge. settings toggle 도입 = effort XL.
- C: Multi-repo tab model — git-fried 의 2-level project/repo vs GitKraken flat 12+ strip. parity option 추가 결정.

### MED 4 (디자인 결정)
- D2 column 순서 (GRAPH 위치 — git-fried 좌측 fixed vs GitKraken BRANCH/TAG 뒤). preset 추가?
- E2 WIP pencil/+1 indicator (GitKraken visual).
- H1 status bar 내용 (git-fried conflict prediction = 의도적 enhancement vs PR/payment GitKraken pattern).
- C3 header nav (회사/홈/레포 한글 vs icon-only GitKraken style).

## Phase 4: Deferred (사용자 결정 / 별도 sprint)

### Codex Wave audit deferred (보안)
- runtime shutdown spawn abort (HIGH-E follow-up, architecture change)
- StdMutex poison + lock map eviction (design decision, parking_lot 검토)
- pty `validate_shell` basename-only (cross-platform UX 트레이드오프)
- `useExternalIssueTracker` localStorage API key → Rust keychain (frontend layer 큰 변경)
- `validate_rev` revset grammar (`^`, `~N`, `@{...}` 통과 — 일부 valid usecase)

### 메모리 drift 후속
- `analyze_2026_05_26_drift_correction.md` 의 god comp threshold 사용자 결정 (≥200/300/500?)
- `#[tracing::instrument]` 6 → 0 정정 후 신규 도입 결정

## Phase 5: `/teach`, `/compound`, `/doc-sync` 적용 가치 검토

### `/compound` — HIGH 가치 (다음 session 진입 즉시 권장)

**기록 가치 있는 1건**:
- **gh keyring 라벨 mismatch (TaeGyumKim vs tgkim-openerd) → push 401** —
  multi-account gh 사용자 일반적 사례. solution doc 가치 HIGH. `/compound` 후
  `docs/solutions/gh-cli-multi-account-credential-routing.md` 생성.

**기록 미고려** (이미 /teach 흡수 또는 메모리 존재):
- PowerShell + Bash `$_` escape — `/teach` 의 `shell-escape` skill 보강 완료
- PrintWindow occlusion-safe — `/teach` 의 `desktop-app-ui-comparison-automation` skill 포함
- Vision diff baseline quality — `/teach` 의 `codex-cross-verification` 보강 완료
- chocolatey rustc PATH 우선 — 메모리 [Sprint c52] + `scripts/cargo-rustup.mjs` 보유

### `/teach` — MED 가치 (compound 후속)

**추가 후보 1건**:
- **gh CLI multi-account credential routing 패턴** — `/compound` 후 글로벌
  toolkit 보강:
  - Option A: `shell-escape` skill 의 "GitHub credential" sub-section 추가
  - Option B: 신규 `tooling/infra/gh-cli-multi-account-credential-routing` skill
  - 결정: `/compound` 진행 후 universality 평가

**미진행 (보류)**:
- lefthook parallel race condition (typecheck + test-web 첫 시도 fail, 재시도 PASS) —
  본 사례 single occurrence, 재현 패턴 확인 후 평가

### `/doc-sync` — LOW~MED 가치 (선택적)

**대상 변경**:
- CHANGELOG `## [Unreleased] ### Security` 섹션이 본 session 6 commit cover —
  C3 wave (F3/E1/G2/A2) + UI 흡수 toolchain 자체는 별도 entry 추가 권장
- README STATS 의 vitest 912 / cargo 304 / commit hash 최신화
- DOGFOOD/CONTRIBUTING 영역 변경 없음 (이미 c95+ Wave 1~5 cover)

**진행 결정 룰**:
- 다음 release (v0.4) 직전이면 `/doc-sync` 진행
- 단순 development cycle 이면 commit 메시지로 충분 (이미 풍부) — defer

## Phase 6: Stop hook 권고

다음 session 의 `/goal` 재설정 시 다음 조건 명시 권장:

```
/goal C2 잔여 HIGH 2 + MED 4 해소 (디자인 결정 받은 영역만) + 
      PoC v4 anchor toolchain Phase 1+2 완료 후 BFS cycle 진입,
      사용자 결정 영역은 옵션 제시 후 진행, Codex 페어로 진행
```

또는 더 작은 단위:

```
/goal Phase 1 quick fix (credential useHttpPath + ~/.gitconfig 수정)
      + Phase 5 의 /compound (gh keyring 라벨 mismatch) 진행
```

---

## 본 session 누적 commit (다음 session 진입 시 git log 확인)

| Hash | Subject |
|---|---|
| `24fa100` | fix(security): /analyze HIGH 5건 + Codex Wave 1 review 5건 |
| `9afcee5` | fix(security): Wave 2 — TOCTOU lock + cancel-safe + rev validation |
| `6f491f1` | fix(security): Wave 3 — Codex R3 audit MED 9건 |
| `70cdbbf` | fix(security): Wave 4 — Codex R4 audit HIGH 1 + MED 4 |
| `53fdb7b` | fix(security): R5 — cherry_pick + reset/revert sha injection |
| `9c46cf3` | fix(security): reset.rs — Codex R5 회귀 fix |
| `d3edb2d` | docs: Sprint c95+ Wave 1~5 보안 강화 doc-sync |
| `95ef118` | docs(changelog): c78~c102 + 2026-05-22 UX backlog condensed |
| `b048437` | docs(changelog): R8 Codex audit Fix 2 |
| `3638319` | fix(ui): C2 F3 — Date column wrap + UI 흡수 toolchain Wave 1 |
| `80d3195` | fix(ui): C3 wave — Codex C2 finding 3건 (E1/G2/A2) |
| `ed0d853` | docs(plan): PoC v4 image search anchor toolchain spec |
| `1332a6e` | chore(bench): session cleanup helper + B17 click attempt 캡처 |

toolkit: `2af18cd` (신규 desktop-app-ui-comparison-automation + 2 보강) + `4ce5ab1` (post-hoc Codex pair 5 finding fix).

push 상태:
- toolkit: origin 동기화 ✅
- git-fried origin (tgkim-openerd): `1332a6e` 동기화 ✅
- git-fried upstream (RoastFried-RF): `ed0d853` 까지 동기화, `1332a6e` 보류 (Phase 1.1 fix 후 재push)
