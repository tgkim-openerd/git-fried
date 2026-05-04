# 29. Deep Research 보고서 재정렬 — 코드 현실 반영 5 에픽

작성: 2026-05-04 / 트리거: 외부 ChatGPT Deep Research 보고서 (`git-fried-deep-research.md`) 흡수 및 코드 현실 검증 후 5 에픽 재정렬

> **목적**: 외부 deep research 가 제시한 5 우선 추가 기능 (`worktree`, `restore`, `sparse/partial clone`, `range-diff`, `stash --staged`) 중 **이미 구현된 부분과 진짜 갭** 을 분리하고, sprint 진입 가능한 5 에픽으로 재정렬한다.
>
> **검증 방법**: (a) `apps/desktop/src-tauri/src/git/*.rs` 34 모듈 직접 read (b) `apps/desktop/src/components/*.vue` 82 컴포넌트 grep (c) deep research 의 각 권장과 코드 1:1 대조.
>
> **연계**: [11-gitkraken-benchmark.md](./11-gitkraken-benchmark.md), [14-additional-gitkraken-gaps.md](./14-additional-gitkraken-gaps.md), [25-gitkraken-layout-migration.md](./25-gitkraken-layout-migration.md).

---

## 1. 30초 요약

Deep research 5 권장 vs 실제 코드:

| 권장 | 실제 백엔드 | 실제 프론트 | verdict | 진짜 갭 |
| --- | --- | --- | --- | --- |
| `worktree` 도입 | ✅ `worktree.rs` 196 LOC, 6 함수 (list/add/remove/prune/lock/unlock) | ✅ `WorktreePanel.vue` 296 LOC + ContextMenu 5 액션 + AI agent 식별 | **이미 구현** | UX polish (cross-ref / dirty 표시 / window.prompt 잔재) |
| `sparse/partial clone` 도입 | ✅ `clone.rs` 217 LOC — `--sparse` + cone + `sparse-checkout init/set` + depth/single-branch/bare | ✅ `CloneRepoModal.vue` 240 LOC — sparse paths textarea + depth + shallowSince | **이미 구현** | Preset 부재 / `--filter=blob:none` 없음 / advanced 토글 가려짐 |
| `bisect` (deep research §3.4 P-low) | ✅ `bisect.rs` 110 LOC | ✅ `BisectModal.vue` | **이미 구현** | (스코프 외) |
| **`restore`** Center | ❌ `restore.rs` **없음** — `reset.rs` (396 LOC) + `stage.rs` (87 LOC) 로 처리 | ❌ HunkStageModal 에 명시적 분리 액션 없음 | **신규 필요** | 의미론 분리 자체가 갭 |
| **`range-diff`** Panel | ❌ `compare.rs` (114 LOC) — `compare_refs` 만, range-diff 미사용 | ❌ `CompareModal.vue` — log+diff+ahead/behind 만 | **신규 필요** | 백엔드+프론트 둘 다 |
| **`stash --staged`** | 🟡 `stash.rs` (234 LOC) — push/apply/pop/drop/show/edit_message/apply_stash_file 있음, 단 `-S` 플래그 미지원 | 🟡 `StashPanel.vue` + `HunkStageModal.vue` | **부분 갭** | `push_stash_staged` (`-S`) + `stash branch <new>` + UX 통합 |
| `rerere` (deep research §3.4 P-mid) | 🟡 `conflict_prediction.rs` **342 LOC** (자체 충돌 예측, rerere 보다 야심) | 🟡 미점검 | **다른 방향 진행 중** | 스코프 외 — 별도 plan |

**5 에픽 재정렬** (실행 순서):

| 순 | 에픽 | 신규/강화 | 백엔드 LOC | 프론트 LOC | 우선순위 |
| - | --- | --- | --- | --- | --- |
| **E1** | Restore Center (신규 모듈) | 신규 `restore.rs` + RestorePopover.vue | ~150 | ~120 | ⭐ P0 |
| **E2** | Range Diff Panel (신규 모듈) | 신규 `range_diff.rs` + RangeDiffPanel.vue | ~120 | ~150 | ⭐ P1 |
| **E3** | Smart Stash (`--staged` 등 backend 소량 + UX 통합) | `stash.rs` +50 + StashPanel/HunkStageModal 보강 | ~50 | ~80 | ⭐ P1 |
| **E4** | Clone Wizard Presets (UX) | `clone.rs` +30 (`--filter`) + CloneRepoModal preset | ~30 | ~120 | ⭐ P1 |
| **E5** | Worktree Manager Polish (UX) | `worktree.rs` +50 (dirty/cross-ref) + WorktreePanel 보강 | ~50 | ~80 | · P2 |

