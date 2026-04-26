-- A4 — Launchpad PR meta (Pin / Snooze) + Saved Views (`docs/plan/11 §14`).
--
-- 설계 이유 (docs/plan/11 검토):
--   - Surrogate INTEGER PK + UNIQUE (5-tuple) — TEXT 4개 string compare 회피,
--     향후 saved_views FK / 다른 테이블에서 참조 가능.
--   - Partial index — 대부분 PR 이 default 상태, pinned/snoozed 만 빠르게 lookup.
--   - Saved Views 테이블 일반화 (view_kind 컬럼) — Launchpad 외 commit search /
--     미래 dashboard 도 동일 테이블 사용.

CREATE TABLE IF NOT EXISTS pr_meta (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    forge_kind    TEXT    NOT NULL,           -- 'gitea' | 'github'
    base_url      TEXT    NOT NULL,           -- 'https://git.dev.opnd.io'
    owner         TEXT    NOT NULL,
    repo          TEXT    NOT NULL,
    number        INTEGER NOT NULL,
    pinned        INTEGER NOT NULL DEFAULT 0, -- 0 | 1
    snoozed_until INTEGER NULL,               -- unix ts, NULL = active
    updated_at    INTEGER NOT NULL,
    UNIQUE (forge_kind, base_url, owner, repo, number)
);

-- Partial index: pinned=1 만 빠르게 lookup (전체 행 스캔 회피).
CREATE INDEX IF NOT EXISTS idx_pr_meta_pinned
    ON pr_meta(pinned) WHERE pinned = 1;

-- Snooze 만료 체크용.
CREATE INDEX IF NOT EXISTS idx_pr_meta_snoozed
    ON pr_meta(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- Launchpad 렌더 시 한 레포의 모든 PR meta 일괄 fetch.
CREATE INDEX IF NOT EXISTS idx_pr_meta_repo
    ON pr_meta(forge_kind, base_url, owner, repo);

-- Saved Views — 일반화된 filter / sort 직렬화 저장.
CREATE TABLE IF NOT EXISTS saved_views (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    view_kind   TEXT    NOT NULL,             -- 'launchpad_pr' | 미래 'launchpad_issue' | 'commit_search' 등
    name        TEXT    NOT NULL,
    filter_json TEXT    NOT NULL,             -- 직렬화된 filter (JSON)
    sort_json   TEXT    NULL,                 -- 직렬화된 sort (JSON, optional)
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    UNIQUE (view_kind, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_views_kind
    ON saved_views(view_kind, name);
