// Sprint c79 ARCH-004 — panic hook 단일책임 모듈.
//
// 기존: lib.rs::run() body 27 LOC inline.
// 분리 이유:
//   - 단일책임: lib.rs 는 Tauri builder + IPC 등록 책임. panic 처리는 별도 관심사.
//   - 재사용: 향후 sentry breadcrumbs / report_frontend_error 통합 시 단일 진입점.
//   - test 가능: install() 함수 단위로 mock / mutate hook 검증 가능.
//
// error.rs 와의 분리:
//   - error.rs: AppError type + Result wrapper (정상 에러 path)
//   - panic_hook.rs: 비복구 panic 의 abort path 포착 + 로깅
//
// 보안 (SEC-001): panic payload 에 PAT/JWT 등 secret 가능 → secret_mask 적용 후 tracing.

use crate::secret_mask;

/// panic hook 등록. lib.rs::run() 의 tracing_subscriber init 직후 1회 호출.
///
/// - debug build: default_hook 보존 (개발 중 stderr backtrace 유지)
/// - release build: SEC-201 (Codex R1) — default_hook 제거 + mask payload 만 stderr.
///   default_hook 가 raw `info` 를 받아 `panicked at "...ghp_xxx..."` stderr 출력 → secret leak 우회 경로.
/// - tracing::error! target=`git_fried_lib::panic` 로 location/payload 구조화 캡처 (양 빌드 공통)
/// - payload 의 secret (PAT/JWT/DB URL/SSN 등) 은 secret_mask 마스킹 (양 빌드 공통)
pub fn install() {
    #[cfg(debug_assertions)]
    let default_hook = std::panic::take_hook();
    #[cfg(not(debug_assertions))]
    let _ = std::panic::take_hook(); // release: default_hook 제거 — secret leak 차단

    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());
        let raw_payload = if let Some(s) = info.payload().downcast_ref::<&'static str>() {
            (*s).to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "<non-string panic payload>".to_string()
        };
        // SEC-001 — payload secret 마스킹 (예: panicked at "Invalid token: ghp_xxx...").
        let payload = secret_mask::mask_secrets(&raw_payload);
        tracing::error!(
            target: "git_fried_lib::panic",
            location = %location,
            payload = %payload,
            "panic — process abort 직전",
        );
        // SEC-201 (Codex R1) — release 에서 default_hook 호출 안 함.
        // debug 에서만 raw backtrace 보존 (개발 편의).
        #[cfg(debug_assertions)]
        default_hook(info);
        #[cfg(not(debug_assertions))]
        {
            // release: mask 된 payload + location 만 stderr 출력 (secret-safe).
            eprintln!("panicked at {}: {}", location, payload);
        }
    }));
}
