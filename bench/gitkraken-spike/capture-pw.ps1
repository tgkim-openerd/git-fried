# PrintWindow API capture — occlusion 무시, multi-monitor 안전.
# 메모리 [plan40 PoC v2.1] 의 "PrintWindow window-only" 기법.
#
# PW_RENDERFULLCONTENT (0x00000002) flag 로 Electron/Tauri 의 DWM 영역까지 render.
#
# Usage:
#   pwsh -File capture-pw.ps1 -ProcessName gitkraken -Label "C1-pw" -OutDir "..."

param(
    [Parameter(Mandatory=$true)][string]$ProcessName,
    [Parameter(Mandatory=$true)][string]$Label,
    [string]$OutDir = "docs/ux-eval/screenshots/cycle-2026-05-26"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not ('Native.PrintWin' -as [type])) {
    Add-Type -Namespace Native -Name PrintWin -MemberDefinition @'
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool PrintWindow(System.IntPtr hWnd, System.IntPtr hdcBlt, uint nFlags);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool GetWindowRect(System.IntPtr hWnd, out RECT lpRect);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(System.IntPtr hWnd);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
        public struct RECT { public int Left, Top, Right, Bottom; }
'@
}

$proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
    Where-Object { $psItem.MainWindowHandle -ne 0 } |
    Select-Object -First 1

if (-not $proc) {
    Write-Host "ERROR: No window for process '$ProcessName'"
    exit 1
}

$hwnd = $proc.MainWindowHandle
Write-Host "Found: PID=$($proc.Id) Title='$($proc.MainWindowTitle)' HWND=$hwnd"

# Restore + foreground (occlusion 보정용, PrintWindow 자체는 occlusion 무관)
[Native.PrintWin]::ShowWindow($hwnd, 9) | Out-Null
[Native.PrintWin]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 300

$rect = New-Object Native.PrintWin+RECT
[Native.PrintWin]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
Write-Host "Rect: ($($rect.Left),$($rect.Top)) ${w}x${h}"

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}

$timestamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$filename = "$ProcessName-$timestamp-$Label-pw.png"
$fullPath = Join-Path $OutDir $filename

$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()

# PW_RENDERFULLCONTENT = 0x00000002 (Windows 8+, DWM composition 영역)
$result = [Native.PrintWin]::PrintWindow($hwnd, $hdc, 2)

$g.ReleaseHdc($hdc)
$g.Dispose()

if (-not $result) {
    Write-Host "WARN: PrintWindow returned false — image may be blank"
}

$bmp.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Saved: $fullPath ($([math]::Round((Get-Item $fullPath).Length / 1KB, 1)) KB)"
