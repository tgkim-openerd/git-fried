# 07 Settings — Narration draft (Phase 2 PoC SC-07-1)

> 캡처: 2026-05-18 17:34 (PoC v2.1 통과) / Claude vision 단독 draft / Codex cross-validation 필수 (Memory Rule 3)
>
> 스크린샷:
>
> - `docs/ux-eval/handson/screenshots/20260518-173426-07-settings-v2-before.png`
> - `docs/ux-eval/handson/screenshots/20260518-173430-07-settings-v2-after.png`

## SC-07-1: Settings 모달 진입 — narration

### 사용자 액션

`Ctrl+,` (Settings hotkey).

### GitKraken 실제 반응 (Claude vision 1차 interpretation — Codex 검증 전)

**시나리오 가정 정정 1**: Settings 는 **modal 이 아닌 full-page replacement**. 좌측 sidebar 가 통째로 Preferences nav 로 전환, 우측 panel 이 settings form. 상단 탭 row (open 한 repo 들) 와 메뉴바 (File/Edit/View/Help) 는 유지.

**좌측 nav 구조 (12 global + 10 repo-specific — Plan #41 Step 1 Codex 2차 REFUTED 정정)**:

| 그룹 | 항목 |
| --- | --- |
| 상단 | `Exit Preferences` (nav-back 명시 패턴) |
| Current profile | Default Profile (avatar + 이름) |
| Organization | TaeKyum Kim |
| **Preferences (global 12)** | General / Profiles / SSH / Integrations / GitKraken AI / External Tools / Notifications / UI Customization / Commit Signing / Editor / In-App Terminal / Experimental |
| Repo-Specific Preferences | `Repo: react-native` (현재 active repo) |
| **Repo-Specific sub-nav (10)** | Encoding / Gitflow / Git Hooks / **Commit / Agents / Conflict Prevention / LFS / Sparse Checkout / Issue Tracker / Team** (Plan #41 Step 1 신규 7 추가) |

> **Plan #41 Step 1 신규 발견 (2차 REFUTED)**: Plan #40 Phase 2/3 Codex 검증의 "3 repo-specific items (Encoding/Gitflow/Git Hooks)" 단정 = 다시 REFUTED. 실제는 **10 항목** — 7 신규 (Commit / Agents / Conflict Prevention / LFS / Sparse Checkout / Issue Tracker / Team) 발견. Multi-round Codex 페어 검증의 가치 정량 증명 — vision rule 35% baseline 외에도 multi-pass 가 추가 finding emit.

**Plan #41 Step 1 Codex 1차 페어 — git-fried implementation 정량**:

| # | 영역 | Rust | Vue | 평가 |
| --- | --- | --- | --- | --- |
| 1 | Encoding | PARTIAL `config_local.rs` | PARTIAL `RepoSpecificForm.vue` | HIGH (identity-core) |
| 2 | Gitflow | PARTIAL `config_local.rs` gitflow.* | PARTIAL `RepoSpecificForm.vue` | LOW (1인 환경) |
| 3 | Git Hooks | PARTIAL `core.hooksPath` | PARTIAL | MED |
| 4 | Commit | PARTIAL `commit.rs` + gpgsign | PARTIAL `CommitMessageInput.vue` | HIGH (GPG/Squash/Template) |
| 5 | Agents | PARTIAL/DIFFERENT `ai/runner.rs` | `useAiCli.ts` | **거부 권고** (cloud SaaS 정체성 충돌) |
| 6 | Conflict Prevention | **YES** `conflict_prediction.rs` + IPC | YES `StatusBar.vue` | HIGH (UI 노출만 필요) |
| 7 | LFS | **YES** `lfs.rs` + 7 IPC | YES `LfsPanel.vue` | HIGH (Settings 노출만) |
| 8 | Sparse Checkout | PARTIAL `clone.rs` (clone 시점만) | PARTIAL `CloneRepoModal.vue` | MED |
| 9 | Issue Tracker | PARTIAL `forge/gitea.rs` `forge/github.rs` | PARTIAL `IssuesPanel.vue` | MED (외부 tracker 제외) |
| 10 | Team | NO | NO | LOW (local profiles 대체) |

**핵심 인사이트**: 6/10 항목 이미 구현 (PARTIAL ~ YES). Settings UI 노출 + per-repo override hook 만 추가하면 빠른 wins.

### 우측 panel — General 활성 항목

| 항목 | 현재값 (관찰) | 설명 |
| --- | --- | --- |
| Auto-Fetch Interval | `1` | "In minutes, between 0 and 60 (0 disables auto-fetch). Fetches all visible remotes." + 경고: "If you have many visible remotes, this may impact performance. LFS objects will not be automatically fetched." |
| Auto-Prune | ✓ ON (toggle) | (label only) |
| Keep submodules up to date | ✓ ON | "Automatically update all submodules after performing a Git action" |
| Default Branch Name | `main` (placeholder) | "Sets the default branch name when initializing new repositories." |
| Delete ".orig" files after merging | ✗ OFF | |
| Show All Commits in Graph | ✗ OFF | "Enabling this option may adversely affect performance." |
| Initial Commits in Graph | `2000` | "Minimum 500. If commit lazy loading is enabled, GitKraken Desktop will load additional commits if you reach the earliest commit in the Graph." + 경고 |
| Lazy Load Commits in Graph | ✓ ON | (label only) |
| Remember tabs | ✓ ON | (label only) |
| Path to sh.exe | `C:\Program Files\Git\bin\sh.exe` (Browse 버튼) | "Pointing to sh.exe is only required if you're using Git hooks. ..." |
| Longpaths | ✗ OFF | "Sets core.longpaths in your global Git Config. ... less than 260 characters." |
| AutoCRLF | ✗ OFF | "Sets core.autocrlf in your global Git Config." |

### git-fried 대응 + backlog 매핑

| GitKraken 항목 | git-fried 대응 | backlog / 결정 |
| --- | --- | --- |
| Auto-Fetch Interval (default 확인 필요) | Sprint c95 SB-028: default 0 → 5min (`ace68a0`) | GitKraken default 가 0 vs 5min vs 1min 인지 baseline 확인 필요 — 현재 `1` 은 사용자 설정값일 가능성 |
| Initial Commits in Graph = 2000 + Lazy Load | Sprint c74 무한 스크롤 STEP 500 / CAP 5000 | **다른 전략** — git-fried 가 더 작은 STEP. UX 차별점인지 GitKraken parity 후보인지 결정 필요 |
| Repo-Specific Preferences | Sprint c81 SB-013 per-repo forge override (commit `1784c3f`) | parity 검증 (양쪽 동일 패턴) |
| GitKraken AI tab (nav 항목 단독) | useAiRunner + ai_commands.rs 9 IPC (Sprint c40+) | git-fried 가 Settings 내 별도 sub-section 으로 통합? Settings 페이지 sub-nav 신규 후보 |
| Commit Signing tab | git-fried 미구현 | SB-XXX 신규 backlog (GPG/SSH commit signing settings UI) |
| Gitflow tab | git-fried 미구현 | LOW 우선도 (workflow 자체 의도적 미지원 가능 — `26-3constraints-identity.md` 검토 필요) |
| Git Hooks tab | git-fried 미구현 (lefthook 외부 사용) | SB-XXX 신규 (hooks 관리 UI) |
| In-App Terminal tab | PTY terminal 구현 (Sprint c80) | Settings sub-section 통합 검토 |
| Experimental tab | feature-flags.json (file 기반) | UI sub-section 신설 검토 — feature flag 토글 GUI |
| Path to sh.exe | git-fried 미구현 (Git hooks 미지원) | LOW |
| Longpaths / AutoCRLF | git-fried 미구현 (core.* git config UI X) | MEDIUM (Windows 사용자에게 중요) |

### Open question (Codex cross-validation 권고 영역)

1. **Auto-Fetch Interval default** — `1` 이 사용자 설정값인지 GitKraken default 인지 (Codex 별도 GitKraken docs 확인 가능)
2. **"GitKraken AI" tab 내부 UI** — Claude/Codex CLI 통합 옵션 있는지 (현재 캡처는 General 활성, AI tab 미진입)
3. **Repo-Specific Preferences override 가능 항목** — 좌하단 라벨만 보임, 클릭 시 우측에 무엇 표시될지 미캡처
4. **"Exit Preferences" 패턴** — nav-back 좌상단 명시 vs git-fried 의 router back navigation 비교

### Memory Rule 3 적용 결과

본 narration 은 Claude multimodal vision 단독 1차 draft. 35% 오류율 기대 — Codex cross-validation 후 정정 가능 finding:

- enum (15 nav 항목 중 일부 라벨 오독 가능성)
- Settings 진입이 modal 아닌 full-page 라는 단정 (Codex 가 cross-validate)
- 수치 (Auto-Fetch 1, Initial Commits 2000) 정확성

Codex agent 호출 + 정정 결과는 본 파일 § Verification 섹션에 append.

---

## Verification — Codex cross-validation (Memory Rule 3 적용)

Codex (`a7d2312e1da4dbbd0`) 가 동일 PNG 2개 + narration .md 독립 검증. 결과:

### 검증 통과율

- **17 단정 중 CONFIRMED 14 / REFUTED 1 / PARTIAL 2**
- Claude 오류율 **약 18%** (Memory Rule 3 기대 35% 보다 양호)

### 정정 항목

| # | Claude 단정 | Codex 검증 | 처리 |
| --- | --- | --- | --- |
| 1 | "좌측 nav 15 항목 (Encoding/Gitflow/Git Hooks 포함)" | 실제 = 12 global + 3 repo-specific 분리 (E/G/GH 는 Repo-Specific Preferences 하위) | **REFUTED** → 본문 정정 완료 |
| 2 | "Auto-Prune ON (toggle)" | 컨트롤 타입 = checkbox (toggle X) | **PARTIAL** → wording "checked checkbox" 로 정정 권고 |
| 3 | "Default Branch Name = main (placeholder)" | field 에 `main` 표시 — placeholder/value 여부 캡처로 불확정 | **PARTIAL** → "field displays main" 표현 권고 |

### Codex-only 신규 finding (Claude 가 놓침 — 7건)

1. **Before PNG 우하단**: GitKraken 버전 표시 `v12.1.1` — narration baseline metadata 보강
2. **Before PNG 좌측 sidebar counts**: LOCAL 35 / REMOTE 71 / WORKTREES 4 / STASHES 10 / CLOUD PATCHES 0 / PULL REQUESTS 0 — 다른 영역 시나리오 baseline
3. **Before PNG 선택 commit**: hash `4fb5df` 제목 "fix: 현대커머셜 이벤트 추적을 프론트로 정리" — graph 시나리오 fixture
4. **Before PNG 우측 panel "Explain commit" AI 버튼** — git-fried 의 useCommitExplain (Sprint c63 도입) 의 GitKraken baseline 확인 ✓
5. **Before PNG "Viewing 106" + active branch `develop`** — Codex V2 (`SB-052`) wording 정정 baseline + branch 이름
6. **After PNG 우측 scrollbar 존재** — General settings 가 보이는 것 외 추가 항목 존재 가능 (캡처 보강 필요)
7. **After PNG 모든 state 컨트롤 = checkbox (toggle X)** — narration wording 정정 권고 (단정 #2 와 일관)

### PoC v3 보정 권고 (Codex 제안)

- sidebar enum 추출 시 계층 구조 (global vs repo-specific) 별도 기재 의무
- 컨트롤 타입 (checkbox vs toggle vs input) 상태와 분리 명시
- text field 는 placeholder/value 확정 불가 시 "displays X" 표현
- before-capture baseline 표준 필드셋: version / repo / branch / sidebar counts / selected commit / right-panel actions
- after 캡처 시 scroll position end-of-page 도 별도 캡처

### git-fried 신규 backlog 후보 (Codex finding 기반)

- "Explain commit" AI 버튼 (Before PNG) → git-fried useCommitExplain Sprint c63 도입 ✓ parity 검증
- Repo-Specific Preferences 의 Encoding / Gitflow / Git Hooks 3 sub-nav → SB-XXX 신규 (per-repo override 영역 확장)
