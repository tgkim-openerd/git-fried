# 04. 기술 아키텍처 — Tauri 2 + Rust + Vue 3 + Vite

## 1. 스택 결정 표

| 레이어 | 선택 | 대안 (포기) | 결정 근거 |
| --- | --- | --- | --- |
| **앱 셸** | Tauri 2 | Electron, Wails 2, Flutter Desktop, Qt 6, Compose MP | 30~50MB idle, GitButler 검증, Rust 생태계 |
| **Backend 언어** | Rust (edition 2024) | Go, Node, C++ | git2-rs, gitoxide, sqlx, encoding_rs, keyring 한 툴체인 |
| **Git 라이브러리** | `git2-rs` (libgit2) + git CLI shell-out 하이브리드 | gitoxide 단독, go-git, nodegit | read=git2-rs, heavy=git CLI, gitoxide 는 v0.3 옵션 |
| **Frontend 프레임워크** | **Vue 3 + Vite** (Nuxt 미사용) | React 19, Svelte 5, Nuxt SPA | 사용자 회사 50+ 레포 = Vue, Claude review 효율 최고 |
| **자동화 (auto-import / file-routing)** | `unplugin-auto-import` + `unplugin-vue-components` + `unplugin-vue-router` | Nuxt 풀 | Nuxt SSR 오버헤드 제거, 데스크탑 SPA 최적화 |
| **UI 컴포넌트** | shadcn-vue (+ reka-ui 보조) | PrimeVue / Naive UI / Ant Design Vue | shadcn 디자인 언어, 부족 컴포넌트는 reka-ui (Radix Vue) |
| **상태** | Pinia | Vuex / 자체 ref store | Vue 공식 |
| **데이터/캐시** | TanStack Query (Vue Query) | swrv / 직접 fetch | 표준, React 버전과 동일 API |
| **CSS** | Tailwind CSS v4 | UnoCSS / CSS Modules | shadcn-vue 호환 |
| **가상 스크롤** | `@tanstack/vue-virtual` | vue-virtual-scroller | TanStack 라인업 |
| **에디터/Diff** | CodeMirror 6 (framework-agnostic) | Monaco | Tauri 번들 작게, Vue/React 모두 동일 |
| **3-way Merge** | `@codemirror/merge` | Monaco merge editor | CodeMirror 라인업 |
| **DB (메타/인덱스)** | SQLite + FTS5 (`sqlx`) | Tantivy, RocksDB | 임베드, 1파일, ACID, FTS5로 검색까지 |
| **인증 보관** | OS keychain (`tauri-plugin-keyring`) | Stronghold | Windows Credential Manager 직접 |
| **HTTP 클라이언트** | `reqwest` + `tokio` | ureq, surf | async 표준 |
| **API 타입 codegen** | `@hey-api/openapi-ts` (Gitea) + `@octokit/types` (GitHub) | 자체 codegen | active 유지 / GraphQL 확장 |
| **AI 통합** | **Claude CLI / Codex CLI subprocess** | BYOK API / Ollama 자체 통합 | 사용자 본인 인증 환경 위임, 토큰·비용·rate limit 모두 외부 (§11) |
| **자동 업데이트** | Tauri updater + GitHub Releases | Squirrel, Sparkle | 표준 / 무료 호스팅 |
| **번들/패키지** | Tauri CLI + cargo-bundle | electron-builder | 표준 |
| **CI** | GitHub Actions (Windows 우선, macOS/Linux v1.x) | Buildkite | 무료 / OSS 표준 |

## 2. 시스템 다이어그램

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (WebView2 / WKWebView / WebKitGTK)                 │
│  Vue 3 + Vite + Tailwind v4 + shadcn-vue + Pinia + Vue Query │
│  CodeMirror 6 (diff/merge) + Canvas (commit graph)           │
└────────────────────────┬─────────────────────────────────────┘
                         │  Tauri IPC (custom protocol + Channel)
                         │  serde JSON / 바이너리 (큰 페이로드)