**합계 추정**: backend ~400 LOC, frontend ~550 LOC. AI pair 환경 (1.0x) 기준 **5~7 sprint** (각 1~2일).

---

## 2. E1 — Restore Center (신규 `restore.rs`) ⭐ P0

### 2-1. 갭 정의

현재 코드는 `git restore` CLI 를 직접 호출하지 않는다. discard 의미는 `reset.rs` (`reset --hard target`, `undo_last_action` reflog) + `stage.rs` 로 처리한다. 사용자에게는 "discard changes" 한 가지 표현만 노출되어, **워킹트리 vs 인덱스 vs 특정 source 기준 복원의 의미론이 가려져** 있다.

### 2-2. 백엔드 설계 — `apps/desktop/src-tauri/src/git/restore.rs`

```rust
pub enum RestoreSource { Worktree, Index, Head, Commit(String) }

pub async fn restore_paths(repo: &Path, paths: &[String], source: RestoreSource) -> AppResult<()>
pub async fn restore_hunks(repo: &Path, path: &str, hunks: &[HunkRef], source: RestoreSource) -> AppResult<()>
```

- `Worktree` → `git restore --worktree -- <paths>` (워킹트리만, 인덱스 보존)
- `Index` → `git restore --staged -- <paths>` (인덱스만, unstage)
- `Head` → `git restore --source=HEAD --staged --worktree -- <paths>` (둘 다 HEAD 기준)
- `Commit(sha)` → `git restore --source=<sha> --worktree -- <paths>`
- 한글 경로 안전 (기존 `git_run` 표준 spawn 그대로 활용)

### 2-3. 프론트 — RestorePopover.vue 신규 + HunkStageModal 통합

- 파일/헝크 컨텍스트 메뉴에 4 액션 분리:
  - `워킹트리 복원` (Worktree, 인덱스 보존)
  - `인덱스 복원` (Index, unstage)
  - `HEAD 기준 복원` (Head)
  - `특정 커밋 기준 복원…` (Commit picker)
- destructive 확인 다이얼로그에 "삭제되는 대상" + "복원 source" 명시
- 기존 `confirmDialog` (sprint c37 window.confirm 0개 정착) 재사용

### 2-4. Acceptance Criteria

- [ ] `restore.rs` 4 source 모두 unit test (한글 경로 포함)
- [ ] 헝크 단위 restore 가 `git apply --reverse` 가 아닌 `git restore` 의미론으로 동작
- [ ] HunkStageModal 우클릭에 4 분리 액션 노출
- [ ] e2e: 일부 stage → 나머지 라인 워킹트리 복원 시 인덱스 손상 없음
- [ ] confirmDialog 메시지에 source 와 대상 파일 수 명시

### 2-5. 영향 파일

- 신규: `src-tauri/src/git/restore.rs`, `src/components/RestorePopover.vue`, `src/composables/useRestore.ts`
- 수정: `src-tauri/src/git/mod.rs` (export), `src-tauri/src/ipc/commands.rs` (4 IPC 추가), `src/api/git.ts` (4 wrapper), `src/components/HunkStageModal.vue` (액션 통합), `src/i18n/locales/ko.json` + `en.json`

---

## 3. E2 — Range Diff Panel (신규 `range_diff.rs`) ⭐ P1

### 3-1. 갭 정의

`compare.rs::compare_refs` 는 `git log A..B` + `git diff A..B` + `rev-list --left-right --count` 만 수행한다. **rebase/PR 업데이트 후 patch correspondence 비교** 는 불가. `git range-diff` CLI 가 인간 친화 porcelain output 을 제공하지만 코드에서 미사용.

### 3-2. 백엔드 설계 — `apps/desktop/src-tauri/src/git/range_diff.rs`

