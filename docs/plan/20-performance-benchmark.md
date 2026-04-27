# 20. Performance benchmark + baseline 측정 plan

작성: 2026-04-27 / 트리거: v1.0 출시 직전 / 사용자 본인 50+ 레포 환경에서 체감 성능 검증 시점

> **목적**: git-fried 가 plan §1 의 "Tauri 1/8 메모리, ~50MB" 약속을 정량 검증. 50k commit 그래프 / 큰 diff / 다중 repo 워크스페이스 / 8 worktree 동시 사용 시 메모리 / 응답 시간 / IPC throughput 을 baseline 으로 기록 + 회귀 차단 기준 마련.
>
> **연계**: [01 positioning](./01-why-and-positioning.md) §2 약점 ④ Electron 무거움, [06 risks](./06-risks-and-pitfalls.md) R4 libgit2 거대 레포 성능, [04 tech-architecture](./04-tech-architecture.md) §3 한글 spawn / 하이브리드 read=git2 / heavy=CLI.

---

## 1. 30초 요약

| 카테고리 | 측정 | 목표 |
| --- | --- | --- |
| **idle 메모리** | 1 repo / 5 repo / 50 repo | ≤ 80MB / 150MB / 300MB |
| **그래프 렌더** | 1k / 10k / 50k commit | ≤ 100ms / 500ms / 2s |
| **status / log** | 50+ 레포 환경 active repo | ≤ 200ms / 500ms |
| **diff** | 1MB / 10MB | ≤ 200ms / 1s |
| **AI subprocess (Claude)** | commit message 생성 | ≤ 5s end-to-end |
| **IPC throughput** | bulk_fetch 50 repo | ≤ 30s wall (병렬) |
| **worktree 8개 동시** | 메모리 증가 | +50MB 이내 |

→ baseline 등록 후 모든 PR 에서 `+20%` 이내 회귀 차단 (06 plan 정합).

**작업량**: M (~6h) — bench 도구 작성 + 1차 측정 + REVIEW 통합.

---

## 2. 측정 대상 (8 카테고리)

### 2-1. 메모리 baseline

| 시나리오 | 측정 지점 | 목표 |
| --- | --- | --- |
| **idle (앱 시작 직후, 0 repo)** | 30초 후 RSS | ≤ 80MB |
| **1 repo open** (사용자 본인 작은 repo) | 30초 후 RSS | ≤ 110MB |
| **5 repo workspace** (동시 status / fetch) | 1분 후 RSS | ≤ 150MB |
| **50 repo workspace** (회사 환경) | 5분 후 RSS | ≤ 300MB |
| **8 worktree 동시** (Agent 모드 시뮬레이션) | 5분 후 RSS | +50MB 이내 |
| **그래프 50k commit 렌더 후** | 그래프 스크롤 1분 후 | +30MB 이내 |

**측정 도구**: Windows Task Manager (Working Set 메모리) 또는 PowerShell `Get-Process git-fried | Select-Object WorkingSet64`. 다음 명령:

```powershell
# bench script
$proc = Get-Process git-fried -ErrorAction SilentlyContinue
if ($proc) {
  Write-Output "RSS: $([Math]::Round($proc.WorkingSet64 / 1MB, 1)) MB"
  Write-Output "Private: $([Math]::Round($proc.PrivateMemorySize64 / 1MB, 1)) MB"
}
```

GitKraken 비교: 200~300MB idle (plan §2-④). git-fried 목표 = **1/3 ~ 1/4**.

### 2-2. 그래프 렌더 시간

| 입력 | 측정 | 목표 |
| --- | --- | --- |
| 1k commits | 첫 렌더 (Canvas paint 완료) | ≤ 100ms |
| 10k commits | 첫 렌더 | ≤ 500ms |
| 50k commits | 첫 렌더 (가상 스크롤 가정) | ≤ 2s |
| 50k 의 검색 (`⌘F`) | 첫 결과 highlight | ≤ 200ms |
| Hide 토글 → dim 재페인트 | 30 viewport rows | ≤ 16ms (60fps) |

