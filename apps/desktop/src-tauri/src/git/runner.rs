// 한글 / UTF-8 안전 git CLI spawn 표준 함수.
//
// 본 모듈은 git-fried 의 보안 + 정확성 중심축이다. (`docs/plan/04 §3` `06 R2`)
// 절대 우회하지 말 것 — Forge / IPC / AI subprocess 모두 본 함수 패턴을 따라야 한다.
//
// 보장 사항:
//   1. 모든 git 호출에 `core.quotepath=false` `i18n.commitencoding=utf-8`
//      `i18n.logoutputencoding=utf-8` `safe.directory=*` 강제 주입.
//   2. 환경변수 `LANG=C.UTF-8` `LC_ALL=C.UTF-8` `PYTHONIOENCODING=utf-8` 강제.
//      Windows OS 의 활성 코드페이지(CP949 등) 가 무엇이든 결과 동일.
//   3. stdout / stderr 는 바이트로 받고 `encoding_rs::UTF_8` 로 명시 디코딩.
//      디코딩 실패 시에도 lossy 변환으로 진행 — 호출자가 결과 검증.
//   4. 결과 문자열은 NFC 로 정규화 (Windows 파일명 NFD 이슈 회피).
//   5. stdin 은 기본 닫힘 — 의도적으로 줄 데이터는 GitRunOpts::stdin 사용.

use crate::error::{AppError, AppResult};
use std::path::Path;
use std::time::Duration;
use tokio::process::Command;

