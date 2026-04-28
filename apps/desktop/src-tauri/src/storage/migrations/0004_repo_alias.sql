-- B4 — Repo tab alias (per-profile, `docs/plan/11 §15` "Repo tab alias").
--
-- 같은 레포가 profile (개인 ↔ 회사) 별로 다른 별칭 가질 수 있도록.
-- 예: peeloff/frontend → "회사 메인" (회사 profile) / "📦 ankentrip" (개인).
--
-- profile_id 는 NULL 허용 — NULL = 모든 profile 공통 (global default).
-- expression-based UNIQUE INDEX 로 (NULL 포함) 단일성 보장.

CREATE TABLE IF NOT EXISTS repo_alias (
    profile_id INTEGER NULL REFERENCES profiles(id) ON DELETE CASCADE,
    repo_id    INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    alias      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
);

-- (profile_id NULL 대체값 -1 로 unique) — SQLite 의 expression index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_repo_alias_profile_repo
    ON repo_alias(COALESCE(profile_id, -1), repo_id);

-- 한 레포의 모든 alias 일괄 fetch (Sidebar 렌더 시).
CREATE INDEX IF NOT EXISTS idx_repo_alias_repo
    ON repo_alias(repo_id);
