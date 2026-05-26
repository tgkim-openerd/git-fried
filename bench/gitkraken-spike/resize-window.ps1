# Window resize/move helper.
#
# Usage:
#   pwsh -File resize-window.ps1 -ProcessName git-fried -W 1920 -H 1080 -X 0 -Y 0

param(
    [Parameter(Mandatory=$true)][string]$ProcessName,
    [int]$X = 0,
    [int]$Y = 0,
    [int]$W = 1920,
    [int]$H = 1080
)

$ErrorActionPreference = 'Stop'

if (-not ('Native.Resize' -as [type])) {
    Add-Type -Namespace Native -Name Resize -MemberDefinition @'
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool MoveWindow(System.IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
'@
}

$proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
    Where-Object { $psItem.MainWindowHandle -ne 0 } |
    Select-Object -First 1

if (-not $proc) {
    Write-Host "ERROR: No window for '$ProcessName'"
    exit 1
}

$hwnd = $proc.MainWindowHandle
Write-Host "Resizing PID=$($proc.Id) Title='$($proc.MainWindowTitle)' HWND=$hwnd to ${W}x${H} at ($X,$Y)"

# Restore (in case minimized)
[Native.Resize]::ShowWindow($hwnd, 9) | Out-Null  # SW_RESTORE
[Native.Resize]::MoveWindow($hwnd, $X, $Y, $W, $H, $true) | Out-Null
Write-Host "Done"
