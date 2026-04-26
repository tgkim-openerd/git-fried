# 09. Interactive Rebase — 설계 / 구현 계획

작성: 2026-04-26 (다음 세션 진입점)
상태: **준비 완료, 사용자 결정 대기 + 다음 세션에서 진행**

---

## 0. TL;DR — 다음 세션 시작 시 가장 먼저

이 문서를 읽고 §3 의 **3가지 기술 옵션 중 하나** 선택. 그 다음 §5 의 sprint 1 부터 진행.

```
시작 명령:
  사용자가 문서 §3 결정 답변 → Claude 가 sprint 1 즉시 진입
```

---

## 1. 왜 큰 작업인가

`git rebase -i HEAD~5` 의 핵심 동작:

1. git 이 **todo file** 을 임시 생성 (`.git/rebase-merge/git-rebase-todo`)
2. `GIT_SEQUENCE_EDITOR` (없으면 `GIT_EDITOR`) 호출 — todo file 경로를 인자로
3. 사용자가 todo 편집 (pick / reword / squash / fixup / drop / edit / exec 액션 + 순서)
4. editor 종료 → git 이 todo 한 줄씩 처리
5. `reword` / `edit` 시 git 이 다시 `GIT_EDITOR` 호출 (메시지 또는 빈 commit)

**핵심 challenge**: GUI 앱이 1, 2, 3 단계에 끼어들어야 함. CLI editor(vim/nano)가 띄워지면 안 됨.

---

## 2. 사용자 워크플로우 ROI

`docs/plan/02 §3 W2`: 사용자 본인은 **interactive rebase 거의 안 씀**. 그러나:

- GitKraken 마이그레이션 유인 (drag-drop reorder UX 가 GitKraken 의 강점)
- 한국 SI/스타트업 개발자 페르소나 P2 의 일상 작업
- 사용자도 향후 사용 가능성 (현재 안 쓰는 게 도구 부재 때문일 수도)

→ **v1.0 에 가치 있음, 단 기술 비용 ≥ 가치**. 가장 작은 시작 (reword 만) 부터 점진.

---

## 3. 기술 옵션 비교 (★ 사용자 결정 필요)

### 옵션 A: 자체 helper binary (sub-command)

**아이디어**: `git-fried.exe rebase-helper <todo-source> <git-todo-path>` sub-command 추가. 이 모드는 Tauri 앱 시작 안 하고 그냥 file 복사 후 종료.

```rust
// main.rs 수정
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() >= 4 && args[1] == "--rebase-helper" {
        let our_todo = std::fs::read_to_string(&args[2]).unwrap();
        std::fs::write(&args[3], our_todo).unwrap();
        return;
    }
    if args.len() >= 4 && args[1] == "--commit-msg-helper" {
        // 비슷하게 메시지 helper
        return;
    }
    git_fried_lib::run();
}
```

호출:
```rust
let exe = std::env::current_exe()?;
let cmd = format!("{:?} --rebase-helper /tmp/our-todo.txt", exe);
git_run(repo, &["-c", &format!("sequence.editor={cmd}"), "rebase", "-i", target], opts).await?;
```

**장점**:
- 단일 binary (별도 helper 배포 안 함)
- cross-platform 동일 코드
- Tauri 의 `tauri::generate_handler!` 영향 없음
- 정확한 git rebase 동작 (모든 액션 지원)

**단점**:
- main() 진입점 분기 (작은 복잡도)
- todo / 메시지 file 사전 생성 필요 (Vue → IPC → 임시 파일 → rebase 시작)
- reword / edit 동작 시 GIT_EDITOR 도 같은 helper 로 (메시지 받기) — 메시지 source file 도 사전 준비
- 충돌 발생 시 rebase 가 멈추고 사용자 개입 필요 — UI 가 충돌 상태 감지 후 안내해야 함

### 옵션 B: cherry-pick sequence 흉내

**아이디어**: rebase 사용 안 하고 우리가 직접 plumbing — 새 detached HEAD 만들고 cherry-pick 시퀀스로 commit 재구성.

