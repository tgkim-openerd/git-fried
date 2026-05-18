# Plan #40 Phase 3 — 6 영역 (+ overview) UI tour runner
#
# 사용법:
#   pwsh -NoProfile -File scripts/run-all-tours.ps1
#
# 동작:
#   1. 6 영역 + overview 7개 AHK script 순차 실행 (각 timeout 30s)
#   2. 각 script 결과 + PNG 카운트 통합 logging
#   3. 사용자 unattended ~2분 (각 영역 3-5초 카운트다운 + capture)

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$runAhk = Join-Path $repoRoot 'scripts\run-ahk2.ps1'

$tours = @(
    @{ Script = 'bench/gitkraken-spike/ui-tour/00-sidebar-overview.ahk2'; Name = '00 sidebar overview' }
    @{ Script = 'bench/gitkraken-spike/ui-tour/01-workspace.ahk2';        Name = '01 workspace' }
    @{ Script = 'bench/gitkraken-spike/ui-tour/02-graph.ahk2';            Name = '02 graph' }
    @{ Script = 'bench/gitkraken-spike/ui-tour/03-stash.ahk2';            Name = '03 stash' }
    @{ Script = 'bench/gitkraken-spike/ui-tour/04-tag.ahk2';              Name = '04 tag' }
    @{ Script = 'bench/gitkraken-spike/ui-tour/05-pr.ahk2';               Name = '05 pr' }
    @{ Script = 'bench/gitkraken-spike/ui-tour/06-worktree.ahk2';         Name = '06 worktree' }
)

Write-Output "=== Plan #40 Phase 3 — 7 UI tour 순차 실행 ==="
Write-Output "총 ~2분 소요. 각 영역 3-5초 카운트다운 + capture."
Write-Output ""

$results = @()
$startTime = Get-Date

foreach ($tour in $tours) {
    Write-Output ">>> $($tour.Name) start"
    $beforeCount = (Get-ChildItem 'docs/ux-eval/handson/screenshots/' -Filter '*.png' -ErrorAction SilentlyContinue).Count
    $proc = Start-Process -FilePath 'pwsh' -ArgumentList @('-NoProfile', '-File', $runAhk, '-Script', $tour.Script, '-TimeoutSec', '30') -PassThru -NoNewWindow -Wait
    $afterCount = (Get-ChildItem 'docs/ux-eval/handson/screenshots/' -Filter '*.png' -ErrorAction SilentlyContinue).Count
    $captured = $afterCount - $beforeCount
    $status = if ($proc.ExitCode -eq 0) { 'OK' } else { "FAIL exit=$($proc.ExitCode)" }
    Write-Output "<<< $($tour.Name): $status, captured=$captured PNG"
    $results += @{ Name = $tour.Name; ExitCode = $proc.ExitCode; Captured = $captured }
    Write-Output ""
}

$elapsed = (Get-Date) - $startTime
Write-Output "=== 총 소요: $($elapsed.TotalSeconds.ToString('F1'))s ==="
Write-Output ""
Write-Output "=== 결과 요약 ==="
$results | ForEach-Object {
    $emoji = if ($_.ExitCode -eq 0) { 'OK' } else { 'FAIL' }
    Write-Output ("  [{0}] {1}  captured={2}" -f $emoji, $_.Name, $_.Captured)
}
Write-Output ""
$totalCaptured = ($results | Measure-Object -Property Captured -Sum).Sum
$failed = ($results | Where-Object { $_.ExitCode -ne 0 }).Count
Write-Output "총 캡처 PNG: $totalCaptured"
Write-Output "실패: $failed / $($tours.Count)"

if ($failed -gt 0) { exit 1 }
exit 0