┌────────────────────────▼─────────────────────────────────────┐
│  Rust Backend (tokio runtime)                                │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Git Service                                             │ │
│  │  - read path: git2-rs (status/log/diff/branch list)     │ │
│  │  - write/heavy path: git CLI shell-out (clone/fetch/    │ │
│  │    push/blame/large diff/rebase)                        │ │
│  │  - 모든 child process: UTF-8 강제 + encoding_rs decode  │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Forge Service                                           │ │
│  │  - GiteaClient (PAT, OpenAPI typed, reqwest)            │ │
│  │  - GitHubClient (PAT/octokit, REST + GraphQL)           │ │
│  │  - Unified PR/Issue/Release abstraction                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Storage                                                 │ │
│  │  - SQLite (sqlx) : workspaces, repos, settings,         │ │
│  │    commit index, search FTS5                            │ │
│  │  - keyring : PAT, SSH passphrase                        │ │
│  │  - tokio fs : config files (~/.git-fried/)              │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Watcher / Indexer                                       │ │
│  │  - notify-rs : file system watch                        │ │
│  │  - 변경 감지 → status 재계산 → IPC push                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 3. Git 라이브러리 — 하이브리드 전략 상세

### read path (git2-rs)
빈도 높고 작은 호출. 프로세스 fork 비용을 피하기 위해 in-process libgit2 사용.

- `git status` (한 레포 staging/working 상태)
- `git log --oneline -100` (커밋 리스트)
- `git branch -a`
- `git diff --stat`
- `git diff <hunk>` (작은 hunk)
- `git stash list`
- `git tag`
- `git submodule status`

### heavy / write path (git CLI shell-out)
큰 출력 / 네트워크 / 정확한 git 동작 필요. CLI가 항상 최신·정확함.

- `git clone <url>`
- `git fetch / pull / push`
- `git blame <file>` (libgit2 blame은 30배 느림 케이스 있음)
- `git rebase -i` (라이브러리로 흉내내지 않고 plumbing 사용)
- `git merge` (충돌 발생 시)
- `git lfs *`
- `git submodule update --init --recursive`
- `git format-patch / apply`

### Rust 측 Git Process Spawn 표준
```rust
// 모든 git CLI 호출은 이 함수 통과
async fn git_run(repo: &Path, args: &[&str]) -> Result<GitOutput> {
    let mut cmd = Command::new("git");
    cmd.current_dir(repo)
       .arg("-c").arg("core.quotepath=false")
       .arg("-c").arg("i18n.commitencoding=utf-8")
       .arg("-c").arg("i18n.logoutputencoding=utf-8")
       .arg("-c").arg("safe.directory=*")
       .args(args)
       .env("LANG", "C.UTF-8")
       .env("LC_ALL", "C.UTF-8")
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());
    let out = cmd.output().await?;
    // stdout 은 항상 바이트로 받고 encoding_rs::UTF_8 로 명시 디코딩
    let stdout = encoding_rs::UTF_8.decode(&out.stdout).0.into_owned();
    let stderr = encoding_rs::UTF_8.decode(&out.stderr).0.into_owned();
    Ok(GitOutput { code: out.status.code(), stdout, stderr })
}
```

> 핵심: **OS 기본 코드페이지 신뢰 안 함**. Windows에서 chcp가 949든 65001이든 결과 동일하도록.

## 4. 한글 / 인코딩 안전 파이프 (CRITICAL)

### 입력 (commit message / PR body)
- UI textarea → React 측에서 NFC normalize (precomposed 강제)
- 길이 큰 메시지는 자동 file-based commit (`git commit -F <tmpfile>`)
- tmpfile은 항상 UTF-8 BOM 없이 작성, 끝줄 LF

