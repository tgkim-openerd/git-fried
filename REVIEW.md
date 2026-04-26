# REVIEW — git-fried v0.0 핸드오프

작성: 2026-04-26 (Claude 세션 1)
대상: tgkim — 다른 업무 마치고 돌아왔을 때 검토용

---

## TL;DR

이번 세션에서 **v0.0 골격 + Phase 2 일부 (현재 진행 중)** 까지 작성. 코드 작성만 했고 빌드/실행은 검증 못 했음 (제 환경에서는 `cargo build` / `bun tauri dev` 실행이 안전하지 않아 사용자 Windows 환경에서만 가능).

**다음 액션 (5분)**:
1. 이 문서를 끝까지 읽기
2. 아래 §빠른 검증 절차 따라 빌드 한 번 시도
3. 빌드 안 되면 §알려진 이슈 / 위험 참고
4. 빌드 OK 면 GitHub repo 생성 → push → 다음 세션 요청

---

## 작성된 v0.0 산출물

```
git-fried/
├── README.md                          # 종합 인덱스
├── LICENSE                            # MIT
├── .gitignore                         # Node/Rust/Tauri 표준
├── package.json                       # workspace root (apps/* + packages/*)
├── REVIEW.md                          # 이 문서
├── docs/plan/                         # 8개 기획 문서 (이전 세션)
├── apps/desktop/                      # Tauri 앱 단일 패키지
│   ├── package.json                   # Vue 3 + Vite + shadcn-vue 의존성
│   ├── tsconfig.json + tsconfig.node.json
│   ├── vite.config.ts                 # auto-import + vue-router + components 플러그인
│   ├── tailwind.config.ts             # shadcn-vue 토큰 포함
│   ├── postcss.config.js
│   ├── index.html                     # html 진입 (lang=ko, dark 디폴트)
│   ├── src/
│   │   ├── main.ts                    # Vue + Pinia + Router + Vue Query
│   │   ├── App.vue                    # 사이드바 + RouterView
│   │   ├── styles/main.css            # Tailwind + shadcn 토큰 (light/dark)
│   │   ├── pages/index.vue            # 첫 화면 (CommitTable)
│   │   ├── components/Sidebar.vue     # 워크스페이스 + 레포 리스트 + 추가 버튼
│   │   ├── components/CommitTable.vue # 커밋 로그 테이블
│   │   ├── stores/repos.ts            # Pinia (활성 레포/워크스페이스)
│   │   ├── api/queryClient.ts         # Vue Query 설정
│   │   ├── api/git.ts                 # Tauri IPC 래퍼
│   │   ├── types/git.ts               # Rust 타입과 1:1 매핑
│   │   ├── composables/.keep
│   │   └── ai/.keep                   # v0.2 AI CLI subprocess
│   └── src-tauri/
│       ├── Cargo.toml                 # git2/sqlx/reqwest/encoding_rs/keyring
│       ├── tauri.conf.json            # Windows MSI/NSIS, Korean locale
│       ├── build.rs
│       ├── capabilities/default.json  # Tauri 2 권한
│       ├── icons/README.md            # ⚠ 아이콘 미작성 (release build 막힘, dev 는 OK)
│       └── src/
│           ├── main.rs                # 진입점 (얇음)
│           ├── lib.rs                 # AppState + tauri::Builder
│           ├── error.rs               # AppError + IPC 직렬화
│           ├── git/mod.rs
│           ├── git/runner.rs          # ★ 한글 안전 spawn 표준 (가장 중요)
│           ├── git/repository.rs      # git2-rs (log/detect_meta/parse_forge)
│           ├── git/tests.rs           # 한글 round-trip 회귀 테스트
│           ├── storage/mod.rs
│           ├── storage/db.rs          # sqlx + workspaces/repos CRUD
│           ├── storage/migrations/0001_initial.sql
│           ├── ipc/mod.rs
│           └── ipc/commands.rs        # 7개 #[tauri::command]
└── .github/workflows/ci.yml           # Windows-only, rust+vue+tauri build
```

총 36개 파일.

---

## 빠른 검증 절차 (Windows)

### 1. 의존성 설치

```bash
cd d:/01.Work/08.rf/git-fried
bun install
```

⚠ 첫 설치는 ~5분. `node_modules` + `bun.lock` 생성.

### 2. Rust 단위 테스트 (가장 먼저 검증)

```bash
cd apps/desktop/src-tauri
cargo test
```

**기대 결과**: 한글 round-trip / NFC / parse_forge / DB CRUD 등 ~12개 테스트 통과. 실패하면 §알려진 이슈 §1 확인.

### 3. Tauri dev 실행 (UI 확인)

```bash
cd ../..
bun tauri:dev
```

**기대 결과**: 1280×800 윈도, 좌측 사이드바 (워크스페이스 빈 상태 + "레포가 없습니다"), 상단 "git-fried v0.0".
[+ 추가] 클릭 → OS 폴더 선택 → 사용자 본인 레포 (예: `d:/01.Work/08.rf/mock-fried`) 선택 → 사이드바에 추가 → 클릭 → 우측에 커밋 로그 ~200개 표시 (한글 안 깨짐).

