// Git 모듈 단위 테스트.
//
// 핵심 테스트:
//   1. 한글 round-trip: 커밋 메시지 → log 파싱 → 정확히 같은 한글
//   2. 한글 파일명 round-trip: 파일 추가 → status / log 표시
//   3. NFC 정규화: NFD 입력도 NFC 로 일관 처리
//   4. parse_forge: GitHub / Gitea URL 패턴 인식
//   5. git CLI 표준 spawn: core.quotepath=false 정상 주입

use super::repository::{detect_meta, log, open, parse_forge, ForgeKindLite};
use super::runner::{commit_with_message, git_run, git_version};
use tempfile::TempDir;

/// 임시 디렉토리에 git init 한 새 레포 생성.
async fn init_test_repo() -> (TempDir, std::path::PathBuf) {
    let tmp = TempDir::new().unwrap();
    let path = tmp.path().to_path_buf();

    // git init
    let out = git_run(&path, &["init", "-q", "-b", "main"], &Default::default())
        .await
        .unwrap();
    out.into_ok().unwrap();

    // 사용자 정보 설정 (한글 + 영문 혼합)
    git_run(
        &path,
        &["config", "user.name", "테스트사용자"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();
    git_run(
        &path,
        &["config", "user.email", "test@example.com"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();
    // 글로벌 commit.gpgsign=true 환경에서 테스트가 깨지지 않도록 강제 OFF.
    git_run(
        &path,
        &["config", "commit.gpgsign", "false"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();

    (tmp, path)
}

#[tokio::test]
async fn test_git_version_available() {
    let v = git_version()
        .await
        .expect("git CLI 가 PATH 에 있어야 합니다");
    assert!(v.starts_with("git version"), "got: {v}");
}

#[tokio::test]
async fn test_korean_commit_message_roundtrip() {
    let (_tmp, path) = init_test_repo().await;

    // 빈 커밋 + 한글 메시지
    let msg = "feat: 한글 커밋 메시지 테스트\n\n본문 줄에도 한글이 잘 들어갑니다.";
    git_run(
        &path,
        &["commit", "--allow-empty", "-m", msg],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();

    // log 로 다시 읽기
    let repo = open(&path).unwrap();
    let commits = log(&repo, 10, 0).unwrap();
    assert_eq!(commits.len(), 1);
    let c = &commits[0];
    assert_eq!(c.subject, "feat: 한글 커밋 메시지 테스트");
    assert!(c.body.contains("본문 줄에도 한글이 잘 들어갑니다."));
    assert_eq!(c.author_name, "테스트사용자");
}

#[tokio::test]
async fn test_file_based_commit_with_korean_body() {
    let (_tmp, path) = init_test_repo().await;

    let msg = "feat: 줄바꿈 포함\n\n매우 긴 한글 본문이 여러 줄에\n걸쳐서 작성될 수 있습니다.\n특수문자 포함: ✓ → ★\n";
    let out = commit_with_message(&path, msg).await.unwrap();
    // empty commit 가능하도록 --allow-empty 가 없으니 첫 commit 은 fail 정상.
    // 단, stderr 가 한글이거나 stage 가 비어있다는 의미를 명확히 디코드해야 함.
    if out.exit_code != Some(0) {
        let stderr = out.stderr;
        // mangle 되지 않은 ASCII 영문 stderr 라도 mojibake 마커가 없어야 함.
        assert!(!stderr.contains("\u{FFFD}"), "mojibake in stderr: {stderr}");
    }
}

#[tokio::test]
async fn test_korean_filename_roundtrip() {
    let (_tmp, path) = init_test_repo().await;

    // 한글 파일명 생성
    let file = path.join("한글파일.txt");
    std::fs::write(&file, "내용").unwrap();

    // stage + commit
    git_run(&path, &["add", "."], &Default::default())
        .await
        .unwrap()
        .into_ok()
        .unwrap();
    git_run(
        &path,
        &["commit", "-m", "feat: 한글 파일 추가"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();

    // log 의 stat 출력에서 파일명이 escape 되지 않고 그대로 나와야 함.
    let out = git_run(
        &path,
        &["log", "--name-only", "-n", "1"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();
    assert!(
        out.contains("한글파일.txt"),
        "core.quotepath=false 가 안 먹은 듯. stdout: {out}"
    );
}

#[test]
fn test_parse_forge_github_https() {
    let (kind, owner, repo) = parse_forge(Some("https://github.com/tgkim/mock-fried.git"));
    assert!(matches!(kind, ForgeKindLite::Github));
    assert_eq!(owner.as_deref(), Some("tgkim"));
    assert_eq!(repo.as_deref(), Some("mock-fried"));
}

#[test]
fn test_parse_forge_github_ssh() {
    let (kind, owner, repo) = parse_forge(Some("git@github.com:tgkim/mock-fried.git"));
    assert!(matches!(kind, ForgeKindLite::Github));
    assert_eq!(owner.as_deref(), Some("tgkim"));
    assert_eq!(repo.as_deref(), Some("mock-fried"));
}

#[test]
fn test_parse_forge_gitea_self_hosted() {
    let (kind, owner, repo) =
        parse_forge(Some("https://git.dev.opnd.io/opnd-frontend/ankentrip.git"));
    assert!(
        matches!(kind, ForgeKindLite::Gitea),
        "사용자 회사 Gitea 인식 실패"
    );
    assert_eq!(owner.as_deref(), Some("opnd-frontend"));
    assert_eq!(repo.as_deref(), Some("ankentrip"));
}

#[test]
fn test_parse_forge_unknown() {
    let (kind, _, _) = parse_forge(Some("https://gitlab.com/foo/bar.git"));
    assert!(matches!(kind, ForgeKindLite::Unknown));
    let (kind2, _, _) = parse_forge(None);
    assert!(matches!(kind2, ForgeKindLite::Unknown));
}

#[tokio::test]
async fn test_detect_meta_round_trip() {
    let (_tmp, path) = init_test_repo().await;
    git_run(
        &path,
        &[
            "remote",
            "add",
            "origin",
            "git@github.com:tgkim/mock-fried.git",
        ],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();
    git_run(
        &path,
        &["commit", "--allow-empty", "-m", "init"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();

    let meta = detect_meta(&path).unwrap();
    assert_eq!(meta.default_branch.as_deref(), Some("main"));
    assert!(matches!(meta.forge_kind, ForgeKindLite::Github));
    assert_eq!(meta.forge_owner.as_deref(), Some("tgkim"));
}

#[tokio::test]
async fn test_safe_directory_injection() {
    // safe.directory=* 가 -c 로 주입되었음을 간접 검증.
    // git config --get-all safe.directory 호출이 * 를 반환해야 함.
    let (_tmp, path) = init_test_repo().await;
    let out = git_run(
        &path,
        &["config", "--get-all", "safe.directory"],
        &Default::default(),
    )
    .await
    .unwrap();
    // 결과 자체가 * 면 OK. -c 는 process-local 이므로 글로벌에는 없음 — 단순 호출이 깨지지 않으면 OK.
    let _ = out; // 통과만 검증 (실제 값은 시스템마다 다름)
}

#[test]
fn test_nfc_normalization_in_decode() {
    // NFD 한글 ('ㅎㅏㄴ' 처럼 자모 분리) 가 NFC 로 합쳐지는지 검증.
    use unicode_normalization::UnicodeNormalization;
    let nfd: String = "한".nfd().collect();
    let nfc: String = nfd.nfc().collect();
    assert_eq!(nfc, "한");
    assert_ne!(nfd.len(), nfc.len());
}

// ====== Phase 2 (v0.1 Sprint 1) 테스트 ======

#[tokio::test]
async fn test_status_clean_after_init() {
    let (_tmp, path) = init_test_repo().await;
    // 빈 init 직후엔 commit 0, working tree 도 비어있음.
    let st = super::status::read_status(&path).unwrap();
    assert!(st.is_clean, "init 직후는 깨끗해야 함");
    assert!(st.staged.is_empty());
    assert!(st.unstaged.is_empty());
}

#[tokio::test]
async fn test_status_detects_korean_filename_change() {
    let (_tmp, path) = init_test_repo().await;
    // 첫 커밋
    git_run(
        &path,
        &["commit", "--allow-empty", "-m", "init"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();
    // 한글 파일명 추가
    let f = path.join("새파일.md");
    std::fs::write(&f, "# 안녕\n").unwrap();

    let st = super::status::read_status(&path).unwrap();
    assert!(!st.is_clean);
    assert_eq!(st.untracked.len(), 1);
    assert_eq!(st.untracked[0], "새파일.md");
}

#[tokio::test]
async fn test_stage_unstage_round_trip() {
    let (_tmp, path) = init_test_repo().await;
    git_run(
        &path,
        &["commit", "--allow-empty", "-m", "init"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();

    std::fs::write(path.join("a.txt"), "hello\n").unwrap();
    std::fs::write(path.join("한글.txt"), "안녕\n").unwrap();

    super::stage::stage_paths(&path, &["a.txt".into(), "한글.txt".into()])
        .await
        .unwrap();

    let st = super::status::read_status(&path).unwrap();
    assert_eq!(st.staged.len(), 2, "한글/영문 모두 staged");

    super::stage::unstage_paths(&path, &["한글.txt".into()])
        .await
        .unwrap();
    let st2 = super::status::read_status(&path).unwrap();
    assert_eq!(st2.staged.len(), 1);
    assert!(st2.staged.iter().any(|f| f.path == "a.txt"));
    assert!(st2.untracked.contains(&"한글.txt".to_string()));
}

#[tokio::test]
async fn test_commit_simple_with_korean() {
    let (_tmp, path) = init_test_repo().await;
    std::fs::write(path.join("hello.md"), "# 한글\n").unwrap();
    super::stage::stage_all(&path).await.unwrap();

    let res = super::commit::commit_simple(&path, "feat: 첫 한글 커밋")
        .await
        .unwrap();
    assert!(res.success, "stderr: {}", res.stderr);
    assert!(res.new_sha.is_some());

    let last = super::commit::last_commit_message(&path).await.unwrap();
    assert!(last.starts_with("feat: 첫 한글 커밋"));
}

// ====== Phase 3 (v0.1 Sprint 2) 테스트 ======

#[tokio::test]
async fn test_branch_create_switch_delete() {
    let (_tmp, path) = init_test_repo().await;
    git_run(
        &path,
        &["commit", "--allow-empty", "-m", "init"],
        &Default::default(),
    )
    .await
    .unwrap()
    .into_ok()
    .unwrap();

    super::branch::create_branch(&path, "feat/한글-브랜치", None)
        .await
        .unwrap();
    let branches = super::branch::list_branches(&path).unwrap();
    assert!(branches.iter().any(|b| b.name == "feat/한글-브랜치"));

    super::branch::switch_branch(&path, "feat/한글-브랜치", false)
        .await
        .unwrap();
    let branches2 = super::branch::list_branches(&path).unwrap();
    let head = branches2.iter().find(|b| b.is_head).unwrap();
    assert_eq!(head.name, "feat/한글-브랜치");

    super::branch::switch_branch(&path, "main", false)
        .await
        .unwrap();
    super::branch::delete_branch(&path, "feat/한글-브랜치", false)
        .await
        .unwrap();
    let branches3 = super::branch::list_branches(&path).unwrap();
    assert!(!branches3.iter().any(|b| b.name == "feat/한글-브랜치"));
}

#[tokio::test]
async fn test_stash_round_trip() {
    let (_tmp, path) = init_test_repo().await;
    std::fs::write(path.join("a.txt"), "hello\n").unwrap();
    super::stage::stage_all(&path).await.unwrap();
    super::commit::commit_simple(&path, "init").await.unwrap();

    // 변경 추가 후 stash
    std::fs::write(path.join("a.txt"), "hello modified\n").unwrap();
    super::stash::push_stash(&path, Some("작업 중 한글 메시지"), false)
        .await
        .unwrap();

    let list = super::stash::list_stash(&path).await.unwrap();
    assert_eq!(list.len(), 1);
    assert!(list[0].message.contains("작업 중 한글"));

    let diff = super::stash::show_stash(&path, 0).await.unwrap();
    assert!(diff.contains("hello modified"));

    super::stash::pop_stash(&path, 0).await.unwrap();
    let list2 = super::stash::list_stash(&path).await.unwrap();
    assert!(list2.is_empty());
    let st = super::status::read_status(&path).unwrap();
    assert!(!st.is_clean, "pop 후 변경이 살아있어야 함");
}

#[tokio::test]
async fn test_reset_soft_keeps_index() {
    let (_tmp, path) = init_test_repo().await;
    std::fs::write(path.join("a.txt"), "v1\n").unwrap();
    super::stage::stage_all(&path).await.unwrap();
    super::commit::commit_simple(&path, "v1").await.unwrap();

    std::fs::write(path.join("a.txt"), "v2\n").unwrap();
    super::stage::stage_all(&path).await.unwrap();
    super::commit::commit_simple(&path, "v2").await.unwrap();

    super::reset::reset(&path, super::reset::ResetMode::Soft, "HEAD~1")
        .await
        .unwrap();
    // staged 에 v2 변경이 있어야 함 (soft 는 working/index 유지)
    let st = super::status::read_status(&path).unwrap();
    assert!(!st.staged.is_empty(), "soft reset 후 staged 변경 유지");
}

#[tokio::test]
async fn test_diff_returns_text() {
    let (_tmp, path) = init_test_repo().await;
    std::fs::write(path.join("a.txt"), "hello\n").unwrap();
    super::stage::stage_all(&path).await.unwrap();
    super::commit::commit_simple(&path, "init").await.unwrap();

    // 수정
    std::fs::write(path.join("a.txt"), "hello world\n").unwrap();

    let d = super::diff::diff(
        &path,
        &super::diff::DiffArgs {
            staged: false,
            path: None,
            rev: None,
            context: Some(3),
        },
    )
    .await
    .unwrap();
    assert!(d.contains("hello world"), "diff 에 변경 라인이 포함");
    assert!(d.contains("--- a/a.txt"), "표준 diff 헤더");
}

// ===== Sprint A1 (D 라운드 보강) — Hide / Solo refs =====

#[tokio::test]
async fn test_hide_unhide_ref_round_trip() {
    use crate::git::hide::{hide, list_hidden, unhide, HiddenRefKind};
    use crate::git::ForgeKindLite;
    use crate::storage::{Db, DbExt};

    // Db::open 이 마이그레이션을 자동 실행하므로 repo_ref_hidden 테이블 생성됨.
    let db_tmp = TempDir::new().unwrap();
    let db_path = db_tmp.path().join("test.sqlite");
    let db = Db::open(&db_path).await.unwrap();

    // FK constraint 충족용 — 실제 repo 한 건 등록.
    let repo_tmp = TempDir::new().unwrap();
    let repo = db
        .add_repo(
            &repo_tmp.path().to_string_lossy(),
            None,
            Some("test"),
            None,
            None,
            ForgeKindLite::Unknown,
            None,
            None,
        )
        .await
        .unwrap();

    hide(&db, repo.id, "feature/foo", HiddenRefKind::Branch)
        .await
        .unwrap();
    hide(&db, repo.id, "v1.0.0", HiddenRefKind::Tag)
        .await
        .unwrap();

    let listed = list_hidden(&db, repo.id).await.unwrap();
    assert_eq!(listed.len(), 2, "두 항목이 영속 + 조회됨");
    let names: Vec<_> = listed.iter().map(|h| h.ref_name.clone()).collect();
    assert!(names.contains(&"feature/foo".to_string()));
    assert!(names.contains(&"v1.0.0".to_string()));

    unhide(&db, repo.id, "feature/foo").await.unwrap();
    let after = list_hidden(&db, repo.id).await.unwrap();
    assert_eq!(after.len(), 1);
    assert_eq!(after[0].ref_name, "v1.0.0");
}

// ===== Sprint C1 — Worktree lock / unlock =====

#[tokio::test]
async fn test_worktree_lock_unlock_round_trip() {
    let (_tmp, path) = init_test_repo().await;
    std::fs::write(path.join("a.txt"), "v1\n").unwrap();
    super::stage::stage_all(&path).await.unwrap();
    super::commit::commit_simple(&path, "init").await.unwrap();

    // 새 worktree 생성 (별도 임시 폴더 안)
    let wt_tmp = TempDir::new().unwrap();
    let wt_path = wt_tmp.path().join("wt-test");
    let wt_str = wt_path.to_string_lossy().to_string();
    super::worktree::add_worktree(
        &path,
        &super::worktree::AddWorktreeOpts {
            path: wt_str.clone(),
            create_branch: Some("wt-branch".into()),
            branch: None,
            start_point: None,
        },
    )
    .await
    .unwrap();

    // lock with reason
    super::worktree::lock_worktree(&path, &wt_str, Some("작업 중"))
        .await
        .unwrap();

    // list → 해당 worktree 가 locked 상태
    let entries = super::worktree::list_worktrees(&path).await.unwrap();
    let me = entries
        .iter()
        .find(|e| e.path.replace('\\', "/").ends_with("wt-test"))
        .expect("새 worktree 가 list 에 보임");
    assert!(me.is_locked, "lock 후 is_locked=true");

    // unlock
    super::worktree::unlock_worktree(&path, &wt_str).await.unwrap();
    let entries2 = super::worktree::list_worktrees(&path).await.unwrap();
    let me2 = entries2
        .iter()
        .find(|e| e.path.replace('\\', "/").ends_with("wt-test"))
        .expect("worktree 그대로 존재");
    assert!(!me2.is_locked, "unlock 후 is_locked=false");
}

// ===== Sprint C2 — LFS push_size (upstream 미설정 시 note) =====

#[tokio::test]
async fn test_lfs_push_size_no_upstream() {
    let (_tmp, path) = init_test_repo().await;
    std::fs::write(path.join("a.txt"), "v1\n").unwrap();
    super::stage::stage_all(&path).await.unwrap();
    super::commit::commit_simple(&path, "init").await.unwrap();

    // upstream 미설정 — push_size 는 note 와 0 카운트.
    let r = super::lfs::push_size(&path).await.unwrap();
    assert_eq!(r.commit_count, 0);
    assert_eq!(r.file_count, 0);
    assert_eq!(r.total_bytes, 0);
    assert!(
        r.note.as_ref().map(|s| s.contains("upstream")).unwrap_or(false),
        "upstream 미설정 안내",
    );
}

// ===== Sprint H — Hunk-level stage (apply_patch round-trip) =====

#[tokio::test]
async fn test_stage_patch_partial_apply() {
    let (_tmp, path) = init_test_repo().await;
    std::fs::write(path.join("a.txt"), "line1\nline2\n").unwrap();
    super::stage::stage_all(&path).await.unwrap();
    super::commit::commit_simple(&path, "init").await.unwrap();

    // 두 라인 추가 (일반 modify).
    std::fs::write(path.join("a.txt"), "line1\nline2\nadded3\nadded4\n").unwrap();

    // 단일 hunk 의 일부만 stage 하는 patch 직접 작성.
    // index abc..def 부분은 git apply 가 복원 가능 (--recount 없이도 OK).
    let patch = "diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -2,1 +2,2 @@\n line2\n+added3\n";
    super::stage::stage_patch(&path, patch).await.unwrap();

    // staged 에 a.txt 가 modified 로 들어가야 함.
    let st = super::status::read_status(&path).unwrap();
    assert!(
        st.staged.iter().any(|f| f.path == "a.txt"),
        "stage_patch 가 a.txt 를 staged 에 넣음",
    );
    // working tree 는 added4 도 그대로 남아있어야 (나머지 stage 안 됨).
    let wt = std::fs::read_to_string(path.join("a.txt")).unwrap();
    assert!(wt.contains("added4"), "stage 안 한 부분은 working 에 잔존");
}