**측정 방식**: `performance.now()` `paintStart` ~ `paintEnd` 차. CommitGraph.vue 의 `drawGraph()` 시작/종료에 console.time / timeEnd.

**테스트 데이터**:
- 작은: gist-broadcenter (사용자 본인 repo, 약 500 commits)
- 중간: catholic-erp (657 commits, plan §02 측정 기준)
- **큰: 합성 50k commits repo** — `seq 50000 | xargs -I {} git commit --allow-empty -m "{}"` (시간 30분~)

### 2-3. status / log / branch 응답

| 명령 | 측정 | 목표 |
| --- | --- | --- |
| `get_status` (clean repo) | IPC end-to-end | ≤ 50ms |
| `get_status` (200 modified files) | | ≤ 200ms |
| `get_log` 1000 commits | | ≤ 500ms |
| `list_branches` (50 branches) | | ≤ 100ms |
| `get_diff` 1MB diff | | ≤ 200ms |
| `get_diff` 10MB diff | | ≤ 1s |

**측정**: Rust `tracing::info!` + `Instant::now()` 차이. dev mode 와 release mode 따로.

### 2-4. AI subprocess 응답

| 명령 | 측정 | 목표 |
| --- | --- | --- |
| Claude CLI commit message (staged 100KB) | end-to-end | ≤ 5s |
| Claude CLI PR body (10 commit) | | ≤ 8s |
| Claude CLI conflict resolve (1 hunk) | | ≤ 6s |
| Codex CLI commit message | | ≤ 5s |
| 첫 호출 (CLI cold start) | +overhead | ≤ +3s |

**측정**: `ai/runner.rs` 의 spawn ~ 응답 종료 시간. 사용자 인증 cache hit 가정.

### 2-5. IPC throughput

| 시나리오 | 측정 | 목표 |
| --- | --- | --- |
| `bulk_fetch` 50 repo (병렬 8) | wall clock | ≤ 30s |
| `bulk_status` 50 repo | | ≤ 5s |
| `bulk_list_prs` 50 repo (Forge API 의존) | | ≤ 10s |

**측정**: 사용자 환경의 50+ 회사 Gitea 레포 (`D:\01.Work\01.Projects`).

### 2-6. 그래프 가상 스크롤

| 동작 | 측정 | 목표 |
| --- | --- | --- |
| 50k commits 그래프 위/아래 스크롤 | drawGraph() 호출 빈도 | ≤ 16ms/frame |
| Search highlight | dim 재페인트 시간 | ≤ 16ms |

**측정**: Chrome DevTools Performance recording (Tauri WebView2 도 동일 도구 사용 가능).

### 2-7. 디스크 / SQLite

| 동작 | 측정 | 목표 |
| --- | --- | --- |
| 50 레포 `add_repo` (워크스페이스 생성) | wall clock | ≤ 5s |
| `list_workspaces` (cold start) | | ≤ 50ms |
| Migration 0001~0004 적용 (첫 시작) | | ≤ 200ms |
| `repo_ref_hidden` 1000 row 조회 | | ≤ 30ms |

**측정**: sqlx 의 query timing.

### 2-8. 한글 안전 round-trip 회귀

| 시나리오 | 검증 | 목표 |
| --- | --- | --- |
| 한글 commit message 100자 commit → log → 표시 | 정확 일치 | 100% |
| 한글 ref name `feature/한글` 생성 → list → switch | 정확 일치 | 100% |
| 한글 PR body Gitea POST → GET | 정확 일치 | 100% |
| chcp 949 / 65001 양쪽에서 동일 | | 100% |

→ 정성적 검증 (cargo test 의 unit / integration 으로 자동화 가능).

---

## 3. Bench 도구 작성

### 3-1. Rust bench (`apps/desktop/src-tauri/benches/`)

`Cargo.toml` 에 `[[bench]]` 추가:

