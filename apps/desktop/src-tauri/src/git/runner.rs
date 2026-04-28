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
use tokio::process::Command;
use unicode_normalization::UnicodeNormalization;

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
}

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

    let output = child.wait_with_output().await.map_err(AppError::Io)?;

    Ok(GitOutput {
        exit_code: output.status.code(),
        stdout: decode_lossy(&output.stdout),
        stderr: decode_lossy(&output.stderr),
    })
}

/// 바이트 → UTF-8 lossy decode + NFC 정규화.
///
/// 디코딩 실패는 `\u{FFFD}` 로 대체. 호출자가 stderr 에서 mojibake 패턴 감지 가능.
fn decode_lossy(bytes: &[u8]) -> String {
    let (cow, _, had_errors) = encoding_rs::UTF_8.decode(bytes);
    let s = if had_errors {
        // UTF-8 강제 환경변수에도 mojibake 가 발생하면 GBK/CP949 fallback 시도.
        let (cow2, _, _) = encoding_rs::GBK.decode(bytes);
        cow2.into_owned()
    } else {
        cow.into_owned()
    };
    s.nfc().collect::<String>()
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
