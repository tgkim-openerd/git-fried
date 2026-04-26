// Tauri IPC 핸들러 모듈.
//
// 모든 #[tauri::command] 함수는 commands.rs 에 모아두고,
// generate_handler! 매크로 호출은 lib.rs 의 invoke_handler() 에서 직접.
// (Box<dyn Fn> 으로 감싸지 못하는 매크로 한계 우회)
pub mod commands;
pub mod forge_commands;
pub mod profile_commands;
pub mod v02_commands;

pub use commands::*;
pub use forge_commands::*;
pub use profile_commands::*;
pub use v02_commands::*;
