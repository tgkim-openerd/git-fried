# Performance bench — 메모리 snapshot (`docs/plan/20 §3-3`).
#
# Windows 전용 PowerShell. git-fried 프로세스의 RSS / Private / GDI 핸들을
# 시나리오별로 기록한다. 실측은 사용자가 직접 dogfood 시나리오를 진행하면서
# 프롬프트에 "준비 완료" 신호를 줘야 하는 반-자동 스크립트.
#
# 사용:
#   pwsh ./bench/memory.ps1
#   pwsh ./bench/memory.ps1 -LogPath ./bench/memory-baseline-2026-04-27.txt
#   pwsh ./bench/memory.ps1 -ProcessName git-fried-dev   # dev 모드 측정 시
#
# 결과 → bench/memory-baseline.txt (기본). baseline.json 에 직접 옮길 것.

param(
    [string] $LogPath      = './bench/memory-baseline.txt',
    [string] $ProcessName  = 'git-fried'
)

# 시나리오 — 사용자가 각 단계 끝나면 Enter. sleep 은 측정 직전 안정화 시간.
$scenarios = @(
    @{ Name = 'idle'         ; SleepSec = 30  ; Hint = '앱 시작, 레포 0개' },
    @{ Name = '1-repo'       ; SleepSec = 30  ; Hint = '본인 작은 repo 1개 open' },
    @{ Name = '5-repo'       ; SleepSec = 60  ; Hint = '워크스페이스에 5개 repo 추가, 모두 status 확인' },
    @{ Name = '50-repo'      ; SleepSec = 300 ; Hint = '회사 50+ repo 워크스페이스 활성, bulk_status 한 번' },
    @{ Name = 'graph-50k'    ; SleepSec = 60  ; Hint = '50k commit 합성 repo 의 그래프 끝까지 스크롤' },
    @{ Name = '8-worktree'   ; SleepSec = 120 ; Hint = '8 worktree 동시 fetch / status' }
)

if (-not (Test-Path -Path (Split-Path $LogPath -Parent))) {
    New-Item -ItemType Directory -Force -Path (Split-Path $LogPath -Parent) | Out-Null
}

"# git-fried 메모리 baseline ($([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')))" | Set-Content -Path $LogPath -Encoding utf8
"# host: $env:COMPUTERNAME / OS: $((Get-CimInstance Win32_OperatingSystem).Caption)" | Add-Content -Path $LogPath -Encoding utf8
"" | Add-Content -Path $LogPath -Encoding utf8

foreach ($s in $scenarios) {
    Write-Host ""
    Write-Host "▶ 시나리오: $($s.Name)" -ForegroundColor Cyan
    Write-Host "  $($s.Hint)" -ForegroundColor Gray
    Read-Host "  준비 완료되면 Enter"

    Write-Host "  안정화 대기 $($s.SleepSec)s..." -ForegroundColor Gray
    Start-Sleep -Seconds $s.SleepSec

    $proc = Get-Process $ProcessName -ErrorAction SilentlyContinue
    if (-not $proc) {
        Write-Warning "  $ProcessName 프로세스를 찾을 수 없습니다 — skip"
        continue
    }

    # 같은 이름의 자식 프로세스 (Tauri WebView2 등) 까지 합산.
    $rss     = [Math]::Round((($proc | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 1)
    $private = [Math]::Round((($proc | Measure-Object PrivateMemorySize64 -Sum).Sum) / 1MB, 1)
    $handles = ($proc | Measure-Object HandleCount -Sum).Sum

    $line = "{0,-12} RSS={1,7} MB  Private={2,7} MB  Handles={3,5}" -f $s.Name, $rss, $private, $handles
    Write-Host "  $line" -ForegroundColor Green
    $line | Add-Content -Path $LogPath -Encoding utf8
}

Write-Host ""
Write-Host "✅ 결과: $LogPath" -ForegroundColor Green
Write-Host "   baseline.json 의 memory_mb 섹션에 옮기세요." -ForegroundColor Gray
