// Storage 레이어 — SQLite + sqlx.
//
// 디자인:
//   - 단일 풀 (Arc<SqlitePool>) 을 AppState 에 보관
//   - 마이그레이션은 시작 시 자동 실행 (`migrations/` 디렉토리, sqlx::migrate!)
//   - 모든 query 는 매크로 (`sqlx::query!`) 가 아닌 `sqlx::query` + `bind` 사용
//     → 컴파일 타임 schema 의존 제거 (offline 빌드에서도 OK)
pub mod db;

pub use db::{Db, DbExt};