```rust
#[derive(Serialize)]
pub struct RangeDiffEntry {
    pub status: String,        // "=", "!", ">", "<"  (matched/changed/added/removed)
    pub left_index: Option<u32>,
    pub right_index: Option<u32>,
    pub left_sha: Option<String>,
    pub right_sha: Option<String>,
    pub summary: String,
    pub patch_diff: Option<String>,  // status=="!" 시 inter-diff
}

pub async fn range_diff(repo: &Path, base: &str, tip1: &str, tip2: &str) -> AppResult<Vec<RangeDiffEntry>>
// → `git range-diff --no-color base..tip1 base..tip2`
```

또는 2-arg 형태 `git range-diff A...B` 도 지원 (base 자동 머지 베이스).

### 3-3. 프론트 — RangeDiffPanel.vue 신규

- CompareModal 에 탭 추가: `Diff (기존)` / `Range Diff (신규)`
- 입력: base + tip1 + tip2 (또는 branch pair)
- 표 렌더: status icon (= 동일, ! 변경, > 추가, < 제거) + 좌/우 SHA + summary
- `!` 행 클릭 시 inter-diff (patch_diff) 인라인 expand
- CommitGraph 의 "rebase 직후" hint 에서 빠른 진입 액션 (선택 branch base/before/after pre-fill)

### 3-4. Acceptance Criteria

- [ ] `range_diff.rs` 4 status (`=`, `!`, `>`, `<`) 모두 파싱 정확
- [ ] 한글 commit summary 안전 (인코딩 round-trip)
- [ ] 입력 검증: empty ref → AppError::validation
- [ ] CompareModal 탭 전환 시 캐시 분리 (vue-query key 분리)
- [ ] e2e: feature branch rebase 시뮬 → range-diff 패널에서 변경된 commit 식별

### 3-5. 영향 파일

- 신규: `src-tauri/src/git/range_diff.rs`, `src/components/RangeDiffPanel.vue`, `src/composables/useRangeDiff.ts`
- 수정: `src-tauri/src/git/mod.rs`, `src-tauri/src/ipc/commands.rs`, `src/api/git.ts`, `src/components/CompareModal.vue` (탭 추가), `src/components/CommitGraph.vue` (rebase 후 entry hint)

---

## 4. E3 — Smart Stash (`--staged` + `stash branch` + UX 통합) ⭐ P1

### 4-1. 갭 정의

`stash.rs::push_stash` 는 `-u` (untracked 포함) 만 옵션. **`-S` (`--staged`, 인덱스만 stash)** 미지원. `stash branch <new>` 도 미구현. UI 도 "stash all" 1버튼 중심.

### 4-2. 백엔드 변경 — `stash.rs` (~50 LOC)

```rust
pub async fn push_stash_staged(repo: &Path, message: Option<&str>) -> AppResult<()>
// `git stash push -S -m <msg>`  — 인덱스에 stage 된 변경만 stash

pub async fn stash_to_branch(repo: &Path, index: usize, branch: &str) -> AppResult<()>
// `git stash branch <branch> stash@{n}`
```

기존 `push_stash`/`apply`/`pop`/`drop` 시그니처는 호환 유지.

### 4-3. 프론트 — HunkStageModal + StashPanel 통합

- HunkStageModal 의 "Stage" 버튼 옆에 새 액션 그룹:
  - `Stash Staged` — 현재 stage 된 것만 stash 후 인덱스 비우기
  - `Stash Selected Files` — 선택 파일만 stash (기존 file-level stash 활용)
  - `Pop to New Branch…` — 기존 stash 를 새 브랜치로 pop
- StashPanel 의 우클릭 메뉴에 `Apply to new branch…` 추가

### 4-4. Acceptance Criteria

- [ ] `push_stash_staged` 호출 후 worktree 변경 보존 + 인덱스 비어짐
- [ ] `stash_to_branch` 후 새 브랜치 체크아웃 + stash 자동 drop (Git 표준 동작)
- [ ] StashPanel 의 메시지 표시에 "(staged only)" 배지 (message 파싱)
- [ ] 한글 message round-trip
- [ ] e2e: staged-only stash → pop 후 인덱스 복원 확인

### 4-5. 영향 파일

- 수정: `src-tauri/src/git/stash.rs` (+2 함수), `src-tauri/src/ipc/commands.rs` (+2 IPC), `src/api/git.ts` (+2 wrapper), `src/components/HunkStageModal.vue`, `src/components/StashPanel.vue`, `src/composables/useStashPopMutation.ts` (재사용 패턴)

---

