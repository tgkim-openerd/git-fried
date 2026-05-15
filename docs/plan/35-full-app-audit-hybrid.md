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

### 2.2 검증 영역 (Phase A 에서 mock 으로 가려졌던 것)

- [ ] **git 실 연산**: clone / fetch / pull / push / merge / rebase / cherry-pick / reset / restore / stash / lfs
- [ ] **Forge API**: GitHub PAT / Gitea token / PR CRUD / Issue / Release
- [ ] **SQLite migration**: 8 migrations 순차 실행 / corruption recovery
- [ ] **PTY 내장 터미널**: pty_open / 한글 입력 / OSC escape strip / size resize
- [ ] **AI CLI**: Claude API call / Codex CLI spawn / 1MB cap / timeout
- [ ] **keyring**: token save/load/delete / Windows Credential Manager / fallback Ok(None)
- [ ] **deep-link**: `git-fried://` URL handler / destructive 차단 (SEC-202)
- [ ] **panic_hook**: Rust panic → process exit → SQLite WAL recovery 시나리오 (수동 trigger)

### 2.3 Codex cross-audit 분담

- Phase A bug list → Codex 가 해당 Vue/TS 파일 read + 회귀 위험 평가
- Phase B IPC bug → Codex 가 해당 Rust 파일 read + 패치 제안

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

## 4. Codex 페어 호출 정책

- Phase A 종료 시 **1회** Codex audit 호출 (`/codex:rescue --wait`):
  - prompt: "Phase A bug list + 코드 cross-audit. 회귀 위험 + missed scenario 검출."
  - Result 통합 후 Phase B 진입
- Phase B 종료 시 **1회** Codex audit 호출:
  - prompt: "Phase B IPC bug + Rust 측 패치 제안 + regression test 추가 우선순위"
- 동일 fan-out group 안의 추가 Codex 호출은 `trigger_cap_applied` skip

## 5. Done criteria

Phase A 완료:
- [ ] 4 pages 모두 navigate + snapshot 1회 이상
- [ ] 9 god components 모두 panel-by-panel touch
- [ ] 7 edge axes 전 panel 적용
- [ ] phase-a-bugs.md 작성 (≥1 entry 또는 "0 bug 발견" 명시)
- [ ] Codex 1차 audit 결과 통합

Phase B 완료:
- [ ] 8 IPC 영역 모두 사용자 직접 trigger 시도
- [ ] phase-b-bugs.md 작성
- [ ] Codex 2차 audit 결과 통합
- [ ] Critical/High bug 모두 fix commit
