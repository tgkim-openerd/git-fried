-- commits 검색 / log 페이지네이션 성능 향상 (`docs/plan/15 §3-5`).
-- repo_id 로 필터 후 author_at DESC 로 정렬하는 일반 패턴 직격.
CREATE INDEX IF NOT EXISTS idx_commits_lookup
    ON commits(repo_id, author_at DESC);