## 5. E4 — Clone Wizard Presets ⭐ P1

### 5-1. 갭 정의

`CloneRepoModal.vue` 는 advanced 토글이 닫힌 상태에서 단순 URL clone 만 가능. sparse / shallow 가 모두 "고급 옵션" 안에 숨어 있어 monorepo 첫 사용자가 발견하기 어렵다. `--filter=blob:none` (partial clone) 미지원.

### 5-2. 백엔드 변경 — `clone.rs` (~30 LOC)

`CloneOptions` 에 `filter: Option<String>` 추가 (`"blob:none"`, `"blob:limit=<bytes>"` 등). args 빌더에서 `--filter=<v>` 추가. 기존 sparse/depth/shallow_since/single_branch/bare 호환 유지.

### 5-3. 프론트 — Preset 4 선택지

CloneRepoModal 상단에 라디오:

| Preset | 매핑 |
| --- | --- |
| **전체** | (옵션 없음) |
| **얕은** | `depth=1` |
| **Monorepo 빠른 시작** | `--sparse --filter=blob:none` (cone 모드 + blobless partial clone) + `single_branch` |
| **필요한 디렉터리만** | sparse paths 입력 활성화 |
| **고급 (사용자 정의)** | 기존 advanced 토글 그대로 |

선택 시 sparse_paths/depth/filter 가 자동 채워지고, 고급 토글에서 미세조정 가능.

### 5-4. Acceptance Criteria

- [ ] Preset 4 종 → CLI 옵션 매핑 unit test (`clone.rs::tests` 추가)
- [ ] "Monorepo 빠른 시작" 선택 후 실제 monorepo 샘플에서 clone 성공 + 사이즈 단축 측정
- [ ] cone vs non-cone 토글 (기본 cone, non-cone 은 경고 노출)
- [ ] e2e: "필요한 디렉터리만" preset → sparse paths 1개만 받기 → 실제 그 폴더만 체크아웃됨

### 5-5. 영향 파일

- 수정: `src-tauri/src/git/clone.rs` (`CloneOptions::filter`), `src/api/git.ts` (`CloneOptions` 타입), `src/components/CloneRepoModal.vue` (Preset 라디오 + 자동 채우기 watch)

---

## 6. E5 — Worktree Manager Polish ⭐ P2

### 6-1. 갭 정의

`WorktreePanel.vue` 는 이미 풍부 (296 LOC, ContextMenu 5 액션, AI agent 식별, lock/unlock, prune). 다만:

1. **다른 worktree 에서 사용 중인 브랜치 cross-reference** — `MiniBranchList` 에 배지 미표시. 같은 브랜치를 두 worktree 가 점유하지 못하는 git 제약을 사용자가 모름.
2. **dirty 상태** — `WorktreeEntry` 에 `is_dirty` 필드 미존재 (확인 필요). 현재 size/locked/prunable/main 만 표시.
3. **window.prompt 잔재** — `WorktreePanel.vue:119` 잠금 사유 입력 (sprint c37 의 window.confirm 0개 정착 후속 cleanup).
4. **"새 창에서 worktree 열기"** — 라인 144 주석에서 명시적으로 main repo Explorer 만 열림.

### 6-2. 백엔드 변경 — `worktree.rs` (~50 LOC)

`WorktreeEntry` 에 `is_dirty: bool` 추가. `git worktree list --porcelain` 후 각 worktree 경로에서 `git -C <path> status --porcelain` 1회씩 호출 (저비용 batch).

### 6-3. 프론트

- `MiniBranchList.vue` 에 worktree 점유 배지 추가 (Sidebar 의 worktree 데이터 cross-ref)
- WorktreePanel 행에 dirty 점 (`●`)
- 잠금 사유 입력을 `confirmDialog` 또는 신규 `promptDialog` composable 로 마이그
- "새 창에서 worktree 열기" — Tauri `WebviewWindow::new` 또는 OS shell `explorer <worktree.path>` 으로 직접 worktree 경로 열기

### 6-4. Acceptance Criteria

- [ ] `WorktreeEntry.isDirty` 필드 IPC round-trip
- [ ] 같은 브랜치 점유 worktree 가 있으면 MiniBranchList 에 배지 + 툴팁
- [ ] window.prompt 0개 (`grep -r "window.prompt" apps/desktop/src` 결과 empty)
- [ ] `Open in Explorer` 가 worktree 의 실제 경로 (main repo 아님) 를 엶
- [ ] e2e: 2 worktree 동시 열고 동일 브랜치 시도 시 거부 안내 표시

