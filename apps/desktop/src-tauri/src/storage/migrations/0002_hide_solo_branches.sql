-- A1 — Hide branches in graph (시각화 필터, 데이터 변경 0).
-- Solo 는 세션 메모리 (transient) — DB 저장 안 함.
--
-- ref_kind 컬럼: v1.x 의 "Hide all Remotes / Tags / Branches / Stashes" 섹션 헤더
-- 일괄 토글 (`docs/plan/11 §5d`) 에서 sub-set lookup 빠르게.

CREATE TABLE IF NOT EXISTS repo_ref_hidden (
    repo_id   INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    ref_name  TEXT    NOT NULL,           -- 'origin/feature/x', 'refs/tags/v1.0', ...
    ref_kind  TEXT    NOT NULL DEFAULT 'branch',  -- 'branch' | 'remote' | 'tag' | 'stash'
    hidden_at INTEGER NOT NULL,           -- unix ts
    PRIMARY KEY (repo_id, ref_name)
);

-- bulk hide / unhide 시 (repo_id, ref_kind) WHERE 절 efficient
CREATE INDEX IF NOT EXISTS idx_repo_ref_hidden_kind
    ON repo_ref_hidden(repo_id, ref_kind);
