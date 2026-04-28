# 14. 추가 GitKraken 잔여 catalog — 11번 흡수 후 발견 항목

작성: 2026-04-27 / 트리거: 13번 plan 의 반영도 95% 검증 후 누락 catalog 보강

> **목적**: 11번 plan (GitKraken benchmark) 흡수 후에도 실제로 GitKraken 에 존재하지만 git-fried 의 현재 계획/구현에 명시되지 않았거나 누락된 기능을 catalog 화하여 추가 sprint 진입 후보로 정리.
>
> **검증 방법**: (a) 11번 §17 Command Palette 카테고리 + §23 Preferences 트리에서 누락 식별 (b) 실제 git-fried 코드 grep 으로 흡수 여부 검증 (c) GitKraken docs 의 "Stash 부분 apply" 같은 미흡수 영역 보강.
>
> **연계**: [11-gitkraken-benchmark.md](./11-gitkraken-benchmark.md) §17/§23/§31, [12-ui-improvement-plan.md](./12-ui-improvement-plan.md), [13-implementation-vs-plan-diff.md](./13-implementation-vs-plan-diff.md).

---

## 1. 30초 요약

**총 22 추가 항목 발견**:

| 카테고리 | 개수 | 내용 |
| --- | --- | --- |
| **A. Command Palette 미수록 명령** | 5 | Compare / Repo Maintenance / Init Git Flow / Init GPG / Init LFS |
| **B. Preferences 트리 미흡수 섹션** | 4 | Per-repo Git Hooks GUI / Encoding / Gitflow / Commit Signing 설정 |
| **C. Branch / Remote 관리 GUI** | 3 | Remote add / remove / rename / URL 변경 |
| **D. Stash 부분 흡수 잔여** | 2 | 파일별 부분 apply / Edit stash message |
| **E. Clone 모달 옵션** | 2 | Sparse Checkout / Shallow Clone 옵션 |
| **F. PR review 보강** | 2 | Code Suggestions (line-level) / PR filter syntax 자동완성 |
| **G. 그래프 / Tag 패널** | 2 | Tag panel 분리 / Author filter dropdown in 그래프 헤더 |
| **H. 11 §27 잔여 단축키** | 1 | `⌘⇧H` File history search (확정 누락) |
| **I. 11 §31 미탐색 검증 가능** | 1 | Right-click 메뉴 완전 매트릭스 (dogfood 검증) |
| **거부 (확정)** | 4 | Cloud Workspace / Cloud Patches / Browser Ext / GitLens |

**작업량 추정** (12 plan v3 의 0.1~0.2x AI pair 보정 적용):
- P0 (Compare / Stash 부분 apply / `⌘⇧H`): **반나절~1일**
- P1 (Preferences 4섹션 / Remote 관리 / Repo Maintenance / GPG/LFS init): **1~2일**
- P2 (Sparse/Shallow Clone / Tag panel / Code Suggestions / Author filter): **1~2일**
- 합계: **3~5일** (1 단일 세션 ~ 1주)

---

## 2. A. Command Palette 미수록 명령 (5개)

검증: `grep "category:" apps/desktop/src/components/CommandPalette.vue` — 30+ 명령 중 다음 5개 누락 확인.

| # | 명령 | 11번 §17 카테고리 | 11번 흡수 표기 | 실제 git-fried | 우선순위 |
| - | --- | --- | --- | --- | --- |
| A1 | **Compare branches / commits** | Branch (8) | "Compare" 항목 명시 | ❌ 없음 | ⭐ P1 |
| A2 | **Perform Repo Maintenance** (gc / prune / fsck) | Repo (10) | 명시 | ❌ 없음 | ⭐ P1 |
| A3 | **Configure Git Flow** (initialize) | Settings (8) | 명시 | ❌ 없음 | · P2 |
| A4 | **Initialize GPG** (commit signing) | Settings (8) | 명시 | ❌ 없음 | · P2 |
| A5 | **Initialize LFS** | Settings (8) | 명시 | 🟡 LFS panel 의 `lfs_track` 으로 일부 커버, 명령 형태 없음 | · P2 |

