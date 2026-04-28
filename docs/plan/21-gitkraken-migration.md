# 21. GitKraken importer (Sprint M14)

작성: 2026-04-27 / 트리거: 사용자 본인 dogfood 시 GitKraken (159 레포 / 43 workspace / 11 tab) 마이그레이션 friction 제거

> **목적**: git-fried 첫 실행 시 사용자가 **Settings → "GitKraken 가져오기" 1 클릭으로** 기존 GitKraken 데이터 (로컬 레포 목록 / 워크스페이스 / 즐겨찾기 / 활성 탭) 를 모두 import. PAT 만 재입력 (5분), 나머지는 자동.
>
> **연계**: `docs/plan/18 dogfood feedback`, `docs/plan/19 v0.3 release prep`, `docs/plan/02 user-workflow-evidence` (사용자 본인 50+ 회사 레포 환경).

---

## 1. 30초 요약

| 항목 | 마이그레이션 | 방법 |
| ---- | ---- | ---- |
| **로컬 레포 path 159개** | ✅ | `localRepoCache` JSON → `add_repo` 159회 (`ON CONFLICT(local_path) DO UPDATE` 로 idempotent) |
| **Workspace (project) 43개** | ✅ | `projectCache.projectsById` → `create_workspace` + syncPath prefix 매칭으로 레포 그룹핑 (type=local 만) |
| **즐겨찾기 4개** | ✅ | `profile.favoriteRepositories` → `set_repo_pinned(true)` |
| **활성 탭 11개** | ✅ | `profile.tabInfo.tabs[].repoPath` → `useReposStore` 의 `tabs` 영속 (localStorage) 에 직접 주입 |
| **PAT (httpCreds)** | ❌ | GitKraken 자체 암호화, 복호화 불가 → **재입력 필요** (Settings → Forge) |
| **SSH / GPG** | ✅ 무관 | 둘 다 OS 표준 (`~/.ssh/`, `~/.gnupg/`) 사용. 마이그레이션 불필요 |
| **테마 / 단축키 / mergeTool** | ❌ | UI 다름. 의미 없음 |

**작업량**: M (~3h) — Rust importer + IPC 2개 + FE modal + 테스트.

---

## 2. GitKraken 데이터 위치 (Windows)

```
%APPDATA%/.gitkraken/
├── config              ← 앱 메타 (마이그 무관)
├── profiles/
│   └── <profileId>/    ← 핵심 데이터
│       ├── localRepoCache       (~16KB JSON)  — 모든 로컬 레포 path 배열
│       ├── profile              (~80KB JSON)  — favorites / tabs / userName / etc.
│       ├── projectCache         (~25KB JSON)  — workspace (project) 메타
│       ├── httpCreds.secFile    (~376B)       — 암호화 PAT (skip)
│       ├── ssh/                                — OS SSH agent 사용 (마이그 무관)
│       ├── github/, gitlab/                    — forge integration 메타 (PAT 별도)
│       └── repoSettings/                       — 레포별 사용자 설정
```

자동 탐지: `%APPDATA%/.gitkraken/profiles/*/profile` 의 mtime 가장 큰 디렉토리.

---

## 3. JSON 스키마 (실측)

### 3-1. localRepoCache

```json
{
  "localRepoCache": [
    "D:/01.Work/01.Projects/57.itruck/backend/.git",
    "C:/Users/tgkim/.claude/.git",
    ...
  ],
  "localCacheByDirectory": { "...": {...} }
}
```

→ git-fried 매핑: `.git` suffix strip 후 `add_repo({ localPath, workspaceId: <inferred> })`.

### 3-2. profile.favoriteRepositories

```json
[
  "D:\\01.Work\\01.Projects\\22.ice-clip\\backend-admin",
  ...
]
```

→ 매핑: import 후 같은 path 의 repo 에 `set_repo_pinned(true)`.

### 3-3. profile.tabInfo.tabs

```json
[
  { "id": "ba3b...", "type": "REPO", "repoName": "openerd-nuxt3",
    "repoPath": "D:/01.Work/01.Projects/00.common/openerd-nuxt3/" },
  { "id": "bcc1...", "isWorktree": false, "type": "REPO",
    "repoName": "frontend_work-dir", "repoPath": "D:/.../" }
]
```

→ 매핑: 활성 탭 path → git-fried `useReposStore.tabs` push (FE 측 처리).

### 3-4. projectCache.projectsById

```json
{
  "596be477-...": {
    "id": "596be477-...",
    "name": "01.Projects",
    "syncPath": "D:\\01.Work\\01.Projects",
    "repositoryCount": 0,
    "repositories": [],
    "type": "local"
  }
}
```

→ 매핑: `type=local` 만, `name` 으로 `create_workspace`, `syncPath` 가 prefix 인 레포들을 해당 workspace 로 묶음.

