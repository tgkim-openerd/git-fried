// git/profile_match.rs — plan/43 P2.5: 계정 기반 자동 매칭.
//
// 레포 등록 시 forge 계정에 맞는 프로필을 자동 선택해 바인딩 (수동 지정 불요).
// 매칭 규칙: forge_kind + owner(== forge 계정 username) 정확 일치가 **1건일 때만** 자동 바인딩.
//   0건 → 공용 프로필 fallback. 다중 후보 → 모호 → 자동 안 함 (토스트 제안은 UI/P4).
// 수동 pin(profile_pinned=true) 레포는 자동 매칭이 절대 건드리지 않음 (D7).
//
// 트리거: register_repo 단일 진입점 — add_repo IPC / clone_repo 모두 경유 (F-01).
// backfill: 기존 레포는 startup 후처리에서 1회 평가 (F-07).

use crate::error::{AppError, AppResult};
use crate::git::repository::ForgeKindLite;
use crate::storage::db::{Db, DbExt, Repo};
use sqlx::Row;

/// 레포의 forge_kind + owner 에 매칭되는 프로필 id.
/// 정확히 1건일 때만 Some — 0건/다중 후보는 None (자동 바인딩 안 함, 모호).
async fn find_matching_profile(
    db: &Db,
    forge_kind: &str,
    forge_owner: &str,
) -> AppResult<Option<i64>> {
    // profile → default_forge_account_id → forge_accounts JOIN.
    // forge_kind 일치 + username == forge_owner (case-insensitive).
    let rows = sqlx::query(
        "SELECT p.id AS profile_id \
         FROM profiles p \
         JOIN forge_accounts fa ON fa.id = p.default_forge_account_id \
         WHERE fa.forge_kind = ? AND lower(fa.username) = lower(?)",
    )
    .bind(forge_kind)
    .bind(forge_owner)
    .fetch_all(&db.pool)
    .await
    .map_err(AppError::Db)?;
    if rows.len() == 1 {
        Ok(Some(rows[0].try_get("profile_id")?))
    } else {
        Ok(None) // 0건 또는 다중 후보 → 자동 매칭 보류.
    }
}

/// 갓 등록된(또는 미바인딩) 레포에 자동 매칭 실행.
/// 조건: profile_id IS NULL AND NOT profile_pinned. 그 외엔 그대로 반환.
pub async fn auto_match(db: &Db, repo: &Repo) -> AppResult<Repo> {
    if repo.profile_id.is_some() || repo.profile_pinned {
        return Ok(repo.clone()); // 이미 바인딩됐거나 수동 pin — 건드리지 않음.
    }
    let owner = repo.forge_owner.as_deref().unwrap_or("");
    if owner.is_empty() {
        return Ok(repo.clone()); // owner 불명 — 매칭 불가, 공용 fallback.
    }
    match find_matching_profile(db, &repo.forge_kind, owner).await? {
        Some(pid) => {
            tracing::info!(
                target: "git_fried_lib::profile_match",
                repo_id = repo.id,
                profile_id = pid,
                "자동 매칭 — 프로필 바인딩 (pinned=false)"
            );
            // 자동 바인딩 — pinned=false (수동 지정 아님 → 이후 재평가 대상).
            db.set_repo_profile(repo.id, Some(pid), false).await
        }
        None => Ok(repo.clone()),
    }
}

/// 단일 진입점 — 레포 등록 + 자동 매칭. add_repo IPC / clone_repo 모두 이 함수 경유 (F-01).
#[allow(clippy::too_many_arguments)]
pub async fn register_repo(
    db: &Db,
    local_path: &str,
    workspace_id: Option<i64>,
    name: Option<&str>,
    default_branch: Option<&str>,
    default_remote: Option<&str>,
    forge_kind: ForgeKindLite,
    forge_owner: Option<&str>,
    forge_repo: Option<&str>,
) -> AppResult<Repo> {
    let repo = db
        .add_repo(
            local_path,
            workspace_id,
            name,
            default_branch,
            default_remote,
            forge_kind,
            forge_owner,
            forge_repo,
        )
        .await?;
    auto_match(db, &repo).await
}

/// startup 후처리 backfill — 미바인딩(profile_id NULL & !pinned) 기존 레포 1회 평가.
/// 자동 매칭이 NULL 만 채우므로 재실행해도 idempotent (F-07).
pub async fn backfill_auto_match(db: &Db) -> AppResult<usize> {
    let repos = db.list_repos(None).await?;
    let mut bound = 0usize;
    for repo in repos {
        if repo.profile_id.is_none() && !repo.profile_pinned {
            let after = auto_match(db, &repo).await?;
            if after.profile_id.is_some() {
                bound += 1;
            }
        }
    }
    if bound > 0 {
        tracing::info!(
            target: "git_fried_lib::profile_match",
            bound,
            "backfill 자동 매칭 완료"
        );
    }
    Ok(bound)
}

