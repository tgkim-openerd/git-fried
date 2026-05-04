# Tauri Commands Index

> 자동 생성: `bun scripts/generate-tauri-commands-index.mjs`
> 소스: `apps/desktop/src-tauri/src/ipc/*.rs`

**총 168 commands**, 9 파일, 65 카테고리.

## 파일별 분포

| 파일 | commands |
|---|---:|
| `ipc/commands.rs` | 79 |
| `ipc/v02_commands.rs` | 45 |
| `ipc/forge_commands.rs` | 17 |
| `ipc/launchpad_commands.rs` | 8 |
| `ipc/hide_commands.rs` | 6 |
| `ipc/profile_commands.rs` | 5 |
| `ipc/alias_commands.rs` | 4 |
| `ipc/pty_commands.rs` | 4 |
| `ipc/mod.rs` | 0 |

## 카테고리별 분포 (prefix snake_case 1번째 토큰)

| 카테고리 | commands |
|---|---:|
| `list_*` | 17 |
| `get_*` | 9 |
| `lfs_*` | 9 |
| `ai_*` | 9 |
| `launchpad_*` | 8 |
| `rebase_*` | 7 |
| `create_*` | 5 |
| `delete_*` | 5 |
| `add_*` | 5 |
| `bulk_*` | 5 |
| `apply_*` | 4 |
| `push_*` | 4 |
| `forge_*` | 4 |
| `pty_*` | 4 |
| `bisect_*` | 4 |
| `set_*` | 3 |
| `update_*` | 3 |
| `remove_*` | 3 |
| `read_*` | 3 |
| `import_*` | 3 |
| `unhide_*` | 3 |
| `merge_*` | 2 |
| `stage_*` | 2 |
| `restore_*` | 2 |
| `rename_*` | 2 |
| `maintenance_*` | 2 |
| `hide_*` | 2 |
| `open_*` | 2 |
| `resolve_*` | 1 |
| `unset_*` | 1 |
| `cherry_*` | 1 |
| `unstage_*` | 1 |
| `discard_*` | 1 |
| `range_*` | 1 |
| `commit_*` | 1 |
| `last_*` | 1 |
| `fetch_*` | 1 |
| `pull_*` | 1 |
| `search_*` | 1 |
| `switch_*` | 1 |
| `stash_*` | 1 |
| `pop_*` | 1 |
| `drop_*` | 1 |
| `show_*` | 1 |
| `edit_*` | 1 |
| `compare_*` | 1 |
| `reset_*` | 1 |
| `revert_*` | 1 |
| `undo_*` | 1 |
| `redo_*` | 1 |
| `count_*` | 1 |
| `init_*` | 1 |
| `sync_*` | 1 |
| `clone_*` | 1 |
| `submit_*` | 1 |
| `close_*` | 1 |
| `reopen_*` | 1 |
| `activate_*` | 1 |
| `prune_*` | 1 |
| `lock_*` | 1 |
| `unlock_*` | 1 |
| `write_*` | 1 |
| `take_*` | 1 |
| `launch_*` | 1 |
| `predict_*` | 1 |

## 카테고리별 상세

### `list_*` (17)

