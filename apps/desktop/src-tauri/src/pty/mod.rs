// 통합 터미널 — `docs/plan/10 옵션 A` 구현.
//
// PTY (Windows ConPTY / Unix forkpty) 위에 shell 을 띄우고 stdin/stdout 을 Tauri
// Channel<Vec<u8>> 로 frontend xterm.js 와 양방향 binding.
//
// 핵심 보장:
//   1. shell 환경변수 LANG=C.UTF-8 / LC_ALL=C.UTF-8 → 한글 안전.
//   2. master reader 를 별도 blocking task 에 옮겨 stdout chunk 를 4KB 단위로 emit.
//   3. PtyRegistry 가 session id (u64) 를 발급, IPC 가 id 로 lookup.
//   4. 세션 close 시 child kill + reader join + master/slave drop.

use crate::error::{AppError, AppResult};
use parking_lot::Mutex as PlMutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// 단일 PTY 세션. master 만 보유 — slave 는 spawn 후 즉시 drop.
pub struct PtySession {
    /// shell 명령 (예: pwsh.exe / bash). 디버깅용 표시.
    pub shell: String,
    /// master fd — resize / drop 시 사용.
    master: Box<dyn MasterPty + Send>,
    /// stdin writer. None 이면 close 됨.
    writer: Option<Box<dyn Write + Send>>,
    /// child process 핸들 (kill 가능).
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl PtySession {
    pub fn write_all(&mut self, data: &[u8]) -> AppResult<()> {
        let w = self
            .writer
            .as_mut()
            .ok_or_else(|| AppError::internal("pty writer 가 close 됨"))?;
        w.write_all(data).map_err(AppError::Io)?;
        w.flush().map_err(AppError::Io)?;
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> AppResult<()> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::internal(format!("pty resize 실패: {e}")))
    }

    /// 별도 blocking task 에서 stdout 을 폴링하기 위한 reader 획득 (1회만 호출).
    pub fn take_reader(&self) -> AppResult<Box<dyn std::io::Read + Send>> {
        self.master
            .try_clone_reader()
            .map_err(|e| AppError::internal(format!("pty reader 복제 실패: {e}")))
    }

    pub fn kill(&mut self) {
        let _ = self.child.kill();
        // writer 도 명시적으로 close 해서 reader 가 EOF 받도록.
        self.writer = None;
    }
}

/// 세션 레지스트리 — id (u64) → PtySession.
pub struct PtyRegistry {
    next_id: AtomicU64,
    sessions: PlMutex<HashMap<u64, Arc<PlMutex<PtySession>>>>,
}

impl PtyRegistry {
    pub fn new() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            sessions: PlMutex::new(HashMap::new()),
        }
    }

    /// 새 PTY 세션 생성. shell 을 실행하고 id 반환.
    pub fn open(
        &self,
        cwd: &Path,
        shell: &str,
        cols: u16,
        rows: u16,
    ) -> AppResult<(u64, Arc<PlMutex<PtySession>>)> {
        if shell.trim().is_empty() {
            return Err(AppError::validation("shell 이 비어있습니다."));
        }
        if !cwd.exists() {
            return Err(AppError::validation(format!(
                "cwd 경로가 존재하지 않습니다: {}",
                cwd.display()
            )));
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::internal(format!("openpty 실패: {e}")))?;

        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(cwd);
        // 한글 안전 — 모든 spawn 패턴과 동일.
        cmd.env("LANG", "C.UTF-8");
        cmd.env("LC_ALL", "C.UTF-8");
        cmd.env("PYTHONIOENCODING", "utf-8");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| AppError::internal(format!("shell spawn 실패: {e}")))?;

        // slave 는 spawn 후 더 이상 필요 없음 — drop.
        drop(pair.slave);

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| AppError::internal(format!("pty writer 추출 실패: {e}")))?;

        let session = PtySession {
            shell: shell.to_string(),
            master: pair.master,
            writer: Some(writer),
            child,
        };

        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let arc = Arc::new(PlMutex::new(session));
        self.sessions.lock().insert(id, arc.clone());
        Ok((id, arc))
    }

    pub fn get(&self, id: u64) -> Option<Arc<PlMutex<PtySession>>> {
        self.sessions.lock().get(&id).cloned()
    }

    pub fn close(&self, id: u64) -> AppResult<()> {
        if let Some(arc) = self.sessions.lock().remove(&id) {
            arc.lock().kill();
        }
        Ok(())
    }
}

impl Default for PtyRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// PtySession 이 생성되고 kill 까지 무사 동작.
    #[cfg(windows)]
    #[test]
    fn test_pty_open_pwsh_and_close() {
        let reg = PtyRegistry::new();
        let cwd = std::env::temp_dir();
        // Windows 라면 cmd.exe 가 항상 있음. pwsh 는 없을 수 있어 cmd 로 검증.
        let (id, arc) = reg.open(&cwd, "cmd.exe", 80, 24).unwrap();
        assert!(id >= 1);
        // reader 한 번 가져올 수 있어야 함.
        let _reader = arc.lock().take_reader().unwrap();
        reg.close(id).unwrap();
        assert!(reg.get(id).is_none(), "close 후 lookup 실패해야 함");
    }

    #[cfg(unix)]
    #[test]
    fn test_pty_open_sh_and_close() {
        let reg = PtyRegistry::new();
        let cwd = std::env::temp_dir();
        let (id, arc) = reg.open(&cwd, "/bin/sh", 80, 24).unwrap();
        assert!(id >= 1);
        let _reader = arc.lock().take_reader().unwrap();
        reg.close(id).unwrap();
        assert!(reg.get(id).is_none());
    }

    #[test]
    fn test_open_invalid_cwd_rejects() {
        let reg = PtyRegistry::new();
        let cwd = Path::new("Z:/non/existent/dir/nope/12345");
        let r = reg.open(cwd, "cmd.exe", 80, 24);
        assert!(r.is_err());
    }

    #[test]
    fn test_open_empty_shell_rejects() {
        let reg = PtyRegistry::new();
        let cwd = std::env::temp_dir();
        let r = reg.open(&cwd, "", 80, 24);
        assert!(r.is_err());
    }
}
