// Tauri 진입점. 실제 로직은 lib.rs 의 run() 에 위임.
// 이 파일을 작게 유지하는 이유:
//  - 데스크탑 / 모바일 / 테스트가 같은 lib 를 공유 가능
//  - integration 테스트에서 lib API 직접 호출 가능
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    git_fried_lib::run();
}