```toml
[[bench]]
name = "git_perf"
harness = false
```

`benches/git_perf.rs`:

```rust
use criterion::{criterion_group, criterion_main, Criterion};
use git_fried_lib::git;

fn bench_status(c: &mut Criterion) {
    let repo = std::env::var("BENCH_REPO").unwrap_or("/tmp/test-repo".into());
    c.bench_function("status_clean", |b| {
        b.iter(|| git::status::get_status(&repo))
    });
}

fn bench_log(c: &mut Criterion) {
    let repo = std::env::var("BENCH_REPO").unwrap();
    c.bench_function("log_1000", |b| {
        b.iter(|| git::commit::get_log(&repo, 1000, None))
    });
}

criterion_group!(benches, bench_status, bench_log);
criterion_main!(benches);
```

실행: `BENCH_REPO=/path/to/repo cargo bench`.

### 3-2. Frontend bench (Playwright 또는 Puppeteer)

```ts
// apps/desktop/__tests__/perf/graph.bench.ts
import { test, expect } from 'vitest'

test('graph 50k commits first paint', async () => {
  // mock 50k commits via fixture
  const t0 = performance.now()
  const { drawGraph } = await import('../../src/utils/graphRender')
  await drawGraph(largeFixture)
  const elapsed = performance.now() - t0
  expect(elapsed).toBeLessThan(2000)
})
```

### 3-3. Memory snapshot script

```powershell
# bench/memory.ps1
param([string]$LogPath = "bench/memory-baseline.txt")

$scenarios = @(
  @{name='idle'; sleep=30},
  @{name='1-repo'; sleep=30},
  @{name='5-repo'; sleep=60},
  @{name='50-repo'; sleep=300}
)

foreach ($s in $scenarios) {
  Read-Host "다음 시나리오: $($s.name) — 준비 후 Enter"
  Start-Sleep -Seconds $s.sleep
  $proc = Get-Process git-fried -ErrorAction SilentlyContinue
  if ($proc) {
    $rss = [Math]::Round($proc.WorkingSet64 / 1MB, 1)
    "$($s.name): $rss MB" | Add-Content $LogPath
  }
}
```

---

## 4. baseline 등록 + 회귀 차단

### 4-1. 결과 저장

`bench/baseline.json`:

```json
{
  "version": "0.3.0",
  "measured_at": "2026-04-27",
  "memory_mb": {
    "idle": 75,
    "1_repo": 105,
    "5_repo": 145,
    "50_repo": 285,
    "8_worktree": 320
  },
  "graph_render_ms": {
    "1k": 85,
    "10k": 420,
    "50k": 1800,
    "search_50k": 175,
    "dim_repaint": 12
  },
  "ipc_ms": {
    "status_clean": 35,
    "status_200_modified": 180,
    "log_1000": 380,
    "list_branches_50": 75,
    "diff_1mb": 165,
    "diff_10mb": 920
  },
  "ai_seconds": {
    "claude_commit_msg": 4.2,
    "claude_pr_body": 6.8,
    "claude_conflict": 5.5
  },
  "bulk_seconds": {
    "fetch_50_repo": 24,
    "status_50_repo": 4.2,
    "list_prs_50_repo": 7.8
  }
}
```

### 4-2. CI 회귀 차단

GitHub Actions 의 `release.yml` 에 추가:

```yaml
- name: Performance regression check
  run: |
    cargo bench --bench git_perf -- --save-baseline current
    cargo bench --bench git_perf -- --baseline current --threshold 0.20
  working-directory: apps/desktop/src-tauri
```

→ baseline 대비 +20% 회귀 시 CI 실패 (06 plan §회귀 차단 정합).

### 4-3. README 정량 표기

baseline 측정 후 README 의 "차별화 4축" 에 정량 추가:

```markdown
3. **Tauri 경량** — idle ~75MB, 50 레포 워크스페이스 ~285MB
   (GitKraken 200~300MB idle 대비 1/3)
```

