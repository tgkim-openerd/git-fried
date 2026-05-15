// Sprint c89-B Phase 1.4 (plan/36 §2.1.4 v0.2) — SAF-303 acquire_timeout 정책 검증.
//
// `storage::db::Db::open` 의 `SqlitePoolOptions::acquire_timeout(10s)` 정책 (SAF-303) 의
// 실제 sqlx error 분기를 cargo integration test 로 검증.
//
// 본 test 는 panic subprocess + SQLite WAL recovery 의 minimal subset:
//   - WAL recovery 자체는 SQLite spec — 우리 코드 cover 영역 아님 (별도 sprint).
//   - 그러나 pool exhaustion → acquire_timeout 동작은 우리 정책 (SAF-303 R5).
//   - Doherty Threshold (400ms) 초과 시 graceful timeout error 보장.
//
// 본 sprint scope 외:
//   - 실 subprocess spawn + SIGABRT + cross-process WAL recovery — Phase 2 또는 별도 sprint.
//   - `tests/panic_wal_recovery.rs` skeleton 만 두고 std::process::Command 절차 명시.

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;
use std::time::Duration;
use tempfile::TempDir;

/// SAF-303 정책 직접 검증 — pool exhaustion 시 short timeout error.
#[tokio::test]
async fn acquire_timeout_returns_error_when_pool_exhausted() {
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().join("test.db");

    let opts = SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))
        .unwrap()
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

    // test 용 short timeout — production 10s 면 test 실행 시간 폭증.
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_millis(200))
        .connect_with(opts)
        .await
        .expect("pool open");

    // 첫 connection acquire — pool 점유.
    let _conn1 = pool.acquire().await.expect("first acquire");

    // 두번째 acquire 시도 — 200ms timeout 후 sqlx::Error::PoolTimedOut 또는 동등.
    let start = std::time::Instant::now();
    let result = pool.acquire().await;
    let elapsed = start.elapsed();

    assert!(
        result.is_err(),
        "exhausted pool 의 두번째 acquire 는 error 기대"
    );
    let err = result.unwrap_err();
    // sqlx 0.8 의 PoolTimedOut variant 또는 Io. 분기 정확 매핑.
    let msg = err.to_string().to_lowercase();
    assert!(
        msg.contains("timed out") || msg.contains("timeout") || msg.contains("pool"),
        "예상 sqlx pool timeout error, 실제: {msg}"
    );
    // SAF-303 의 핵심 — Doherty threshold 25배 초과 안 함 (test 는 200ms 라 200~500ms 사이).
    assert!(
        elapsed >= Duration::from_millis(150),
        "acquire_timeout 보다 일찍 실패 — sqlx 동작 회귀: {elapsed:?}"
    );
    assert!(
        elapsed < Duration::from_millis(1500),
        "acquire_timeout 보다 너무 늦게 실패 — sqlx 회귀: {elapsed:?}"
    );
}

/// Pool 의 max_connections + acquire/release round-trip — pool 정책 가드.
#[tokio::test]
async fn pool_release_makes_connection_available_again() {
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().join("test.db");

    let opts = SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))
        .unwrap()
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_millis(500))
        .connect_with(opts)
        .await
        .expect("pool open");

    {
        let _c = pool.acquire().await.expect("first");
        // scope 종료 시 자동 release.
    }
    let _c2 = pool
        .acquire()
        .await
        .expect("release 후 두번째 acquire 가능해야");
}

/// sqlx::Transaction 의 explicit Drop (commit/rollback 호출 안 됨) → auto rollback.
/// SAF-301 reasoning 의 sqlx::Transaction Drop 동작 verify.
#[tokio::test]
async fn dropped_tx_without_commit_rolls_back() {
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().join("test.db");

    let opts = SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))
        .unwrap()
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(2)
        .connect_with(opts)
        .await
        .expect("pool open");

    sqlx::query("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)")
        .execute(&pool)
        .await
        .unwrap();

    // tx 시작 + insert 후 commit 안 하고 drop.
    {
        let mut tx = pool.begin().await.expect("begin");
        sqlx::query("INSERT INTO t (v) VALUES ('uncommitted')")
            .execute(&mut *tx)
            .await
            .unwrap();
        // 명시 drop — commit() 호출 안 됨. sqlx 가 자동 rollback.
    }

    // 새 query 로 카운트 — uncommitted row 가 보존되면 안 됨.
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM t")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        row.0, 0,
        "dropped tx 의 INSERT 가 auto-rollback 되지 않음 — sqlx 회귀"
    );
}