### 6-5. 영향 파일

- 수정: `src-tauri/src/git/worktree.rs` (`is_dirty`), `src/api/git.ts` 타입, `src/components/WorktreePanel.vue`, `src/components/MiniBranchList.vue`, `src/composables/useConfirm.ts` (promptDialog 추가 검토)

---

## 7. 실행 순서 권장

1. **E1 Restore Center** (P0) — 의미론 갭이 가장 크고 사용자 안전성 직결. 신규 모듈이라 다른 에픽과 충돌 없음.
2. **E3 Smart Stash** (P1) — `stash.rs` 소량 추가만으로 큰 UX 효과. E1 완료 후 HunkStageModal 통합 작업이 합쳐져 합리적.
3. **E4 Clone Wizard Presets** (P1) — 고립된 흐름. E1/E3 와 충돌 없음, 병렬 진행 가능.
4. **E2 Range Diff Panel** (P1) — CompareModal 확장. 신규 모듈 + 새 탭이라 안정적이지만, CommitGraph 의 rebase hint 통합은 god comp 후속 분리 작업과 일정 조정 필요.
5. **E5 Worktree Polish** (P2) — 가장 자유도 높음, 짬짬이.

### 마이그레이션 전략 (deep research §7-2 권장 흡수)

- **Restore Center** = feature flag `experimental.restoreCenter` 알파 (의미론 학습 노이즈 차단)
- **Range Diff** = beta (UI 자체는 안전, 사용 빈도 측정 필요)
- **Smart Stash** = 즉시 GA (stash 의미 친숙)
- **Clone Wizard Presets** = 즉시 GA (preset 은 옵션 노출 단순화일 뿐)
- **Worktree Polish** = 즉시 GA (기존 기능 polish)

---

## 8. Deep Research 보고서 부분 폐기 항목

원문에서 채택하지 않은 권장:

| 원문 권장 | 폐기 사유 |
| --- | --- |
| "god-comp 분해 1.5~2주 신규 작업" | sprint c33-c37 에서 9→17 분리 / -1450 LOC / -27% 이미 진행 ([MEMORY](../../../C:/Users/tgkim/.claude/projects/d--01-Work-08-rf-git-fried/memory/sprint_2026_04_30_c33_c37.md)). 잔여는 PrDetailModal/FullscreenDiff/GitKrakenToolbar 한정. |
| "AI runner 는 코어 안정화 후 도입" | `src-tauri/src/ai/runner.rs` 이미 구현 + AI composable 5 표준화 완료 (sprint c33-c37). 시점 인지가 이미 outdated. |
| "rerere 도입 (P-mid)" | `conflict_prediction.rs` 342 LOC 자체 구현 진행 중 — rerere 보다 야심찬 방향. 별도 plan 분리. |
| "bisect Wizard 신규 도입 (P-low)" | `bisect.rs` 110 LOC + `BisectModal.vue` 이미 구현. UX polish 만 필요 시 별도 항목. |
| "worktree backend 신규 도입" | `worktree.rs` 196 LOC 6 함수 이미 구현. E5 Polish 로 축소. |

---

## 9. 한계와 후속 검증

- **`stash --staged` (`-S`) git 버전 요구사항** — Git 2.35+ (2022-01) 필요. 사용자 환경 git 버전 점검 필요 (`git --version` ≥ 2.35 가정 가능).
- **`--filter=blob:none` partial clone** — Git 2.19+ + 서버 측 지원 필요. Gitea/GitHub 모두 지원하나 사내 Gitea 1.x 일부 버전 점검 필요.
- **`range-diff` porcelain stability** — Git docs 가 "porcelain" 명시하지만 버전별 출력 차이 존재. parser 는 status 마커 (`=`, `!`, `>`, `<`) 위주로 안정적 영역만 사용.
- **Worktree dirty batch** — N 개 worktree 마다 `git status --porcelain` 호출 — 매우 큰 worktree 에서 비용 측정 필요. 캐시 + manual refresh 도 고려.
- **Restore 의미론 사용자 학습** — alpha feature flag 와 in-app tooltip 으로 점진 노출.
