-- v0.4 #1 (UltraPlan plan/31 §2) — per-repo forge account override.
--
-- 사용자 핵심 요구: 회사 (Gitea, 회사 PAT) vs 개인 (GitHub, 개인 PAT) 분리.
-- 현재 forge_client_for_repo 가 forge_kind first-match — repo 별 명시 계정 지정 불가.
--
-- Resolution chain (forge_commands.rs::forge_client_for_repo 변경 동반):
--   1. repos.forge_account_id (per-repo 명시 override, 본 컬럼)
--   2. profiles.default_forge_account_id (active Profile)
--   3. forge_kind first-match (기존 fallback, 호환성 보존)
--
-- 외부 사례: Tower/Fork/SourceTree/GitKraken 모두 per-repo PAT 미지원 — git-fried 가 첫 도입.
--
-- 위험:
--   - 기존 repos 모든 row 에 NULL 이라 fallback chain 자동 진입 — 회귀 위험 없음
--   - FK ON DELETE 명시 안 함 (default RESTRICT) — forge_accounts 삭제 시 referenced repo 있으면 차단
--     (사용자 의도 보호: 잘못된 삭제로 repo 가 fallback 모드로 silent 전환 방지)

ALTER TABLE repos ADD COLUMN forge_account_id INTEGER REFERENCES forge_accounts(id);

-- Resolution chain 의 1단계 lookup 가속.
CREATE INDEX IF NOT EXISTS idx_repos_forge_account ON repos(forge_account_id);
