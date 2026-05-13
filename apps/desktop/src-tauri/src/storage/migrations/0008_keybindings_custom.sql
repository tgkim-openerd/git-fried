-- v0.5 #15 (UltraPlan plan/31) — Keybindings custom user storage.
--
-- 사용자가 useShortcuts 의 hardcoded chain 을 customize 가능. SQLite 에 binding 저장
-- (chord_normalized, action). 충돌 검출 = useShortcuts.findShortcutConflicts (v0.6 #22).
--
-- 동작:
--   App start 시 keybindings 테이블 load → bus.customBindings 적용 (priority > hardcoded).
--   사용자가 Settings → Keybindings 에서 add/edit/delete → 즉시 mutation + reload.
--
-- 실 UI / load logic 통합은 별도 sprint (본 migration 은 schema 만).

CREATE TABLE IF NOT EXISTS keybindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chord_normalized TEXT NOT NULL,          -- 'mod+shift+k' 같은 정규화 chord (useShortcuts.normalizeChord)
    action TEXT NOT NULL,                    -- ShortcutAction enum 값
    user_label TEXT,                          -- 사용자 메모 (optional)
    enabled INTEGER NOT NULL DEFAULT 1,       -- soft disable (delete 안 함)
    created_at INTEGER NOT NULL,
    UNIQUE(chord_normalized, action)          -- 같은 chord+action 중복 방지
);

CREATE INDEX IF NOT EXISTS idx_keybindings_action ON keybindings(action);
CREATE INDEX IF NOT EXISTS idx_keybindings_chord ON keybindings(chord_normalized);
