-- 초기 스키마. docs/plan/04 §5 의 데이터 모델과 일치.
-- 모든 한글 텍스트는 SQLite 기본 UTF-8 저장 — encoding 옵션 별도 설정 불필요.

CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    forge_kind TEXT NOT NULL DEFAULT 'mixed', -- 'gitea' | 'github' | 'mixed'
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    local_path TEXT NOT NULL UNIQUE,
    default_remote TEXT,
    default_branch TEXT,
    forge_kind TEXT NOT NULL DEFAULT 'unknown', -- 'gitea' | 'github' | 'unknown'
    forge_owner TEXT,
    forge_repo TEXT,
    last_fetched_at INTEGER,
    is_pinned INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_repos_workspace ON repos(workspace_id);

-- forge 계정 (PAT 본체는 keyring, 본 테이블에는 ref 만 보관)
CREATE TABLE IF NOT EXISTS forge_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forge_kind TEXT NOT NULL,        -- 'gitea' | 'github'
    base_url TEXT NOT NULL,          -- 'https://git.dev.opnd.io' | 'https://api.github.com'
    username TEXT,
    keychain_ref TEXT NOT NULL,      -- OS keychain entry 식별자
    UNIQUE(forge_kind, base_url, username)
);

-- 프로파일 (개인 ↔ 회사 1-click 토글, v0.3 에서 활용)
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    git_user_name TEXT,
    git_user_email TEXT,
    signing_key TEXT,
    ssh_key_path TEXT,
    default_forge_account_id INTEGER REFERENCES forge_accounts(id),
    is_active INTEGER NOT NULL DEFAULT 0
);

-- KV 설정 (UI 테마 / 마지막 활성 워크스페이스 등)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 커밋 인덱스 (검색용, v0.3 FTS5 와 함께 활용)
CREATE TABLE IF NOT EXISTS commits (
    repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    sha TEXT NOT NULL,
    parent_shas TEXT,        -- JSON array
    author_name TEXT,
    author_email TEXT,
    author_at INTEGER,
    message TEXT,
    PRIMARY KEY (repo_id, sha)
);
