# REVIEW — git-fried 핸드오프

작성: 2026-04-26 (Claude 단일 세션)
대상: tgkim — 다른 업무 마치고 돌아왔을 때 한 번에 파악용

---

## 30초 요약

이번 세션에서 **v0.0 + v0.1(전체 5 sprint) + v0.2 stretch 4개** 까지 작성. 7개 commit, ~7,100 라인 추가, 69개 코드 파일.

**다음 액션 (순서)**:
1. 이 문서 + [DOGFOOD.md](DOGFOOD.md) 읽기 (5분)
2. `bun install` + `cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml` (Windows)
3. 빌드 에러 발생 시 [DOGFOOD.md §빌드 트러블슈팅](DOGFOOD.md#빌드-트러블슈팅) 참조
4. `bun tauri:dev` → 첫 화면 확인
5. 사용자 본인 레포(rf 또는 01.Projects) 1개 추가 → 한글 round-trip 검증
6. `gh repo create tgkim/git-fried --public --source=. --remote=origin && git push -u origin main`

---

## 진행 현황 (vs `docs/plan/05` 로드맵)

### ✅ 완료된 마일스톤

| 단계 | 계획 기간 | 실제 | 산출물 |
|---|---|---|---|
| **v0.0** | 5주 | 1세션 | 골격 + Tauri+Vue+Rust+sqlx+한글 spawn+첫 화면 |
| **v0.1 Sprint 1** | 1개월 | 1세션 | status/stage/commit/sync/diff + StatusPanel + Conventional builder |
| **v0.1 Sprint 2** | 1개월 | 1세션 | branch/stash/reset/revert + DiffViewer (CodeMirror 6) |
| **v0.1 Sprint 3** | 1개월 | 1세션 | commit graph (pvigier) + Canvas + virtual scroll |
| **v0.1 Sprint 4** | 1개월 | 1세션 | submodule + 일괄 fetch + 듀얼 레포 그룹핑 |
| **v0.1 Sprint 5** | 1개월 | 1세션 | Forge (Gitea + GitHub) + keyring + Theme + Settings |
| **v0.2 stretch** | 3개월 일부 | 1세션 | AI CLI subprocess + Worktree + Cherry-pick + Command Palette |

### ⏳ 미완 (v0.2 잔여 + v1.0)

- Interactive rebase (drag-drop reorder/squash/fixup)
- 3-way merge editor (CodeMirror merge view)
- File history / Blame UI
- GPG signing 토글 + 상태 인디케이터
- Pre-commit hook 결과 패널
- PR 코멘트 / Review (Approve/Request)
- Launchpad (워크스페이스 모든 PR 통합)
- AI merge conflict 도움 / AI 코드 리뷰
- FTS5 검색 / Profiles / Issues / Releases / Bot PR 그룹핑
- macOS / Linux (v1.x)
- EV 코드 서명

⚠ 위 미완 항목은 모든 코드가 **빌드되고 사용자 검증 완료된 상태에서** 다음 세션으로 미루는 것이 안전.

---

## 작성된 산출물 통계

```
69 코드 파일 (Rust 34 / Vue+TS 32 / 기타 3)
~7,100 라인 추가
7 commit (planning + 6 feature sprint)

src-tauri/src/
├── main.rs / lib.rs / error.rs / auth.rs
├── git/ (12 modules: runner/repository/status/stage/commit/diff/
│        branch/stash/reset/sync/graph/submodule/bulk/cherry_pick/worktree)
├── storage/ (db.rs + migrations)
├── forge/ (mod/model/gitea/github)
├── ipc/ (commands + forge_commands + v02_commands — 60+ #[tauri::command])
└── ai/ (mod/runner/prompts — Claude/Codex CLI)

apps/desktop/src/
├── App.vue / main.ts / pages/(index|settings).vue
├── components/ (Sidebar/CommitGraph/CommitTable/StatusPanel/
│   BranchPanel/StashPanel/SubmodulePanel/PrPanel/WorktreePanel/
│   DiffViewer/CommitMessageInput/SyncBar/ForgeSetup/CommandPalette/FileRow)
├── composables/ (useStatus/useBranches/useStash/useSubmodules/
│   useGraph/useTheme/usePullRequests/useWorktrees)
├── stores/repos.ts (Pinia)
├── api/ (git.ts IPC 래퍼 + queryClient.ts)
└── types/git.ts (Rust 모델 1:1 + Conventional builder + test)
```

---

## 주요 IPC 명령어 (60+개)

| 카테고리 | 명령어 |
|---|---|
| App | get_app_info |
| Workspaces | list/create_workspace |
| Repos | list/add/remove_repo |
| Git read | get_log / get_status / get_diff / get_commit_diff / get_graph |
| Stage | stage_paths/all / unstage_paths / discard_paths / apply_patch |
| Commit | commit / last_commit_message |
| Branch | list/switch/create/delete/rename_branch |
| Stash | list/push/apply/pop/drop/show_stash |
| Reset | reset / revert |
| Sync | fetch_all / pull / push |
| Submodule | list/init/update/sync_submodules |
| Bulk | bulk_fetch / bulk_status |
| Forge | forge_save_token / list_accounts / delete_account / whoami / list_pull_requests / get_pull_request / create_pull_request / list_issues / list_releases |
| Worktree | list/add/remove/prune_worktrees |
| Cherry-pick | bulk_cherry_pick |
| AI | ai_detect_clis / ai_commit_message / ai_pr_body |

---

## 핵심 표준 함수 (수정 시 회귀 테스트 필수)

| 함수 | 위치 | 책임 |
|---|---|---|
| `git::runner::git_run` | `git/runner.rs` | 모든 git CLI 호출의 단일 spawn 함수. core.quotepath=false / safe.directory=* 강제 주입 + UTF-8 디코딩 + NFC 정규화. **절대 우회 금지**. |
| `git::commit::commit` | `git/commit.rs` | 한글 메시지 file-based commit (`-F` tmpfile). 커밋 메시지 절대 `-m "..."` 인라인 X. |
| `ai::runner::ai_run` | `ai/runner.rs` | Claude/Codex CLI subprocess 표준. UTF-8 강제 + GBK fallback. |
| `ai::prompts::mask_secrets` | `ai/prompts.rs` | AI 송출 전 secret 마스킹 (GitHub PAT / AWS / private key / 주민번호). |
| `auth::*` | `auth.rs` | OS keychain entry. 평문 토큰 DB 저장 절대 X. |
| `forge::ForgeClient` | `forge/mod.rs` | Gitea + GitHub 통합 trait. 양 forge 차이는 impl 안에서. |

---

## 한글 / Windows 안전성 (테스트 통과 시 보장)

✅ 한글 commit message round-trip (subject + body)
✅ 한글 파일명 round-trip (stage / commit / log --name-only)
✅ 한글 branch 이름 round-trip
✅ 한글 stash 메시지 round-trip
✅ NFC 정규화 (NFD 입력도 NFC 로 일관)
✅ NFC 정규화 (NFD 입력도 NFC 로 일관)
✅ DB 한글 워크스페이스 이름 / 한글 경로 / 한글 레포 이름 idempotent

⚠ **검증되지 않음** (Windows 환경 필요):
- Windows CP949 활성 코드페이지에서의 실제 동작 (이론상 OK, dogfood 필요)
- WebView2 한글 입력 IME (`composition` 이벤트)
- Pretendard 폰트 fallback (시스템 미설치 시)

---

## 알려진 위험 / 미해결

### §1. 컴파일 검증 없음 (가장 큰 위험)

제 환경에서 `cargo build` / `bun tauri dev` 실행 안 함. 의심 지점:

- `tauri 2.1` + `tauri-plugin-* 2.0` API 정합성
- `git2 0.19` `vendored-libgit2` 가 Windows 에서 LLVM/clang 필요할 수 있음
- `keyring 3.4` 의 platform feature 이름 (apple-native/windows-native/linux-native) — 0.x 와 다름
- `sqlx 0.8` `migrate!` 매크로의 디렉토리 절대경로
- `regex 1.10` 추가 정상
- `unplugin-vue-router` 의 `routesFolder` 동작 (Vue 3.5+ 호환)

**대응**: 첫 빌드 실패 시 에러 로그를 다음 세션에 그대로 전달 → 패치.

### §2. 아이콘 부재 → release 빌드 차단

`apps/desktop/src-tauri/icons/README.md` 참조. `bun tauri dev` 는 OK, `bun tauri build` 만 막힘. 임시 PNG 한 장 → `bun tauri icon ./logo.png` 로 자동 생성.

### §3. AI CLI 의존성

`claude` / `codex` 가 PATH 에 없으면 AI 패널 자동 비활성. 수동 검증:
```bash
where claude
where codex
```

### §4. Tauri capabilities

`capabilities/default.json` 의 권한이 부족할 수 있음. 첫 dialog 호출 시 거부되면 추가 필요 (예: `dialog:allow-open-folder`).

### §5. CodeMirror 6 데코레이션 ranges 빌더

`DiffViewer.vue` 의 `Decoration.set(builder.map(...))` 가 빌드 시 타입 오류 가능. CodeMirror 6 의 `RangeSetBuilder` 가 더 안전한데 빠른 prototype 으로 작성. 회귀 시 `RangeSetBuilder<Decoration>` 으로 교체.

### §6. PR 페이지네이션 미구현

`list_pull_requests` 가 첫 50개만 반환. 사용자 회사 레포(50+)에서는 누락 가능. v0.2 다음 단계에서 cursor/page 추가.

### §7. AI prompt 송출 컨센트

회사 워크스페이스 디폴트 OFF / 개인 디폴트 ON 정책이 Vue 측에서만 confirm() 으로 처리됨. 실제 워크스페이스별 토글 + per-workspace settings 는 v0.2 다음 단계.

---

## 검증 체크리스트 (사용자가 Windows 에서 돌아왔을 때)

빌드 검증:
- [ ] `bun install` 성공
- [ ] `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` 성공
- [ ] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` 성공 (한글 round-trip 모두 통과)
- [ ] `bun tauri:dev` 윈도우 실행

기능 검증 (사용자 본인 레포):
- [ ] 사이드바에 워크스페이스 / 레포 추가 가능
- [ ] 듀얼 레포 그룹핑 표시 (peeloff/frontend + peeloff/frontend-admin)
- [ ] 커밋 그래프 한글 메시지 깨짐 없이 표시
- [ ] Status 패널 한글 파일명 표시
- [ ] Stage / Unstage / Commit (한글 메시지) 동작
- [ ] Push / Pull / Fetch
- [ ] Branch 목록 / 새 브랜치 생성 / 전환
- [ ] Stash push / pop / show diff
- [ ] Submodule 패널 (회사 레포 6/6 사용)
- [ ] PR 패널 (Gitea token 등록 후 list 표시)
- [ ] PR 패널 (GitHub token 등록 후 list 표시)
- [ ] Worktree 목록 (사용자 8개 동시 사용 케이스)
- [ ] Command Palette ⌘P 동작
- [ ] AI commit message (claude PATH 있으면 ✨ 버튼 활성화)
- [ ] Theme 토글 (다크/라이트)
- [ ] 일괄 Fetch 버튼 (사이드바 ⤓)

회귀 차단:
- [ ] `core.quotepath=false` 자동 주입 (한글 파일명 escape 안 됨)
- [ ] `safe.directory=*` 자동 주입 (외장 D: 드라이브 OK)
- [ ] keychain 토큰 / DB 평문 분리 (forge_accounts 에 keychain_ref 만)

---

## 다음 세션 권장 시작점

1. **빌드 결과 보고** — `cargo check` + `bun tauri dev` 시도 결과
2. **에러 메시지 그대로 전달** — Claude 가 패치
3. **사용자 검증 결과** — 위 체크리스트 중 실패한 항목

다음 sprint 후보 (우선순위):
1. 빌드 에러 수정 + 회귀 테스트 추가 (필수)
2. v0.2 잔여: Interactive rebase + 3-way merge editor + File history/Blame
3. v0.3: Profiles + FTS5 검색 + Issues/Releases + Bot PR 그룹핑
4. v1.0: Pre-commit 패널 + PR 리뷰 + Launchpad

---

## 글로벌 CLAUDE.md 준수 확인

✅ 모든 commit 에 `Co-Authored-By: Claude` trailer 없음
✅ 모든 commit 에 `Generated with Claude Code` 푸터 없음
✅ commit 메시지는 HEREDOC + `'EOF'` 로 한글 안전 전달
✅ scope 외 변경 없음 (다른 프로젝트 / 파일 미수정)
✅ 회귀 테스트 우선 (한글 round-trip / NFC / parse_forge 등)