- **`list_all_repo_aliases() -> AppResult<Vec<RepoAlias>>`** — `ipc/alias_commands.rs`
- **`list_workspaces() -> AppResult<Vec<Workspace>>`** — `ipc/commands.rs`
- **`list_repos(workspace_id: Option<i64>) -> AppResult<Vec<Repo>>`** — `ipc/commands.rs`
- **`list_branches(repo_id: i64) -> AppResult<Vec<git_branch::BranchInfo>>`** — `ipc/commands.rs`
- **`list_stash(repo_id: i64) -> AppResult<Vec<git_stash::StashEntry>>`** — `ipc/commands.rs`
- **`list_submodules(repo_id: i64) -> AppResult<Vec<git_sub::SubmoduleEntry>>`** — `ipc/commands.rs`
- **`list_remotes(repo_id: i64) -> AppResult<Vec<git_remote::RemoteInfo>>`** — `ipc/commands.rs`
- **`list_tags(repo_id: i64) -> AppResult<Vec<git_tag::TagInfo>>`** — `ipc/commands.rs`
- **`list_pull_requests(args: ListPrArgs) -> AppResult<Vec<PullRequest>>`** — `ipc/forge_commands.rs`
- **`list_issues(repo_id: i64) -> AppResult<Vec<Issue>>`** — `ipc/forge_commands.rs`
- **`list_releases(repo_id: i64) -> AppResult<Vec<Release>>`** — `ipc/forge_commands.rs`
- **`list_pr_comments(args: GetPrArgs) -> AppResult<Vec<PrComment>>`** — `ipc/forge_commands.rs`
- **`list_pr_files(args: GetPrArgs) -> AppResult<Vec<PrFile>>`** — `ipc/forge_commands.rs`
- **`list_hidden_refs(repo_id: i64) -> AppResult<Vec<hide::HiddenRef>>`** — `ipc/hide_commands.rs`
- **`list_profiles() -> AppResult<Vec<Profile>>`** — `ipc/profile_commands.rs`
- **`list_worktrees(repo_id: i64) -> AppResult<Vec<git_wt::WorktreeEntry>>`** — `ipc/v02_commands.rs`
- **`list_reflog(args: ReflogArgs) -> AppResult<Vec<git_reflog::ReflogEntry>>`** — `ipc/v02_commands.rs`

### `get_*` (9)

- **`get_app_info() -> AppInfo`** — `ipc/commands.rs`
- **`get_log(args: GetLogArgs) -> AppResult<Vec<repo::CommitSummary>>`** — `ipc/commands.rs`
- **`get_status(repo_id: i64) -> AppResult<git_status::RepoStatus>`** — `ipc/commands.rs`
- **`get_diff(args: DiffCommandArgs) -> AppResult<String>`** — `ipc/commands.rs`
- **`get_commit_diff(args: DiffCommitArgs) -> AppResult<String>`** — `ipc/commands.rs`
- **`get_graph(args: GetGraphArgs) -> AppResult<git_graph::GraphResult>`** — `ipc/commands.rs`
- **`get_pull_request(args: GetPrArgs) -> AppResult<PullRequest>`** — `ipc/forge_commands.rs`
- **`get_file_history(args: FileHistoryArgs) -> AppResult<Vec<crate::git::repository::CommitSummary>>`** — `ipc/v02_commands.rs`
- **`get_file_blame(args: FileBlameArgs) -> AppResult<Vec<git_fh::BlameLine>>`** — `ipc/v02_commands.rs`

### `lfs_*` (9)

- **`lfs_status(repo_id: i64) -> AppResult<git_lfs::LfsStatus>`** — `ipc/v02_commands.rs`
- **`lfs_list_files(repo_id: i64) -> AppResult<Vec<git_lfs::LfsFile>>`** — `ipc/v02_commands.rs`
- **`lfs_track(args: LfsPatternArgs) -> AppResult<()>`** — `ipc/v02_commands.rs`
- **`lfs_untrack(args: LfsPatternArgs) -> AppResult<()>`** — `ipc/v02_commands.rs`
- **`lfs_install(repo_id: i64) -> AppResult<()>`** — `ipc/v02_commands.rs`
- **`lfs_fetch(repo_id: i64) -> AppResult<()>`** — `ipc/v02_commands.rs`
- **`lfs_pull(repo_id: i64) -> AppResult<()>`** — `ipc/v02_commands.rs`
- **`lfs_prune(repo_id: i64) -> AppResult<()>`** — `ipc/v02_commands.rs`
- **`lfs_push_size(repo_id: i64) -> AppResult<git_lfs::LfsPushSize>`** — `ipc/v02_commands.rs`

### `ai_*` (9)

