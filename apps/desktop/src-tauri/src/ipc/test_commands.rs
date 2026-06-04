// e2e 전용 IPC — debug 빌드에서만 컴파일/등록 (mod 선언 + 핸들러 등록 모두 #[cfg(debug_assertions)]).
//
// /verify 2026-06-04 Layer 2 — repo_mutation_guard 직렬화를 CDP e2e(Playwright + WebView2 CDP)가
// 관찰할 수 있게 enter/leave 타임스탬프를 반환하는 probe 커맨드. release 빌드에는 미포함.
//
// 관찰 패턴 (Codex 권고): 두 호출을 동시 발사 → 같은 repo 면 `enter2 >= leave1`(직렬화),
// 다른 repo 면 critical section 겹침(동시). 순수 timing 이 아니라 enter/leave ordering 으로 판정.

use crate::error::AppResult;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

/// 프로세스 공통 monotonic 기준점 — enter/leave 를 같은 baseline 으로 ms 환산해
/// 호출 간 ordering(enter2 vs leave1) 을 비교 가능하게 한다.
fn baseline() -> Instant {
    static B: OnceLock<Instant> = OnceLock::new();
    *B.get_or_init(Instant::now)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardProbeArgs {
    pub repo_id: i64,
    pub delay_ms: u64,
    pub token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardProbeResult {
    pub token: String,
    /// guard 진입 시각 (baseline 기준 ms).
    pub enter_ms: u128,
    /// guard 해제 직전 시각 (baseline 기준 ms).
    pub leave_ms: u128,
}

/// repo_mutation_guard 획득 → enter 기록 → delay → leave 기록.
///
/// e2e 가 `Promise.all([guard_probe(repo=1,...A), guard_probe(repo=1,...B)])` 로 동시 발사 시,
/// guard 직렬화면 두 결과의 critical section([enter,leave])이 겹치지 않는다.
#[tauri::command]
pub async fn guard_probe(
    args: GuardProbeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<GuardProbeResult> {
    let base = baseline();
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let enter_ms = base.elapsed().as_millis();
    // delay 는 e2e flake 방지용 — 5s cap (오남용/DoS 방지, debug 전용이라 영향 미미).
    tokio::time::sleep(Duration::from_millis(args.delay_ms.min(5000))).await;
    let leave_ms = base.elapsed().as_millis();
    Ok(GuardProbeResult {
        token: args.token,
        enter_ms,
        leave_ms,
    })
}
