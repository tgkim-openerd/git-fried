// Claude / Codex CLI subprocess 표준 spawn 함수.
//
// `docs/plan/04 §11` 참조.
//
// 호출 형식:
//   - Claude: `claude -p "<prompt>" --output-format stream-json`
//     (또는 `--output-format json` 단일 응답)
//   - Codex:  `codex exec "<prompt>" --json`
//
// stdin/stdout 은 UTF-8 강제. 바이트 디코딩은 git_run 과 동일 패턴.

use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AiCli {
    Claude,
    Codex,
}

impl AiCli {
    pub fn binary(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiOutput {
    pub success: bool,
    pub text: String,
    pub stderr: String,
    pub took_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProbe {
    pub cli: AiCli,
    pub installed: bool,
    pub version: Option<String>,
}

/// PATH 에서 `claude` / `codex` 자동 감지.
pub async fn detect_clis() -> Vec<AiProbe> {
    let mut out = Vec::new();
    for cli in [AiCli::Claude, AiCli::Codex] {
        let bin = cli.binary();
        let mut cmd = Command::new(bin);
        cmd.arg("--version")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let probe = match cmd.output().await {
            Ok(o) if o.status.code() == Some(0) => {
                let v = String::from_utf8_lossy(&o.stdout).trim().to_string();
                AiProbe {
                    cli,
                    installed: true,
                    version: Some(v),
                }
            }
            _ => AiProbe {
                cli,
                installed: false,
                version: None,
            },
        };
        out.push(probe);
    }
    out
}

/// 한 번의 prompt 실행 (single-shot, non-stream).
///
/// Claude / Codex 모두 비대화식 모드 (`-p` / `exec`) 사용.
/// stream 은 v0.2 다음 단계 (Tauri Channel<String>).
pub async fn ai_run(cli: AiCli, prompt: &str) -> AppResult<AiOutput> {
    let start = std::time::Instant::now();
    let bin = cli.binary();

    let mut cmd = Command::new(bin);
    match cli {
        AiCli::Claude => {
            // Claude Code: -p (non-interactive) + --output-format text
            cmd.args(["-p", prompt, "--output-format", "text"]);
        }
        AiCli::Codex => {
            // Codex CLI: exec (non-interactive) — 출력은 plain text
            cmd.args(["exec", prompt]);
        }
    };

    cmd.env("LANG", "C.UTF-8")
        .env("LC_ALL", "C.UTF-8")
        .env("PYTHONIOENCODING", "utf-8")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = cmd.output().await.map_err(AppError::Io)?;

    // 바이트 → UTF-8 lossy 디코딩 (git_run 과 동일 패턴)
    let (stdout_cow, _, had_err) = encoding_rs::UTF_8.decode(&output.stdout);
    let stdout = if had_err {
        encoding_rs::GBK.decode(&output.stdout).0.into_owned()
    } else {
        stdout_cow.into_owned()
    };
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    Ok(AiOutput {
        success: output.status.code() == Some(0),
        text: stdout,
        stderr,
        took_ms: start.elapsed().as_millis() as u64,
    })
}
