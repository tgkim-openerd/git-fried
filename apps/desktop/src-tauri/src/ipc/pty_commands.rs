// 통합 터미널 IPC (`docs/plan/10 옵션 A`).
//
// Tauri Channel<Vec<u8>> 로 frontend xterm.js 와 양방향 binding:
//   - pty_open  : shell spawn + reader task spawn → id 반환
//   - pty_write : 사용자 입력을 stdin 에 write
//   - pty_resize: 창 크기 변경
//   - pty_close : kill + 레지스트리 제거

use crate::error::{AppError, AppResult};
use crate::AppState;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::ipc::Channel;

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
    let cwd = PathBuf::from(&args.cwd);
    let (id, session) = state.pty.open(&cwd, &args.shell, args.cols, args.rows)?;
    let reader = session.lock().take_reader()?;

    // reader 는 blocking read — 별도 std::thread 로 분리.
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => break, // EOF (shell 종료)
                Ok(n) => {
                    if on_data.send(buf[..n].to_vec()).is_err() {
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