**구현 가이드**:
- **A1 Compare**: `git diff <ref1>..<ref2>` 또는 `git log <ref1>..<ref2>` 결합한 modal. 두 ref 선택 picker + 결과 view. 신규 IPC `compare_refs(repo_path, ref1, ref2)` + `CompareModal.vue`. 작업량 M (~6h).
- **A2 Repo Maintenance**: `git gc` / `git prune` / `git fsck` 호출 + 진행 상황 toast. 신규 IPC 3개 또는 통합 1개. 작업량 S (~3h).
- **A3 Git Flow init**: Preferences > Repo-Specific 섹션 안에서 처리 권장 (B 와 통합). 별도 명령은 단축. 작업량 S (~2h).
- **A4 GPG init**: Preferences > Commit Signing 섹션 (B4) 와 통합. 작업량 S (~2h).
- **A5 LFS init**: 기존 LFS panel 에 "초기화" 버튼 추가. 작업량 S (~1h).

---

## 3. B. Preferences 트리 미흡수 섹션 (4개)

11번 §23 Preferences 트리의 `Repository-Specific` 카테고리 흡수 미완. B10 commit `457c3dc` 가 Settings 공용 store + 일부 토글만 추가, repo-specific 미상세.

| # | 섹션 | 11번 §23 표기 | 실제 git-fried | 우선순위 |
| - | --- | --- | --- | --- |
| B1 | **Per-repo Git Hooks GUI** | "Repository-Specific > Git Hooks" | ❌ 없음 (`useUserSettings` 가 글로벌만) | ⭐ P1 |
| B2 | **Per-repo Encoding** (UTF-8/CP949) | "Repository-Specific > Encoding" | ❌ 없음 | ⭐ P1 (한글 환경 직격) |
| B3 | **Per-repo Gitflow branch naming** | "Repository-Specific > Gitflow" | ❌ 없음 | · P2 |
| B4 | **Per-repo Commit Signing** (GPG key 선택) | "Repository-Specific > Commit Signing" | ❌ 없음 | ⭐ P1 |

**구현 가이드**:
- 신규 migration `0005_repo_settings.sql` — `repo_settings(repo_id UNIQUE, hooks_path, encoding, gitflow_*, signing_key, ...)`
- 신규 composable `useRepoSettings(repoId)` — Vue Query + per-repo form
- `pages/settings.vue` 에 "Repository-Specific" 카테고리 섹션 추가 (현재 active repo 선택 dropdown)
- 작업량 M (~6~8h, 4섹션 form UI + DB)

---

## 4. C. Branch / Remote 관리 GUI (3개)

11번 §4 Left Panel 의 Remote 섹션 — git-fried 의 BranchPanel 이 list 만 보여주고 관리 GUI 없음. `addRemote`/`removeRemote`/`setRemoteUrl` IPC 0건 (검증).

| # | 기능 | 우선순위 |
| - | --- | --- |
| C1 | **Remote add** (URL 입력 modal) | ⭐ P1 |
| C2 | **Remote remove** (우클릭 메뉴) | ⭐ P1 |
| C3 | **Remote rename / URL 변경** | ⭐ P1 |

**구현 가이드**:
- 신규 IPC 3개: `add_remote(repo_path, name, url)`, `remove_remote(repo_path, name)`, `set_remote_url(repo_path, name, url)`
- `BranchPanel.vue` 의 Remote 섹션 헤더에 "+" 버튼 추가
- 각 remote 항목에 ContextMenu (Remove / Rename / Change URL / Fetch this remote)
- 작업량 M (~4h)

---

## 5. D. Stash 부분 흡수 잔여 (2개)

11번 §11 Stash 패널의 일부 기능 흡수 미완.

| # | 기능 | 11번 §11 표기 | 실제 git-fried | 우선순위 |
| - | --- | --- | --- | --- |
| D1 | **부분 apply** (stash 내 파일 1개만 apply) | "Apply this file" | ❌ 없음 | ⭐ P1 |
| D2 | **Edit stash message** (생성 후 메시지 수정) | "Edit stash message" | ❌ 없음 | · P2 |

