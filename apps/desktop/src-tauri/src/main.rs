// Tauri 진입점. 실제 로직은 lib.rs 의 run() 에 위임.
//
// 추가로 git rebase -i 의 GIT_SEQUENCE_EDITOR 로 자기 자신을 호출할 때 처리하는
// helper sub-command 분기를 둔다 (docs/plan/09 §4.1).
//   - `--rebase-todo-helper <src> <dst>` : 미리 만든 todo 를 git 임시 파일로 복사
//
// 분기 처리 후에는 Tauri 앱을 시작하지 않고 즉시 종료.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::ErrorKind;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match handle_helpers(&args) {
        Ok(true) => return, // helper 처리됨 → Tauri 앱 시작 안 함
        Ok(false) => {}     // helper 아님 → 정상 진입
        Err(e) => {
            eprintln!("git-fried helper error: {e}");
            std::process::exit(1);
        }
    }
    git_fried_lib::run();
}

/// `--xxx-helper` sub-command 처리. 처리됐으면 `Ok(true)`, 평범한 실행이면 `Ok(false)`.
fn handle_helpers(args: &[String]) -> std::io::Result<bool> {
    if args.len() < 2 {
        return Ok(false);
    }
    match args[1].as_str() {
        "--rebase-todo-helper" => {
            // args[2] = source path (우리가 만든 todo)
            // args[3] = git 이 넘긴 dest path
            if args.len() != 4 {
                return Err(io_err("--rebase-todo-helper 인자 부족 (src, dst 필수)"));
            }
            let src = std::fs::read_to_string(&args[2])?;
            std::fs::write(&args[3], src)?;
            Ok(true)
        }
        _ => Ok(false),
    }
}

fn io_err(msg: &str) -> std::io::Error {
    std::io::Error::new(ErrorKind::InvalidInput, msg)
}
