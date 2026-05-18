# Plan #40 Phase 0 — AHK v2 portable script runner
#
# 사용법:
#   pwsh -NoProfile -File scripts/run-ahk2.ps1 -Script bench/gitkraken-spike/hello.ahk2
#   pwsh -NoProfile -File scripts/run-ahk2.ps1 -Script <path> -TimeoutSec 30 -Wait
#
# 동작:
#   1. bench/gitkraken-spike/ahk-v2/AutoHotkey64.exe 존재 확인
#   2. 지정 script 파일 absolute path 검증
#   3. exec + timeout 적용
#   4. exit code 그대로 전파

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Script,

    [int]$TimeoutSec = 30,

    [switch]$Wait
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$ahkExe = Join-Path $repoRoot 'bench\gitkraken-spike\ahk-v2\AutoHotkey64.exe'
$scriptAbs = if ([System.IO.Path]::IsPathRooted($Script)) { $Script } else { Join-Path $repoRoot $Script }

if (-not (Test-Path $ahkExe)) {
    Write-Error "AHK v2 binary not found: $ahkExe. Run Phase 0 download step first."
    exit 2
}

if (-not (Test-Path $scriptAbs)) {
    Write-Error "Script not found: $scriptAbs"
    exit 2
}

Write-Output "[run-ahk2] exe : $ahkExe"
Write-Output "[run-ahk2] script: $scriptAbs"
Write-Output "[run-ahk2] timeout: ${TimeoutSec}s"

$proc = Start-Process -FilePath $ahkExe -ArgumentList @($scriptAbs) -PassThru -NoNewWindow

if ($Wait -or $true) {
    $exited = $proc.WaitForExit($TimeoutSec * 1000)
    if (-not $exited) {
        Write-Warning "[run-ahk2] timeout ${TimeoutSec}s exceeded — killing process $($proc.Id)"
        try { $proc.Kill() } catch {}
        exit 124
    }
    $code = $proc.ExitCode
    Write-Output "[run-ahk2] exit code: $code"
    exit $code
}
