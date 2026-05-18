# Plan #40 — GitKraken AutoHotkey v2 자동 제어 UI Tour

> 작성: 2026-05-18 / 트리거: 사용자 명시 "GitKraken을 직접 제어해서, UI/UX 동작하는 것을 문서화" / 선행: Sprint c95+ (반자동 PowerShell + Win32 multi-monitor 캡처 toolchain)

## 0. Goal

GitKraken Desktop 12.1.1 의 **7 영역 UI tour** 를 AutoHotkey v2 portable + image search 로 **AI 직접 제어** → screenshot 시리즈 + Claude narration + git-fried vs GitKraken 비교표 산출.

**산출물 형식 (사용자 confirmed multi-select)**:
1. PNG screenshot 시리즈 + 라벨 (`docs/ux-eval/handson/screenshots/`)
2. Step-by-step narration (Claude 작성, Codex cross-validation 필수)
3. GitKraken vs git-fried 비교표 + backlog 매핑 (SB-xxx)

**사용 제약**:
- 내부 문서용으로만 사용 (공개 배포 X) — 사용자 confirmed
- 다음 sprint plan input 으로만 활용
- Memory Rule 3 (Multimodal Vision Cross-Validation 5 Rule) 적용

## 1. Scope (7 영역)

사용자 confirmed: GitKraken 전체 UI tour. 영역 enumerate:

| # | 영역 | 시나리오 예상 갯수 | git-fried 대응 SB 범위 |
| --- | --- | --- | --- |
| 1 | Workspace | 5~8 (폴더 그룹 / repo open / search / cloud workspace 등) | SB-019~023 |
| 2 | Graph | 8~12 (commit detail / branch chip / merge donut / file list / inline diff 등) | SB-001~014, SB-052~055 |
| 3 | Stash | 3~5 (list / apply / pop / drop / message) | SB-024~027 |
| 4 | Tag | 3~5 (list / annotate / push / delete) | SB-033 + SB-034~036 |
| 5 | Pull Request | 4~6 (list / approve / merge / comment / files) | SB-037~042 |
| 6 | Worktree | 3~4 (add / list / remove / lock) | SB-043~046 |
| 7 | Settings | 4~6 (Profile / Integration / UI Cust / Plugin) | SB-047~051 |

**총 예상 시나리오**: 30~46개 × 평균 2-3 screenshot = 60~138 PNG.

## 2. Phase 분리

### Phase 0 — 환경 준비 (선행 조건)

- [ ] AHK v2 portable zip 다운로드 (`https://www.autohotkey.com/download/ahk-v2.zip`, ~3MB)
  - SHA-256 확인 후 `bench/gitkraken-spike/ahk-v2/` 에 unzip
  - `.gitignore` 에 `bench/gitkraken-spike/ahk-v2/` 추가 (binary 커밋 회피)
- [ ] `scripts/run-ahk2.ps1` wrapper 작성 (PowerShell 에서 AHK script 실행 + 결과 capture)
- [ ] AHK v2 hello world 검증 (`hello.ahk2` script: MsgBox + ImageSearch 함수 호출 dry-run)
- [ ] `bench/gitkraken-spike/ahk-v2/README.md` 작성 (포함 binary 출처 + version + 사용법)

**Acceptance**: `pwsh -File scripts/run-ahk2.ps1 -Script bench/gitkraken-spike/hello.ahk2` 가 정상 종료 (exit 0).

### Phase 1 — 시나리오 enumerate (사용자 협업)

영역 별 시나리오 list 작성 → `docs/ux-eval/handson/scenarios/{01..07}-{area}.md`.

**1 시나리오 schema (markdown)**:
```markdown
## SC-{area}-{num}: {시나리오 명}

- 사용자 액션: {예 — 좌측 sidebar 의 LOCAL 섹션 hover}
- GitKraken 예상 반응: {예 — Quick Search 입력란 활성화 + 우측 ⋮ 컨텍스트 메뉴 아이콘 표시}
- git-fried 대응 backlog: SB-{num} ({상태: 미구현/부분/완료})
- 기대 screenshot: {예 — 2개. (a) hover 직전 (b) hover 후 popup 표시}
- AHK script 난이도: {S/M/L} (UI element position 안정성 기준)
- 우선순위: {HIGH/MED/LOW} (git-fried 다음 sprint 영향도)
```