```
1. orig_head = current HEAD 저장
2. base SHA 로 detach (git checkout --detach <base>)
3. todo 의 각 행 처리:
   - pick: git cherry-pick <sha>
   - squash/fixup: git cherry-pick <sha> + git commit --amend --no-edit (또는 --message)
   - reword: git cherry-pick <sha> + git commit --amend -m "<new>"
   - drop: skip
   - edit: git cherry-pick --no-commit <sha> + UI 가 파일 편집 대기 + commit
4. 완료 후 현재 브랜치 ref 를 detached HEAD 로 강제 이동 (git update-ref)
```

**장점**:
- helper binary 불필요
- Vue → IPC → Rust 표준 흐름 (rebase 와 별개의 명령)
- 디버깅 용이 (각 단계 명시적)

**단점**:
- 복잡 — todo 의 모든 액션을 우리가 흉내내야 함
- 충돌 처리는 어차피 똑같이 까다로움 (cherry-pick 도 충돌 발생)
- pre-commit hook 이 매 단계 실행됨 (rebase 는 한 번에 처리하는 옵션이 있는데 cherry-pick 은 매 commit)
- 수십 commit 시퀀스 시 느림
- exec 액션 흉내 어려움

### 옵션 C: 통합 터미널 위임 (다음 세션에서 통합 터미널 같이 작업)

**아이디어**: Interactive rebase 자체는 구현 안 하고, 우리 앱 안의 통합 터미널에서 사용자가 `git rebase -i` 직접 실행. UI 는 **최소** (todo file 편집은 vim/nano 그대로).

**장점**:
- 가장 간단 (rebase 코드 0)
- 사용자가 이미 익숙한 vim/nano 편집기 사용
- 모든 git rebase 옵션 그대로

**단점**:
- "GUI 차별화" 부재 (GitKraken 의 drag-drop 은 못 따라감)
- 사용자가 vim 모를 경우 진입장벽
- 한글 입력 IME 가 vim 에서 동작 안 할 수 있음 (Windows ConPTY)

### 추천 + 위험

**1차 추천: 옵션 A** (자체 helper binary).
- Tauri 의 단일 binary 모델과 잘 맞음
- 한 번 인프라 만들면 v1.x 에서 squash / drop / reword 점진 추가 쉬움
- 사용자 vim 의존 안 함

**2차: 옵션 C** (통합 터미널 위임).
- v0.x 에서 가장 빠른 출시
- 단, 통합 터미널이 먼저 완성돼야 함 (`docs/plan/10` 참조)

**옵션 B는 비추천** — 복잡성 대비 이득 적음.

---

## 4. 옵션 A 채택 시 — 상세 설계

### 4.1 Sub-command 분기 (main.rs)

```rust
// apps/desktop/src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if let Err(e) = handle_helpers(&args) {
        eprintln!("git-fried helper error: {e}");
        std::process::exit(1);
    }
    if args.len() >= 2 && args[1].starts_with("--") {
        // 우리 helper 였지만 처리 안 됐으면 종료 (Tauri 앱 시작 안 함)
        return;
    }
    git_fried_lib::run();
}

/// 우리 sub-command 면 처리 후 std::process::exit, 아니면 그대로 리턴.
fn handle_helpers(args: &[String]) -> std::io::Result<()> {
    if args.len() < 2 || !args[1].starts_with("--") {
        return Ok(());
    }
    match args[1].as_str() {
        "--rebase-todo-helper" => {
            // args[2] = source path (우리가 만든 todo)
            // args[3] = git 이 준 dest path
            if args.len() != 4 {
                return Err(io_err("--rebase-todo-helper 인자 부족"));
            }
            let src = std::fs::read_to_string(&args[2])?;
            std::fs::write(&args[3], src)?;
            std::process::exit(0);
        }
        "--commit-msg-helper" => {
            // GIT_EDITOR 호출. args[2] = 메시지 source, args[3] = git 임시 파일.
            if args.len() != 4 {
                return Err(io_err("--commit-msg-helper 인자 부족"));
            }
            let src = std::fs::read_to_string(&args[2])?;
            std::fs::write(&args[3], src)?;
            std::process::exit(0);
        }
        _ => Ok(()),
    }
}

fn io_err(msg: &str) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidInput, msg)
}
```