- **`ai_detect_clis() -> Vec<ai::AiProbe>`** — `ipc/v02_commands.rs`
- **`ai_commit_message(args: AiCommitMessageArgs) -> AppResult<ai::AiOutput>`** — `ipc/v02_commands.rs`
- **`ai_resolve_conflict(args: AiResolveConflictArgs) -> AppResult<ai::AiOutput>`** — `ipc/v02_commands.rs`
- **`ai_code_review(args: AiCodeReviewArgs) -> AppResult<ai::AiOutput>`** — `ipc/v02_commands.rs`
- **`ai_pr_body(args: AiPrBodyArgs) -> AppResult<ai::AiOutput>`** — `ipc/v02_commands.rs`
- **`ai_explain_commit(args: AiExplainCommitArgs) -> AppResult<ai::AiOutput>`** — `ipc/v02_commands.rs`
- **`ai_explain_branch(args: AiExplainBranchArgs) -> AppResult<ai::AiOutput>`** — `ipc/v02_commands.rs`
- **`ai_stash_message(args: AiStashMessageArgs) -> AppResult<ai::AiOutput>`** — `ipc/v02_commands.rs`
- **`ai_composer_plan(args: AiComposerArgs) -> AppResult<ai::AiOutput>`** — `ipc/v02_commands.rs`

### `launchpad_*` (8)

- **`launchpad_list_active() -> AppResult<Vec<PrMeta>>`** — `ipc/launchpad_commands.rs`
- **`launchpad_list_for_repo(args: ListForRepoArgs) -> AppResult<Vec<PrMeta>>`** — `ipc/launchpad_commands.rs`
- **`launchpad_set_pinned(args: PinArgs) -> AppResult<PrMeta>`** — `ipc/launchpad_commands.rs`
- **`launchpad_set_snooze(args: SnoozeArgs) -> AppResult<PrMeta>`** — `ipc/launchpad_commands.rs`
- **`launchpad_cleanup_defaults() -> AppResult<u64>`** — `ipc/launchpad_commands.rs`
- **`launchpad_list_views(args: ListViewsArgs) -> AppResult<Vec<SavedView>>`** — `ipc/launchpad_commands.rs`
- **`launchpad_save_view(args: SaveViewArgs) -> AppResult<SavedView>`** — `ipc/launchpad_commands.rs`
- **`launchpad_delete_view(id: i64) -> AppResult<()>`** — `ipc/launchpad_commands.rs`

### `rebase_*` (7)

- **`rebase_branch(args: RebaseBranchArgs) -> AppResult<crate::git::branch::MergeResult>`** — `ipc/commands.rs`
- **`rebase_prepare_todo(args: RebasePrepareArgs) -> AppResult<Vec<git_rebase::RebaseTodoEntry>>`** — `ipc/v02_commands.rs`
- **`rebase_run(args: RebaseRunArgs) -> AppResult<RebaseRunResult>`** — `ipc/v02_commands.rs`
- **`rebase_status(repo_id: i64) -> AppResult<git_rebase::RebaseStatus>`** — `ipc/v02_commands.rs`
- **`rebase_continue(repo_id: i64) -> AppResult<RebaseRunResult>`** — `ipc/v02_commands.rs`
- **`rebase_abort(repo_id: i64) -> AppResult<()>`** — `ipc/v02_commands.rs`
- **`rebase_skip(repo_id: i64) -> AppResult<RebaseRunResult>`** — `ipc/v02_commands.rs`

### `create_*` (5)