### 출력 (log / diff / blame)
- git CLI: 위 표준 spawn 함수로 강제 UTF-8
- libgit2: `git2::Config` 에서 `i18n.*` 설정 강제, blob은 바이트로 받아 명시 디코딩

### 파일명
- Windows에서 NFC/NFD 차이로 한글 파일명 깨질 수 있음
- 모든 파일명을 NFC normalize 후 표시
- `core.precomposeunicode=true` 강제 주입

### 검증 시나리오 (회귀 방지)
- "한글 커밋 메시지 입력 → 커밋 → log 표시 → diff 표시"
- "한글 파일명 stage → commit → 다른 머신 pull 후 표시"
- "Gitea PR body 한글 작성 → API POST → Gitea 웹에서 깨지지 않는지"

## 5. 데이터 모델 (SQLite)

```sql
-- 워크스페이스 (=레포 그룹, 회사/개인 구분)
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  forge_kind TEXT,    -- 'gitea' | 'github' | 'mixed'
  created_at INTEGER NOT NULL
);

-- 레포 (로컬 경로 + remote 정보)
CREATE TABLE repos (
  id INTEGER PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id),
  name TEXT NOT NULL,
  local_path TEXT NOT NULL UNIQUE,
  default_remote TEXT,
  default_branch TEXT,
  forge_kind TEXT,
  forge_owner TEXT,   -- 'tgkim' | 'opnd-frontend'
  forge_repo TEXT,
  last_fetched_at INTEGER,
  is_pinned INTEGER DEFAULT 0
);

-- 커밋 인덱스 (검색용, 옵션)
CREATE TABLE commits (
  repo_id INTEGER REFERENCES repos(id),
  sha TEXT,
  parent_shas TEXT,   -- JSON array
  author_name TEXT,
  author_email TEXT,
  author_at INTEGER,
  message TEXT,
  PRIMARY KEY (repo_id, sha)
);

-- FTS5 검색
CREATE VIRTUAL TABLE commits_fts USING fts5(
  message, author_name,
  content='commits', tokenize='unicode61 remove_diacritics 2'
);

-- Forge 계정
CREATE TABLE forge_accounts (
  id INTEGER PRIMARY KEY,
  forge_kind TEXT,    -- 'gitea' | 'github'
  base_url TEXT,      -- 'https://git.dev.opnd.io' | 'https://api.github.com'
  username TEXT,
  -- token 은 keychain 에 (id 만 참조)
  keychain_ref TEXT
);

-- 프로파일 (개인↔회사 토글)
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,    -- 'personal' | 'opnd'
  git_user_name TEXT,
  git_user_email TEXT,
  signing_key TEXT,
  ssh_key_path TEXT,
  default_forge_account_id INTEGER REFERENCES forge_accounts(id),
  is_active INTEGER DEFAULT 0
);

-- 설정 (KV)
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
```

## 6. Forge 추상화 (Gitea + GitHub 통합)

GitKraken/Tower가 forge 추상화에서 자주 실패하는 지점: PR 데이터 모델이 forge별로 미묘하게 다름.

### 통합 트랜스폼

```rust
// Rust trait
#[async_trait]
trait ForgeClient {
    async fn list_pull_requests(&self, repo: ForgeRepo) -> Result<Vec<PullRequest>>;
    async fn get_pull_request(&self, repo: ForgeRepo, num: u64) -> Result<PullRequest>;
    async fn create_pull_request(&self, req: CreatePullRequestReq) -> Result<PullRequest>;
    async fn list_issues(&self, repo: ForgeRepo) -> Result<Vec<Issue>>;
    async fn list_releases(&self, repo: ForgeRepo) -> Result<Vec<Release>>;
}

struct PullRequest {
    forge_kind: ForgeKind,         // gitea | github
    repo: ForgeRepo,
    number: u64,
    title: String,
    body_md: String,
    state: PrState,                 // open | closed | merged | draft
    head_branch: String,
    base_branch: String,
    head_sha: String,
    author: Author,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    mergeable: Option<bool>,
    requested_reviewers: Vec<Author>,
    labels: Vec<Label>,
    // forge 별 raw 페이로드 보관 (UI 에서 필요 시 노출)
    raw: serde_json::Value,
}
```

