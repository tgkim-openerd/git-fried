# Plan #40 Phase 2 — Screen / Window capture helper
#
# 사용법:
#   pwsh -NoProfile -File capture-screen.ps1 -Label "label"                    # primary monitor 전체
#   pwsh -NoProfile -File capture-screen.ps1 -Label "label" -Monitor 1         # 보조 monitor
#   pwsh -NoProfile -File capture-screen.ps1 -Label "label" -Hwnd 0x7B0234     # 특정 window only (multi-monitor 무관)
#
# 동작:
#   - -Hwnd: PrintWindow Win32 API 로 그 window 만 캡처 (background occlusion 무관)
#   - -Monitor: System.Windows.Forms.Screen primary/secondary 캡처
#   - PNG → {OutDir}/{TIMESTAMP}-{LABEL}.png

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Label,

    [string]$OutDir = 'docs/ux-eval/handson/screenshots',

    [int]$Monitor = 0,

    [string]$Hwnd = ''
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outAbs = if ([System.IO.Path]::IsPathRooted($OutDir)) { $OutDir } else { Join-Path $repoRoot $OutDir }

if (-not (Test-Path $outAbs)) {
    New-Item -ItemType Directory -Path $outAbs -Force | Out-Null
}

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$safeLabel = $Label -replace '[^a-zA-Z0-9_-]', '_'
$fileName = "$ts-$safeLabel.png"
$outPath = Join-Path $outAbs $fileName

if ($Hwnd) {
    # Window-specific capture via PrintWindow Win32 API
    Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
public class PrintWindowHelper {
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@ -ErrorAction SilentlyContinue

    $hwndInt = if ($Hwnd.StartsWith('0x')) { [Convert]::ToInt64($Hwnd, 16) } else { [int64]$Hwnd }
    $hwndPtr = [IntPtr]::new($hwndInt)

    if (-not [PrintWindowHelper]::IsWindow($hwndPtr)) {
        Write-Error "Invalid hwnd: $Hwnd"
        exit 3
    }

    $rect = New-Object PrintWindowHelper+RECT
    [PrintWindowHelper]::GetWindowRect($hwndPtr, [ref]$rect) | Out-Null
    $w = $rect.Right - $rect.Left
    $h = $rect.Bottom - $rect.Top
    if ($w -le 0 -or $h -le 0) {
        Write-Error "Window has zero/negative size: ${w}x${h}"
        exit 4
    }

    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    # PW_RENDERFULLCONTENT = 0x00000002 (Win10 1903+ — 정확한 DWM-composited capture)
    [PrintWindowHelper]::PrintWindow($hwndPtr, $hdc, 0x00000002) | Out-Null
    $g.ReleaseHdc($hdc)
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()

    Write-Output "[capture-screen] saved (window): $outPath"
    Write-Output "[capture-screen] hwnd: $Hwnd size: ${w}x${h} at ($($rect.Left),$($rect.Top))"
} else {
    # Full monitor capture
    $screens = [System.Windows.Forms.Screen]::AllScreens
    if ($Monitor -ge $screens.Count) {
        Write-Error "Monitor index $Monitor out of range (have $($screens.Count) screens)"
        exit 2
    }

    $screen = if ($Monitor -eq 0) {
        [System.Windows.Forms.Screen]::PrimaryScreen
    } else {
        $screens[$Monitor]
    }

    $bounds = $screen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()

    Write-Output "[capture-screen] saved (monitor): $outPath"
    Write-Output "[capture-screen] size: $($bounds.Width)x$($bounds.Height) @ monitor $Monitor"
}

$fileInfo = Get-Item $outPath
Write-Output "[capture-screen] file size: $($fileInfo.Length) bytes"
exit 0