**구현 가이드**:
- D1: stash 선택 → file list → 파일 우클릭 "Apply this file" → `git checkout stash@{N} -- <path>` 또는 `git show stash@{N} -- <path> | git apply`. 신규 IPC `apply_stash_file(repo_path, stash_id, path)`. 작업량 S (~2h).
- D2: stash 우클릭 메뉴에 "Edit message" 항목 추가 → input modal → `git stash store -m "new msg" $(git stash list --format="%H" stash@{N})` 또는 drop+push 재구성. 작업량 S~M (~3h, drop+push 안전성 검증 필요).

---

## 6. E. Clone 모달 옵션 (2개)

11번 §22 Onboarding 의 Clone 모달 흡수 부분. git-fried 현재 Sidebar 의 Clone UI 가 단순 URL+경로만 받음 (추정, dogfood 검증 필요).

| # | 옵션 | 우선순위 |
| - | --- | --- |
| E1 | **Sparse Checkout** (path rules 입력) | · P2 |
| E2 | **Shallow Clone** (depth / since-date / branch) | · P2 |

**구현 가이드**:
- Clone modal 의 "고급 옵션" 토글 → expand 시 두 섹션 노출
- E1: `git clone --no-checkout` + `git sparse-checkout init --cone` + path 추가. 작업량 M (~4h).
- E2: `git clone --depth N` 또는 `--shallow-since=DATE` 또는 `--single-branch --branch B`. 작업량 S (~2h).

대안: Clone 후 사용자가 CLI 로 재설정 — 통합 터미널 (10번 plan) 으로 충분하므로 후순위.

---

## 7. F. PR Review 보강 (2개)

11번 §13 PR Detail View 의 일부 기능 흡수 미완.

| # | 기능 | 11번 §13 표기 | 실제 git-fried | 우선순위 |
| - | --- | --- | --- | --- |
| F1 | **Code Suggestions** (line-level 제안 생성) | "Review Code and Suggest Changes" → diff editor | 🟡 PR review 의 코멘트만 (REVIEW v1 e2de2dd), line suggestion 미확인 | · P2 |
| F2 | **PR Filter syntax 자동완성** (`author:` `label:` `review:` 등) | §13 표 18 키 | ❌ 없음 (단순 검색만) | · P2 |

