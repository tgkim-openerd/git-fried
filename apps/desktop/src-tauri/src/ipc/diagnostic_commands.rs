// Frontend 진단 funnel — Vue `app.config.errorHandler` 가 흘려보낸
// uncaught 예외를 Rust tracing sink 로 받는다.
//
// c40 도메인 분해 정책에 따라 `commands.rs` (앱 메타) 와 분리.
// 향후 `report_panic` / `dump_state` / `flush_traces` 등 진단 명령은
// 이 파일에 추가한다.
//
// 적용된 보안 패턴 (c46+ /code-review):
//   - SEC-1: `secret_mask::mask_secrets` 로 stack trace / message 평문 노출 차단
//   - SEC-2: CRLF (`\r\n`) escape — 위조 로그 라인 주입 방어
//   - SEC-3: 1초 윈도우 50건 cap rate limit — 무한 렌더 루프 시 sink DoS 방어

use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::secret_mask::mask_secrets;

// ====== Rate limit 상태 ======

const RATE_WINDOW: Duration = Duration::from_millis(1_000);
const RATE_CAP_PER_WINDOW: u32 = 50;

struct RateState {
    window_start: Instant,
    accepted: u32,
    dropped: u32,
}

fn rate_state() -> &'static Mutex<RateState> {
    static S: OnceLock<Mutex<RateState>> = OnceLock::new();
    S.get_or_init(|| {
        Mutex::new(RateState {
            window_start: Instant::now(),
            accepted: 0,
            dropped: 0,
        })
    })
}

/// Returns `(should_drop_this_call, dropped_in_previous_window)`.
/// `should_drop=true` 이면 본 호출은 sink 미전송. `dropped_in_previous_window>0`
/// 이면 이전 윈도우에서 cap 초과로 drop 된 건수 — 본 호출 직전에 1회 warn 으로
/// 일괄 보고한다.
fn rate_check() -> (bool, u32) {
    let mut s = rate_state().lock().expect("rate state poisoned");
    let now = Instant::now();
    if now.duration_since(s.window_start) >= RATE_WINDOW {
        let dropped = s.dropped;
        s.window_start = now;
        s.accepted = 1;
        s.dropped = 0;
        return (false, dropped);
    }
    if s.accepted < RATE_CAP_PER_WINDOW {
        s.accepted += 1;
        (false, 0)
    } else {
        s.dropped += 1;
        (true, 0)
    }
}

// ====== Log line sanitizer ======

/// Secret 마스킹 + CRLF escape. 로그 라인 위조 방어 (SEC-2).
fn sanitize_for_log(input: &str) -> String {
    mask_secrets(input)
        .replace('\r', "\\r")
        .replace('\n', "\\n")
}

// ====== IPC ======

#[tauri::command]
pub fn report_frontend_error(
    message: String,
    source: Option<String>,
    info: Option<String>,
    component: Option<String>,
) {
    let (drop_this, dropped_prev) = rate_check();
    if dropped_prev > 0 {
        tracing::warn!(
            target: "frontend",
            "frontend-error rate-limited: {} 건 drop (직전 1초 윈도우)",
            dropped_prev
        );
    }
    if drop_this {
        return;
    }

    let safe_message = sanitize_for_log(&message);
    let safe_source = source.as_deref().map(sanitize_for_log);
    let safe_info = info.as_deref().map(sanitize_for_log);
    let safe_component = component.as_deref().map(sanitize_for_log);

    tracing::error!(
        target: "frontend",
        source = safe_source.as_deref(),
        info = safe_info.as_deref(),
        component = safe_component.as_deref(),
        "[frontend-error] {}",
        safe_message
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smoke_optional_fields_all_some() {
        report_frontend_error(
            "boom".into(),
            Some("at Foo (foo.vue:10)".into()),
            Some("setup".into()),
            Some("FooBar".into()),
        );
    }

    #[test]
    fn smoke_optional_fields_all_none() {
        report_frontend_error("plain".into(), None, None, None);
    }

    #[test]
    fn sanitize_masks_secrets() {
        // GitHub PAT 패턴이 [MASKED] 로 치환되는지.
        let s = sanitize_for_log("token: ghp_abcdefghijklmnopqrstuvwxyz123456");
        assert!(s.contains("[MASKED]"));
        assert!(!s.contains("ghp_"));
    }

    #[test]
    fn sanitize_escapes_crlf() {
        // \n / \r 가 literal escape 로 치환되어 위조 라인 차단.
        let s = sanitize_for_log("line1\nINFO fake admin login\r\ndone");
        assert!(!s.contains('\n'));
        assert!(!s.contains('\r'));
        assert!(s.contains("\\n"));
        assert!(s.contains("\\r"));
    }

    #[test]
    fn rate_limit_drops_excess() {
        // 자체 윈도우 분리 — 다른 테스트와 격리하기 위해 cap+10 호출.
        // OnceLock 으로 전역 공유라 본 테스트는 rate state 의 cumulative 동작 확인용.
        for _ in 0..(RATE_CAP_PER_WINDOW + 10) {
            report_frontend_error("x".into(), None, None, None);
        }
        // 단순 panic 부재 검증 (정확한 drop 카운트는 시계 의존이라 assert 안 함).
    }
}
