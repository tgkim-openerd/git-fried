// Claude / Codex CLI subprocess 표준 spawn 함수.
//
// `docs/plan/04 §11` 참조.
//
// 호출 형식:
//   - Claude: `claude -p "<prompt>" --output-format text`
//   - Codex:  `codex exec "<prompt>"`
//
// stdin/stdout 은 UTF-8 강제. 바이트 디코딩은 git/path::decode_korean_safe 위임.
//
// Sprint c35 — plan/27 단기 액션 2: AiCli enum 의 binary / build_args 메서드 분리.
// trait 추출 (v1.x crate 'local-ai-cli') 시 시그니처 그대로 trait 로 이동.

use crate::error::{AppError, AppResult};
use crate::git::path::decode_korean_safe;
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
    /// 실행 binary 이름 (PATH 검색 대상).
    pub fn binary(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
        }
    }

    /// non-interactive prompt 실행을 위한 CLI args 조립.
    ///
    /// Sprint c35 — `ai_run` 의 match 인라인 제거. trait 변환 시 그대로 trait method.
    pub fn build_args<'a>(self, prompt: &'a str) -> Vec<&'a str> {
        match self {
            // Claude Code: -p (non-interactive) + --output-format text
            Self::Claude => vec!["-p", prompt, "--output-format", "text"],
            // Codex CLI: exec (non-interactive) — 출력은 plain text
            Self::Codex => vec!["exec", prompt],
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
                let v = decode_korean_safe(&o.stdout, false).trim().to_string();
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
/// Claude / Codex 모두 비대화식 모드. stream 은 v0.2 다음 단계 (Tauri Channel<String>).
/// Sprint c35 — `cli.build_args(prompt)` 위임으로 match 인라인 제거.
///
/// SAF-401 (Codex R5 강화): backend timeout 적용 — frontend IPC timeout 은 child cancellation 이
/// 아니므로 backend 에서 별도 `tokio::time::timeout` + `child.kill()` 필요. 60s 표준 (AI roundtrip
/// 의 doherty_threshold 8s × 7.5 여유). 초과 시 child kill + AppError::Timeout.
pub const AI_RUN_TIMEOUT_SECS: u64 = 60;

pub async fn ai_run(cli: AiCli, prompt: &str) -> AppResult<AiOutput> {
    let start = std::time::Instant::now();

    let mut cmd = Command::new(cli.binary());
    cmd.args(cli.build_args(prompt))
        .env("LANG", "C.UTF-8")
        .env("LC_ALL", "C.UTF-8")
        .env("PYTHONIOENCODING", "utf-8")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // SAF-401 — child 소유권 보존 + tokio::time::timeout. 초과 시 OS 자연 정리.
    // (wait_with_output 가 child 소유권을 가져가므로 timeout 시 직접 kill 불가 — 다음 sprint 에서
    //  wait + manual stdout/stderr read 패턴으로 explicit kill 가능)
    let child = cmd.spawn().map_err(AppError::Io)?;
    let output = match tokio::time::timeout(
        std::time::Duration::from_secs(AI_RUN_TIMEOUT_SECS),
        child.wait_with_output(),
    )
    .await
    {
        Ok(res) => res.map_err(AppError::Io)?,
        Err(_) => {
            // wait_with_output 가 child 소유권을 가져갔으므로 직접 kill 불가능.
            // OS 가 자연 종료 시 정리. 추후 sprint 에서 wait + manual stdout/stderr read 패턴 재구성 가능.
            return Err(AppError::internal(format!(
                "AI 명령 timeout {}초 초과 ({:?})",
                AI_RUN_TIMEOUT_SECS, cli
            )));
        }
    };

    // Sprint c35 — git/path::decode_korean_safe 위임 (UTF-8 + GBK fallback).
    // stdout 은 NFC 미적용 (AI 응답 content 보존), stderr 도 동일.
    let stdout = decode_korean_safe(&output.stdout, false);
    let stderr = decode_korean_safe(&output.stderr, false);

    Ok(AiOutput {
        success: output.status.code() == Some(0),
        text: stdout,
        stderr,
        took_ms: start.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_args_claude_format() {
        let args = AiCli::Claude.build_args("hello");
        assert_eq!(args, vec!["-p", "hello", "--output-format", "text"]);
    }

    #[test]
    fn build_args_codex_format() {
        let args = AiCli::Codex.build_args("hello");
        assert_eq!(args, vec!["exec", "hello"]);
    }

    #[test]
    fn build_args_korean_prompt_passthrough() {
        let prompt = "한글 prompt 테스트";
        assert!(AiCli::Claude.build_args(prompt).contains(&prompt));
        assert!(AiCli::Codex.build_args(prompt).contains(&prompt));
    }

    #[test]
    fn binary_names() {
        assert_eq!(AiCli::Claude.binary(), "claude");
        assert_eq!(AiCli::Codex.binary(), "codex");
    }

    #[test]
    fn ai_cli_serializes_lowercase() {
        // serde rename_all = "lowercase" 검증 (frontend AiCli 타입과 호환).
        let json = serde_json::to_string(&AiCli::Claude).unwrap();
        assert_eq!(json, r#""claude""#);
        let json = serde_json::to_string(&AiCli::Codex).unwrap();
        assert_eq!(json, r#""codex""#);
    }
}