**구현 가이드**:
- F1: PR diff editor 에서 라인 선택 → "Suggest change" 버튼 → ` ```suggestion ` 형식으로 PR comment 생성. GitHub API: `POST /repos/{owner}/{repo}/pulls/{n}/comments` with `position`. Gitea: 유사 endpoint. 작업량 L (~8h, GitHub + Gitea 양쪽).
- F2: PR Panel 검색 input 에 syntax 자동완성 — 키 prefix detect → dropdown 제안. 작업량 M (~4h).

---

## 8. G. 그래프 / Tag 패널 (2개)

| # | 기능 | 11번 표기 | 실제 git-fried | 우선순위 |
| - | --- | --- | --- | --- |
| G1 | **Tag panel 분리** | §4 Left Panel List Mode 7섹션 중 "Tags" | 🟡 ReleasesPanel 안에 통합 — 단순 tag (release 아닌) 누락 | · P2 |
| G2 | **Author filter dropdown** in 그래프 헤더 | §4 Commit Graph "AUTHOR 컬럼 dropdown" | ❌ 없음 (검색 bar 의 단순 author 매치만) | · P2 |

**구현 가이드**:
- G1: 별도 TagPanel.vue (또는 ReleasesPanel 안에 "Plain Tags" 섹션). `git tag --list` 결과 단순 표시 + create/delete/push tag. 작업량 M (~4h).
- G2: CommitTable header 의 Author column 옆 dropdown — 작가 list (현재 graph 의 unique authors) + 클릭 시 필터. 작업량 S (~2h).

---

## 9. H. 11 §27 잔여 단축키 (1개)

| # | 단축키 | 동작 | 우선순위 |
| - | --- | --- | --- |
| H1 | **`⌘⇧H` / `Ctrl+⇧H`** | File history search | ⭐ P1 |

**구현 가이드**: Command Palette 의 `⌘⇧H` 매핑 → 파일 picker (현재 repo 의 모든 파일) → 선택 시 `useFileHistory` modal 진입. `useShortcuts.ts` 한 줄 + CommandPalette command 추가. 작업량 S (~30분).

---

## 10. I. 11 §31 미탐색 검증 가능 항목 (1개 — sprint 외 dogfood)

| # | 항목 | 검증 방법 |
| - | --- | --- |
| I1 | **Right-click 메뉴 완전 매트릭스** | GitKraken 12.0 직접 설치 → 모든 ref / commit / file / 헤더 우클릭 → 캡처 → 11번 §31 갱신 |

비-sprint 작업. 사용자 dogfood 시 스크린샷 누적 → 별도 plan 으로.

---

## 11. 거부 catalog (확정 — 본 plan 에 포함하지 않음)

| 항목 | 사유 |
| --- | --- |
| Cloud Workspace / Cloud Patches | plan §5, OPEX, Cloud 의존 |
| Browser Extension (Chrome/FF/Edge) | Cloud Workspace 데이터 의존 |
| GitLens (VS Code 확장) | git-fried = standalone desktop |
| gitkraken.dev (웹 companion) | Cloud 의존 |
| Issue 트래커 풀 통합 (Jira/Linear) | Gitea/GitHub Issues 만 1급 |
| Multi-account 한 forge 의 여러 token | Profiles 시스템으로 충분 |
| Emoji picker in commit message | 외부 키보드 입력 (IME) 으로 충분 |
| Animation tween library | 단순 CSS transition 으로 충분 |
| Org Member 충돌 prediction | Cloud 의존 |
| Time-based / OS-sync 다중 테마 위저드 | system follow 만 |

---

## 12. 우선순위 정리 + 권장 sprint 진입

### Sprint A14 (P0) ✅ 완료 (2026-04-27)

1. ✅ **H1 `⌘⇧H` File history search** — StatusPanel 의 `useShortcut('fileHistorySearch')` 가 selected file 또는 첫 unstaged/staged 의 history modal 자동 진입 (이미 구현됨, 검증만)
2. ✅ **D1 Stash 부분 apply** — commit `f6e05c8`. backend `git/stash.rs::apply_stash_file` (`git checkout stash@{n} -- <path>` 단순 전략) + IPC + `applyStashFile` wrapper + `StashPanel.vue` 미리보기에 파일별 row + "이 파일만 apply" 버튼
3. ✅ **A1 Compare branches/commits** — commit `(C3)`. backend `git/compare.rs::compare_refs` (commits + diff + leftCount/rightCount via `rev-list --left-right --count`) + `CompareModal.vue` (ref1 ⇄ ref2 picker + commit list + diff text) + CommandPalette "Compare — 두 ref 비교" 명령

### Sprint B14 (P1 — 다음 sprint, ~1.5일) — 3 sub-sprint 분할

#### B14-1 ✅ 완료 (2026-04-27)

5. ✅ **C1~C3 Remote 관리 GUI** — `git/remote.rs` (list/add/remove/rename/set-url) + 5 IPC + `RemoteManageModal.vue` + BranchPanel 헤더 🔗 진입 버튼. Rust unit test 3개

#### B14-2 ✅ 완료 (2026-04-27)

6. ✅ **A2 Repo Maintenance** — `git/maintenance.rs` (gc + fsck) + 2 IPC + Settings "유지보수" 카테고리 (gc / aggressive gc with confirm / fsck / lfs install 4 버튼 + 결과 stdout/stderr 표시)
7. ✅ **A5 LFS init** — `git/lfs.rs::install()` + `lfs_install` IPC + Settings "유지보수" 의 `git lfs install` 버튼

#### B14-3 ✅ 완료 (2026-04-27)

4. ✅ **B1~B4 Preferences Repository-Specific** + **A3 Git Flow** + **A4 GPG init** — `git/config_local.rs` (13 키 read/write via `git config --local`) + 2 IPC + `useRepoConfig` composable + `RepoSpecificForm.vue` + Settings → "Repository-Specific" 카테고리. **신규 SQLite migration 불필요** (`.git/config` 이 source of truth, 직접 read/write 가 더 단순 + 외부 git 도구와 자연 호환)

### Sprint C14 (P2 — 여유 시, ~2일) — 부분 진행

#### C14-1 ✅ 완료 (2026-04-27) — 작은 3건

11. ✅ **G1 Tag panel** — `git/tag.rs` (5 함수) + 5 IPC + `TagPanel.vue` + ForgePanel 4번째 tab "Tag"
12. ✅ **G2 Author filter dropdown** — CommitTable header dropdown (unique authors / ko-locale 정렬, 작가 1명 이하면 hide)
13. ✅ **D2 Edit stash message** — `git/stash.rs::edit_stash_message` (rev-parse → stash store -m → drop 원본) + IPC + StashPanel "edit msg" 버튼

#### C14-2 ✅ 부분 완료 (2026-04-27) — 작은 2건

8. ✅ **E1~E2 Clone 옵션** — `git/clone.rs` (sparse cone + depth + shallow-since + single-branch + bare) + `clone_repo` IPC (auto-register=true 면 add_repo 자동) + `CloneRepoModal.vue` + Sidebar "⬇ Clone" 버튼
10. ✅ **F2 PR Filter syntax** — Launchpad 검색 input + helper 버튼 (`+author:` `+state:open` `+repo:` `+is:pinned/snoozed/bot`). syntax: `key:val` + free-text title 매칭, 모든 token AND

#### C14-3 ✅ 완료 (2026-04-27) — plan/14 22 항목 100%

9. ✅ **F1 PR Code Suggestions** — `ForgeClient::add_review_comment` trait + GitHub (`POST /pulls/{n}/comments` with commit_id+path+line+side=RIGHT, head SHA 자동 조회) + Gitea (`POST /pulls/{n}/reviews` event=COMMENT + comments=[{path, body, new_position}]) + IPC + PrDetailModal "+ Code suggestion" 토글 form (path / line / 새 코드 / 컨텍스트, ` ```suggestion ` 자동 wrap)