- **`create_workspace(name: String, color: Option<String>) -> AppResult<Workspace>`** — `ipc/commands.rs`
- **`create_branch(args: CreateBranchArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`create_tag(args: CreateTagArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`create_pull_request(args: CreatePrArgs) -> AppResult<PullRequest>`** — `ipc/forge_commands.rs`
- **`create_profile(input: ProfileInput) -> AppResult<Profile>`** — `ipc/profile_commands.rs`

### `delete_*` (5)

- **`delete_workspace(id: i64) -> AppResult<()>`** — `ipc/commands.rs`
- **`delete_branch(args: DeleteBranchArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`delete_tag(args: TagNameArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`delete_remote_tag(args: PushTagArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`delete_profile(id: i64) -> AppResult<()>`** — `ipc/profile_commands.rs`

### `add_*` (5)

- **`add_repo(args: AddRepoArgs) -> AppResult<Repo>`** — `ipc/commands.rs`
- **`add_remote(args: AddRemoteArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`add_pr_comment(args: AddPrCommentArgs) -> AppResult<PrComment>`** — `ipc/forge_commands.rs`
- **`add_review_comment(args: AddReviewCommentArgs) -> AppResult<()>`** — `ipc/forge_commands.rs`
- **`add_worktree(args: AddWorktreeArgs) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `bulk_*` (5)

- **`bulk_fetch(workspace_id: Option<i64>) -> AppResult<Vec<git_bulk::BulkResult<git_sync::SyncResult>>>`** — `ipc/commands.rs`
- **`bulk_status(workspace_id: Option<i64>) -> AppResult<Vec<git_bulk::BulkResult<git_status::RepoStatus>>>`** — `ipc/commands.rs`
- **`bulk_quick_status(workspace_id: Option<i64>) -> AppResult<Vec<git_bulk::BulkResult<git_status::QuickStatus>>>`** — `ipc/commands.rs`
- **`bulk_list_prs(args: BulkPrsArgs) -> AppResult<Vec<git_bulk::BulkResult<Vec<crate::forge::PullRequest>>>>`** — `ipc/commands.rs`
- **`bulk_cherry_pick(args: BulkCherryPickArgs) -> AppResult<Vec<git_cp::CherryPickResult>>`** — `ipc/v02_commands.rs`

### `apply_*` (4)

- **`apply_patch(args: PatchArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`apply_stash(args: StashIndexArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`apply_stash_file(args: StashFileArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`apply_repo_config(args: ApplyRepoConfigArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `push_*` (4)

- **`push(args: PushArgs) -> AppResult<git_sync::SyncResult>`** — `ipc/commands.rs`
- **`push_stash(args: PushStashArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`push_stash_staged(args: PushStashStagedArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`push_tag(args: PushTagArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `forge_*` (4)

- **`forge_save_token(args: SaveTokenArgs) -> AppResult<ForgeAccount>`** — `ipc/forge_commands.rs`
- **`forge_list_accounts() -> AppResult<Vec<ForgeAccount>>`** — `ipc/forge_commands.rs`
- **`forge_delete_account(id: i64) -> AppResult<()>`** — `ipc/forge_commands.rs`
- **`forge_whoami(args: WhoamiArgs) -> AppResult<crate::forge::Author>`** — `ipc/forge_commands.rs`

### `pty_*` (4)

- **`pty_open(args: PtyOpenArgs, on_data: Channel<Vec<u8>>) -> AppResult<u64>`** — `ipc/pty_commands.rs`
- **`pty_write(args: PtyWriteArgs) -> AppResult<()>`** — `ipc/pty_commands.rs`
- **`pty_resize(args: PtyResizeArgs) -> AppResult<()>`** — `ipc/pty_commands.rs`
- **`pty_close(id: u64) -> AppResult<()>`** — `ipc/pty_commands.rs`

### `bisect_*` (4)

- **`bisect_status(repo_id: i64) -> AppResult<git_bisect::BisectStatus>`** — `ipc/v02_commands.rs`
- **`bisect_start(repo_id: i64) -> AppResult<String>`** — `ipc/v02_commands.rs`
- **`bisect_mark(args: BisectMarkArgs) -> AppResult<String>`** — `ipc/v02_commands.rs`
- **`bisect_reset(repo_id: i64) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `set_*` (3)

- **`set_repo_alias(args: SetAliasArgs) -> AppResult<RepoAlias>`** — `ipc/alias_commands.rs`
- **`set_repo_pinned(args: SetPinnedArgs) -> AppResult<Repo>`** — `ipc/commands.rs`
- **`set_remote_url(args: SetRemoteUrlArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `update_*` (3)

- **`update_workspace(args: UpdateWorkspaceArgs) -> AppResult<Workspace>`** — `ipc/commands.rs`
- **`update_submodules(args: UpdateSubmodulesArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`update_profile(args: UpdateProfileArgs) -> AppResult<Profile>`** — `ipc/profile_commands.rs`

### `remove_*` (3)

- **`remove_repo(id: i64) -> AppResult<()>`** — `ipc/commands.rs`
- **`remove_remote(args: RemoteNameArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`remove_worktree(args: RemoveWorktreeArgs) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `read_*` (3)

- **`read_file(args: ReadFileArgs) -> AppResult<String>`** — `ipc/commands.rs`
- **`read_repo_config(repo_id: i64) -> AppResult<git_cfg_local::RepoConfigSnapshot>`** — `ipc/commands.rs`
- **`read_conflicted(args: ConflictedFileArgs) -> AppResult<git_merge::ConflictedFile>`** — `ipc/v02_commands.rs`

### `import_*` (3)

- **`import_gitkraken_detect() -> AppResult<Option<gitkraken::DetectResult>>`** — `ipc/commands.rs`
- **`import_gitkraken_dry_run(args: GitKrakenImportArgs) -> AppResult<gitkraken::ImportPlan>`** — `ipc/commands.rs`
- **`import_gitkraken_apply(args: GitKrakenImportArgs) -> AppResult<gitkraken::ApplyResult>`** — `ipc/commands.rs`

### `unhide_*` (3)

- **`unhide_ref(args: UnhideRefArgs) -> AppResult<()>`** — `ipc/hide_commands.rs`
- **`unhide_refs_by_kind(args: UnhideKindArgs) -> AppResult<u64>`** — `ipc/hide_commands.rs`
- **`unhide_all_refs(repo_id: i64) -> AppResult<u64>`** — `ipc/hide_commands.rs`

### `merge_*` (2)

- **`merge_branch(args: MergeBranchArgs) -> AppResult<crate::git::branch::MergeResult>`** — `ipc/commands.rs`
- **`merge_pr(args: MergePrArgs) -> AppResult<()>`** — `ipc/forge_commands.rs`

### `stage_*` (2)

- **`stage_paths(args: PathsArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`stage_all(repo_id: i64) -> AppResult<()>`** — `ipc/commands.rs`

### `restore_*` (2)

- **`restore_worktree_patch(args: RestoreWorktreePatchArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`restore_paths(args: RestoreArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `rename_*` (2)

- **`rename_branch(args: RenameBranchArgs) -> AppResult<()>`** — `ipc/commands.rs`
- **`rename_remote(args: RenameRemoteArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `maintenance_*` (2)

- **`maintenance_gc(args: MaintenanceArgs) -> AppResult<git_maint::MaintenanceResult>`** — `ipc/commands.rs`
- **`maintenance_fsck(repo_id: i64) -> AppResult<git_maint::MaintenanceResult>`** — `ipc/commands.rs`

### `hide_*` (2)

- **`hide_ref(args: HideRefArgs) -> AppResult<()>`** — `ipc/hide_commands.rs`
- **`hide_refs_bulk(args: HideRefsByKindArgs) -> AppResult<usize>`** — `ipc/hide_commands.rs`

### `open_*` (2)

- **`open_in_explorer(repo_id: i64) -> AppResult<()>`** — `ipc/v02_commands.rs`
- **`open_path_in_explorer(path: String) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `resolve_*` (1)

- **`resolve_repo_alias(args: ResolveAliasArgs) -> AppResult<Option<String>>`** — `ipc/alias_commands.rs`

### `unset_*` (1)

- **`unset_repo_alias(args: UnsetAliasArgs) -> AppResult<()>`** — `ipc/alias_commands.rs`

### `cherry_*` (1)

- **`cherry_pick_sha(args: CherryPickShaArgs) -> AppResult<crate::git::branch::MergeResult>`** — `ipc/commands.rs`

### `unstage_*` (1)

- **`unstage_paths(args: PathsArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `discard_*` (1)

- **`discard_paths(args: PathsArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `range_*` (1)

- **`range_diff(args: RangeDiffArgs) -> AppResult<Vec<git_range_diff::RangeDiffEntry>>`** — `ipc/commands.rs`

### `commit_*` (1)

- **`commit(args: CommitArgs) -> AppResult<git_commit::CommitResult>`** — `ipc/commands.rs`

### `last_*` (1)

- **`last_commit_message(repo_id: i64) -> AppResult<String>`** — `ipc/commands.rs`

### `fetch_*` (1)

- **`fetch_all(repo_id: i64) -> AppResult<git_sync::SyncResult>`** — `ipc/commands.rs`

### `pull_*` (1)

- **`pull(args: PullArgs) -> AppResult<git_sync::SyncResult>`** — `ipc/commands.rs`

### `search_*` (1)

- **`search_commits_by_message(args: SearchCommitsByMessageArgs) -> AppResult<Vec<repo::CommitSummary>>`** — `ipc/commands.rs`

### `switch_*` (1)

- **`switch_branch(args: SwitchBranchArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `stash_*` (1)

- **`stash_to_branch(args: StashToBranchArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `pop_*` (1)

- **`pop_stash(args: StashIndexArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `drop_*` (1)

- **`drop_stash(args: StashIndexArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `show_*` (1)

- **`show_stash(args: StashIndexArgs) -> AppResult<String>`** — `ipc/commands.rs`

### `edit_*` (1)

- **`edit_stash_message(args: EditStashMessageArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `compare_*` (1)

- **`compare_refs(args: CompareRefsArgs) -> AppResult<crate::git::compare::CompareResult>`** — `ipc/commands.rs`

### `reset_*` (1)

- **`reset(args: ResetArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `revert_*` (1)

- **`revert(args: RevertArgs) -> AppResult<()>`** — `ipc/commands.rs`

### `undo_*` (1)

- **`undo_last_action(args: UndoLastActionArgs) -> AppResult<git_reflog::UndoResult>`** — `ipc/commands.rs`

### `redo_*` (1)

- **`redo_last_action(args: UndoLastActionArgs) -> AppResult<git_reflog::UndoResult>`** — `ipc/commands.rs`

### `count_*` (1)

- **`count_hangul_commits(args: CountHangulCommitsArgs) -> AppResult<git_identity::HangulCommitStats>`** — `ipc/commands.rs`

### `init_*` (1)

- **`init_submodules(repo_id: i64) -> AppResult<()>`** — `ipc/commands.rs`

### `sync_*` (1)

- **`sync_submodules(repo_id: i64) -> AppResult<()>`** — `ipc/commands.rs`

### `clone_*` (1)

- **`clone_repo(args: CloneRepoArgs) -> AppResult<CloneRepoResult>`** — `ipc/commands.rs`

### `submit_*` (1)

- **`submit_pr_review(args: SubmitReviewArgs) -> AppResult<()>`** — `ipc/forge_commands.rs`

### `close_*` (1)

- **`close_pr(args: GetPrArgs) -> AppResult<()>`** — `ipc/forge_commands.rs`

### `reopen_*` (1)

- **`reopen_pr(args: GetPrArgs) -> AppResult<()>`** — `ipc/forge_commands.rs`

### `activate_*` (1)

- **`activate_profile(id: i64) -> AppResult<Profile>`** — `ipc/profile_commands.rs`

### `prune_*` (1)

- **`prune_worktrees(repo_id: i64) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `lock_*` (1)

- **`lock_worktree(args: LockWorktreeArgs) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `unlock_*` (1)

- **`unlock_worktree(args: UnlockWorktreeArgs) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `write_*` (1)

- **`write_resolved(args: WriteResolvedArgs) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `take_*` (1)

- **`take_side(args: TakeSideArgs) -> AppResult<()>`** — `ipc/v02_commands.rs`

### `launch_*` (1)

- **`launch_mergetool(args: LaunchMergetoolArgs) -> AppResult<MergetoolResult>`** — `ipc/v02_commands.rs`

### `predict_*` (1)

- **`predict_target_conflict(args: PredictConflictArgs) -> AppResult<git_cp_pred::ConflictPrediction>`** — `ipc/v02_commands.rs`