/// stale 재평가 — forge 계정 삭제/변경 후 호출. pinned=false 레포만 재매칭.
/// 매칭이 어긋난 자동 바인딩을 현재 유효 매칭으로 교정 (D7: pinned=true 는 항상 보존).
pub async fn reevaluate_after_forge_change(db: &Db) -> AppResult<()> {
    let repos = db.list_repos(None).await?;
    for repo in repos {
        if repo.profile_pinned {
            continue; // 수동 pin 보존.
        }
        let owner = repo.forge_owner.as_deref().unwrap_or("");
        let current_match = if owner.is_empty() {
            None
        } else {
            find_matching_profile(db, &repo.forge_kind, owner).await?
        };
        // 현재 바인딩과 재평가 결과가 다르면 교정 (None ↔ Some 포함).
        if current_match != repo.profile_id {
            db.set_repo_profile(repo.id, current_match, false).await?;
        }
    }
    tracing::info!(
        target: "git_fried_lib::profile_match",
        "forge 변경 후 자동 매칭 재평가 완료"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profiles::{create, ProfileInput};
    use crate::storage::Db;

    /// forge_accounts row 직접 삽입 (테스트 helper — forge IPC 우회).
    async fn add_forge_account(db: &Db, kind: &str, base_url: &str, username: &str) -> i64 {
        sqlx::query(
            "INSERT INTO forge_accounts (forge_kind, base_url, username, keychain_ref) \
             VALUES (?, ?, ?, ?) RETURNING id",
        )
        .bind(kind)
        .bind(base_url)
        .bind(username)
        .bind("test-ref")
        .fetch_one(&db.pool)
        .await
        .unwrap()
        .try_get::<i64, _>("id")
        .unwrap()
    }

    async fn mk_profile_with_account(db: &Db, name: &str, account_id: i64) -> i64 {
        let p = create(
            &db.pool,
            ProfileInput {
                name: name.to_string(),
                git_user_name: None,
                git_user_email: None,
                signing_key: None,
                ssh_key_path: None,
                default_forge_account_id: Some(account_id),
            },
        )
        .await
        .unwrap();
        p.id
    }

    #[tokio::test]
    async fn test_auto_match_exact_single() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        let acc = add_forge_account(&db, "github", "https://github.com", "tgkim").await;
        let pid = mk_profile_with_account(&db, "개인", acc).await;

        // forge_owner=tgkim 인 github 레포 → 매칭.
        let repo = register_repo(
            &db,
            "/tmp/m1",
            None,
            Some("m1"),
            None,
            None,
            ForgeKindLite::Github,
            Some("tgkim"),
            None,
        )
        .await
        .unwrap();
        assert_eq!(repo.profile_id, Some(pid));
        assert!(!repo.profile_pinned); // 자동 매칭은 pinned=false.
    }

    #[tokio::test]
    async fn test_auto_match_ambiguous_skips() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();

        // 같은 forge_kind + username 의 계정 2개 → 프로필 2개 → 다중 후보.
        let acc1 = add_forge_account(&db, "gitea", "https://git.a.com", "tgkim").await;
        let acc2 = add_forge_account(&db, "gitea", "https://git.b.com", "tgkim").await;
        mk_profile_with_account(&db, "A", acc1).await;
        mk_profile_with_account(&db, "B", acc2).await;

        let repo = register_repo(
            &db,
            "/tmp/m2",
            None,
            Some("m2"),
            None,
            None,
            ForgeKindLite::Gitea,
            Some("tgkim"),
            None,
        )
        .await
        .unwrap();
        // 다중 후보 → 자동 바인딩 안 함 (공용 fallback).
        assert_eq!(repo.profile_id, None);
    }

    #[tokio::test]
    async fn test_auto_match_no_match_and_pin_preserved() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open(tmp.path()).await.unwrap();
        let acc = add_forge_account(&db, "github", "https://github.com", "tgkim").await;
        let pid = mk_profile_with_account(&db, "개인", acc).await;

        // owner 불일치 → 매칭 없음.
        let repo = register_repo(
            &db,
            "/tmp/m3",
            None,
            Some("m3"),
            None,
            None,
            ForgeKindLite::Github,
            Some("someone-else"),
            None,
        )
        .await
        .unwrap();
        assert_eq!(repo.profile_id, None);

        // 수동 pin 후 auto_match 재실행 → 건드리지 않음.
        let pinned = db.set_repo_profile(repo.id, Some(pid), true).await.unwrap();
        let after = auto_match(&db, &pinned).await.unwrap();
        assert_eq!(after.profile_id, Some(pid));
        assert!(after.profile_pinned);
    }
}
