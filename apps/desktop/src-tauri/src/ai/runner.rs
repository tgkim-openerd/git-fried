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
use tokio::io::AsyncReadExt;
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
/// SAF-401 (Codex c82 audit + consultation P1): backend timeout + explicit child.kill().
///
/// 기존 (commit 770f1b9): `child.wait_with_output()` 가 child 소유권 가져가서 timeout 시
/// kill 불가 → OS 자연 종료 대기 (orphan). Codex audit `task-mp53zjgg` 가 HOLD 로 보고.
///
/// 본 refactor (Codex consultation `task-mp554150` P1):
///   1. `child.stdout.take()` + `child.stderr.take()` → 별도 spawn read tasks
///   2. `child.wait()` 를 timeout 으로 감쌈 — child 소유권 보존
///   3. timeout 시 `child.kill().await` + reap (`child.wait().await`)
///   4. accumulated stdout/stderr 는 timeout 시에도 부분 capture 가능
///
/// 60s 표준 (AI roundtrip doherty_threshold 8s × 7.5 여유) — p95 실측 후 조정.
pub const AI_RUN_TIMEOUT_SECS: u64 = 60;

/// SAF-401-FU (plan v0.9) — AI stdout/stderr 최대 누적 바이트.
///
/// claude/codex CLI 정상 응답은 보통 < 50KB. 1MB cap 은 정상 사용 100% cover +
/// runaway/악성 응답 OOM 방지. 초과 시 truncate + AppError::internal.
pub const AI_RUN_MAX_OUTPUT_BYTES: u64 = 1024 * 1024;

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

    // SAF-401 — child 소유권 보존 + explicit stdout/stderr take + child.wait + timeout kill.
    let mut child = cmd.spawn().map_err(AppError::Io)?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::internal("AI subprocess stdout 핸들 take 실패 (이미 닫힘)"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| AppError::internal("AI subprocess stderr 핸들 take 실패 (이미 닫힘)"))?;

    // 별도 task 로 stdout/stderr 비동기 누적 — child.wait 와 race.
    // SAF-401-FU (plan v0.9) — max 1MB cap. .take(N) 으로 hard limit → OOM 방지.
    let stdout_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let mut reader = stdout.take(AI_RUN_MAX_OUTPUT_BYTES);
        let _ = reader.read_to_end(&mut buf).await;
        buf
    });
    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let mut reader = stderr.take(AI_RUN_MAX_OUTPUT_BYTES);
        let _ = reader.read_to_end(&mut buf).await;
        buf
    });

    let status = match tokio::time::timeout(
        std::time::Duration::from_secs(AI_RUN_TIMEOUT_SECS),
        child.wait(),
    )
    .await
    {
        Ok(res) => res.map_err(AppError::Io)?,
        Err(_) => {
            // timeout — child kill + reap. orphan 방지.
            let _ = child.kill().await;
            let _ = child.wait().await;
            // read task abort (이미 EOF 가까이 갔거나 partial).
            stdout_task.abort();
            stderr_task.abort();
            return Err(AppError::internal(format!(
                "AI 명령 timeout {}초 초과 ({:?}) — child killed",
                AI_RUN_TIMEOUT_SECS, cli
            )));
        }
    };

    let stdout_bytes = stdout_task.await.unwrap_or_default();
    let stderr_bytes = stderr_task.await.unwrap_or_default();

    // Sprint c35 — git/path::decode_korean_safe 위임 (UTF-8 + GBK fallback).
    // stdout 은 NFC 미적용 (AI 응답 content 보존), stderr 도 동일.
    let stdout_text = decode_korean_safe(&stdout_bytes, false);
    let stderr_text = decode_korean_safe(&stderr_bytes, false);

    Ok(AiOutput {
        success: status.code() == Some(0),
        text: stdout_text,
        stderr: stderr_text,
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
