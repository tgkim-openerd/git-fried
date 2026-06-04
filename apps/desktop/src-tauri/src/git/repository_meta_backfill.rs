//! forge 메타 backfill (Sprint 2026-06-04).
//!
//! GitKraken 대량 임포트 시 detect_meta 실패(미클론 등)로 `forge_owner`/`forge_repo`/
//! `default_remote` 가 비어 forge(PR/Issue/Release) 기능이 막힌 레포를, 기동 후 background
//! 로 1회 일괄 재탐지해 복구한다. best-effort — 경로 부재/비 git/remote 없음은 graceful skip.
//!
//! `forge_client_for_repo` 의 lazy self-heal(`ensure_forge_meta`) 과 대칭이다. lazy 는
//! 사용자가 클릭한 레포 1건을 즉시 복구하고, backfill 은 전체 DB 를 정리한다(Launchpad /
//! bulk PR 목록 품질 — `bulk_list_prs` 는 forge_kind=unknown 또는 owner/repo 가 없으면
//! skip 하므로 backfill 이 필요). 둘 다 `update_repo_forge_meta` 부분 UPDATE 를 써서
//! 사용자 바인딩·핀을 보존한다.

use crate::error::AppResult;
use crate::git::repository as repo;
use crate::storage::{Db, DbExt, Repo};
use std::sync::Arc;
use tokio::sync::Semaphore;

/// detect_meta 재탐지 동시 실행 상한 (bulk.rs 의 네트워크 semaphore 와 동일 보수치).
const CONCURRENCY: usize = 4;

#[derive(Debug, Default, Clone, Copy)]
pub struct BackfillReport {
    /// forge 메타가 새로 채워진 레포 수.
    pub healed: usize,
    /// 로컬 경로가 사라진 레포 (이동/삭제) — skip.
    pub skipped_missing: usize,
    /// git 레포지만 origin remote 가 없거나 URL 에서 owner/repo 추출 불가 — skip.
    pub skipped_no_meta: usize,
    /// detect_meta task / DB write 실패 — skip.
    pub failed: usize,
}

enum Outcome {
    Healed,
    SkippedMissing,
    SkippedNoMeta,
    Failed,
}

/// forge 메타가 비어있는 레포만 detect_meta 재실행해 복구.
///
/// **호출 순서 주의**: profile 자동 매칭(`profile_match::backfill_auto_match`) 은
/// `forge_owner` 가 비면 early return 하므로, 같은 기동에서 자동 매칭까지 반영하려면
/// 이 함수가 *먼저* 끝난 뒤 auto_match 를 재실행해야 한다 (lib.rs background task 참조).
pub async fn backfill_forge_meta(db: &Db) -> AppResult<BackfillReport> {
    let repos = db.list_repos(None).await?;
    let targets: Vec<Repo> = repos
        .into_iter()
        .filter(|r| r.forge_owner.is_none() || r.forge_repo.is_none() || r.default_remote.is_none())
        .collect();

    if targets.is_empty() {
        return Ok(BackfillReport::default());
    }

    let sem = Arc::new(Semaphore::new(CONCURRENCY));
    let mut handles = Vec::with_capacity(targets.len());
    for r in targets {
        let db = db.clone();
        let sem = sem.clone();
        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.expect("semaphore closed");
            heal_one(&db, &r).await
        }));
    }

    let mut report = BackfillReport::default();
    for h in handles {
        match h.await {
            Ok(Outcome::Healed) => report.healed += 1,
            Ok(Outcome::SkippedMissing) => report.skipped_missing += 1,
            Ok(Outcome::SkippedNoMeta) => report.skipped_no_meta += 1,
            Ok(Outcome::Failed) => report.failed += 1,
            Err(_) => report.failed += 1, // JoinError (task panic 등)
        }
    }
    Ok(report)
}

async fn heal_one(db: &Db, r: &Repo) -> Outcome {
    let path = std::path::PathBuf::from(&r.local_path);
    if !path.exists() {
        return Outcome::SkippedMissing;
    }
    // detect_meta 는 sync(libgit2) — blocking pool 에서 실행해 async 워커 차단 회피.
    let meta = match tokio::task::spawn_blocking(move || repo::detect_meta(&path)).await {
        Ok(Ok(m)) => m,
        _ => return Outcome::Failed,
    };
    // remote 가 전혀 없으면 owner/repo/remote 모두 None — 갱신할 게 없음.
    if meta.forge_owner.is_none() && meta.forge_repo.is_none() && meta.default_remote.is_none() {
        return Outcome::SkippedNoMeta;
    }
    match db
        .update_repo_forge_meta(
            r.id,
            meta.default_branch.as_deref(),
            meta.default_remote.as_deref(),
            meta.forge_kind,
            meta.forge_owner.as_deref(),
            meta.forge_repo.as_deref(),
        )
        .await
    {
        Ok(_) => Outcome::Healed,
        Err(_) => Outcome::Failed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::repository::ForgeKindLite;

    /// 비어있던 forge 메타가 실제 origin remote 로부터 복구되고,
    /// 경로가 사라진 레포는 skip 으로 분류되는지.
    #[tokio::test]
    async fn test_backfill_heals_empty_forge_meta_and_skips_missing() {
        use git2::Repository as GitRepo;

        let db_tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(db_tmp.path()).await.unwrap();

        // 실제 git 레포 + origin remote (gitea 인식 호스트).
        let repo_dir = tempfile::tempdir().unwrap();
        let grepo = GitRepo::init(repo_dir.path()).unwrap();
        grepo
            .remote("origin", "https://git.dev.opnd.io/testorg/testrepo.git")
            .unwrap();

        // forge 메타 비운 채 등록 (임포트 실패 상황 재현).
        let path_str = repo_dir.path().to_string_lossy().to_string();
        let added = db
            .add_repo(
                &path_str,
                None,
                Some("testrepo"),
                None,
                None,
                ForgeKindLite::Unknown,
                None,
                None,
            )
            .await
            .unwrap();
        assert!(added.forge_owner.is_none());

        // 경로 부재 레포 (skip 확인).
        db.add_repo(
            "D:/this/path/does/not/exist/repoX",
            None,
            Some("ghost"),
            None,
            None,
            ForgeKindLite::Unknown,
            None,
            None,
        )
        .await
        .unwrap();

        let report = backfill_forge_meta(&db).await.unwrap();
        assert_eq!(report.healed, 1, "git 레포 1건 heal");
        assert_eq!(report.skipped_missing, 1, "경로 부재 1건 skip");

        let healed = db.get_repo(added.id).await.unwrap();
        assert_eq!(healed.forge_owner.as_deref(), Some("testorg"));
        assert_eq!(healed.forge_repo.as_deref(), Some("testrepo"));
        assert_eq!(healed.forge_kind, "gitea");
        assert_eq!(healed.default_remote.as_deref(), Some("origin"));
    }

    /// 이미 메타가 채워진 레포만 있으면 no-op (빈 리포트).
    #[tokio::test]
    async fn test_backfill_noop_when_all_populated() {
        let db_tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(db_tmp.path()).await.unwrap();
        db.add_repo(
            "D:/some/repo",
            None,
            Some("r"),
            Some("main"),
            Some("origin"),
            ForgeKindLite::Github,
            Some("owner"),
            Some("repo"),
        )
        .await
        .unwrap();
        let report = backfill_forge_meta(&db).await.unwrap();
        assert_eq!(report.healed, 0);
        assert_eq!(report.skipped_missing, 0);
        assert_eq!(report.skipped_no_meta, 0);
        assert_eq!(report.failed, 0);
    }
}
