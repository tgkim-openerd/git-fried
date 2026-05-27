# Session cleanup - git-fried tauri:dev background processes
# GitKraken preserved (user own).
# Usage: pwsh -File session-cleanup.ps1

$ErrorActionPreference = 'Continue'

$gitFried = Get-Process -Name 'git-fried' -ErrorAction SilentlyContinue
if ($gitFried) {
    Write-Host "Stopping git-fried PID $($gitFried.Id)"
    Stop-Process -Id $gitFried.Id -Force -ErrorAction SilentlyContinue
}

$cargoProcs = Get-Process -Name 'cargo' -ErrorAction SilentlyContinue
foreach ($p in $cargoProcs) {
    Write-Host "Stopping cargo PID $($p.Id)"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}

# bun / node - only those running tauri/vite/git-fried (preserve other work)
$bunProcs = Get-CimInstance Win32_Process -Filter "Name = 'bun.exe'" -ErrorAction SilentlyContinue
foreach ($b in $bunProcs) {
    $cmdLine = $b.CommandLine
    if ($cmdLine -and ($cmdLine -match 'tauri|vite|git-fried|01\.Work')) {
        Write-Host "Stopping bun PID $($b.ProcessId)"
        Stop-Process -Id $b.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

$nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
foreach ($n in $nodeProcs) {
    $cmdLine = $n.CommandLine
    if ($cmdLine -and ($cmdLine -match 'tauri|vite|git-fried|01\.Work')) {
        Write-Host "Stopping node PID $($n.ProcessId)"
        Stop-Process -Id $n.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Milliseconds 500

$remaining = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $psItem.Name -match '^(git-fried|cargo)$'
}
if ($remaining) {
    Write-Host "Remaining git-fried/cargo:"
    $remaining | Format-Table Id, Name, MainWindowTitle -AutoSize
} else {
    Write-Host "OK: git-fried and cargo all stopped"
}
