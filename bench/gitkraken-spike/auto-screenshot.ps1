# GitKraken UI/UX 흡수 — 자동 스크린샷 toolchain (Sprint c95+, 2026-05-18)
#
# 사용법:
#   pwsh -File bench/gitkraken-spike/auto-screenshot.ps1
#
# 워크플로우:
#   1. GitKraken Desktop 띄우고 git-fried 같은 repo open
#   2. 본 script 실행
#   3. 사용자가 GitKraken 의 UI 조작 (hover / 우클릭 / dblclick / drag&drop)
#   4. 캡처할 상태 도달 → 본 script 의 콘솔에 "영역 라벨" 입력 + ENTER
#      (예: "sidebar-branch-hover-tooltip" / "ctx-menu-local-branch" / "drag-merge-confirm")
#   5. 2초 후 자동 캡처 (사용자가 GitKraken focus 로 돌아갈 시간)
#   6. Q + ENTER → 종료
#
# 출력:
#   docs/ux-eval/screenshots/gitkraken-{timestamp}-{label}.png
#
# 영역 라벨 컨벤션 (microdiff backlog 매칭 용):
#   - sidebar-*       : 사이드바 micro-detail (SB-001~051)
#   - ctx-menu-*      : 우클릭 메뉴 (branch / remote / tag / stash / submodule / pr / worktree)
#   - drag-*          : drag&drop 동작
#   - hover-*         : hover popover / tooltip
#   - dblclick-*      : 더블클릭 동작
#   - empty-*         : 빈 상태 / 로딩
#   - error-*         : 에러 상태
#   - keyboard-*      : 키보드 nav

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Win32 API — GitKraken window foreground bring + window-specific 캡처 (multi-monitor 대응)
if (-not ('Native.Win32Capture' -as [type])) {
    Add-Type -Namespace Native -Name Win32Capture -MemberDefinition @'
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(System.IntPtr hWnd);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool GetWindowRect(System.IntPtr hWnd, out RECT lpRect);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool IsIconic(System.IntPtr hWnd);
        public struct RECT { public int Left, Top, Right, Bottom; }
'@
}

# Capture mode 결정 — virtual (전체 모니터) 또는 window (GitKraken main window 만)
$CaptureMode = $env:GKSPIKE_CAPTURE_MODE
if ([string]::IsNullOrEmpty($CaptureMode)) { $CaptureMode = 'window' }  # default 'window'

$ScreenshotDir = Join-Path (Resolve-Path "$PSScriptRoot\..\..\docs\ux-eval\screenshots") ''
if (-not (Test-Path $ScreenshotDir)) {
    New-Item -ItemType Directory -Force -Path $ScreenshotDir | Out-Null
}

# 진행 누적 (세션 동안 캡처한 라벨 모두)
$SessionLog = @()

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host " GitKraken UI/UX 흡수 — 자동 스크린샷 toolchain " -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  저장 위치: $ScreenshotDir" -ForegroundColor Gray
Write-Host "  Capture mode: $CaptureMode  (env GKSPIKE_CAPTURE_MODE=virtual|window 변경)" -ForegroundColor Gray
Write-Host ""

# GitKraken main window detect — multi-process 중 MainWindowTitle 매칭
$gkProc = Get-Process -Name 'gitkraken' -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*GitKraken*' -or $_.MainWindowTitle -like '*Kraken*' } |
    Select-Object -First 1

if ($gkProc) {
    Write-Host "  GitKraken main window 검출: PID $($gkProc.Id) — '$($gkProc.MainWindowTitle)' (HWND $($gkProc.MainWindowHandle))" -ForegroundColor Green
    $gkHwnd = $gkProc.MainWindowHandle
    # 위치 확인
    $rect = New-Object Native.Win32Capture+RECT
    [void][Native.Win32Capture]::GetWindowRect($gkHwnd, [ref]$rect)
    Write-Host "  Window bounds: L=$($rect.Left) T=$($rect.Top) R=$($rect.Right) B=$($rect.Bottom) (W=$($rect.Right-$rect.Left), H=$($rect.Bottom-$rect.Top))" -ForegroundColor DarkGray
} else {
    Write-Host "  ⚠ GitKraken 메인 윈도우 감지 실패 — virtual screen mode 로 강제 fallback" -ForegroundColor Yellow
    $gkHwnd = $null
    $CaptureMode = 'virtual'
}

