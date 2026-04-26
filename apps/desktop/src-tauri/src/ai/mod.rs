// AI subprocess 통합 — Claude Code CLI / Codex CLI.
//
// `docs/plan/04 §11` 의 표준 spawn 함수.
//
// 디자인:
//   - 자체 LLM 인프라 없음. 사용자 PATH 의 `claude` / `codex` CLI 호출.
//   - 토큰/비용/rate limit 모두 외부 위임.
//   - prompt 빌드 + stream + 결과 적용만 책임.
//   - secret 마스킹 사전 처리 (`.env`, `ghp_*`, `gho_*`, `glpat-*` 등).
pub mod runner;
pub mod prompts;

pub use runner::{ai_run, detect_clis, AiCli, AiOutput, AiProbe};
pub use prompts::{
    code_review_prompt, commit_message_prompt, composer_plan_prompt, explain_branch_prompt,
    explain_commit_prompt, mask_secrets, merge_resolution_prompt, pr_body_prompt,
    stash_message_prompt,
};
