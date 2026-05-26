# Fully-autonomous window capture — process name + label.
#
# Usage:
#   pwsh -File capture-window.ps1 -ProcessName gitkraken -Label "01-baseline" -OutDir "docs/ux-eval/screenshots/cycle-2026-05-26"
#
# 결과: <OutDir>/<process>-<timestamp>-<label>.png

param(
    [Parameter(Mandatory=$true)][string]$ProcessName,
    [Parameter(Mandatory=$true)][string]$Label,
    [string]$OutDir = "docs/ux-eval/screenshots/cycle-2026-05-26",
    [int]$FocusDelayMs = 500
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not ('Native.Win32Cap' -as [type])) {
    Add-Type -Namespace Native -Name Win32Cap -MemberDefinition @'
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(System.IntPtr hWnd);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool GetWindowRect(System.IntPtr hWnd, out RECT lpRect);
        public struct RECT { public int Left, Top, Right, Bottom; }
'@
}

# Find process with MainWindowHandle
$proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
    Where-Object { $psItem.MainWindowHandle -ne 0 } |
    Select-Object -First 1

if (-not $proc) {
    Write-Host "ERROR: No window for process '$ProcessName'"
    exit 1
}

$hwnd = $proc.MainWindowHandle
Write-Host "Found: PID=$($proc.Id) Title='$($proc.MainWindowTitle)' HWND=$hwnd"

# Restore + bring to foreground
[Native.Win32Cap]::ShowWindow($hwnd, 9) | Out-Null  # SW_RESTORE
[Native.Win32Cap]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds $FocusDelayMs

# Get window rect
$rect = New-Object Native.Win32Cap+RECT
[Native.Win32Cap]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
Write-Host "Window rect: ($($rect.Left),$($rect.Top)) ${w}x${h}"

if ($w -le 0 -or $h -le 0) {
    Write-Host "ERROR: Invalid window size"
    exit 1
}

# Ensure outdir
if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}

$timestamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$filename = "$ProcessName-$timestamp-$Label.png"
$fullPath = Join-Path $OutDir $filename

$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
$bmp.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Host "Saved: $fullPath ($([math]::Round((Get-Item $fullPath).Length / 1KB, 1)) KB)"