### 4.2 Rust 측 모듈 (`git/rebase.rs`)

```rust
use crate::error::{AppError, AppResult};
use crate::git::runner::{git_run, GitRunOpts};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RebaseAction {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
    Edit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseTodoEntry {
    pub action: RebaseAction,
    pub sha: String,
    pub subject: String,
    /// reword 시 새 메시지 (다른 액션은 None).
    pub new_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseStatus {
    pub in_progress: bool,
    pub current_step: Option<usize>,
    pub total_steps: Option<usize>,
    pub stopped_at: Option<String>,
    pub conflict: bool,
    pub last_output: String,
}

/// 마지막 N 개 commit 의 todo 후보 생성 (모두 pick).
/// UI 가 받아서 사용자가 액션 / 순서 변경 후 run_interactive 호출.
pub async fn prepare_todo(repo: &Path, count: usize) -> AppResult<Vec<RebaseTodoEntry>> {
    let n = format!("-n{count}");
    let out = git_run(
        repo,
        &["log", &n, "--pretty=%H\x1f%s", "--reverse"],
        &GitRunOpts::default(),
    )
    .await?
    .into_ok()?;
    let mut entries = Vec::new();
    for line in out.lines() {
        let mut parts = line.splitn(2, '\x1f');
        let sha = parts.next().unwrap_or("").to_string();
        let subject = parts.next().unwrap_or("").to_string();
        if !sha.is_empty() {
            entries.push(RebaseTodoEntry {
                action: RebaseAction::Pick,
                sha,
                subject,
                new_message: None,
            });
        }
    }
    Ok(entries)
}

pub async fn run_interactive(
    repo: &Path,
    base: &str,
    todo: &[RebaseTodoEntry],
) -> AppResult<crate::git::runner::GitOutput> {
    // 1. todo 문자열 빌드
    let todo_str: String = todo
        .iter()
        .map(|e| {
            let action = match e.action {
                RebaseAction::Pick => "pick",
                RebaseAction::Reword => "reword",
                RebaseAction::Squash => "squash",
                RebaseAction::Fixup => "fixup",
                RebaseAction::Drop => "drop",
                RebaseAction::Edit => "edit",
            };
            format!("{action} {} {}", e.sha, e.subject)
        })
        .collect::<Vec<_>>()
        .join("\n");

    // 2. todo 임시 파일
    let todo_file = tempfile::NamedTempFile::new().map_err(AppError::Io)?;
    std::fs::write(todo_file.path(), &todo_str).map_err(AppError::Io)?;

    // 3. reword 메시지 임시 파일들 (각 reword 마다 새 메시지)
    //    git 이 reword 시 GIT_EDITOR 를 매번 호출 — 우리는 sequence 의 첫 reword 에 대응.
    //    v1 단계: reword 1개만 지원 (simple). 다중 reword 는 v1.x.
    //    또는: helper 가 호출될 때마다 우리가 미리 큐잉한 메시지를 차례로 사용.

    let exe = std::env::current_exe().map_err(AppError::Io)?;
    let exe_str = exe.to_string_lossy().into_owned();

    let sequence_editor = format!(
        r#"{exe_str:?} --rebase-todo-helper {:?}"#,
        todo_file.path().to_string_lossy()
    );

    // 4. rebase 실행 (-i 필수)
    let opts = GitRunOpts {
        envs: vec![
            ("GIT_SEQUENCE_EDITOR".into(), sequence_editor),
            // GIT_EDITOR 는 reword/edit 시 호출되는데, 우리 simple 버전은 reword 미지원
            // 또는 v1.x 에 큐잉 helper 도입 시 추가.
            ("GIT_EDITOR".into(), "true".into()),
        ],
        ..Default::default()
    };
    git_run(repo, &["rebase", "-i", base], &opts).await
}

/// 현재 rebase 상태 조회 (.git/rebase-merge / .git/rebase-apply).
pub fn status(repo: &Path) -> AppResult<RebaseStatus> {
    let merge_dir = repo.join(".git").join("rebase-merge");
    let apply_dir = repo.join(".git").join("rebase-apply");
    let in_progress = merge_dir.exists() || apply_dir.exists();
    let dir = if merge_dir.exists() { merge_dir } else { apply_dir };

    let current_step = std::fs::read_to_string(dir.join("msgnum"))
        .ok()
        .and_then(|s| s.trim().parse::<usize>().ok());
    let total_steps = std::fs::read_to_string(dir.join("end"))
        .ok()
        .and_then(|s| s.trim().parse::<usize>().ok());
    let stopped_at = std::fs::read_to_string(dir.join("stopped-sha")).ok();

    // 충돌: merge 파일 또는 stage 1/2/3 entries
    let conflict = repo.join(".git").join("MERGE_MSG").exists();

    Ok(RebaseStatus {
        in_progress,
        current_step,
        total_steps,
        stopped_at,
        conflict,
        last_output: String::new(),
    })
}

pub async fn rebase_continue(repo: &Path) -> AppResult<crate::git::runner::GitOutput> {
    git_run(repo, &["rebase", "--continue"], &GitRunOpts::default()).await
}

pub async fn rebase_abort(repo: &Path) -> AppResult<()> {
    git_run(repo, &["rebase", "--abort"], &GitRunOpts::default())
        .await?
        .into_ok()?;
    Ok(())
}

pub async fn rebase_skip(repo: &Path) -> AppResult<crate::git::runner::GitOutput> {
    git_run(repo, &["rebase", "--skip"], &GitRunOpts::default()).await
}
```

