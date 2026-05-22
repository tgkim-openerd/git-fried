-- plan/43 P1 — Per-Repo Profile Binding.
--
-- 레포마다 git 신원(commit author) + push credential 을 프로필로 바인딩.
-- 모델: zero-config 공용(default) 프로필 + 계정 기반 자동 매칭 + 수동 pin override.
--
-- 컬럼:
--   repos.profile_id      — 바인딩된 프로필. 프로필 삭제 시 SET NULL → 공용 fallback
--                           (레포 row 보존, CASCADE-삭제 아님).
--   repos.profile_pinned  — 1 = 사용자 수동 지정 (자동 매칭이 덮어쓰지 않음).
--                           0 = 자동 매칭 대상. profile_id 만으론 "미매칭" 과
--                           "수동으로 공용 선택" 을 구분 못 하므로 별도 컬럼 (D7).
--   profiles.is_default   — 공용(default) 프로필 표식. is_active("전역 활성") 와
--                           의미 분리 (D2). 레포 바인딩 없을 때의 fallback SoT.
--
-- 0006/0007 패턴 답습 — 별도 테이블 아닌 repos/profiles 컬럼 추가.

ALTER TABLE repos    ADD COLUMN profile_id INTEGER
  REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE repos    ADD COLUMN profile_pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN is_default     INTEGER NOT NULL DEFAULT 0;

-- 기존 is_active=1 → is_default=1 이행. multi-active 손상 상태 방어:
-- MIN(rowid) 1개만 승격(collapse) → 아래 unique index 생성이 실패하지 않도록.
-- is_active row 가 0개면 subquery 가 NULL → 아무 row 도 승격 안 됨 (backfill 이 처리).
UPDATE profiles SET is_default = 1
  WHERE rowid = (SELECT MIN(rowid) FROM profiles WHERE is_active = 1);

-- is_default 최대 1개 보장 — partial unique index (is_default=1 인 row 만 인덱스).
CREATE UNIQUE INDEX profiles_is_default_one ON profiles(is_default) WHERE is_default = 1;

-- profile_id JOIN 용 인덱스 (0006 의 forge_account_id 인덱스와 일관).
CREATE INDEX idx_repos_profile_id ON repos(profile_id);