Write-Host ""
Write-Host "사용법:" -ForegroundColor Yellow
Write-Host "  - GitKraken 에서 캡처할 상태 도달"
Write-Host "  - 본 콘솔에 영역 라벨 입력 + ENTER (예: sidebar-branch-hover)"
Write-Host "  - 2초 후 자동 캡처 (mode=$CaptureMode: window=GitKraken 만, virtual=모든 모니터)"
Write-Host "  - Q + ENTER → 종료 + 세션 요약"
Write-Host ""
Write-Host "라벨 prefix 컨벤션:" -ForegroundColor Yellow
Write-Host "  sidebar-* / ctx-menu-* / drag-* / hover-* / dblclick-* / empty-* / error-* / keyboard-* / state-*"
Write-Host ""

while ($true) {
    $label = Read-Host "[캡처할 영역 라벨 입력 (Q=종료)]"
    if ($label -match '^[qQ]$') {
        break
    }
    if ([string]::IsNullOrWhiteSpace($label)) {
        Write-Host "  (빈 라벨 — skip)" -ForegroundColor DarkYellow
        continue
    }

    # 라벨 sanitize (파일명 안전)
    $safeLabel = $label -replace '[^a-zA-Z0-9_-]', '-' -replace '-+', '-'

    # GitKraken foreground bring (window mode 시) — 사용자가 console 입력하느라 focus 잃었을 가능성
    if ($gkHwnd -and $CaptureMode -eq 'window') {
        # IsIconic = minimized 이면 restore
        if ([Native.Win32Capture]::IsIconic($gkHwnd)) {
            [void][Native.Win32Capture]::ShowWindow($gkHwnd, 9)  # SW_RESTORE
        }
        [void][Native.Win32Capture]::SetForegroundWindow($gkHwnd)
    }
    Write-Host "  GitKraken focus 로 전환 중... 2초 후 캡처" -ForegroundColor DarkCyan
    Start-Sleep -Seconds 2

    $ts = Get-Date -Format 'yyyy-MM-dd-HHmmss'
    $filename = "gitkraken-$ts-$safeLabel.png"
    $fullPath = Join-Path $ScreenshotDir $filename

    try {
        if ($CaptureMode -eq 'window' -and $gkHwnd) {
            # Window-specific 캡처 — multi-monitor 무관, GitKraken 영역만
            $rect = New-Object Native.Win32Capture+RECT
            [void][Native.Win32Capture]::GetWindowRect($gkHwnd, [ref]$rect)
            $w = $rect.Right - $rect.Left
            $h = $rect.Bottom - $rect.Top
            if ($w -le 0 -or $h -le 0) { throw "Invalid window bounds: ${w}x${h}" }
            $bitmap = New-Object System.Drawing.Bitmap($w, $h)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
        } else {
            # Virtual screen 캡처 — 모든 모니터 합친 영역 (multi-monitor 대응)
            $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
            $bitmap = New-Object System.Drawing.Bitmap($vs.Width, $vs.Height)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($vs.X, $vs.Y, 0, 0, $bitmap.Size)
        }
        $bitmap.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()

        $SessionLog += [PSCustomObject]@{
            Label = $safeLabel
            Filename = $filename
            Timestamp = $ts
            SizeKB = [math]::Round((Get-Item $fullPath).Length / 1KB, 1)
        }

        Write-Host "  ✓ saved: $filename ($([math]::Round((Get-Item $fullPath).Length / 1KB, 1)) KB)" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ 캡처 실패: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# 세션 종료 — 요약 출력 + manifest 생성
Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host " 세션 종료 — 캡처 요약" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  총 캡처: $($SessionLog.Count) 장" -ForegroundColor White

if ($SessionLog.Count -gt 0) {
    Write-Host ""
    Write-Host "캡처 목록:" -ForegroundColor Yellow
    $SessionLog | Format-Table -AutoSize | Out-String | Write-Host

    # Manifest JSON 생성 (Claude 가 read 해서 분석 batch 처리 가능)
    $manifestPath = Join-Path $ScreenshotDir "session-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').json"
    $SessionLog | ConvertTo-Json -Depth 3 | Out-File -FilePath $manifestPath -Encoding utf8
    Write-Host "  Manifest: $manifestPath" -ForegroundColor Gray
}

Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "  1. Claude Code 세션에서 캡처 파일 분석 요청"
Write-Host "  2. docs/ux-eval/2026-XX-XX-gitkraken-hands-on-{영역}.md 보고서 생성"
Write-Host "  3. microdiff backlog (SB-XXX) 와 매칭 + git-fried 코드 fix"
Write-Host ""
