# DOGFOOD.md — Windows 빌드 + 사용자 본인 환경 검증 가이드

5분 안에 끝내는 step-by-step. 완전 처음부터.

---

## 0. 사전 요구사항

| 도구 | 권장 버전 | 확인 명령 |
|---|---|---|
| Bun | 1.1+ | `bun --version` |
| Rust | 1.77+ (edition 2021) | `rustc --version` |
| Node 호환 | (Bun 으로 충분) | — |
| Git CLI | 2.40+ | `git --version` |
| MSVC Build Tools (Win) | VS 2022 Build Tools | `cl` |
| WebView2 | (Win 11 기본 포함) | — |

⚠ Rust toolchain 미설치 시:
```powershell
winget install Rustlang.Rustup
rustup default stable
```

⚠ MSVC Build Tools 미설치 시:
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
# 워크로드 "Desktop development with C++" 선택
```

---

## 1. 의존성 설치

```bash
cd d:/01.Work/08.rf/git-fried
bun install
```

**예상 결과**: `node_modules/` + `bun.lock` 생성. 첫 설치 ~3분.

---

## 2. Rust 단위 테스트 (가장 먼저)

```bash
cd apps/desktop/src-tauri
cargo test --no-fail-fast
```

**예상 통과 테스트 (~15개)**:
- `git::tests::test_git_version_available`
- `git::tests::test_korean_commit_message_roundtrip` ★
- `git::tests::test_korean_filename_roundtrip` ★
- `git::tests::test_parse_forge_github_https`
- `git::tests::test_parse_forge_github_ssh`
- `git::tests::test_parse_forge_gitea_self_hosted` ★
- `git::tests::test_status_clean_after_init`
- `git::tests::test_status_detects_korean_filename_change` ★
- `git::tests::test_stage_unstage_round_trip` ★
- `git::tests::test_commit_simple_with_korean` ★
- `git::tests::test_diff_returns_text`
- `git::tests::test_branch_create_switch_delete` ★
- `git::tests::test_stash_round_trip` ★
- `git::tests::test_reset_soft_keeps_index`
- `git::graph::tests::test_linear_history`
- `git::graph::tests::test_merge_creates_new_lane`
- `storage::db::tests::test_db_open_and_migrate`
- `storage::db::tests::test_add_repo_korean_name_idempotent`
- `ai::prompts::tests::test_mask_*` (5개)

★ = 한글 회귀 차단 핵심.

⚠ 실패하면 `REVIEW.md §알려진 위험 §1` 참조 후 다음 세션에 에러 로그 전달.

---

## 3. 첫 dev 실행

```bash
cd ../..   # 프로젝트 루트
bun tauri:dev
```

**첫 실행 ~5분** (Rust 의존성 컴파일). 이후는 ~30초.

**예상 화면**:
- 1280×800 다크 윈도
- 좌측 사이드바: "git-fried v0.0", 워크스페이스 "전체", "레포가 없습니다"
- 우측: "좌측에서 레포를 선택하세요"

⚠ 안 뜨면:
- 콘솔 에러 확인: `bun tauri:dev --verbose`
- WebView2 미설치: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## 4. 첫 dogfood — 사용자 본인 레포 추가

1. 사이드바 우측 상단 **`+ 추가`** 클릭
2. OS 다이얼로그 → `D:\01.Work\08.rf\mock-fried` 선택
3. 사이드바에 `mock-fried` + `github` 배지 표시 ← 검증
4. 클릭 → 우측 커밋 그래프 + 로그 표시
5. **한글 커밋 메시지가 깨지지 않고 표시되는지 확인** ← 핵심 검증

---

## 5. 사용자 13개 레포 detect 테스트

다음 13개 레포 모두 `+ 추가` 후 사이드바 정상 표시 확인:

**개인 (GitHub)**:
- `D:\01.Work\08.rf\mock-fried`
- `D:\01.Work\08.rf\mcp-code-mode-starter`
- `D:\01.Work\08.rf\web-analysis`
- `D:\01.Work\08.rf\potluck-invite`

**회사 (Gitea, sub-repo 표본)**:
- `D:\01.Work\01.Projects\27.template_work-dir`
- `D:\01.Work\01.Projects\41.playground` (또는 본인이 자주 보는 1개)
- 듀얼 레포 1쌍: `peeloff/frontend` + `peeloff/frontend-admin`

**검증 포인트**:
- [ ] forge 배지 (gitea / github) 정확
- [ ] 듀얼 레포 그룹핑 (⇆ 표시)
- [ ] 한글 커밋 메시지 (회사 레포 70%+) 깨짐 없음
- [ ] worktree 8개 사용 레포 (gist-broadcenter / ptcorp-eosikahair) → WT 탭에서 모두 표시
- [ ] submodule 사용 레포 → Sub 탭에서 표시 + 디스크 사용량

---

## 6. Forge token 등록 (PR 패널 테스트)

1. 상단 헤더 → **설정** 클릭
2. "새 계정 등록" 섹션:
   - Gitea: `https://git.dev.opnd.io` + 회사 PAT
   - GitHub: 빈칸 (디폴트 `https://api.github.com`) + 개인 PAT