### 알려진 차이점 (구현 시 주의)
- Gitea draft PR: `prerelease`/`draft` 필드 위치가 GitHub과 다름
- Gitea labels: 색상이 hex prefix 없이 6글자
- Gitea reviews: GitHub과 거의 동일하지만 일부 필드(state) 케이스 차이
- GitHub GraphQL vs Gitea REST: 페이지네이션 모델 다름 → 추상화 레이어에서 cursor/page 통합

## 7. Branch Graph 렌더링

### 알고리즘: pvigier "Straight branches"
- 각 브랜치를 컬럼(lane)에 할당
- 브랜치 종료 시 다른 컬럼 shift 안 시킴 → 곧은 직선
- GitKraken/Sourcetree 만 한 lane 알고리즘

### 렌더링: Canvas 2D + 오프스크린 worker
- SVG는 1만 커밋 넘으면 DOM 폭발
- WebGL은 텍스트 렌더 비용 큼
- Canvas는 가상 스크롤 + 줄당 22~28px 고정 → 100k 커밋도 60fps 가능

### 가상화
- `@tanstack/vue-virtual` + Canvas 직접 그리기
- viewport 안의 ~50개 row만 그림
- scroll 이벤트에서 row 인덱스 → graph 좌표 매핑

## 8. 알려진 함정 + 완화

