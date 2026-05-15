# Full App UI/UX Audit Plan — Hybrid 2-Phase (Claude + Codex)

> **작성일**: 2026-05-15 (sprint c89-B 진입)
> **트리거**: 사용자 명시 "전체 테스트가 목적, hybrid 2-phase"
> **목표**: git-fried v0.3.0 데스크탑 앱의 빠진 부분 없이 UI/UX + IPC 에러 발굴
> **전략**: Phase A 자동 UI audit (vite dev + Playwright MCP) → Phase B 수동 IPC audit (tauri:dev)
> **Codex 협업**: Claude main 이 실 앱 띄움/screenshot, Codex 가 발견 spot 의 코드 cross-audit

## 0. Scope 정의

### 0.1 검증 대상 (full enumerate)

| 영역 | 단위 | 개수 |
|---|---|---|
| Pages | file-based route | 4 (index / launchpad / repositories / settings) |
| God components (script ≥150 LOC) | .vue | 9 |
| Medium components (100~250 LOC) | .vue | ~30 |
| Small components (<100 LOC) | .vue | ~50 |
| Composables | .ts | 124 (자체 unit test 68개 + e2e 영향 panel 별 측정) |
| Rust IPC handlers | `#[tauri::command]` | 173 |
| i18n locales | leaf keys | 1298 ko / 1298 en |
| Edge case axes | 환경/입력 차원 | 7 (한글 / dark / viewport / kbd / focus / HC / forced-colors) |

### 0.2 검증 차원 (axis matrix)

각 panel 을 다음 7 차원에 대해 audit:

1. **시각 (visual)**: 레이아웃 / 색상 / 글꼴 / 간격 / 정렬
2. **상호작용 (interaction)**: 버튼 클릭 / hover / drag / drop / context menu / keyboard
3. **상태 (state)**: empty / loading / error / partial / success / large dataset
4. **i18n**: ko/en toggle, 한글 ko key 가 한글로 보이는지, 영어 ko key 가 영어로 보이는지, missing key fallback
5. **dark toggle**: light → dark → light, 모든 색상 토큰 대비비 OK
6. **a11y**: focus ring 보이는지, kbd-only 진입 가능한지, aria-label 작동
7. **edge**: 작은 viewport (1024x600), 큰 viewport (2560x1440), 한글 long name, RTL fallback, forced-colors

## 1. Phase A — 자동 UI audit (vite dev + Playwright MCP)

### 1.1 환경

```bash
# Background spawn
cd "d:/01.Work/08.rf/git-fried"
bun run dev                    # → http://localhost:1420
# 대안: bun run --cwd apps/desktop dev

# Mock 모드 — Tauri webview 가 아닌 chromium 이므로 devMock fixture 응답
# (api/devMock.ts 가 isMockEnabled 시 가짜 데이터 반환)
```

### 1.2 자동화 도구

- `mcp__playwright__browser_navigate` — 주어진 URL 로 진입
- `mcp__playwright__browser_snapshot` — DOM tree + ARIA 추출
- `mcp__playwright__browser_click` / `_type` / `_hover` / `_drag` — 상호작용
- `mcp__playwright__browser_take_screenshot` — 시각 회귀 검증용
- `mcp__playwright__browser_press_key` — kbd shortcut
- `mcp__playwright__browser_resize` — viewport 변경 (edge axis)
- `mcp__playwright__browser_evaluate` — runtime JS (i18n locale toggle, dark toggle 등)

### 1.3 Phase A Wave 분할

#### Wave A-1: `index` page (graph/branches/stash 통합)