---

## 5. 측정 시나리오 (~6h)

| 단계 | 시간 |
| --- | --- |
| 1 | 50k commit 합성 repo 생성 (~30분) |
| 2 | 메모리 snapshot 5 시나리오 (~30분) |
| 3 | 그래프 렌더 측정 (1k / 10k / 50k) (~30분) |
| 4 | status / log / diff 측정 (~30분) |
| 5 | AI subprocess 측정 (~30분) |
| 6 | bulk IPC 측정 (사용자 회사 50 repo) (~30분) |
| 7 | 한글 round-trip 회귀 (cargo test 통합) (~30분) |
| 8 | baseline.json 작성 + README 갱신 (~30분) |
| 9 | CI workflow 통합 (~30분) |
| 10 | dogfood 검증 + 결과 정리 (~1h) |

**총 ~6h** (단일 세션 가능, AI pair 보정 ~1.5h).

---

## 6. 결정 로그 (2026-04-27)

| # | 결정 | 근거 |
| --- | --- | --- |
| 1 | **메모리 회귀 차단 = +20%** | 06 plan §회귀 차단 정합 |
| 2 | **bench 도구 = criterion + vitest + powershell 3가지** | Rust / TS / Memory 각 측면 |
| 3 | **50k commit repo = 합성** | 사용자 환경 가장 큰 repo 가 ~700 commits 라 부족 |
| 4 | **AI 측정은 cache hit 가정** | cold start 별도 +3s overhead 표기 |
| 5 | **CI 회귀 검사 = release workflow only** | PR 마다 30분 bench 부담 큼, release 시점만 검증 |

---

## 7. 다음 plan 후보

본 plan 이 plan 시리즈의 마지막. 추가는 trigger 발생 시:

- 21 = `21-` 새 catalog (예: GitHub repo 100 stars 후 community management)
- 22 = `22-` macOS Apple Silicon optimization (v1.3 후 발견 시)

---

## 8. 검증 체크리스트

- [ ] 모든 8 카테고리 측정 완료
- [ ] baseline.json 작성
- [ ] CI 회귀 차단 통합
- [ ] README 정량 표기
- [ ] cargo bench / vitest perf 둘 다 통과
- [ ] 한글 round-trip 4 시나리오 통과
- [ ] memory baseline +20% 회귀 0건

---

## 9. plan 시리즈 종합 (2026-04-27 기준)

| # | 제목 | 상태 |
| -- | --- | --- |
| 00~08 | 초기 plan (overview / positioning / workflow / feature matrix / tech / roadmap / risks / decisions / refs) | ✅ |
| 09 | Interactive rebase (옵션 A 채택) | ✅ |
| 10 | Integrated terminal (옵션 A 채택) | ✅ |
| 11 | GitKraken 12.0 catalog (95% 흡수) | ✅ |
| 12 | UI improvement plan v3 (43 항목 완료 인벤토리) | ✅ |
| 13 | 구현 vs 계획 정밀 diff (반영도 검증) | ✅ |
| 14 | 추가 GitKraken 잔여 catalog (22 항목) | ✅ |
| 15 | 품질 cleanup sprint (P0 2 + P1 7 + P2 7) | ✅ |
| 16 | Line-level stage v2 (Sprint H 후속) | ✅ |
| 17 | v1.x roadmap (EV / Sentry / macOS / Linux / OAuth / 수익) | ✅ |
| 18 | dogfood feedback (template 형식) | ✅ |
| 19 | v0.3 GitHub release prep | ✅ |
| 20 | Performance benchmark (본 문서) | ✅ |

→ **plan 시리즈 21개 작성 완료** (00~08 + 09~20). 후속은 trigger 발생 시 21+ 로.

---

다음 행동 → 사용자 결정에 따라 sprint 진입 (15 P0 / 14 A14 / 16 line-stage / 17 v1.1 / 18 dogfood / 19 release / 20 bench).
