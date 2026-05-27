# PoC v4 — AHK ImageSearch Anchor Toolchain (2026-05-27)

> Trigger: 2026-05-26 button matrix B17 cycle 에서 PowerShell SetCursorPos 좌표 추정만으로 commit row LMB 양쪽 모두 미선택 (working tree state 변화 없음 = click 좌표 부정확).
>
> 결정: 메모리 [plan40_complete] PoC v4 권고 5 항목 중 "image search anchor 도입" 별도 sprint 진입.
> 사용자 명시: "PoC v4 image search anchor toolchain 보강 (별도 sprint)" (2026-05-26).

## 문제 정의

매 button click 마다 image pixel → screen 좌표 변환 (window rect + image offset) 가 미세 차이로 row 미선택. 메모리 [plan40 phase2 poc] 의 누적 21% 오류율 패턴 재발 가능성.

해결: AHK 의 `ImageSearch` 로 anchor PNG 를 화면에서 검색 → 정확 좌표 반환 → Click. 좌표 추정 0% 의존, anchor 자체 capture 정확성 ↑.

## Toolchain 구성

### 1. Anchor PNG 라이브러리

```
bench/gitkraken-spike/anchors/
├── gitkraken-12.1.2/
│   ├── toolbar-pull-button.png
│   ├── toolbar-push-button.png
│   ├── toolbar-branch-button.png
│   ├── toolbar-stash-button.png
│   ├── sidebar-local-header.png
│   ├── sidebar-stashes-header.png
│   ├── sidebar-tags-header.png
│   ├── graph-wip-row-marker.png       # "// WIP" 텍스트 작은 fragment
│   ├── commit-row-marker.png           # commit row 의 lane node circle
│   ├── right-panel-stage-all-button.png
│   └── ...
├── git-fried-v0.3.0/
│   ├── toolbar-pull-button.png         # 한글 "Pull" 라벨
│   ├── sidebar-local-header.png        # "LOCAL (N)" 영역
│   ├── ...
└── README.md                            # anchor capture 방법론
```

각 anchor PNG = button 의 small unique fragment (예: 20x20 ~ 80x40 pixel). text label 만 + icon edge 정도 cover. 너무 작으면 false positive, 너무 크면 환경 차이 (theme/font/spacing 변동) 에 약함.

### 2. AHK ImageSearch Script

```ahk
; bench/gitkraken-spike/ahk-v2/imagesearch-click.ahk
; Usage: AutoHotkey64.exe imagesearch-click.ahk <anchor-png> [<button>]
#Requires AutoHotkey v2.0
#SingleInstance Force

anchor := A_Args[1]
button := A_Args.Length >= 2 ? A_Args[2] : "Left"

if !FileExist(anchor) {
    MsgBox("Anchor PNG 없음: " . anchor)
    ExitApp(1)
}

; Tolerance: *50 (RGB 50 까지 차이 허용), *Trans white (배경 무시) — DPI/anti-alias 보정
if !ImageSearch(&foundX, &foundY, 0, 0, A_ScreenWidth, A_ScreenHeight, "*50 " . anchor) {
    MsgBox("Anchor 못 찾음: " . anchor)
    ExitApp(2)
}

centerX := foundX + (anchorW := 40) // 2  ; anchor PNG 의 절반 (caller 가 명시)
centerY := foundY + (anchorH := 20) // 2

Click(centerX, centerY, button)
FileAppend("OK " . centerX . "," . centerY . "`n", "*")
ExitApp(0)
```

### 3. PowerShell Wrapper (Bash 환경 호출용)

```powershell
# bench/gitkraken-spike/click-by-anchor.ps1
# Usage: pwsh -File click-by-anchor.ps1 -Anchor "anchors/gitkraken-12.1.2/toolbar-pull-button.png" [-Button left|right]

param(
    [Parameter(Mandatory=$true)][string]$Anchor,
    [ValidateSet('left','right')][string]$Button = 'left'
)