- [ ] navigate http://localhost:1420
- [ ] snapshot DOM tree — `data-testid` 매핑 검증
- [ ] **CommitGraph**: rows 가상 스크롤 + WIP row + branchTag sticky overlay + drag handle + zoom +/- + ⌘F 검색 + headerMenu 우클릭 + column toggle/reorder + skeleton (rows 0 시)
- [ ] **StatusPanel** (right side): staging / unstage / hunk select / diff toggle
- [ ] **BranchPanel** (left side or sidebar): tree view / local/remote 분리 / context menu / hide refs
- [ ] **CommitMessageInput**: amend toggle / draft 저장 / 한글 입력
- [ ] **CommitDetailSidebar**: SHA 메타 / parent / 작성자 / refs
- [ ] **FullscreenDiffView** (더블클릭 시): inline / side-by-side toggle / hunk navigation
- [ ] **ContextMenu**: row 우클릭 9+ action / keyboard nav (esc 닫기)
- [ ] **Toast**: error / success / info dedup window

축 검증:
- [ ] dark toggle 모든 panel
- [ ] 한글 commit message 입력/표시
- [ ] viewport 1024x600 (작은) / 2560x1440 (큰)
- [ ] keyboard-only: Tab traversal + ⌘F + esc + J/K vim nav
- [ ] focus-visible ring (WCAG 2.4.7)

#### Wave A-2: `launchpad` page

- [ ] navigate /launchpad
- [ ] PR list / commit-based filter / open in forge button
- [ ] AI commit / AI resolve 버튼
- [ ] LFS install banner / scrollbar
- [ ] HOOK 등록 toast (false claim 정정 확인 — D-LFS-002 후속)

축 검증 동일.

#### Wave A-3: `repositories` page

- [ ] navigate /repositories
- [ ] Workspace 그룹 (UltraPlan v0.4)
- [ ] Repo 등록 / clone / GitKraken import / 삭제 modal
- [ ] First-run wizard (UltraPlan v0.5)
- [ ] Per-repo forge override
- [ ] RepoTabBar (open tab 관리 + drag reorder + persist)
- [ ] Plugin / UiCust 설정 modal

축 검증 동일.

#### Wave A-4: `settings` page

4 sub:
- [ ] Repo 설정 sub
- [ ] UiCust sub (테마 / 폰트 / 색상 / 단축키)
- [ ] Plugin sub
- [ ] AI 설정 sub (quota 60s / Claude / Codex / ssh_key path validation)

축 검증 동일.

#### Wave A-5: god component 잠재 회귀 (script <200 정책)

이미 audit 된 컴포넌트 외에도 panel-by-panel touch:

- [ ] CommitGraph (이미 W2.1/W2.3 처리, regression 0 확인)
- [ ] StatusPanel (script 165 / template 308 — template god)
- [ ] PrDetailModal (script 143 / template ~330)
- [ ] FullscreenDiffView (script 167 / template 260 — template god)
- [ ] GitKrakenToolbar (script 121 / template 262 — template god)
- [ ] CommitDetailSidebar (script 140 / template ~250)
- [ ] BranchPanel (script 138 / template ~230)
- [ ] CommitMessageInput (script 155 / template ~200)
- [ ] CloneRepoModal (script ~150 / template ~180)

#### Wave A-6: edge case axis 일괄

7 axes 전수 sweep:

1. **한글 (encoding)**:
   - [ ] commit message 한글 입력 + 표시 (NFC normalize)
   - [ ] branch name 한글 + ref pill 표시
   - [ ] 작성자 한글 이름 + avatar initial (c58 P3-5 한글 2글자 font 축소)
   - [ ] 파일명 한글 + diff hunk
2. **dark toggle**:
   - [ ] 모든 panel light → dark → light cycle
   - [ ] 색 토큰 invisible (transparent) 없는지
   - [ ] `--diff-add` / `--diff-delete` 대비비 ≥ AA
3. **viewport**:
   - [ ] 1024x600 (작은) — sidebar collapse / panel overflow
   - [ ] 1920x1080 (디폴트)
   - [ ] 2560x1440 (큰)
4. **keyboard-only**:
   - [ ] Tab 순회 — 모든 interactive element 도달
   - [ ] ⌘F / Esc / J/K / Enter / Space / Arrow
   - [ ] 단축키 충돌 없음
