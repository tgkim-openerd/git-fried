# Window enumeration helper — Bash 의 $_ escape 함정 회피.
# Usage: powershell -NoProfile -File find-windows.ps1
Get-Process | Where-Object {
    $psItem.MainWindowTitle -match 'git-fried|GitKraken Desktop'
} | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | Format-Table -AutoSize -Wrap