$ahkExe = Join-Path $PSScriptRoot 'ahk-v2/AutoHotkey64.exe'
$ahkScript = Join-Path $PSScriptRoot 'ahk-v2/imagesearch-click.ahk'

$output = & $ahkExe $ahkScript $Anchor $Button 2>&1
Write-Host $output
exit $LASTEXITCODE
```

### 4. Anchor Capture Helper

```powershell
# bench/gitkraken-spike/capture-anchor.ps1
# Usage: pwsh -File capture-anchor.ps1 -ProcessName gitkraken -X 820 -Y 105 -W 30 -H 30 -Label "toolbar-pull-button"
# 캡처된 anchor PNG = anchors/<process>-<version>/<label>.png

param(
    [Parameter(Mandatory=$true)][string]$ProcessName,
    [Parameter(Mandatory=$true)][int]$X,
    [Parameter(Mandatory=$true)][int]$Y,
    [int]$W = 60,
    [int]$H = 30,
    [Parameter(Mandatory=$true)][string]$Label,
    [string]$AnchorDir = "bench/gitkraken-spike/anchors"
)

# 1. 양쪽 앱 fully focused + visible 확인 (사용자 책임)
# 2. Win32 GetWindowRect 로 base 좌표 + (X, Y) offset 으로 region capture
# 3. 결과: <AnchorDir>/<process>/<label>.png
# ...구현 생략 (capture-pw.ps1 의 region capture 확장)
```

## 진입 cycle (다음 sprint)

### Phase 1: Anchor library 초기화 (~M effort)
1. P1 Workspaces 의 가장 critical 12 button 의 anchor PNG capture
   - GitKraken: Pull / Push / Branch / Stash / LOCAL header / STASHES header / TAGS header / WIP row / commit row / Stage All / file row / Settings gear
   - git-fried: 동등 영역
2. 각 anchor 5~10x 검증 (false positive rate 측정)

### Phase 2: AHK ImageSearch script 검증 (~S effort)
1. 단일 anchor → Click → 결과 캡처 → 의도된 sub-screen 확인
2. tolerance (*50 ~ *80) 실측 조정

### Phase 3: button matrix BFS cycle (~XL effort, 다중 sprint)
1. TODO.md 의 B1~B32 priority 순회
2. 각 button: anchor click → 양쪽 캡처 → Codex Vision pair diff → finding fix
3. sub-screen (modal/context menu) 발생 시 BFS queue 에 push + 재귀
4. **사용자 안전**: test repo (`C:\Users\tgkim\test-gitkraken-vs-git-fried`) 만 사용 — 실 작업 repo 영향 X
5. **destructive button 우선순위 ↓**: delete / reset --hard 같은 destructive button 은 별도 cycle (사용자 명시 승인)

### Phase 4: 종료 조건
- BFS queue empty (모든 button + sub-screen cover)
- 새 finding 0 라운드 N=2 연속

## 종합 효과 측정 (cycle 진행 중 누적)

- finding 카운트 (HIGH/MED/LOW/intentional)
- fix 카운트 + 회귀 (vitest/cargo)
- Codex Vision 오류율 (Memory Rule 3 baseline 21% 대비 PoC v4 후 측정)
- anchor PNG hit rate

## 메모리 통합

PoC v4 완료 시:
- 메모리 sprint pointer 신규 (`sprint_2026_05_27_poc_v4.md`)
- 글로벌 toolkit 보강 후보 — `tooling/infra/desktop-app-ui-comparison-automation/skill.md`
  (AHK ImageSearch + anchor library + Codex Vision pair 패턴 = 재사용 가치)

## 본 sprint (2026-05-26) 의 진입점

본 PoC v4 plan 자체가 다음 sprint 의 진입점.
누적 commit: 3638319 (F3) + 80d3195 (E1+G2+A2) + 본 plan commit.
다음 sprint 시작 시: `bench/gitkraken-spike/anchors/` 디렉토리 신설 + Phase 1 부터.
