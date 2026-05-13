-- v0.5 #9 (UltraPlan plan/31) — per-repo SSH key path override.
--
-- 사용자 요구: 회사 (회사 SSH key) vs 개인 (개인 SSH key) 분리.
-- 외부 사례: Tower 6+ Per-Repository SSH key (git config core.sshCommand wrapper).
-- 다른 git GUI (Fork / SourceTree / GitKraken) 미지원.
--
-- 동작:
--   repos.ssh_key_path = Some(path) 시 git operation 직전 `git -c core.sshCommand='ssh -i <path>' ...` 동등 효과.
--   None → Profile.ssh_key_path fallback (Profile 의 default).
--
-- v0.4 #1 forge_account_id 와 동일 fallback chain 패턴.
-- 실 git operation 통합은 git/runner.rs 수정 동반 (별도 sprint, 본 migration 은 schema 만).

ALTER TABLE repos ADD COLUMN ssh_key_path TEXT;
