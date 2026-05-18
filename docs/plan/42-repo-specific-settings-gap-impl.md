# Plan #42 — Repo-Specific Settings gap 구현 (Plan #41 Step 4 산출물)

> 작성: 2026-05-18 / 선행: Plan #41 Step 1 발견 (GitKraken Settings Repo-Specific 10 항목 — 7 신규) + Codex 1차 페어 권고

## Goal

Plan #41 Step 1 발견 (GitKraken Settings Repo-Specific = 10 항목, git-fried 6 PARTIAL ~ YES 이미 구현) 의 **빠른 wins** 구현 — Settings UI 노출 + per-repo override hook 추가로 git-fried 가 GitKraken parity 영역 확장.

## 우선순위 (Codex 1차 페어 권고 기반)

### HIGH — 빠른 wins (즉시 구현 후보, Sprint c96+ 진입점)

#### H-1: Conflict Prevention Settings UI 노출

- **현재**: Rust `conflict_prediction.rs` + `v02_commands.rs::predict_target_conflict` IPC + Vue `StatusBar.vue` + `useUserSettings.ts` **이미 구현**
- **gap**: `pages/settings/sections/` 에 별도 ConflictPreventionSection.vue 없음
- **구현 action**:
  - 신규: `pages/settings/sections/ConflictPreventionSection.vue` (per-repo toggle + threshold 옵션)
  - extend: `useUserSettings.ts` 의 conflict prevention 항목 노출
  - i18n: `settings.conflictPrevention.*` 키 추가 (ko/en)
- **effort**: XS
- **acceptance**: Settings → Conflict Prevention 페이지 navigate 가능 + toggle 동작 + per-repo override 가능

#### H-2: LFS Settings UI 노출

- **현재**: Rust `lfs.rs` + `lfs_commands.rs` (7 IPC: status/track/untrack/install/fetch/pull/prune) + Vue `LfsPanel.vue` + `api/git.ts` **이미 구현**
- **gap**: Settings 페이지에서 LFS 진입점 없음 (LfsPanel 은 다른 UI 영역)
- **구현 action**:
  - 신규: `pages/settings/sections/LfsSection.vue` (status 표시 + track/untrack input + install/fetch/pull/prune 버튼)
  - 또는 LfsPanel 재사용 (Settings 페이지 안에 embed)
  - i18n: `settings.lfs.*` 키 추가
- **effort**: XS~S
- **acceptance**: Settings → LFS 페이지 진입 + 모든 7 액션 가능

#### H-3: Encoding identity-core UI 강화

- **현재**: Rust `config_local.rs` (i18n.commitEncoding / logOutputEncoding) + Vue `RepoSpecificForm.vue` B2 **PARTIAL**
- **gap**: 별도 Settings 페이지 없음 + 한글 ko/en + Asian 확장 (UTF-8 / CP949 / Shift_JIS / GB2312 등)
- **구현 action**:
  - 신규: `pages/settings/sections/EncodingSection.vue` (commit encoding dropdown + log output encoding dropdown + UTF-8 default + 검증)
  - extend: `RepoSpecificForm.vue` 의 B2 영역에서 EncodingSection link 추가
  - i18n: `settings.encoding.*` + 한글 안전 가이드 inline
- **effort**: S
- **acceptance**: Settings → Encoding 페이지 진입 + commit/log encoding 변경 가능 + git-fried 한글 안전 (encoding_rs + unicode_normalization) baseline 검증

#### H-4: Commit Template / Squash toggle / Skip hooks UI

- **현재**: Rust `commit.rs` + gpgsign 부분 + Vue `CommitMessageInput.vue` + `useCommitMutation.ts` **PARTIAL**
- **gap**: GitKraken 의 4 옵션 (Push after each commit / Skip git hooks / Squash / Commit Template + Summary 72자 limit + Description body) 미통합
- **구현 action**:
  - 신규: `pages/settings/sections/CommitSection.vue` (4 toggle + template input + Save 버튼)
  - extend: `useCommitMutation.ts` 의 push-after-commit / squash 옵션 + commit template substitution
  - i18n: `settings.commit.*`
- **effort**: M
- **acceptance**: per-repo commit template + 4 toggle 적용 + 다음 commit 시 효과 검증

### MED — 다음 sprint 후보

#### M-1: Git Hooks manager UI

- **현재**: Rust `core.hooksPath` 등록 + Vue `RepoSpecificForm.vue` B1 PARTIAL
- **gap**: hook list 표시 / enable-disable / 외부 lefthook 통합 UI 없음
- **effort**: M
- **acceptance**: hook list view + enable/disable toggle

#### M-2: Sparse Checkout repo manager

- **현재**: Rust `clone.rs` CloneOptions.sparse_paths (clone 시점만) + Vue `CloneRepoModal.vue` PARTIAL
- **gap**: clone 이후의 sparse paths 변경 UI 없음
- **effort**: M
- **acceptance**: per-repo sparse paths 변경 + apply

#### M-3: Issue Tracker (Gitea / GitHub 1급)

- **현재**: Rust forge 측 issue list (gitea.rs / github.rs) + Vue IssuesPanel + useExternalIssueTracker (skeleton) PARTIAL
- **gap**: Settings → Issue Tracker 페이지에서 forge 별 활성/비활성 toggle + 외부 (Jira/Linear/Azure DevOps) 명시 거부 안내
- **effort**: S
- **acceptance**: Settings 페이지 진입 + Gitea/GitHub 토글 + 외부 tracker "지원 안 함" 명시

### LOW — 미구현 유지 권고

#### L-1: Gitflow

- **이유**: 1인 듀얼 forge 환경에서 identity-core 아님. `26-3constraints-identity.md` 의 거부 항목 후보
- **action**: Settings 페이지 미구현 유지 + docs 에 "지원 안 함" 명시