3. **검증** 버튼 → "✓ 검증 완료 — tgkim" 표시
4. **저장** 클릭
5. 홈으로 → 회사 레포 선택 → PR 탭 → 50개 이내 PR 표시

⚠ 토큰은 OS keychain (Windows Credential Manager) 에 저장됨. 직접 확인:
```powershell
control /name Microsoft.CredentialManager
# Windows Credentials → "git-fried:..." entries
```

---

## 7. AI 페어 프로그래밍 검증 (선택)

PATH 에 `claude` 가 있으면 ✨ AI 버튼 활성화:

1. 어떤 파일이라도 수정 + stage
2. 우측 패널 하단 **✨ AI** 버튼 클릭
3. confirm: "외부 LLM 송출, 회사 정책 확인?" → 확인
4. 잠시 후 commit message input 자동 채워짐
5. 사용자 검토 후 Commit

`codex` CLI 만 있으면 그것 사용. 둘 다 없으면 ✨ 버튼 안 보임.

---

## 8. 한글 안전 회귀 차단 시나리오

가장 중요. **반드시 한 번 해보고 결과 보고**.

```
시나리오 1: 한글 커밋 메시지
1. 임의 레포 변경 stage
2. Conventional 빌더에서 type=feat, subject="한글 + 이모지 ✓"
3. body 에 "여러 줄에 걸친\n한국어 본문" 입력
4. Commit 실행
5. 그래프에서 새 커밋 표시 확인 — 깨지면 회귀

시나리오 2: 한글 파일명
1. 레포 안에 "테스트.md" 파일 생성
2. Status 패널에서 "Untracked: 테스트.md" 표시 확인
3. + 클릭 → Staged 로 이동, "추가 테스트.md" 표시
4. Commit "feat: 한글 파일 추가"
5. git log --name-only -1 출력에 "테스트.md" 그대로 (escape 안됨)

시나리오 3: 한글 브랜치명
1. 브랜치 패널에서 "feat/한글-브랜치" 입력 + + 클릭
2. 더블클릭으로 switch
3. 다시 main 으로 switch
4. × 클릭으로 삭제
5. 모든 단계 깨지면 안 됨
```

---

## 9. 빌드 트러블슈팅

### `cargo: error: linking with link.exe failed`
→ MSVC Build Tools 누락. `winget install Microsoft.VisualStudio.2022.BuildTools` + "Desktop development with C++" 워크로드.

### `error: failed to run custom build command for openssl-sys`
→ `Cargo.toml` 의 `git2` 가 `vendored-openssl` feature 사용 중인데 충돌 가능. 일반적으로 vendored OK. 안되면 `OPENSSL_DIR` env 설정.

### `cannot find -lsqlite3`
→ sqlx 가 vendored sqlite 사용 중 (정상). 발생 안 해야 함. 발생하면 `Cargo.toml` 에 `sqlx = { ..., features = ["..., libsqlite3-sys/bundled"] }` 추가.

### `unplugin-vue-router: routes folder not found`
→ `apps/desktop/src/pages/` 가 비어있을 때. `pages/index.vue` `pages/settings.vue` 가 있는지 확인.

### `tauri::generate_handler!` 컴파일 에러
→ commands.rs 의 함수 시그니처 확인. `state: tauri::State<'_, Arc<AppState>>` 형식 일관성.

### Windows Defender SmartScreen "이 앱은 보호되지 않은 ..."
→ 정상. unsigned dev build. Settings → Privacy & security → Windows Security → App control → "Unverified apps" 허용. 또는 "More info → Run anyway".

### 한글 파일명이 `\343\205\244...` 로 표시
→ `core.quotepath=false` 가 적용 안 됨. `git/runner.rs` 의 `git_run` 표준 함수 통과 확인. 직접 `Command::new("git")` 호출하는 코드가 있으면 그걸 git_run 으로 교체.

---

## 10. 빌드 성공 시 — GitHub remote 연결

```bash
cd d:/01.Work/08.rf/git-fried
gh auth status   # 인증 확인
gh repo create tgkim/git-fried --public --source=. --remote=origin --push
```

또는 manual:
```bash
gh repo create tgkim/git-fried --public --source=.
git remote add origin git@github.com:tgkim/git-fried.git
git push -u origin main
```

⚠ `git push` 시 7개 commit 이 한 번에 올라감. CI 가 트리거되면 GitHub Actions tab 확인.

---

## 11. 다음 세션 시작 시 보고 형식

다음 Claude 세션 첫 메시지 권장 형식:

```
git-fried v0.2-stretch 빌드 결과:

cargo check: [성공/실패]
cargo test: [통과 N개 / 실패 M개]
실패 로그:
  <에러 메시지 그대로>

bun tauri:dev: [실행됨/안 됨]

dogfood:
  - 한글 커밋 round-trip: [OK/실패]
  - 듀얼 레포 그룹핑: [OK/실패]
  - PR 패널: [OK/실패/시도 안 함]
  - AI commit msg: [OK/실패/CLI 미설치]

다음 우선순위:
  1. <빌드 에러 수정>
  2. <기능 X 구현>
```

이 형식으로 보고하면 Claude 가 즉시 패치 PR 또는 다음 sprint 진입.