/// git CLI 실행 결과.
#[derive(Debug, Clone)]
pub struct GitOutput {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

impl GitOutput {
    /// 0 종료가 아니면 GitCli 에러로 변환.
    pub fn into_ok(self) -> AppResult<String> {
        if self.exit_code == Some(0) {
            Ok(self.stdout)
        } else {
            Err(AppError::GitCli {
                message: format!("git 종료 코드 {:?}", self.exit_code),
                exit_code: self.exit_code,
                stderr: self.stderr,
            })
        }
    }
}

/// spawn 옵션 (디폴트는 [`GitRunOpts::default()`]).
#[derive(Debug, Default, Clone)]
pub struct GitRunOpts {
    /// stdin 으로 보낼 데이터 (file-based commit body 등).
    /// `None` 이면 stdin 이 즉시 닫힘.
    pub stdin: Option<String>,
    /// 추가 환경변수 (이미 강제되는 LANG/LC_ALL 외).
    pub envs: Vec<(String, String)>,
    /// `true` 이면 cwd 를 잠그지 않고 (시스템) git 으로 호출.
    pub global: bool,
    /// Sprint c45 P0-2 — git CLI 작업 timeout. None = 무제한 (backwards compat).
    /// 권장: clone/fetch/pull/push 는 600s (10분), log/status/diff 는 30s.
    pub timeout: Option<Duration>,
    /// SEC-301 (Codex consultation `task-mp554150` P1) — OpenSSH key path.
    ///
    /// Some(path) → `GIT_SSH_COMMAND="ssh -i <path> -o IdentitiesOnly=yes"` 자동 적용.
    /// None → SSH agent default (`SSH_AUTH_SOCK`) 또는 system `~/.ssh/id_*` 사용 (기존 동작).
    ///
    /// caller (fetch/pull/push/clone) 가 active profile 의 `ssh_key_path` 를 옵션 전달.
    /// PuTTY/plink 미지원 — 사용자 별도 PATH 설정 (Codex 권고).
    pub ssh_key_path: Option<String>,
}

/// Sprint c45 P0-2 — long-running git 작업 표준 timeout (10분). repo_mutation_guard 를
/// 보유하는 op(pull 등)용 — guard starvation 방지로 짧게.
pub const GIT_NETWORK_TIMEOUT: Duration = Duration::from_secs(600);

/// plan #45 M4a — guard 없는 네트워크 op(clone/fetch/push)용 generous backstop (30분).
/// 의도: 대형 repo 의 정상 장시간 작업은 보존하되, 무한 hang(네트워크 black-hole 등)은
/// 영원히 매달리지 않고 종료시킨다. 사용자 능동 취소는 M4b(cancellation IPC) 가 담당.
pub const GIT_LONG_NETWORK_TIMEOUT: Duration = Duration::from_secs(1800);

/// 한글 안전 git CLI 호출.
///
/// 사용 예:
/// ```ignore
/// let out = git_run(&repo_path, &["log", "--oneline", "-10"], &Default::default()).await?;
/// let log = out.into_ok()?;
/// ```
pub async fn git_run(cwd: &Path, args: &[&str], opts: &GitRunOpts) -> AppResult<GitOutput> {
    // -c 강제 주입: core.quotepath=false 가 한글 파일명 escape 방지의 핵심
    let injected: &[&str] = &[
        "-c",
        "core.quotepath=false",
        "-c",
        "i18n.commitencoding=utf-8",
        "-c",
        "i18n.logoutputencoding=utf-8",
        "-c",
        "safe.directory=*",
    ];

    let mut cmd = Command::new("git");
    if !opts.global {
        cmd.current_dir(cwd);
    }

    cmd.args(injected);
    cmd.args(args);

    // 환경변수: OS 코드페이지 무력화
    cmd.env("LANG", "C.UTF-8")
        .env("LC_ALL", "C.UTF-8")
        .env("PYTHONIOENCODING", "utf-8")
        .env("GIT_PAGER", "cat")
        .env("GIT_EDITOR", "true");

    for (k, v) in &opts.envs {
        cmd.env(k, v);
    }

    // SEC-301 (Codex consultation P1) — active profile 의 SSH key path 가 있으면
    // GIT_SSH_COMMAND env 자동 적용 (OpenSSH only). agent fallback 보존: -o IdentitiesOnly=yes
    // 는 명시한 키만 사용하되 agent 가 forward 한 키도 시도 가능.
    //
    // code-review SEC-001 — Windows path backslash 가 POSIX shell parsing 시 escape meta 로
    // 오인 가능 → forward-slash 로 normalize. OpenSSH (Windows port 포함) 가 `/` path 정상
    // 처리. caller 책임으로 `crate::profiles::validate_ssh_key_path` 통과한 path 만 전달.
    if let Some(ssh_key) = &opts.ssh_key_path {
        if !ssh_key.is_empty() {
            let normalized = ssh_key.replace('\\', "/");
            cmd.env(
                "GIT_SSH_COMMAND",
                format!("ssh -i \"{normalized}\" -o IdentitiesOnly=yes"),
            );
        }
    }

    cmd.stdin(if opts.stdin.is_some() {
        std::process::Stdio::piped()
    } else {
        std::process::Stdio::null()
    });
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(AppError::Io)?;

    // Sprint 2026-06-04 (/analyze F14) — SAF-401(ai/runner.rs) child.kill() 패턴 이식.
    // 기존 `wait_with_output()` 은 child 소유권을 가져가 timeout 시 kill 불가 → orphan 잔존.
    // explicit stdout/stderr take → 별도 reader task 로 비동기 drain → `child.wait()` 와 race →
    // timeout 시 `child.kill().await` + reap + reader abort 로 orphan 제거.
    use tokio::io::AsyncReadExt;
    let stdout_handle = child
        .stdout
        .take()
        .ok_or_else(|| AppError::internal("git subprocess stdout 핸들 take 실패 (이미 닫힘)"))?;
    let stderr_handle = child
        .stderr
        .take()
        .ok_or_else(|| AppError::internal("git subprocess stderr 핸들 take 실패 (이미 닫힘)"))?;

    // reader 를 stdin write 보다 먼저 spawn — child 가 stdout 파이프 버퍼를 채우며 block 하고
    // 우리는 stdin write 로 block 되는 deadlock 회피 (대용량 patch stdin + 대용량 stdout 동시).
    // Codex review 2026-06-04 (F4) — read IO error 시 partial buf 는 보존(hard-fail 보다 유용)
    // 하되 silent swallow 대신 trace 로깅해 진단 손실 방지.
    let stdout_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let mut h = stdout_handle;
        if let Err(e) = h.read_to_end(&mut buf).await {
            tracing::debug!(target: "git_fried_lib::runner", error = %e, "git stdout read 부분 실패 — partial 반환");
        }
        buf
    });
    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let mut h = stderr_handle;
        if let Err(e) = h.read_to_end(&mut buf).await {
            tracing::debug!(target: "git_fried_lib::runner", error = %e, "git stderr read 부분 실패 — partial 반환");
        }
        buf
    });

    if let (Some(input), Some(mut stdin)) = (opts.stdin.as_ref(), child.stdin.take()) {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(input.as_bytes())
            .await
            .map_err(AppError::Io)?;
        stdin.shutdown().await.map_err(AppError::Io)?;
    }

    // Sprint c45 P0-2 — timeout 적용. 초과 시 child kill + reap + GitCli 에러.
    let status = match opts.timeout {
        Some(d) => match tokio::time::timeout(d, child.wait()).await {
            Ok(res) => res.map_err(AppError::Io)?,
            Err(_) => {
                // timeout — child kill + reap (orphan 방지) + reader task abort.
                let _ = child.kill().await;
                let _ = child.wait().await;
                stdout_task.abort();
                stderr_task.abort();
                return Err(AppError::GitCli {
                    message: format!(
                        "git 명령 timeout {}초 초과 ({})",
                        d.as_secs(),
                        args.first().copied().unwrap_or("?")
                    ),
                    exit_code: None,
                    stderr: String::new(),
                });
            }
        },
        None => child.wait().await.map_err(AppError::Io)?,
    };

    let stdout_bytes = stdout_task.await.unwrap_or_default();
    let stderr_bytes = stderr_task.await.unwrap_or_default();

    Ok(GitOutput {
        exit_code: status.code(),
        stdout: decode_lossy(&stdout_bytes),
        stderr: decode_lossy(&stderr_bytes),
    })
}