**우선 enumerate 순서**: Settings (가장 정적, PoC 우선) → Tag → Stash → Worktree → PR → Workspace → Graph (가장 dynamic).

**Acceptance**: 7 영역 × N 시나리오 markdown 파일 7개 + 총합 ~30-46 시나리오 enumerate 완료.

### Phase 2 — PoC: Settings 1 시나리오 자동 제어

가장 정적 (transition 적음) 인 Settings 영역에서 1 시나리오 PoC.

**대상**: SC-07-1 (Profile 페이지 열기 + 한 행 hover + tooltip 캡처)

**AHK v2 script 구조** (`bench/gitkraken-spike/ui-tour/07-settings-poc.ahk2`):
```autohotkey
#Requires AutoHotkey v2.0
SetTitleMatchMode(2)  ; partial match

; 1. GitKraken focus
WinActivate("ahk_exe gitkraken.exe")
WinWaitActive("GitKraken", , 5)

; 2. Settings hotkey (Ctrl+,)
Send "^,"
Sleep 1500  ; transition

; 3. Screenshot 1: Settings 진입 직후
RunWait('pwsh -NoProfile -File "bench/gitkraken-spike/capture-screen.ps1" -Label "settings-entry"')

; 4. Profile 탭으로 이동 (image search)
ImageSearch &px, &py, 0, 0, A_ScreenWidth, A_ScreenHeight, "bench/gitkraken-spike/anchors/profile-tab.png"
if (px > 0) {
    MouseClick("Left", px + 20, py + 10)
    Sleep 800
    RunWait('pwsh -NoProfile -File "bench/gitkraken-spike/capture-screen.ps1" -Label "settings-profile"')
}

; 5. 종료 (Esc)
Send "{Escape}"
ExitApp
```

**helper 작성**:
- `bench/gitkraken-spike/capture-screen.ps1` — System.Windows.Forms.Screen 으로 PNG 저장
- `bench/gitkraken-spike/anchors/` — image search 용 anchor PNG 디렉토리

**Acceptance**:
- PoC script 실행 → 2 PNG 파일 생성 (`settings-entry-{ts}.png` + `settings-profile-{ts}.png`)
- 사용자가 PNG 시각 확인 후 OK 판정
- Claude 가 vision interpretation 으로 narration draft 1건 작성

### Phase 3 — PoC 보정 + 나머지 6 영역 확장

PoC 결과 분석:
- toolchain 결함 (image anchor fragility / focus timing / multi-monitor DPI) 파악 후 보정
- 재사용 가능한 helper 분리:
  - `lib/gk-focus.ahk2` — GitKraken activate + waitActive 표준화
  - `lib/gk-capture.ahk2` — capture-screen.ps1 호출 wrapper
  - `lib/gk-anchor.ahk2` — ImageSearch 표준화 + fallback (좌표 base)
- 영역별 script 6개 작성 (`02..07`)

**Acceptance**: 7 영역 × N 시나리오 = 30~46 시나리오 자동 실행 → 60~138 PNG 생성.

### Phase 4 — Claude narration + Codex cross-validation

Memory Rule 3 (Multimodal Vision Cross-Validation 5 Rule) 적용:

1. Claude vision interpretation (각 screenshot 1차 narration)
2. **Codex cross-validation** (필수, default ON):
   - 영역별 batch 5-10 시나리오 단위로 `Agent({ subagent_type: "codex:codex-rescue", background: true })` 호출
   - Codex 가 같은 PNG 분석 → 정정/추가 finding emit