### 4. 검증 체크리스트

- [ ] `cargo test` 모든 테스트 통과
- [ ] `bun tauri:dev` 윈도가 뜸
- [ ] 폴더 다이얼로그가 열림
- [ ] 사용자 본인 레포 (rf 또는 01.Projects 중 하나) 추가 가능
- [ ] 커밋 로그 한글 메시지가 깨지지 않음
- [ ] 한글 파일명 변경 커밋이 표시됨
- [ ] 사이드바 forge 배지 (gitea / github) 가 정확히 인식됨
- [ ] 다크 모드 디폴트 (배경 #0a0a0a)

### 5. GitHub 레포 생성 (수동 — 제가 못함)

```bash
cd d:/01.Work/08.rf/git-fried
gh repo create tgkim/git-fried --public --source=. --remote=origin
git push -u origin main
```

---

## 알려진 이슈 / 위험

### §1. Rust 컴파일 안 될 가능성

**가능성**: 중간. 제가 Cargo.toml 의존성 버전을 보수적으로 고정했지만 실제 빌드 검증 못 함.

**의심 지점**:
- `tauri 2.1` + `tauri-plugin-* 2.0` API 일치 여부 (Tauri 2 는 자주 breaking 변경)
- `git2 0.19` 의 `vendored-libgit2` 가 Windows 에서 컴파일러 (clang) 필요할 수 있음 → 실패 시 `default-features = false` 변경 검토
- `sqlx 0.8` migrate! 매크로가 빌드 시 마이그레이션 디렉토리를 찾는데, `apps/desktop/src-tauri/src/storage/migrations` 절대경로 의존
- `tauri-plugin-keyring` 미포함 — v0.1 Sprint 5 에서 PAT 저장 시 추가 예정

**대처**:
1. `cargo check` 부터 시도 → 에러 보고 (Claude 다음 세션에서 수정)
2. 의존성 충돌이면 `cargo update` 한 번
3. `vendored-libgit2` 빌드 실패 시 OpenSSL/libclang 설치 안내

### §2. capabilities/default.json 권한 부족

Tauri 2 의 권한 모델은 매우 엄격. 실제 dialog 호출 시 권한 거부 가능.
필요 시 `dialog:allow-open-folder`, `fs:scope` 등 추가.

### §3. 아이콘 부재 → release 빌드 차단

`bun tauri:build` (release MSI) 는 아이콘 필요. 임시 PNG 한 장 준비 후:

```bash
bun tauri icon ./logo.png
```

`apps/desktop/src-tauri/icons/` 에 모든 사이즈 자동 생성.

### §4. 코드페이지 시뮬레이션 미완

`runner.rs` 의 `decode_lossy` 는 UTF-8 → GBK fallback 만 구현. 사용자 가장 자주 마주치는 CP949 (한글 EUC-KR) 가 GBK 와 거의 동일하지만 **완전 동일 아님**. v0.1 Sprint 1 에 EUC-KR 명시 fallback 추가 예정.

### §5. capabilities scope

`fs:default` 는 일반 파일 접근만. dialog 로 선택한 폴더 외 작업 시 추가 scope 필요 (`fs:scope-asset` / 동적 scope).

---

## 다음 세션 권장 시작점

세션 시작 시 첫 메시지로 이 문서 + 빌드 결과 (성공 / 에러 로그) 전달.

**Phase 2 (v0.1 Sprint 1) 예상 작업**:
- `get_status` (working/staged/untracked) IPC + Rust
- `stage_path` / `unstage_path` / `discard` IPC
- `stage_hunk` (diff 청크 단위 — 이게 가장 비싼 작업)
- `commit_with_message` (file-based) IPC + Conventional builder UI
- `push` / `pull` / `fetch` (git CLI shell-out)
- 진행 상황 표시 (Tauri Channel<T> 로 stream)

**예상 산출물**: ~20개 파일 추가/수정.

---

## 커밋 메시지 (이번 세션 commit 시 사용)

글로벌 CLAUDE.md 규칙 준수:
- ❌ Co-Authored-By trailer 금지
- ❌ "Generated with Claude" 푸터 금지

추천 메시지:

```
feat: v0.0 foundation — Tauri 2 + Vue 3 + Rust git2-rs skeleton

- Workspace root + apps/desktop monorepo 구조
- Vue 3 + Vite + shadcn-vue 토큰 + Pinia + Vue Query 셋업
- Rust 백엔드: git2-rs read path + git CLI 한글 안전 spawn 표준
- SQLite + sqlx + 0001_initial.sql (workspaces/repos/forge_accounts/profiles)
- 7 IPC commands: get_app_info / list+create_workspace /
  list+add+remove_repo / get_log
- 첫 화면: 사이드바 (워크스페이스 + 레포) + 커밋 로그 테이블
- 한글 round-trip 회귀 테스트 7종 (cargo test)
- GitHub Actions CI (Windows-only matrix)

Refs: docs/plan/00 §2 §6, 04 §3 §5, 05 v0.0
```