5. **focus-visible**:
   - [ ] kbd focus 시 ring 보임 (box-shadow 2px ring)
   - [ ] mouse click 후 ring 사라짐
   - [ ] scroll-margin-top 4rem (WCAG 2.2 SC 2.4.11)
6. **High Contrast (Windows)**:
   - [ ] `forced-colors: active` media query — CanvasText / ButtonText 대체
   - [ ] focus outline 2px solid CanvasText
   - [ ] button border 1px solid ButtonText
7. **prefers-reduced-motion**:
   - [ ] 모든 transition 0ms 으로 disable
   - [ ] animation-duration 0.01ms

### 1.4 산출물 (Phase A 완료 시)

- `docs/code-review/2026-05-15-full-audit/phase-a-bugs.md` — 발견 bug list (severity / panel / axis / repro)
- `docs/code-review/2026-05-15-full-audit/screenshots/` — Wave 별 screenshot baseline (regression test 추가용)
- Bug 별 우선순위 (Critical / High / Medium / Low)
- Codex 코드 cross-audit 결과

## 2. Phase B — 수동 IPC audit (tauri:dev)

### 2.1 환경

```bash
bun run tauri:dev    # Tauri 실 webview + Rust backend
# 사용자가 직접 조작 + Claude 가 console / stderr / tracing 로그 share
```

### 2.2 검증 영역 — IPC command family × error class 매트릭스 (Codex c89-B audit 권고)

> v0.2 — Codex audit (`task-mp6agi61`) Finding B/C 반영: "8 영역" 으로 축약하면 171
> commands 의 family/error class coverage 증명 안 됨. 아래는 family × happy/error
> matrix. 각 cell 은 `[ ] handler family > 대표 cmd > happy / error path / UI caller`
> 단위로 trigger.

**Family rows (Rust 측 `#[tauri::command]` 11 cluster)**:

- [ ] **git core** — clone / fetch / pull / push / merge / rebase / cherry-pick / reset / restore (각 happy + conflict)
- [ ] **stash** — list_stashes / save / pop / drop / apply_partial / edit_stash_message
- [ ] **worktree** — list / add / remove / **lock** / **unlock** / **prune** / locked path / stale path / disk usage (Finding A — git-fried 제품 근거 1급)
- [ ] **lfs** — install scope / track / push size NUL-safe / fetch + checkout
- [ ] **status/diff** — get_status / get_log / get_graph (1k/10k/50k rows perf — Finding I)
- [ ] **branch/ref** — checkout / delete / hide / unhide / rename / search
- [ ] **tag** — create / delete / push / delete_remote
- [ ] **forge** — list_pr / get_pull_request / create_pr / submit_review / merge_pr / close / reopen
- [ ] **profile / workspace / repo** — apply_repo_config / activate_profile / set_repo_ssh_key_path / per-repo forge override
- [ ] **importer** — import_gitkraken_dry_run / import_gitkraken_apply (Finding A 자매)
- [ ] **AI / search** — ai_commit_message / ai_resolve_conflict / search_commits_by_message / count_hangul_commits

**Error class columns**:

| Class | Trigger pattern | Expected UX |
|---|---|---|
| `happy` | 정상 입력 + 권한 OK | success toast 또는 UI 상태 갱신 |
| `429 rate_limit` | Forge API 빠른 연속 호출 | `humanizeGitError` rate-limit 패턴 toast + retry-after 안내 |
| `auth_expired` | PAT 만료 / 401 | `humanizeGitError` 401 패턴 + Settings 재발급 안내 |
| `keyring_locked` | OS keychain 잠금 / NoEntry 외 에러 | `auth.rs` Ok(None) fallback (PR-C.2) + UI toast |
| `db_timeout` | sqlx acquire_timeout(10s) 초과 / full disk | `AppError::Db` + 사용자 anguish 명시 |
| `git_cli_fail` | git2 vendored 실패 / conflict / dirty / non-fast-forward | `humanizeGitError` 11 패턴별 한글 |
| `fs_lock` | repo .git/index 잠금 / sibling process | retry 1회 + 실패 시 사용자 안내 |
| `network_flap` | mid-fetch DNS / timeout / connection reset | retry policy + cancel 가능성 |
| `cancel` | 사용자 명시 취소 (timeout / esc / unmount) | `AppError::Internal("cancelled")` |
| `permission_denied` | Tauri capability 거부 / dialog cancel | silent fail vs explicit toast 분리 (Finding E) |

