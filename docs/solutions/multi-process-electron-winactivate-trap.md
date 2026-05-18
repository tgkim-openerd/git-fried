# Multi-process Electron desktop app — WinActivate hwnd selection 함정 + PrintWindow window-only 캡처

- **일시**: 2026-05-18 (Plan #40 Phase 2 PoC v1 → v2.1)
- **트리거**: GitKraken Desktop 12.1.1 (Electron 기반, 5 process 활성) 자동 제어 toolchain 첫 PoC
- **scope**: cross-project (Electron 기반 desktop app — GitKraken / VS Code / Slack / Discord / Notion / Figma desktop / Spotify) + Tauri multi-window + 일반 multi-process desktop GUI
- **toolkit sync 보류**: git-fried 측 우선 기록. `~/.claude/docs/solutions/` 측 sync 는 다음 session 첫 작업 (race condition 회피, [`multi-session-git-race-condition.md`](multi-session-git-race-condition.md) 참조)

## 증상

AHK v2 (또는 PowerShell/Win32 SendInput 동등) 로 Electron 기반 desktop app 을 자동 제어할 때:

1. **`WinExist("ahk_exe <name>.exe")`** 또는 동등한 hwnd 검색이 **main visible window 아닌 hidden helper window** 를 반환
2. `WinActivate` 성공 후 즉시 다른 app (Cursor / VS Code 같은 active IDE) 이 foreground 점유 회수
3. 자동 입력 (`Send "^,"`, mouse click) 이 의도된 app 이 아닌 **wrong app 에 전달**
4. 결과: 캡처 화면이 target app 이 아니거나 잘못된 app 의 settings 가 활성화됨

git-fried Plan #40 Phase 2 PoC v1 실측: `WinExist("ahk_exe gitkraken.exe")` 가 hwnd `8067510` 반환 → WinGetTitle = "GitKraken Desktop" 이지만 **실제 minimized 상태** (pos=-32000,-32000 / size 160x28 = Windows minimize sentinel). WinActivate 후 Cursor IDE 가 곧바로 foreground 회수 → `Ctrl+,` 가 Cursor Settings 트리거.

## 원인 (3 layer)

### Layer 1: Electron multi-process 의 hwnd 분포

Electron 기반 app 은 **5+ process** spawn:
- main process (renderer host)
- renderer process (BrowserWindow 별)
- GPU process
- utility process (network / audio / printing)
- crashpad helper

`tasklist | findstr <name>.exe` 가 5+ 행 반환. `WinGetList("ahk_exe <name>.exe")` 도 마찬가지로 각 process 의 window 후보 모두 enumerate — but **renderer process 의 main BrowserWindow hwnd 가 last-found 보장 X**.

### Layer 2: minimized window 의 sentinel position

Windows 의 minimized window 는 hwnd 유지하지만:
- position = `(-32000, -32000)` (사용자 화면 밖 sentinel)
- size = 통상 `160x28` (taskbar button 영역)
- `WinGetMinMax(hwnd)` = `-1`
- visible flag 는 여전히 true (taskbar 에 표시되니까)

따라서 `size ≥ 800x600` 같은 simple filter 가 minimized 거부 — 그러나 실제 사용 환경에서 GitKraken / Slack 같은 무거운 app 은 사용자가 **minimize 한 상태가 가장 흔함**.

### Layer 3: foreground 점유 회수 (focus stealing prevention)

Windows 의 SetForegroundWindow 는 ForegroundLockTimeout 이 있어 다른 process 의 강제 activate 를 차단. `WinActivate` 가 "성공" 으로 보고해도 actual active window 는 호출 직전 active app (사용자가 사용 중인 IDE 같은) 일 수 있음.

## 해결 (3-layer 대응)

### Step 1: WinGetList enumerate + main window 선별 휴리스틱

```autohotkey
FindMainWindow(processName, titleHint) {
    hwnds := WinGetList("ahk_exe " . processName)
    bestHwnd := 0
    bestArea := 0
    for hwnd in hwnds {
        try {
            title := WinGetTitle("ahk_id " . hwnd)
            mm := WinGetMinMax("ahk_id " . hwnd)
            x := 0, y := 0, w := 0, h := 0
            WinGetPos(&x, &y, &w, &h, "ahk_id " . hwnd)
            area := w * h
            ; title hint 매칭 + minimized 도 후보 (Restore 가 normalize)
            if (title != "" && InStr(title, titleHint)) {
                if (mm == -1 || area > bestArea) {
                    bestHwnd := hwnd
                    bestArea := mm == -1 ? -1 : area
                }
            }
        } catch {
            ; ignore
        }
    }
    return bestHwnd
}
```

핵심:
- title hint 로 hidden helper window 제외 (GPU/utility process 는 보통 title 비어있음)
- minimized 도 후보 — area 비교 회피, 첫 매치를 best 로
- normal/maximized 는 area 큰 것 우선 (multi-window 의 main 식별)

### Step 2: WinRestore + WinActivate + active 재확인

```autohotkey
if (WinGetMinMax("ahk_id " . hwnd) == -1) {
    WinRestore("ahk_id " . hwnd)
    Sleep 500  ; restore transition
}
WinActivate("ahk_id " . hwnd)
WinWaitActive("ahk_id " . hwnd, , 5)
Sleep 1200  ; foreground 정착

; active 재확인 — Cursor / IDE 의 foreground 회수 detect
activeHwnd := WinGetID("A")
if (activeHwnd != hwnd) {
    ; fail fast — focus stolen
    return false
}
```

### Step 3: PrintWindow Win32 API 로 window-only 캡처

`CopyFromScreen` (full monitor) 대신 `PrintWindow` 사용:

```powershell
Add-Type @"
using System.Runtime.InteropServices;
public class PrintWindowHelper {
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(System.IntPtr hWnd, System.IntPtr hdcBlt, uint nFlags);
}
"@
# PW_RENDERFULLCONTENT = 0x00000002 (Win10 1903+ DWM-composited capture)
[PrintWindowHelper]::PrintWindow($hwndPtr, $hdc, 0x00000002)
```

장점:
- multi-monitor 무관 (target window 의 좌표 자동 추적)
- DPI 무관 (PrintWindow 가 정상 픽셀 좌표 사용)
- occlusion 무관 (다른 window 가 가려도 PrintWindow 가 원본 content 그림)
- background app 의 화면도 추출 가능 (focus 없어도)

단점:
- 일부 GPU-accelerated content (WebGL, video) 가 검은 박스로 나올 수 있음 (PW_RENDERFULLCONTENT flag 가 Win10 1903+ 에서 DWM 추출 시도, but 일부 Electron 의 hardware-accelerated rendering 영역 제외 가능)
- Electron BrowserWindow 의 GPU compositing 영역은 검증 필요

## 검증 환경

- OS: Windows 11 Pro 10.0.26200
- AHK: v2.0.26 portable (admin 권한 없음)
- target: GitKraken Desktop 12.1.1 (Electron, 5 process)
- 화면: 2560×1440 @ 96 DPI
- 검증 시나리오: SC-07-1 (Settings 모달 진입, Ctrl+,)

PoC v1 (size filter only) → exit 10 "No suitable" (minimized 상태에서 GitKraken main 식별 실패)
PoC v2 (size filter 만 보강) → exit 10 동일 (filter 거부)
PoC v2.1 (title hint + minimized 후보) → exit 0, Settings UI 정확 캡처

캡처 결과: `docs/ux-eval/handson/screenshots/20260518-173430-07-settings-v2-after.png` (Codex cross-validation 통과 — 17 단정 중 14 CONFIRMED).

## 적용 범위

| App | Process 수 (대략) | title 패턴 | hotkey |
| --- | --- | --- | --- |
| GitKraken Desktop | 5+ | "GitKraken" | Ctrl+, (Settings) |
| VS Code (Electron) | 3+ | "Visual Studio Code" | Ctrl+, |
| Cursor (VS Code fork) | 3+ | "Cursor" | Ctrl+, |
| Slack Desktop | 4+ | "Slack" | Ctrl+, |
| Discord | 3+ | "Discord" | Ctrl+, |
| Notion Desktop | 3+ | "Notion" | Ctrl+, |
| Figma Desktop | 3+ | "Figma" | Ctrl+, |
| Tauri multi-window | (build 별) | (사용자 정의 title) | (사용자 정의) |

## 회피 / 대안

- **Playwright Electron `_electron.launch()`** — DOM 접근 가능 (focus 문제 없음). 단 Electron 의 `contextIsolation: true` + `nodeIntegration: false` + `sandbox: true` + 라이선스 인증 차단 시 실패 (GitKraken 의 경우 차단).
- **Microsoft UI Automation API (`Inspect.exe` accessibility tree)** — UIA 가 BrowserWindow 내부 Chrome accessibility tree 노출 시 element 단위 접근. 단 Electron `contextIsolation` 영향 + accessibility 활성 필요.
- **녹화 기반 (Power Automate Desktop, SikuliX)** — image matching + click 좌표 기록 / 재생. fragility 동일하나 진입장벽 낮음.

## 관련

- [Plan #40 — GitKraken AutoHotkey v2 자동 제어 UI Tour](../plan/40-gitkraken-ahk-handson.md)
- [Multimodal Vision Cross-Validation 5 Rule false positive](multimodal-vision-cross-validation-false-positive.md) — Memory Rule 3 의 baseline (단독 vision 35% 오류율)
- [Multi-session git race condition](multi-session-git-race-condition.md) — toolkit sync 보류 패턴

## 학습

1. **multi-process desktop app 자동 제어는 single-process app 과 다른 protocol** — WinExist 단독 신뢰 금지, WinGetList enumerate + filter 필수
2. **minimized window 가 일반적 사용 상태** — filter 가 size 거부하면 main 사용 환경 차단
3. **foreground 회수 detect** — WinGetID("A") 재확인이 silent failure 방지
4. **PrintWindow > CopyFromScreen** — multi-monitor / DPI / occlusion 무관 (target hwnd 기준)
5. **PoC 부터 실측**: v1 의 size filter 결함은 spec 문서로 발견 불가 — 실제 사용자 환경 (minimized) 에서 즉시 표면화