| 함정 | 완화 |
|---|---|
| **WebView2 한글 디코딩 버그** (Tauri issue #4644 등) | 모든 git child stdout 은 Rust에서 디코딩 후 IPC. 프론트는 디코딩 책임 없음. |
| **libgit2 거대 레포 느림** | 하이브리드 전략 (heavy = git CLI) |
| **Tauri sidecar UTF-8 버그** | sidecar 미사용, std `Command` + `Stdio::piped` 직접 |
| **Windows EV 인증서 비용** | v0.x = OV ($100/yr), v1+ = EV ($400/yr) |
| **`safe.directory` 거부** | 워크스페이스 추가 시 자동 등록 + `-c safe.directory=*` 주입 |
| **GitButler `gitoxide` 마이그레이션 진행 중 = 학습 자료 풍부** | 그들의 PR/이슈 추적, 동일 패턴 차용 |
| **Tauri Linux WebKitGTK 4.1 의존성** | v1.0 까지 Linux 포지션 후순위, AppImage 우선 |

## 9. 디렉토리 구조 (제안)

```
git-fried/
├── README.md
├── LICENSE
├── docs/
│   └── plan/                    # 본 기획 문서들
├── apps/
│   └── desktop/                 # Tauri 앱 (단일 패키지)
│       ├── src-tauri/           # Rust 백엔드
│       │   ├── Cargo.toml
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   ├── git/         # Git 서비스
│       │   │   ├── forge/       # Gitea / GitHub
│       │   │   ├── storage/     # SQLite, keyring
│       │   │   ├── ipc/         # Tauri commands
│       │   │   └── watcher/
│       │   └── tauri.conf.json
│       ├── src/                 # Vue 3 프론트
│       │   ├── App.vue
│       │   ├── main.ts
│       │   ├── components/      # PascalCase.vue (auto-import)
│       │   ├── pages/           # file-routing (unplugin-vue-router)
│       │   ├── composables/     # use*.ts (auto-import)
│       │   ├── stores/          # Pinia
│       │   ├── api/             # IPC 래퍼 + Vue Query (TanStack)
│       │   ├── ai/              # Claude/Codex CLI subprocess wrapper
│       │   ├── styles/
│       │   └── types/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts       # auto-import / vue-components / vue-router 플러그인
│       └── tailwind.config.ts
├── packages/
│   ├── forge-types/             # Gitea / GitHub typed clients (codegen)
│   └── ui/                      # 추후 공유 컴포넌트 (옵션)
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
└── package.json                 # workspace root
```

## 10. AI 페어 프로그래밍 (Rust 학습 0 가정)

**전제**: 사용자(tgkim) 는 Rust 경험 0. 본 프로젝트의 Rust 백엔드 코드는 **Claude Code / Codex CLI 페어 프로그래밍** 으로 생성·검수한다. 별도 학습 시간 없이 v0.0 즉시 진입.

### 분업 모델

| 역할 | 담당 |
|---|---|
| Rust 백엔드 (git2-rs / sqlx / reqwest / Tauri commands) | **AI 페어** (Claude/Codex 가 작성, tgkim 이 review) |
| 도메인 / UI / 결정 / 회귀 테스트 시나리오 | **tgkim** |
| 인코딩 spawn 표준 / Forge 추상화 등 표준 패턴 정의 | **AI 페어가 본 문서를 SoT 로 참조** |

### 코드 스타일 강제 (AI 출력에 적용)
- 매 함수 한국어 짧은 코멘트 + 핵심 라인에 의도 설명 (review 가능성 우선)
- 단순 패턴만: `Arc<Mutex<T>>`, `async/await`, `anyhow::Result<T>`
- 복잡한 lifetime / 고급 generics / `unsafe` 회피
- 리팩토링보다 **회귀 테스트** 우선 — 사용자가 디버깅 어려우니 테스트가 안전망
- 모든 git/IO/network 함수는 §3 표준 spawn / §11 AI subprocess 표준 통과

### 작업 흐름 (v0.0 첫 PR 예시)
```
1. tgkim: "Tauri 2 + sqlite + 첫 화면 추가" 요청
2. Claude Code: docs/plan/04 §3 표준 spawn 함수, §5 SQL 스키마 참조 → src-tauri/* 생성
3. Claude Code: 회귀 테스트 (한글 round-trip + safe.directory) 동시 작성
4. tgkim: review (한국어 코멘트 + 의도 명확성), 수정 요청
5. Claude Code: 수정 → tgkim 승인 → commit (Co-Authored-By 금지)
```

### 위험 / 완화
- **위험**: AI 가 GitButler 등 다른 OSS 의 패턴을 무비판 차용 → 본 프로젝트의 한글/Gitea 표준에 어긋남.
- **완화**: 모든 PR 은 §3 / §4 / §6 / §11 의 표준 함수를 통과해야 함을 review checklist 로 강제.
- **위험**: AI 페어로 짧은 시간에 코드 양이 폭증 → tgkim review 처리 못 함.
- **완화**: Sprint 단위 (2~4주) 로 PR 양 제한. v0.1 의 16개 must 중 한 번에 1~2개씩.

---

## 11. AI Integration — Claude CLI / Codex CLI subprocess 위임

### 원칙
- **자체 LLM 인프라 없음**. BYOK / Ollama / API 키 관리 / 토큰 비용 추적 — 모두 외부 CLI 책임.
- 사용자가 이미 인증·세팅 완료한 `claude` / `codex` 명령어를 subprocess 로 호출.
- 토큰 비용 / rate limit / 모델 선택 / 컨텍스트 제한 — CLI 측 위임.
- 우리 앱은 **prompt 조립 + 스트림 표시 + 결과 적용** 책임만.

### 지원 CLI (감지 순서)
1. **Claude Code** (`claude` 명령어, https://claude.com/claude-code) — v0.2 우선
2. **Codex CLI** (`codex` 명령어, OpenAI) — v0.2 동시
3. (확장) Ollama 로컬 / 사내 LLM — v1.x 검토

### 첫 실행 감지
```
앱 시작 시:
1. PATH 에서 `claude --version` / `codex --version` 시도
2. 감지된 CLI 의 인증 상태 확인 (`claude -p "ping" --output-format json`)
3. 결과를 settings 에 캐시 (다음 실행 빠른 부팅)
4. 둘 다 없으면 AI 패널 비활성화 + 안내 ("Claude Code 또는 Codex CLI 를 설치하면 AI 기능이 활성화됩니다")
```

### Rust 측 표준 spawn

```rust
pub enum AiCli { Claude, Codex }

pub struct AiOutput {
    pub text: String,
    pub raw_json: Option<serde_json::Value>,
    pub usage: Option<AiUsage>,  // CLI 가 제공할 때만
    pub took_ms: u64,
}

async fn ai_run(
    cli: AiCli,
    prompt: &str,
    on_chunk: impl Fn(String),  // Tauri Channel<String> 으로 stream
) -> Result<AiOutput> {
    let bin = match cli { AiCli::Claude => "claude", AiCli::Codex => "codex" };
    let mut cmd = Command::new(bin);
    match cli {
        AiCli::Claude => cmd.args(["-p", prompt, "--output-format", "stream-json"]),
        AiCli::Codex  => cmd.args(["exec", prompt, "--json"]),
    };
    cmd.env("LANG", "C.UTF-8")
       .stdin(Stdio::null())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());
    // stdout 라인별 파싱 → on_chunk 콜백 → 프론트로 stream
    // 마지막 라인의 result/usage 를 누적 반환
    ...
}
```

### 기능 매핑 (어떤 액션이 어떤 prompt 를 만드는가)

| 액션 | 입력 | Prompt 템플릿 | 결과 활용 |
|---|---|---|---|
| **AI commit message** | staged diff (≤5KB 잘림) + 최근 5개 commit 스타일 | "다음 diff 에 대한 conventional commit message 한국어로. 사용자는 `feat:/fix:/chore:` 80% 사용. body 는 옵션." | message input 자동 채움 + 사용자 승인 후 commit |
| **AI PR body** | branch 의 모든 commit + diff stat | "다음 변경에 대한 한국어 PR body. 글로벌 CLAUDE.md 의 'Co-Authored-By 금지' 룰 준수." | PR 생성 폼 body 자동 채움 |
| **AI merge conflict 도움** (v1.x) | conflict chunk + 양쪽 file context | "다음 충돌에 대한 해결안 + 근거." | 사용자가 선택 |
| **AI 코드 리뷰** (v1.x) | branch diff | "변경 사항 리뷰. 보안/성능/한글/에러 처리 관점." | 인라인 코멘트 후보 |

### 인증 / 보안
- `claude` / `codex` 의 인증은 **사용자 환경의 책임**. 우리는 토큰 저장 안 함.
- 회사 코드 (Gitea private) 가 외부 LLM 으로 전송됨을 첫 실행 시 명확히 고지 + opt-in.
- 사용자 회사 정책에 따라 AI 기능 전체 disable 토글 (settings) 제공.
- prompt 에 **secret 마스킹** 사전 처리: `.env`, PAT, SSH key 패턴 정규식 필터.

### 비용·rate limit
- 우리 앱은 비용 표시 안 함 (CLI 가 표시하면 그대로 보여줌, 아니면 침묵).
- rate limit 에러는 토스트로 그대로 표시 + "잠시 후 다시 시도".

### 한국어 대응
- 모든 prompt 템플릿 한국어 디폴트.
- 사용자 워크스페이스 컨텍스트 (`docs/plan/*`, 글로벌 CLAUDE.md) 를 system prompt 의 일부로 첨부 가능 (옵션).

### 미지원 CLI / 오프라인
- AI 패널 자동 비활성화. 일반 commit / PR 생성은 항상 manual input 가능.

---

다음 문서 → [05-roadmap-v0.1-v1.0.md](./05-roadmap-v0.1-v1.0.md)