#### L-2: Team

- **이유**: GitKraken 의 collab feature (Cloud Workspace 같은 SaaS 영역) — git-fried 의 local profiles + per-repo forge override 로 대체 가능
- **action**: 미구현 유지 + docs 에 "local profiles 사용 권고" 안내

### 거부 — 정체성 충돌

#### R-1: Agents

- **이유**: GitKraken Agents = cloud SaaS 서비스 (외부 자동화 + remote execution). git-fried 의 AI CLI subprocess + no cloud + BYO LLM 정체성과 직접 충돌
- **action**: docs/plan/26-3constraints-identity.md 에 명시 거부 추가. `useAiCli.ts` 의 로컬 Claude/Codex CLI 액션은 유지하되 "Agents Settings" 클론은 구현 안 함

## 구현 순서 (Sprint c96+ 진입점)

### Sprint c96 — HIGH 4 batch (XS + XS + S + M = total M-L)

1. H-1 Conflict Prevention UI 노출 (XS) — 1 .vue + 1 composable extend + i18n
2. H-2 LFS UI 노출 (XS~S) — 1 .vue 또는 LfsPanel 재사용
3. H-3 Encoding UI 강화 (S) — 1 .vue + i18n + 한글 안전 가이드
4. H-4 Commit Template/Squash/Skip UI (M) — 1 .vue + composable extend + 4 toggle

### Sprint c97+ — MED 3 batch (M + M + S = total L)

1. M-1 Git Hooks manager UI (M)
2. M-2 Sparse Checkout repo manager (M)
3. M-3 Issue Tracker forge 1급 (S)

### Sprint c98+ — LOW 명시 + 거부 docs

1. L-1 Gitflow / L-2 Team 미구현 안내 docs
2. R-1 Agents `26-3constraints-identity.md` 거부 추가

## Acceptance (Plan #42 종료 조건)

- [ ] Sprint c96 HIGH 4 모두 구현 + Settings 진입 검증
- [ ] Sprint c97 MED 3 구현
- [ ] Sprint c98 LOW/거부 docs 업데이트
- [ ] comparison.md 의 parity matrix update (Repo-Specific 10 row 의 △ → ✓ 또는 명시 ✗)
- [ ] git-fried coverage 67% → 90%+ 도달

## Open question — Codex 2차 페어 (`a070d03958d0f12cb`) 해결

1. **Sprint c96 단일 진입**: **YES** 1 sprint 내 가능. 단 단일 commit 비권장 — XS+XS+S+M = 3~4 logical commit 분할.
2. **flat vs hierarchical**: **hierarchical 점진 권장**. 현재 `apps/desktop/src/pages/settings.vue` 단일 파일 (268 LOC) + `CATEGORY_GROUPS` 7 그룹 enumerate. 디렉토리 분리 (`pages/settings/sections/*.vue`) 보다 settings.vue 내부 group 구분 incremental.
3. **i18n 비용**: ~120 leaf 추가. lefthook `i18n-symmetry` pre-commit 활성 — ko/en 동시 작업 필수. 분할 commit 시 각 commit 마다 ko/en symmetry 유지.
4. **per-repo override 패턴**: **RepoSpecificForm + DB migration** 권장 (SB-013 ID 는 comparison 라벨, 실 구현 근거는 `RepoSpecificForm.vue` + `0006_repo_forge_account_override.sql` 같은 migration). H-1~H-4 의 global default 는 `useUserSettings.ts`, per-repo override 는 DB row 신규 또는 `.git/config` 경로.

## Codex 2차 발견 정정 (E1-E4)

| # | 정정 항목 | Plan #42 v1 단정 | 실제 (Codex 검증) |
| --- | --- | --- | --- |
| E1 | 경로 | `pages/settings/sections/*.vue` 전제 | 실제 `apps/desktop/src/pages/settings.vue` 단일 파일 + `components/Settings*.vue` 별도 |
| E2 | LFS IPC 수 | 7 | 실제 9 (`status/list/track/untrack/install/fetch/pull/prune/push_size`) |
| E3 | H-1 threshold | XS effort | **S** effort — `useUserSettings.ts` 의 `conflictDetection: boolean` 만 — threshold 저장 모델 부재 |
| E4 | per-repo 명칭 | "useUserSettings vs SB-013" | 실 구현 근거 = `RepoSpecificForm.vue` + DB migration. SB-013 = comparison 라벨 |

## 정정 후 H-1 구현 단계 (S effort, 2-3 commits)

git-fried `apps/desktop/src/pages/settings.vue` 의 실제 구조 기반:

1. type `Category` union 에 `'conflictPrevention'` 추가
2. `CATEGORY_GROUPS` 의 `workspace` 그룹 items 에 `{ id: 'conflictPrevention', label: 'Conflict Prevention' }` 추가
3. 신규 `apps/desktop/src/components/SettingsConflictPrevention.vue` (다른 SettingsXxx.vue 패턴 따름)
4. settings.vue template 에 `<SettingsConflictPrevention v-else-if="active === 'conflictPrevention'" />` 추가
5. `useUserSettings.ts` 의 `GeneralSettings` interface 에 `conflictDetectionThreshold: number` 추가 + default 값 (예: 100) + DEFAULT_GENERAL 갱신
6. i18n: ko/en `settings.items.conflictPrevention` + section 내 ~10 키 (description / threshold label / suggestion 등)

per-repo override 는 다음 sprint (M-1.1) — global first.

## 다음 단계

- 본 plan #42 정정 commit
- H-1 구현 (S, 단일 commit) 시도
- 안정 시 Sprint c96 batch (H-2/H-3/H-4) 진행
- Plan #41 Step 2/3 (attended) 는 사용자 환경 가능 시점 진행
