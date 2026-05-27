# Fully-autonomous mouse click at screen coordinates after window focus.
# Bash $_ 함정 회피 — $psItem 사용.
#
# Usage:
#   pwsh -File click-at-coord.ps1 -ProcessName gitkraken -X 625 -Y 340 [-Button left|right] [-DoubleClick]

param(
    [Parameter(Mandatory=$true)][string]$ProcessName,
    [Parameter(Mandatory=$true)][int]$X,
    [Parameter(Mandatory=$true)][int]$Y,
    [ValidateSet('left','right')][string]$Button = 'left',
    [switch]$DoubleClick,
    [int]$FocusDelayMs = 400,
    [int]$AfterClickDelayMs = 500
)

$ErrorActionPreference = 'Stop'

if (-not ('Native.MouseSim' -as [type])) {
    Add-Type -Namespace Native -Name MouseSim -MemberDefinition @'
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool SetCursorPos(int X, int Y);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, System.UIntPtr dwExtraInfo);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(System.IntPtr hWnd);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool GetWindowRect(System.IntPtr hWnd, out RECT lpRect);
        public struct RECT { public int Left, Top, Right, Bottom; }
'@
}

$LMB_DOWN = [uint32]0x0002
$LMB_UP   = [uint32]0x0004
$RMB_DOWN = [uint32]0x0008
$RMB_UP   = [uint32]0x0010

$proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
    Where-Object { $psItem.MainWindowHandle -ne 0 } |
    Select-Object -First 1

if (-not $proc) {
    Write-Host "ERROR: No window for '$ProcessName'"
    exit 1
}

$hwnd = $proc.MainWindowHandle
[Native.MouseSim]::ShowWindow($hwnd, 9) | Out-Null  # SW_RESTORE
[Native.MouseSim]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds $FocusDelayMs

$rect = New-Object Native.MouseSim+RECT
[Native.MouseSim]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
Write-Host "Window: '$($proc.MainWindowTitle)' rect ($($rect.Left),$($rect.Top))-($($rect.Right),$($rect.Bottom))"
Write-Host "Target click: ($X, $Y) — ${Button}-click$(if ($DoubleClick) { ' x2' })"

[Native.MouseSim]::SetCursorPos($X, $Y) | Out-Null
Start-Sleep -Milliseconds 100

if ($Button -eq 'left') {
    $down = $LMB_DOWN; $up = $LMB_UP
} else {
    $down = $RMB_DOWN; $up = $RMB_UP
}

[Native.MouseSim]::mouse_event($down, 0, 0, 0, [System.UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[Native.MouseSim]::mouse_event($up, 0, 0, 0, [System.UIntPtr]::Zero)

if ($DoubleClick) {
    Start-Sleep -Milliseconds 80
    [Native.MouseSim]::mouse_event($down, 0, 0, 0, [System.UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [Native.MouseSim]::mouse_event($up, 0, 0, 0, [System.UIntPtr]::Zero)
}

Start-Sleep -Milliseconds $AfterClickDelayMs
Write-Host "Done"