**Tauri shell lifecycle row** (Finding D — 별도 B-0 cluster):

- [ ] reload-window — Vue state / query cache / localStorage / pinia store 복구 + dirty form 상태
- [ ] minimize / restore — repo polling 재개 / WIP 변화 detect
- [ ] fullscreen toggle / devtools toggle — keybinding 충돌
- [ ] tray / single-instance (있을 경우 N/A row)
- [ ] updater (있을 경우 N/A row)

**Capability silent-fail matrix** (Finding E):

- [ ] notification permission denied → `useNotification` silent fail → toast fallback OK?
- [ ] dialog cancel → caller catch + 사용자 의도 무시 회피
- [ ] shell open failure (URL handler 미등록) → `errors.browserOpenFailed` toast (Sprint c46 SEC-202)
- [ ] deep-link 미등록 OS → 무한 wait 회피

### 2.3 Codex cross-audit 분담

- Phase A bug list → Codex 가 해당 Vue/TS 파일 read + 회귀 위험 평가 (✓ 수행 — task-mp6agi61)
- Phase B IPC bug → Codex 가 해당 Rust 파일 read + 패치 제안 + regression spec 후보 enumerate

## 3. 진행 절차

### 3.1 Phase A wave 별 cycle

```
1. wave 진입 — TodoWrite in_progress
2. bun run dev background 기동 확인 (1420 ready)
3. browser_navigate → browser_snapshot → 시각 + DOM 검증
4. 7 axes sweep
5. 발견 bug → phase-a-bugs.md 추가 (severity / panel / axis / repro)
6. wave 종료 — TodoWrite completed + commit (bug doc 만)
7. 다음 wave 진입
```

### 3.2 Bug fix 정책

- **Critical** (앱 동작 차단 / 데이터 손실 / 보안): 즉시 fix + 단일 commit
- **High** (UX 큰 회귀 / 핵심 시나리오 실패): wave 종료 후 batch fix
- **Medium** (시각 회귀 / edge case 누락): Phase A 종료 후 batch
- **Low** (cosmetic): Phase B 후 결정

### 3.3 Session 분량 cap

- 단일 session 으로 모두 진행 어려울 시 wave 단위 commit + next_session_entry.md 에 진행 상태 기록
- 사용자 redirect / stop 가능 — `/loop dynamic` 으로 자율 진행 가능

## 4. Codex 페어 호출 정책 — wave-end inline checkpoint (v0.2)

> v0.2 — Codex audit Finding J 반영. Phase-end 2회만으로 약함. c82 데이터 = Codex
> 가 round 중간 catch 했을 때 Critical 2건 (SEC-201/SEC-202) 발견. inline checkpoint
> 가 ROI 큼.

### 4.1 Inline checkpoint trigger (wave-end)

| Wave | Codex 호출 prompt | Skip 조건 |
|---|---|---|
| **A-1 종료** (index page) | "Index page audit 결과 + CommitGraph virtual scroll 1k/10k/50k perf 시나리오 missed scenario" | bug 0 + screenshot 정상 시 skip |
| **A-3 종료** (repositories) | "Repositories audit + per-repo forge override + clone error path missed" | bug 0 시 skip |
| **A-4 종료** (settings 9 sub) | "Settings 9 sub audit + capability silent fail (notification/dialog/shell) cross-check" | bug 0 시 skip |
| **B-risk 종료** (IPC fault matrix) | "IPC fault-injection 결과 + 한글 인코딩 + worktree lock/unlock + reload-window state 복구" | trigger_cap_applied 적용 |
| **Phase 종합** (A 또는 B 전체 종료) | "전체 bug list + regression spec 후보 enumerate + 다음 sprint 우선순위" | 마지막 1회만 |