### 4.3 IPC 명령

```rust
// apps/desktop/src-tauri/src/ipc/v02_commands.rs (확장)
pub async fn rebase_prepare_todo(args: { repo_id, count }) -> Vec<RebaseTodoEntry>;
pub async fn rebase_run(args: { repo_id, base, todo }) -> GitOutputLike;
pub async fn rebase_status(repo_id: i64) -> RebaseStatus;
pub async fn rebase_continue(repo_id: i64) -> GitOutputLike;
pub async fn rebase_abort(repo_id: i64) -> ();
pub async fn rebase_skip(repo_id: i64) -> GitOutputLike;
```

### 4.4 Vue UI (`InteractiveRebaseModal.vue`)

```vue
<!-- 핵심 UI 요소 -->

1. base 입력 (디폴트: HEAD~N, 또는 사용자 SHA 직접)
2. todo 리스트 — 각 행:
   - 액션 select (pick/reword/squash/fixup/drop/edit)
   - SHA + subject (read-only)
   - drag-handle (vue-draggable + Sortable.js)
   - reword 시 새 메시지 textarea (확장)
3. "Run rebase" 버튼
4. 진행 중: status polling (5초 간격) → step N/M / 충돌 표시
5. 충돌 시: [continue] [skip] [abort] + 상태 패널의 conflicted 파일로 안내
```

### 4.5 핵심 제약 (v1 의 "MVP")

- **drag-drop reorder** — vue-draggable
- **reword (1개)** — 단순 케이스. 다중 reword 는 v1.x.
- **drop** — 작동
- **squash / fixup** — 작동 (이전 commit 에 합침). 메시지 편집 UI 는 v1.x.
- **edit** — v1.x (사용자 file 편집 인터럽트가 복잡).
- **exec** — v2 (보안 위험).

### 4.6 충돌 처리 흐름

