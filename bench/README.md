# Performance bench

`docs/plan/20 — Performance benchmark + baseline` 의 도구 모음.

목표 = v0.3.0 cut 직전 / 직후 baseline 한 번 박고, 이후 PR 에서 +20% 회귀를 차단.

## 측정 항목 (8 카테고리, plan/20 §2)

| 영역 | 도구 | 결과 저장 |
| ---- | ---- | ---- |
| RSS / Private 메모리 6 시나리오 | `pwsh ./bench/memory.ps1` | `bench/memory-baseline.txt` → `baseline.json :: memory_mb` |
| read_status / list_branches / compute_graph(1k, 10k) | `cargo bench --bench git_perf` (criterion) | criterion HTML report → `baseline.json :: ipc_ms` |
| 그래프 렌더 (1k / 10k / 50k commits) | DevTools Performance recording (수동) | `baseline.json :: graph_render_ms` |
| AI subprocess (claude / codex) | 사용자 dogfood | `baseline.json :: ai_seconds` |
| bulk_fetch / bulk_status (50 repo) | 사용자 회사 워크스페이스 | `baseline.json :: bulk_seconds` |
| 한글 round-trip 회귀 | `cargo test --lib` (이미 자동) | pass/fail |

## 1. Rust criterion bench

```bash
# 작은 repo (수백 commit) — 빠른 sanity check
BENCH_REPO=/path/to/small-repo cargo bench --bench git_perf --manifest-path apps/desktop/src-tauri/Cargo.toml

# 큰 repo (50k 합성, plan/20 §2-2 의 `seq 50000 | xargs -I {} git commit --allow-empty -m {}`)
BENCH_REPO=/path/to/big-repo cargo bench --bench git_perf --manifest-path apps/desktop/src-tauri/Cargo.toml -- --save-baseline v0.3.0

# 다음 측정에서 baseline 대비
cargo bench --bench git_perf --manifest-path apps/desktop/src-tauri/Cargo.toml -- --baseline v0.3.0
```

리포트는 `apps/desktop/src-tauri/target/criterion/` 아래 HTML 로 생성.

## 2. PowerShell 메모리 snapshot

```powershell
# git-fried 를 미리 띄워 두고 (release 또는 dev 모두 가능), 다른 터미널에서:
pwsh ./bench/memory.ps1
# 시나리오마다 Enter 로 진행 — 각 단계 안정화 후 RSS / Private / Handles 기록.
```

dev 모드 측정 시 프로세스명 옵션:

```powershell
pwsh ./bench/memory.ps1 -ProcessName git-fried-dev -LogPath ./bench/memory-dev.txt
```

## 3. baseline.json 작성 흐름

1. 위 도구로 측정 → `bench/memory-baseline.txt` + criterion HTML
2. `bench/baseline.json` 의 `null` 을 실제 값으로 교체 (PR 1건)
3. `measured_at`, `host` 채우기
4. 다음 PR 에서 회귀 검증: 새 측정값이 baseline 대비 +20% 초과 필드가 있으면 reject

## 4. CI 통합

`docs/plan/20 §4-2` 가 `release.yml` 에서 release tag push 시 cargo bench 를
돌리도록 명시. 단, 합성 50k repo 는 GitHub Actions runner 에서 30분+ 걸려
실용적이지 않으므로:

- **PR**: 회귀 검사 안 함 (bench 비용 큼)
- **Release tag**: cargo bench (작은 fixture, ~1분) 만 트리거 — `BENCH_REPO` 미설정 시 skip
- **수동**: 사용자 본인 환경에서 v0.3.0 / v0.4.0 cut 직전 전체 8 카테고리 실측

## 5. 다음 행동

- [ ] v0.3.0 cut 직전: 본인 환경에서 8 카테고리 1차 측정 → `baseline.json` 채움
- [ ] README 의 "Tauri 경량" 항목에 정량 (`idle ~75MB`) 추가 (plan/20 §4-3)
- [ ] release.yml `Performance regression check` step (현재 placeholder, 실제 활성화는 baseline 채운 다음 PR)
