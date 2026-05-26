// 통합 터미널 IPC (`docs/plan/10 옵션 A`).
//
// Tauri Channel<Vec<u8>> 로 frontend xterm.js 와 양방향 binding:
//   - pty_open  : shell spawn + reader task spawn → id 반환
//   - pty_write : 사용자 입력을 stdin 에 write
//   - pty_resize: 창 크기 변경
//   - pty_close : kill + 레지스트리 제거
//
// Sprint 2026-05-26 — HIGH-C 해소:
// shell / cwd 모두 IPC 직접 입력 → arbitrary process launch 차단.
// (1) shell basename 을 시스템 shell allowlist 와 매칭
// (2) cwd 가 등록된 repo root 의 하위경로인지 검증

use crate::error::{AppError, AppResult};
use crate::storage::db::DbExt;
use crate::AppState;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::ipc::Channel;

/// 시스템에서 정상 shell 로 인정되는 basename 의 lowercase set.
///
/// Windows: `.exe` 포함. POSIX: 확장자 없음. cross-platform 모두 cover.
/// 추가 필요 시 (예: nu shell, xonsh) 본 set 만 확장.
const ALLOWED_SHELL_BASENAMES: &[&str] = &[
    // POSIX
    "bash",
    "sh",
    "zsh",
    "fish",
    "dash",
    "ash",
    "tcsh",
    "csh",
    "ksh",
    "nu",
    // Windows
    "bash.exe",
    "sh.exe",
    "zsh.exe",
    "fish.exe",
    "cmd.exe",
    "powershell.exe",
    "pwsh.exe",
    "nu.exe",
    "wsl.exe",
    "git-bash.exe",
];

/// shell 문자열이 allowlist 의 정상 shell 인지 검증.
///
/// 절대경로 / 상대경로 / basename only 모두 허용. 평가 기준은 basename lowercase.
fn validate_shell(shell: &str) -> AppResult<()> {
    let trimmed = shell.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation("shell 이 비어있습니다."));
    }
    // 위험 메타 문자 — shell 경로에 `;`, `&`, `|`, `>`, `<`, newline 같은 게 들어오면 거부.
    if trimmed
        .chars()
        .any(|c| c == ';' || c == '&' || c == '|' || c == '<' || c == '>' || c == '\n' || c == '\r')
    {
        return Err(AppError::validation(format!(
            "shell 경로에 메타 문자가 포함되어 있습니다: {trimmed}"
        )));
    }
    let basename = Path::new(trimmed)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !ALLOWED_SHELL_BASENAMES.contains(&basename.as_str()) {
        return Err(AppError::validation(format!(
            "허용되지 않은 shell: {trimmed} (basename={basename}). 허용 목록: {:?}",
            ALLOWED_SHELL_BASENAMES
        )));
    }
    Ok(())
}