### 4.2 Inline checkpoint vs Phase-end 종합 비용 분리

- Inline = 작은 prompt (≤2K char) + bug 1-3건 + 1 wave 영역만 — `effort: medium`, `--wait`
- Phase 종합 = 큰 prompt (≥4K char) + bug list 전체 + Rust regression spec — `effort: high`, background OK

### 4.3 동일 fan-out group cap

- 같은 sprint 안의 동일 영역 (예: A-1 inline + A-1 종합) 은 1회만 — 두번째는 `trigger_cap_applied` skip
- 다른 wave (A-1 inline → A-3 inline) 는 별 fan-out — cap 적용 안 함

## 5. Done criteria — v0.2 regression spec 의무 (Codex Finding K)

### 5.1 Severity → Required evidence/test 매트릭스 (BLOCKING)

> Codex audit Finding K + blind spot 5 반영. "fix commit 만" 산출은 다음 sprint
> 휘발 risk. severity 별 evidence/spec/gate 의무화.

| Severity | Required evidence | Regression spec 의무 | Native gate |
|---|---|---|---|
| **Critical** | Repro 명확 + 시각 또는 로그 evidence | **e2e spec OR Tauri webdriver spec 추가** OR "untestable" 사유 (Tauri only API / OS env / external API 등) 명시 | typecheck 0 + vitest PASS + cargo check + cargo test + lefthook pre-push |
| **High** | Repro + axis (panel/i18n/dev-mode/IPC/perf) | **unit/e2e spec 추가** OR untestable 사유 | typecheck 0 + vitest PASS + cargo check + (Tauri-side 변경 시 cargo test) |
| **Medium** | Repro 가능한 step | spec **권장** (시간 cap 시 skip OK + backlog 기록) | typecheck 0 + vitest PASS |
| **Low** | 관찰만 | spec 면제 | typecheck 0 |

### 5.2 Phase A 완료 (v0.2)

- [ ] 4 pages 모두 navigate + snapshot 1회 이상
- [ ] 9 god components 모두 panel-by-panel touch
- [ ] 7 edge axes 전 panel 적용 (+ § 8 backlog 의 app zoom / system DPI 후보 sweep)
- [ ] phase-a-bugs.md 작성 (≥1 entry 또는 "0 bug 발견" 명시)
- [ ] Codex inline checkpoint (A-1/A-3/A-4 별) + Phase 종합 1회 결과 통합
- [ ] **Critical/High bug 모두 § 5.1 evidence/test/gate 완료**
- [ ] phase-a-bugs.md 의 각 entry 에 `regression-spec: <path or "untestable: <reason>">` 필드 명시

### 5.3 Phase B 완료 (v0.2)

- [ ] § 2.2 IPC family × error class 매트릭스 cell ≥80% trigger (worktree / 한글 / lifecycle / capability 4 cluster 100%)
- [ ] phase-b-bugs.md 작성 + 각 entry 의 `regression-spec` 필드
- [ ] Codex B-risk inline checkpoint + Phase 종합 결과 통합
- [ ] **Critical/High bug 모두 § 5.1 evidence/test/gate 완료**
- [ ] tauri-webdriver smoke (TST-502) 가 enable 가능한 환경이면 1 case 추가

### 5.4 Branch / commit policy (Codex Finding L)

- **Audit docs / bug log / screenshot** — main 직접 commit OK (개인 프로젝트 + 가시 회귀 없음)
- **Fix commit** — main 직접 OK, 단 다음 조건은 POC branch 권고:
  - visual surface 큰 변경 (tailwindcss/vite major) — [plan/34](34-poc-vite8-tailwindcss4.md) 정책 적용
  - 15+ 파일 변경 시 (CLAUDE.md)
  - Critical/High 시 자동 rollback 가능한 단일 commit 권장
