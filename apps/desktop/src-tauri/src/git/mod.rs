// Git 서비스 모듈.
//
// 디자인 결정 (`docs/plan/04 §3` 참조):
//   - read path: git2-rs (in-process, 빠름) → repository.rs
//   - heavy/write path: git CLI shell-out (정확함) → runner.rs
//   - 모든 child process 는 한글 안전 spawn 함수 (runner::git_run) 통과
pub mod commit;
pub mod diff;
pub mod repository;
pub mod runner;
pub mod stage;
pub mod status;
pub mod sync;

#[cfg(test)]
mod tests;

pub use repository::*;
pub use runner::{git_run, GitOutput, GitRunOpts};