> **plan/14 진행도: 22/22 = 100%** (A14 3 + B14 7 + C14 6 + 거부 4 + 통합 2)

**합계 22 항목** = 약 **3~5일** (AI pair 가속 기준).

---

## 13. 13번 plan 의 다음 plan 후보 갱신 제안

기존 13번 §8:
- 14 = Line-stage v2
- 15 = v1.x roadmap
- 16 = dogfood feedback

→ **갱신 후**:
- **14 (본 문서) = GitKraken 잔여 catalog** ← 본 plan
- **15 = Line-stage v2** (`15-line-stage-v2.md`, 다음 진입)
- **16 = v1.x roadmap** (`16-v1.x-roadmap.md`)
- **17 = dogfood feedback** (사용자 누적 시)

---

## 14. 검증 체크리스트

각 PR 머지 직전:

- [ ] 한글 ref / 메시지 / path round-trip 통과
- [ ] cargo unit test 추가 (특히 A1 Compare / A2 Repo Maintenance / D1 부분 apply)
- [ ] `bun run typecheck` 0 에러
- [ ] 사용자 본인 레포 1개에 dogfood
- [ ] memory baseline +20% 이내
- [ ] commit message HEREDOC + `'EOF'` 한글 안전
- [ ] PR/이슈 body 의 한글은 `--data-binary @file` 로 전달
- [ ] 11번 §17/§23 의 흡수 매트릭스에 ✅ 표기 갱신

---

## 15. 결정 로그 (2026-04-27)

| # | 결정 | 근거 |
| --- | --- | --- |
| 1 | **22 추가 항목 catalog** = 11번 catalog 95% 흡수 후 잔여 | 11번 §17/§23 표 + git-fried 코드 grep 검증 |
| 2 | **Sprint A14 (P0 3개) 우선** | 사용자 일상 사용 빈도 + 작업량 적음 |
| 3 | **Per-repo Encoding (B2) ⭐ P1 승격** | 한글 환경에서 사용자 가치 큼 |
| 4 | **Code Suggestions (F1) P2** | GitHub + Gitea 양쪽 endpoint 차이로 작업량 큼 |
| 5 | **거부 항목 4 + 7 = 11개 확정** | 11번 §30 정합 유지 |

---

다음 문서 → `15-line-stage-v2.md` (parseDiff.ts 작업 진입 시)