/// cwd 가 등록된 repo 의 하위경로인지 검증 후 canonical path 반환.
///
/// canonicalize 후 prefix 비교 — 심볼릭 링크 탈출도 방어.
/// Codex Wave 1 review MED — TOCTOU 방지: 검증된 canonical path 를 caller 에 반환해
/// spawn 시 동일 path 사용 (validate vs spawn 사이 race 차단).
async fn validate_cwd_under_registered_repo(
    cwd: &Path,
    state: &Arc<AppState>,
) -> AppResult<PathBuf> {
    if !cwd.exists() {
        return Err(AppError::validation(format!(
            "cwd 가 존재하지 않습니다: {}",
            cwd.display()
        )));
    }
    let canon_cwd = cwd
        .canonicalize()
        .map_err(|e| AppError::validation(format!("cwd canonicalize 실패: {e}")))?;
    let repos = state.db.list_repos(None).await?;
    if repos.is_empty() {
        return Err(AppError::validation(
            "등록된 repo 가 없습니다 — pty 는 등록된 repo 의 하위 경로에서만 열 수 있습니다.",
        ));
    }
    for r in &repos {
        let repo_path = Path::new(&r.local_path);
        let canon_repo = match repo_path.canonicalize() {
            Ok(p) => p,
            Err(_) => continue, // repo 경로가 사라진 경우 건너뜀 (다음 repo 시도)
        };
        if canon_cwd.starts_with(&canon_repo) {
            return Ok(canon_cwd);
        }
    }
    Err(AppError::validation(format!(
        "cwd 가 등록된 repo 외부입니다: {}",
        cwd.display()
    )))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyOpenArgs {
    pub cwd: String,
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
}

#[tauri::command]
pub async fn pty_open(
    args: PtyOpenArgs,
    on_data: Channel<Vec<u8>>,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<u64> {
    // Sprint 2026-05-26 HIGH-C: shell + cwd 검증 (registry 호출 전).
    // Codex Wave 1 review MED — TOCTOU 방지: 검증된 canonical cwd 를 spawn 에 사용.
    validate_shell(&args.shell)?;
    let cwd_raw = PathBuf::from(&args.cwd);
    let canon_cwd = validate_cwd_under_registered_repo(&cwd_raw, state.inner()).await?;
    let (id, session) = state
        .pty
        .open(&canon_cwd, &args.shell, args.cols, args.rows)?;
    let reader = session.lock().take_reader()?;

    // reader 는 blocking read — 별도 std::thread 로 분리.
    // SAF-302 output-side (Codex c82 audit) — stream-stateful OscStripper 로
    // child stdout 의 OSC escape 도 차단. stateless `sanitize_pty_input` 은 4096 chunk
    // boundary 에서 OSC split 시 누락 가능 → stream-stateful 채택.
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        let mut stripper = crate::pty::OscStripper::new();
        loop {
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => break, // EOF (shell 종료)
                Ok(n) => {
                    let sanitized = stripper.process(&buf[..n]);
                    if on_data.send(sanitized).is_err() {
                        // frontend 가 channel 을 닫음 → 종료.
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    Ok(id)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyWriteArgs {
    pub id: u64,
    pub data: Vec<u8>,
}

#[tauri::command]
pub async fn pty_write(
    args: PtyWriteArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let session = state
        .pty
        .get(args.id)
        .ok_or_else(|| AppError::validation(format!("pty 세션 없음 (id={})", args.id)))?;
    let r = session.lock().write_all(&args.data);
    r
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyResizeArgs {
    pub id: u64,
    pub cols: u16,
    pub rows: u16,
}

#[tauri::command]
pub async fn pty_resize(
    args: PtyResizeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<()> {
    let session = state
        .pty
        .get(args.id)
        .ok_or_else(|| AppError::validation(format!("pty 세션 없음 (id={})", args.id)))?;
    let r = session.lock().resize(args.cols, args.rows);
    r
}

#[tauri::command]
pub async fn pty_close(id: u64, state: tauri::State<'_, Arc<AppState>>) -> AppResult<()> {
    state.pty.close(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Sprint 2026-05-26 — HIGH-C 회귀 가드 (pty_open allowlist).
    //
    // 본 테스트는 pure unit (validate_shell) 만 cover.
    // cwd 검증은 AppState (Db) 가 필요해 integration test 영역.

    #[test]
    fn validate_shell_accepts_posix_bash() {
        assert!(validate_shell("bash").is_ok());
        assert!(validate_shell("/bin/bash").is_ok());
        assert!(validate_shell("/usr/local/bin/zsh").is_ok());
        assert!(validate_shell("fish").is_ok());
    }

    #[test]
    fn validate_shell_accepts_windows_shells() {
        assert!(validate_shell("cmd.exe").is_ok());
        assert!(validate_shell("C:\\Windows\\System32\\cmd.exe").is_ok());
        assert!(validate_shell("powershell.exe").is_ok());
        assert!(validate_shell("pwsh.exe").is_ok());
        assert!(validate_shell("C:\\Program Files\\Git\\bin\\bash.exe").is_ok());
    }

    #[test]
    fn validate_shell_case_insensitive() {
        assert!(validate_shell("CMD.EXE").is_ok());
        assert!(validate_shell("PowerShell.Exe").is_ok());
    }

    #[test]
    fn validate_shell_rejects_arbitrary_binary() {
        assert!(validate_shell("/etc/passwd").is_err());
        assert!(validate_shell("/bin/cat").is_err());
        assert!(validate_shell("notepad.exe").is_err());
        assert!(validate_shell("rm").is_err());
    }

    #[test]
    fn validate_shell_rejects_empty() {
        assert!(validate_shell("").is_err());
        assert!(validate_shell("   ").is_err());
    }

    #[test]
    fn validate_shell_rejects_meta_chars() {
        assert!(validate_shell("bash; rm -rf /").is_err());
        assert!(validate_shell("bash | nc evil").is_err());
        assert!(validate_shell("bash & whoami").is_err());
        assert!(validate_shell("bash\nrm -rf /").is_err());
    }

    #[test]
    fn validate_shell_rejects_io_redirect() {
        assert!(validate_shell("bash > /tmp/out").is_err());
        assert!(validate_shell("bash < input").is_err());
    }
}
