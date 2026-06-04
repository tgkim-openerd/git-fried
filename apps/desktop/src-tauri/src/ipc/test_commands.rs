// e2e 전용 IPC — debug 빌드에서만 컴파일/등록 (mod 선언 + 핸들러 등록 모두 #[cfg(debug_assertions)]).
//
// /verify 2026-06-04 Layer 2 — repo_mutation_guard 직렬화를 CDP e2e(Playwright + WebView2 CDP)가
// 관찰할 수 있게 enter/leave 타임스탬프를 반환하는 probe 커맨드. release 빌드에는 미포함.
//
// 관찰 패턴 (Codex 권고): 두 호출을 동시 발사 → 같은 repo 면 `enter2 >= leave1`(직렬화),
// 다른 repo 면 critical section 겹침(동시). 순수 timing 이 아니라 enter/leave ordering 으로 판정.

use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use crate::storage::Db;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

/// 프로세스 공통 monotonic 기준점 — enter/leave 를 같은 baseline 으로 ms 환산해
/// 호출 간 ordering(enter2 vs leave1) 을 비교 가능하게 한다.
fn baseline() -> Instant {
    static B: OnceLock<Instant> = OnceLock::new();
    *B.get_or_init(Instant::now)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardProbeArgs {
    pub repo_id: i64,
    pub delay_ms: u64,
    pub token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardProbeResult {
    pub token: String,
    /// guard 진입 시각 (baseline 기준 ms).
    pub enter_ms: u128,
    /// guard 해제 직전 시각 (baseline 기준 ms).
    pub leave_ms: u128,
}

/// repo_mutation_guard 획득 → enter 기록 → delay → leave 기록.
///
/// e2e 가 `Promise.all([guard_probe(repo=1,...A), guard_probe(repo=1,...B)])` 로 동시 발사 시,
/// guard 직렬화면 두 결과의 critical section([enter,leave])이 겹치지 않는다.
#[tauri::command]
pub async fn guard_probe(
    args: GuardProbeArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<GuardProbeResult> {
    let base = baseline();
    let _guard = state.repo_mutation_guard(args.repo_id).await;
    let enter_ms = base.elapsed().as_millis();
    // delay 는 e2e flake 방지용 — 5s cap (오남용/DoS 방지, debug 전용이라 영향 미미).
    tokio::time::sleep(Duration::from_millis(args.delay_ms.min(5000))).await;
    let leave_ms = base.elapsed().as_millis();
    Ok(GuardProbeResult {
        token: args.token,
        enter_ms,
        leave_ms,
    })
}

// ====== Fixture factory (e2e 격리 테스트용 가짜 git 저장소 생성) ======
//
// e2e 가 GIT_FRIED_DB_PATH 로 격리 DB 를 띄운 뒤, 통제된 상태(브랜치/충돌/스태시/remote)의 임시
// git 레포를 찍어내 add_repo 등록한다. 앱의 실제 git 실행 경로인 `git_run`(한글 안전 runner)으로
// 빌드해 현실성 보존. 결정론 핀(Codex BLOCKER): init -b main / repo-local identity / autocrlf=false
// / eol=lf / gpgsign=false / AUTHOR·COMMITTER_DATE 고정 — 환경 의존(기본 브랜치명/CRLF/서명/날짜)
// 제거. root/name 의 유니크성은 호출측(TS)이 보장.

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedFixtureArgs {
    /// "basic" | "branches" | "dirty" | "stash" | "conflict" | "remote"
    pub scenario: String,
    /// 임시 루트 디렉토리 (TS temp dir).
    pub root: String,
    /// 유니크 fixture 이름 (TS 가 충돌 없게 보장).
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeededRepo {
    pub repo_id: i64,
    pub path: String,
    pub default_branch: Option<String>,
    pub scenario: String,
}

/// 통제된 가짜 git 레포 생성 + add_repo 등록. debug 빌드 전용(모듈 #[cfg(debug_assertions)]).
/// 실패 시 생성한 fixture 디렉토리(+ remote 시나리오의 bare sibling)를 정리해
/// 부분 상태 누수를 막는다(DEFECT-3).
#[tauri::command]
pub async fn seed_fixture_repo(
    args: SeedFixtureArgs,
    state: tauri::State<'_, Arc<AppState>>,
) -> AppResult<SeededRepo> {
    let dir = Path::new(&args.root).join(&args.name);
    std::fs::create_dir_all(&dir).map_err(AppError::Io)?;

    let res = build_and_register(&dir, &args.scenario, &args.name, &state.db).await;
    if res.is_err() {
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(bare_sibling(&dir));
    }
    res
}

/// `<root>/<name>` → `<root>/<name>.git` — dotted name 안전(DEFECT-2: with_extension 은
/// `my.repo` 를 `my.git` 으로 잘못 만든다).
fn bare_sibling(dir: &Path) -> PathBuf {
    let leaf = dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    dir.with_file_name(format!("{leaf}.git"))
}

/// 결정론 핀 → 시나리오 빌드 → detect_meta → register_repo. 실패 시 caller 가 dir 정리.
async fn build_and_register(
    dir: &Path,
    scenario: &str,
    name: &str,
    db: &Db,
) -> AppResult<SeededRepo> {
    // 결정론 핀 — 모든 git_run 에 고정 날짜 env 적용 (commit hash 안정화).
    let opts = GitRunOpts {
        envs: vec![
            ("GIT_AUTHOR_DATE".into(), "2020-01-01 00:00:00 +0000".into()),
            (
                "GIT_COMMITTER_DATE".into(),
                "2020-01-01 00:00:00 +0000".into(),
            ),
        ],
        ..Default::default()
    };

    git_run(dir, &["init", "-b", "main"], &opts)
        .await?
        .into_ok()?;
    for (k, v) in [
        ("user.name", "fixture"),
        ("user.email", "fixture@test.local"),
        ("core.autocrlf", "false"),
        ("core.eol", "lf"),
        ("commit.gpgsign", "false"),
    ] {
        git_run(dir, &["config", k, v], &opts).await?.into_ok()?;
    }

    build_scenario(dir, scenario, &opts).await?;

    // 등록은 실제 add_repo 경로(register_repo) 경유 — canonicalize 포함 현실성 보존.
    let canonical = dir
        .canonicalize()
        .map_err(|e| AppError::validation(format!("fixture canonicalize 실패: {e}")))?;
    let canonical_str = canonical.to_string_lossy().to_string();
    let meta = crate::git::repository::detect_meta(&canonical)?;
    let repo = crate::git::profile_match::register_repo(
        db,
        &canonical_str,
        None,
        Some(name),
        meta.default_branch.as_deref(),
        meta.default_remote.as_deref(),
        meta.forge_kind,
        meta.forge_owner.as_deref(),
        meta.forge_repo.as_deref(),
    )
    .await?;

    Ok(SeededRepo {
        repo_id: repo.id,
        path: canonical_str,
        default_branch: repo.default_branch,
        scenario: scenario.to_string(),
    })
}

/// 파일 1개 write → add → commit (결정론 opts 전달).
async fn commit_file(
    dir: &Path,
    file: &str,
    content: &str,
    msg: &str,
    opts: &GitRunOpts,
) -> AppResult<()> {
    std::fs::write(dir.join(file), content).map_err(AppError::Io)?;
    git_run(dir, &["add", file], opts).await?.into_ok()?;
    git_run(dir, &["commit", "-m", msg], opts)
        .await?
        .into_ok()?;
    Ok(())
}

/// 시나리오별 레포 상태 구성. 모두 deterministic(고정 날짜/identity/eol).
async fn build_scenario(dir: &Path, scenario: &str, opts: &GitRunOpts) -> AppResult<()> {
    match scenario {
        // 3 commit on main.
        "basic" => {
            commit_file(dir, "README.md", "A\n", "feat: A", opts).await?;
            commit_file(dir, "README.md", "A\nB\n", "feat: B", opts).await?;
            commit_file(dir, "README.md", "A\nB\nC\n", "feat: C", opts).await?;
        }
        // main + feature 분기(divergent commit).
        "branches" => {
            commit_file(dir, "README.md", "base\n", "feat: base", opts).await?;
            git_run(dir, &["checkout", "-b", "feature"], opts)
                .await?
                .into_ok()?;
            commit_file(dir, "feature.txt", "feat\n", "feat: feature work", opts).await?;
            git_run(dir, &["checkout", "main"], opts).await?.into_ok()?;
        }
        // staged 1 + unstaged 1 (status/stage 테스트).
        "dirty" => {
            commit_file(dir, "README.md", "base\n", "feat: base", opts).await?;
            std::fs::write(dir.join("README.md"), "base\nunstaged\n").map_err(AppError::Io)?;
            std::fs::write(dir.join("staged.txt"), "staged\n").map_err(AppError::Io)?;
            git_run(dir, &["add", "staged.txt"], opts)
                .await?
                .into_ok()?;
        }
        // 스태시 1개 present.
        "stash" => {
            commit_file(dir, "README.md", "base\n", "feat: base", opts).await?;
            std::fs::write(dir.join("README.md"), "base\nwip\n").map_err(AppError::Io)?;
            git_run(dir, &["stash", "push", "-m", "wip"], opts)
                .await?
                .into_ok()?;
        }
        // 머지 진행 중 충돌 상태(MERGE_HEAD + unmerged index)로 진입 — conflict 해결/abort 테스트용.
        "conflict" => {
            commit_file(dir, "conflict.txt", "line0\n", "feat: base", opts).await?;
            git_run(dir, &["checkout", "-b", "other"], opts)
                .await?
                .into_ok()?;
            commit_file(dir, "conflict.txt", "other-change\n", "feat: other", opts).await?;
            git_run(dir, &["checkout", "main"], opts).await?.into_ok()?;
            commit_file(dir, "conflict.txt", "main-change\n", "feat: main", opts).await?;
            // DEFECT-1 — 실제 머지를 실행해 충돌 상태로 둔다. 충돌 머지는 exit 1 + MERGE_HEAD 생성.
            // (into_ok 는 exit 1 을 에러로 바꾸므로 raw output 으로 검증.)
            let out = git_run(dir, &["merge", "--no-commit", "other"], opts).await?;
            if out.exit_code != Some(1) || !dir.join(".git").join("MERGE_HEAD").exists() {
                return Err(AppError::validation(format!(
                    "conflict fixture 가 충돌 상태로 진입 실패 (exit={:?})",
                    out.exit_code
                )));
            }
        }
        // 로컬 bare origin push (네트워크 없이 fetch/push/remote 테스트).
        "remote" => {
            commit_file(dir, "README.md", "base\n", "feat: base", opts).await?;
            let bare_str = bare_sibling(dir).to_string_lossy().to_string();
            git_run(dir, &["init", "--bare", bare_str.as_str()], opts)
                .await?
                .into_ok()?;
            git_run(dir, &["remote", "add", "origin", bare_str.as_str()], opts)
                .await?
                .into_ok()?;
            git_run(dir, &["push", "-u", "origin", "main"], opts)
                .await?
                .into_ok()?;
        }
        other => {
            return Err(AppError::validation(format!(
                "unknown fixture scenario: {other}"
            )))
        }
    }
    Ok(())
}
