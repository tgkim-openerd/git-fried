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

/// Sprint c45 P0-2 — long-running git 작업 표준 timeout (10분).
pub const GIT_NETWORK_TIMEOUT: Duration = Duration::from_secs(600);

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
    if let Some(ssh_key) = &opts.ssh_key_path {
        if !ssh_key.is_empty() {
            // ssh CLI argument 에 path 직접 삽입. caller 가 path validation 책임.
            // PuTTY/plink 는 사용자가 별도 GIT_SSH 또는 GIT_SSH_COMMAND 로 명시.
            cmd.env(
                "GIT_SSH_COMMAND",
                format!("ssh -i \"{}\" -o IdentitiesOnly=yes", ssh_key),
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

    if let (Some(input), Some(mut stdin)) = (opts.stdin.as_ref(), child.stdin.take()) {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(input.as_bytes())
            .await
            .map_err(AppError::Io)?;
        stdin.shutdown().await.map_err(AppError::Io)?;
    }

    // Sprint c45 P0-2 — timeout 적용. 초과 시 child kill + GitCli 에러.
    let output = match opts.timeout {
        Some(d) => match tokio::time::timeout(d, child.wait_with_output()).await {
            Ok(res) => res.map_err(AppError::Io)?,
            Err(_) => {
                // timeout 시 best-effort kill — wait_with_output 이 child 소유권을 이미 가져갔으므로
                // 별도 kill 호출은 불가능. 프로세스는 자연 종료될 때까지 orphan 가능 (OS 가 정리).
                // 다음 sprint 에서 child.kill() + manual stdout/stderr read 패턴으로 재구성 가능.
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
        None => child.wait_with_output().await.map_err(AppError::Io)?,
    };

    Ok(GitOutput {
        exit_code: output.status.code(),
        stdout: decode_lossy(&output.stdout),
        stderr: decode_lossy(&output.stderr),
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