> **주의**: 같은 syncPath prefix 가 여러 project 에 중복될 수 있음 (예: `D:\01.Work` 와 `D:\01.Work\01.Projects` 동시 존재). 더 긴 prefix (= 더 좁은 scope) 를 우선 매칭.

---

## 4. 매핑 알고리즘

```
1) GitKraken profile dir 탐지 (mtime 최신)
2) 3 JSON 파일 parse
3) [Workspace 단계]
   - projectsById 의 type=local 항목만 필터
   - 각 project → workspaces 테이블에 INSERT (name 중복 시 " (GitKraken)" suffix 부착)
   - syncPath → wsByPath: HashMap<canonicalPath, workspace_id> 생성
4) [Repo 단계]
   - localRepoCache 각 path:
     a) `.git` suffix strip + canonical
     b) wsByPath 에서 가장 긴 매칭 prefix → workspace_id 결정
     c) add_repo(local_path, workspace_id, name=last_path_component)
       (ON CONFLICT(local_path) DO UPDATE 로 기존 repo 도 workspace 재할당)
5) [Pin 단계]
   - favoriteRepositories 각 path → 매칭 repo.id → set_repo_pinned(true)
6) [Tab 단계]
   - tabInfo.tabs[type=REPO] 의 repoPath 목록 반환
   - FE 측에서 useReposStore.openTabs(paths) 처리
```

**dry-run** 모드 = 1)~6) 의 결과 카운트만 반환 (DB 변경 없음). 사용자가 미리보기 확인 후 confirm → apply.

---

## 5. 구현 분해

### 5-1. Rust (`apps/desktop/src-tauri/src/importer/`)

```
importer/
├── mod.rs
└── gitkraken.rs   — JSON 스키마 + 탐지 + parse + dry_run/apply
```

- `pub fn detect_profile_dir() -> Option<PathBuf>` — `%APPDATA%/.gitkraken/profiles/*/` 중 mtime 가장 최신
- `pub fn read_payload(profile_dir: &Path) -> AppResult<Payload>` — 3 JSON parse
- `pub async fn dry_run(db: &Db, payload: &Payload) -> AppResult<Plan>` — Plan { workspaces_to_create, repos_to_add, repos_to_pin, tabs_to_open }
- `pub async fn apply(db: &Db, payload: &Payload) -> AppResult<ApplyResult>` — 실제 INSERT/UPDATE

### 5-2. IPC (`ipc/commands.rs` 추가)

```rust
#[tauri::command]
pub async fn import_gitkraken_detect() -> AppResult<Option<DetectResult>>;

#[tauri::command]
pub async fn import_gitkraken_dry_run(profile_dir: String, state: State<...>) -> AppResult<Plan>;

#[tauri::command]
pub async fn import_gitkraken_apply(profile_dir: String, state: State<...>) -> AppResult<ApplyResult>;
```

### 5-3. FE (`apps/desktop/src/`)

- `api/git.ts` — 3 wrapper 추가
- `components/GitKrakenImportModal.vue` 신규 — 탐지 → dry-run preview 표 → "가져오기" 버튼 → apply 결과 toast → 탭 복원
- `pages/settings.vue` — "마이그레이션" 섹션 신규 + "GitKraken 가져오기" 버튼

### 5-4. 테스트

- Rust: `tests/gitkraken_importer.rs` — fixture JSON (작은 합성 3 paths / 2 workspaces / 1 favorite / 1 tab) 으로 dry_run 검증
- Cargo check (cargo build 환경 이슈 시 skip — 다음 세션에서 검증)
- FE typecheck/lint

---

## 6. 결정 로그 (2026-04-27)

| # | 결정 | 근거 |
| ---- | ---- | ---- |
| 1 | **dry-run + apply 분리** | 159 레포 일괄 import 는 큰 변경 — 사용자가 미리보기 후 confirm |
| 2 | **PAT 마이그 포기** | GitKraken 자체 암호화. 무리하게 시도 시 supply chain 우려. Settings 에서 5분 재입력 |
| 3 | **type=local 워크스페이스만** | cloud workspace (GitKraken Pro) 는 git-fried 와 무관 모델 |
| 4 | **syncPath prefix 매칭 = 더 긴 prefix 우선** | 중첩 워크스페이스 (예: `D:\01.Work` ⊃ `D:\01.Work\01.Projects`) 는 좁은 쪽이 의도 |
| 5 | **이름 충돌 시 " (GitKraken)" suffix** | 기존 git-fried 워크스페이스 보호 |
| 6 | **Tab 복원은 FE 측 처리** | RepoTabBar / useReposStore localStorage 가 frontend state 라 IPC 응답 후 store.openTabs(paths) |

---

## 7. 다음 plan 후보

- 22 = macOS / Linux 마이그 (homebrew Cask `gitkraken` 사용자 대상)
- v0.3 cut 후 dogfood 결과로 보고