- **Rollback gate**: 각 commit pre-push hook (typecheck + test-web) 통과 필수. fail 시 즉시 revert + audit doc 에 사유 기록.

## 6. Backlog (Codex audit `task-mp6agi61` 잔여 finding)

본 plan v0.2 에 직접 반영 안 된 finding 의 후속 sprint 매핑.

### 6.1 P0 critical path smoke (Finding G)

> wave 순서 — page taxonomy 가 아닌 사용자 critical path 우선

Phase A-1 진입 전 P0 smoke:
- [ ] repo 등록 → status / stage / hunk / commit → fetch / pull / push → conflict / recovery → PR detail
- [ ] keyring / token / per-repo forge override 선행 검증
- 별도 sprint 신설 또는 § 1.3 앞에 추가 — 본 plan 후속 patch 영역

### 6.2 Automation boundary table (Finding H)

> Playwright 로 볼 수 있는 것 vs tauri:dev 만 가능한 것 vs 확인 불가

- IME composition / native dialog / context menu suppression / drag modifier / clipboard / openDialog — Phase B 전용
- 별도 §1.2 patch 후속

### 6.3 Edge axis 정의 통합 (Finding F)

> § 0.2 의 7 axis 와 §1.3 A-6 sweep 의 7 axis 정의 불일치

- HC vs forced-colors 분리 (Windows High Contrast 는 forced-colors 의 superset)
- app zoom / system DPI 추가 (`useUiState.ts` 의 zoomPx state 존재)
- prefers-reduced-motion 은 reduce-motion axis 로 별도
- A-6 일괄 sweep → 각 wave inline 으로 분산 권고

### 6.4 Virtual scroll perf threshold (Finding I)

> A-1 CommitGraph 의 "rows 가상 스크롤" 검증 데이터 크기 부재

- 1k / 10k / 50k synthetic fixture (devMock 확장)
- fast wheel burst FPS threshold (≥30fps 권고)
- canvas pixel non-blank check
- jump-to-SHA latency (≤100ms)

### 6.5 Worktree 1급 workflow (Finding A)

> git-fried 제품 근거인데 plan v0.1 에 명시 X (§ 2.2 v0.2 매트릭스에 cluster 추가 완료)

- WorktreePanel 의 list / add / remove / lock / unlock / prune UI flow
- locked worktree + stale path + disk usage 표시
- GitButler virtual branches 비교 축

### 6.6 Self-blind spot 5 patterns (Codex blind spot section)

향후 audit plan 작성 시 의식적 회피:

1. devMock + Playwright 로 "화면 대부분" 본다는 가정 — Tauri shell / capability / keyring / WebView2 가 더 위험
2. "7 edge axes" 충분조건 가정 — app zoom / system DPI / wheel burst / OS permission / reload-restore / large-repo perf 추가
3. Phase-end Codex 2회 충분 가정 — inline checkpoint ROI 큼 (§ 4.1 v0.2)
4. god component LOC 를 risk proxy — 사용자 빈도 + 데이터 손실 가능성이 우선
5. bug doc + fix commit 산출 — regression spec gate 필수 (§ 5.1 v0.2)

## 7. Codex audit raw 결과

- 파일: [docs/code-review/2026-05-15-full-audit/codex-audit-task-mp6agi61.md](../code-review/2026-05-15-full-audit/codex-audit-task-mp6agi61.md)
- Session ID: `019e296e-0ae4-7da0-918e-3f3146735d0c`
- Resume: `codex resume 019e296e-0ae4-7da0-918e-3f3146735d0c`
- Duration: 6m 7s
- Verdict: 12 finding + 5 blind spot + 3 immediate recommendation
- Top 3 권고 모두 본 plan v0.2 반영 완료 (§ 2.2 / § 4 / § 5)