```
rebase → CONFLICT
  ↓
RebaseStatus { conflict: true, current_step: 3, total_steps: 5, stopped_at: <sha> }
  ↓
UI: "충돌 발생 (3/5단계, sha 1234567)"
  + 변경 패널의 Conflicted 파일 자동 노출
  + [Continue] [Skip] [Abort] 버튼
  ↓
사용자가 충돌 해결 (3-way merge editor 사용)
  ↓
[Continue] → git rebase --continue
```

---

## 5. Sprint 계획 (옵션 A 기준)

### Sprint 1 (예상 1.5세션)
- [ ] main.rs 의 sub-command 분기 (`--rebase-todo-helper`)
- [ ] git/rebase.rs 모듈 (prepare_todo / run_interactive / status / continue / abort / skip)
- [ ] IPC 6개
- [ ] 테스트: 3개 commit 시퀀스에서 drop / reword / squash round-trip

### Sprint 2 (예상 1.5세션)
- [ ] InteractiveRebaseModal.vue (drag-drop + 액션 select)
- [ ] vue-draggable 통합
- [ ] reword 새 메시지 textarea
- [ ] 충돌 발생 시 status polling + UI 안내
- [ ] Command Palette 등록 ("rebase last N")

### Sprint 3 (예상 1세션 — polish)
- [ ] 충돌 발생 시 자동으로 Status 탭 + Conflicted 파일 펼침
- [ ] continue / abort / skip 버튼 워크플로우
- [ ] reword 다중 (큐잉 메시지 helper)
- [ ] 단축키 (모달 내부)

### Sprint 4 (v1.x — 미루기)
- edit 액션
- 충돌 해결 자동화 (AI suggest)

---

## 6. 알려진 함정 (사전 인지)

1. **Windows GIT_SEQUENCE_EDITOR 인용 처리**: 경로에 공백 있으면 git 이 split 잘못함. `"C:/Program Files/.../git-fried.exe" --helper /tmp/foo` 형태로 따옴표 필요.
2. **reword 시 GIT_EDITOR 호출 횟수**: rebase 가 todo 의 모든 reword 에 대해 매번 호출 — sequence 에 따라 우리가 어느 reword 인지 추적 어려움. v1 은 reword 1개로 제한.
3. **rebase autosquash / signoff / rerere**: 사용자 글로벌 git config 영향. 우리 default 는 끔 (`-c rebase.autosquash=false` 등 명시 주입 검토).
4. **충돌 미해결 상태에서 앱 닫기**: `.git/rebase-merge/` 가 남음. 다음 실행 시 status 조회로 자동 감지 + 사용자 안내.
5. **abort 위험**: working tree 변경 잃을 수 있음 — 두 단계 confirm.
6. **commit hook 영향**: rebase 는 commit hook 을 매 행마다 실행. `--no-verify` 옵션 추가 검토.
7. **macOS / Linux 차이**: `current_exe()` 결과 형식 / sequence_editor 인용 — Windows-only 가정 OK (v1.x 까지).

---

## 7. 사용자 결정 항목 (다음 세션 시작 전)

다음 4가지 답변 주시면 다음 세션 즉시 진입:

1. **기술 옵션** — A (helper binary) / B (cherry-pick 흉내) / C (통합 터미널 위임) ?
2. **MVP 범위** — drop+reword+squash+drop 4개로 출발 / 더 좁게 / 더 넓게 ?
3. **drag-drop 라이브러리** — vue-draggable-plus (추천) / SortableJS 직접 ?
4. **충돌 발생 시 UX** — 모달 안에서 처리 / 모달 닫고 Status 탭으로 이동 ?

---

## 8. 다음 세션 첫 명령어 (옵션 A 가정)

```
# 다음 세션 시작 시 사용자가 입력할 첫 메시지:
"docs/plan/09 의 옵션 A 로 진행. MVP = drop+reword+squash. drag-drop 은 vue-draggable-plus."
```

Claude 가 자동 진입:
1. main.rs 의 sub-command 분기 추가
2. git/rebase.rs 작성
3. IPC + Vue Modal
4. cargo + typecheck 검증
5. commit

---

다음 문서 → `10-integrated-terminal.md`