3. 35% 오류율 기대 (Memory Rule 3 실측치)
4. Claude/Codex disagree 시 보존적 판단 (Codex 우선)
5. cost cap: baseline × 3 초과 시 `cost_cap_exceeded` skip

**산출물**: `docs/ux-eval/handson/{01..07}-{area}-narration.md` 7개 파일.

### Phase 5 — git-fried vs GitKraken 비교표

영역 별 narration 을 기반으로:

| # | 시나리오 | GitKraken 동작 | git-fried 현재 | backlog SB-xxx | 우선도 |
| --- | --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... | ... |

총합 표 → `docs/ux-eval/handson/comparison.md`. 다음 sprint plan input.

### Phase 6 — memory + obsidian + commit

- memory entry 생성: `gitkraken_ahk_handson_2026_05_18.md` + MEMORY.md 인덱스 추가
- Obsidian log
- commit: `feat(bench): GitKraken AHK v2 자동 제어 toolchain + 7 영역 UI tour (Plan #40)`

## 3. Risks / Open questions

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | AHK v2 zip download HTTPS + integrity | 다운로드 후 SHA-256 hash 확인 (autohotkey.com 공개 hash 가 있으면 매칭, 없으면 사용자 확인) |
| 2 | GitKraken 5 process 중 main window focus 식별 어려움 | `WinActivate("ahk_exe gitkraken.exe")` + `WinGetTitle` 로 정확한 process 선별. PoC 에서 검증 |
| 3 | UI dynamic — image anchor frame 마다 변동 (transition / hover popup 위치) | Sleep 충분히 (1.5s+) + ImageSearch retry 3회 + fallback 좌표 |
| 4 | Codex cross-validation cost cap — 30~46 시나리오 × 2-3 screenshot 분석 | Phase 4 batch (영역당 1회 background) + cost-tracker baseline 모니터 |
| 5 | 사용자 작업 중 자동 제어 시 충돌 (마우스/키보드 hijack) | 실행 전 "5초 대기 + 사용자 unattended 확인 prompt" 표시 |
| 6 | GitKraken 12.1.1 → 12.2 업그레이드 시 image anchor 깨짐 | anchor PNG 에 GitKraken 버전 명시 (`anchors/12.1.1/`) + 재캡처 plan |
| 7 | EULA 검토 — 사용자 confirmed 내부 문서용 (Axosoft EULA 일반 안전 범위) | 산출물 모두 docs/ux-eval/handson/ 내부 저장 + 공개 배포 X |
| 8 | Claude vision 35% 오류율 | Memory Rule 3 — Codex cross-validation 의무 |

## 4. Acceptance (전체 plan 종료 조건)

- [ ] AHK v2 portable 환경 작동 (Phase 0)
- [ ] 7 영역 × N 시나리오 enumerate 완료 (Phase 1)
- [ ] PoC Settings 1 시나리오 자동 실행 성공 + Claude narration 1건 (Phase 2)
- [ ] 나머지 6 영역 자동 실행 + 60~138 PNG 생성 (Phase 3)
- [ ] Claude narration 7 파일 + Codex cross-validation 통과 (Phase 4)
- [ ] git-fried vs GitKraken 비교표 1 파일 (Phase 5)
- [ ] memory + obsidian + commit (Phase 6)

## 5. Effort (사이즈)

§ Time Estimation Restraint 적용 — 시간 환산 X. 사이즈:

| Phase | 사이즈 |
| --- | --- |
| Phase 0 환경 준비 | XS |
| Phase 1 시나리오 enumerate | M (사용자 협업) |
| Phase 2 PoC | S |
| Phase 3 6 영역 확장 | L |
| Phase 4 narration + Codex | L |
| Phase 5 비교표 | M |
| Phase 6 memory + commit | XS |
| **합산** | **L+ (multi-session)** |

## 6. Next action

**Phase 0 의 첫 commit** (`feat(bench): AHK v2 portable + run-ahk2 wrapper — Plan #40 Phase 0`) 후 사용자에게 PoC (Phase 2) 진행 승인 받음.