/// 바이트 → UTF-8 lossy decode + NFC 정규화.
///
/// Sprint c34 — `git::path::decode_korean_safe(bytes, true)` 위임 (plan/27 단기 액션).
/// 본 wrapper 는 기존 호출처 (git_run / commit_with_message) 인터페이스 보존용.
#[inline]
fn decode_lossy(bytes: &[u8]) -> String {
    crate::git::path::decode_korean_safe(bytes, true)
}

/// `git --version` 호출. 시스템에 git CLI 가 있는지 검증.
pub async fn git_version() -> AppResult<String> {
    let out = git_run(
        Path::new("."),
        &["--version"],
        &GitRunOpts {
            global: true,
            ..Default::default()
        },
    )
    .await?;
    out.into_ok().map(|s| s.trim().to_string())
}

/// 임시 파일에 메시지 작성 후 `git commit -F <file>` 호출.
///
/// 한글 메시지를 명령줄 인자로 전달하면 Windows 에서 mangle 가능 → 항상 file-based.
pub async fn commit_with_message(repo: &Path, message: &str) -> AppResult<GitOutput> {
    use std::io::Write;
    let mut f = tempfile::NamedTempFile::new().map_err(AppError::Io)?;
    f.write_all(message.as_bytes()).map_err(AppError::Io)?;
    let path = f.path().to_string_lossy().into_owned();
    git_run(repo, &["commit", "-F", &path], &Default::default()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    /// UTF-8 한글 정상 디코드 (가장 일반).
    #[test]
    fn test_decode_lossy_utf8_korean() {
        let bytes = "커밋 메시지".as_bytes();
        assert_eq!(decode_lossy(bytes), "커밋 메시지");
    }

    /// 빈 byte slice 는 빈 string.
    #[test]
    fn test_decode_lossy_empty() {
        assert_eq!(decode_lossy(&[]), "");
    }

    /// ASCII 는 무영향.
    #[test]
    fn test_decode_lossy_ascii() {
        assert_eq!(decode_lossy(b"git --version"), "git --version");
    }

    /// NFC 정규화 — 자모 분리 ("ㅎ" + "ㅏ" + "ㄴ") 가 결합 ("한") 으로.
    /// 실제로 분리된 자모 byte sequence: \u{1100} (ᄒ) + \u{1161} (ᅡ) + \u{11AB} (ᆫ).
    #[test]
    fn test_decode_lossy_nfc_normalization() {
        // 분리형 (NFD) 한글
        let nfd = "\u{1112}\u{1161}\u{11AB}\u{1100}\u{1173}\u{11AF}";
        let bytes = nfd.as_bytes();
        let decoded = decode_lossy(bytes);
        // NFC 후에는 결합형 "한글" 이어야 함.
        assert_eq!(decoded, "한글");
    }

    /// 한글 commit message 가 ASCII 와 mixed.
    #[test]
    fn test_decode_lossy_mixed_korean_ascii() {
        let bytes = "feat: 한글 커밋 메시지 (CJK=2 cell)".as_bytes();
        assert_eq!(decode_lossy(bytes), "feat: 한글 커밋 메시지 (CJK=2 cell)");
    }
}
