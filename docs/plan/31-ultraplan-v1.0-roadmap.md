# plan/31 — UltraPlan v0.3 → v1.0 Roadmap (Claude × Codex 합의)

> 작성일: 2026-05-13 (Sprint c80+ 종료 직후)
> 입력: [research.md](../../research.md) (390 LOC) + [plan/30](30-ux-comprehensive-c55-batch.md) (808 LOC c58 baseline) + 사용자 4축 요구
> 협업: Claude (코드 verification SoT) × Codex (외부 GUI knowledge + UI/UX 방법론 cross-validate)
> 분류: UltraPlan (단일 sprint 가 아닌 v0.3 → v1.0 multi-phase roadmap)
> Effort 표기: XS/S/M/L/XL (시간 라벨 금지 — CLAUDE.md § Time Estimation Restraint)

---

## §0 Executive Summary

### 현재 위치 (c80+ 종료)

| 차원 | 점수 | baseline |
|---|---:|---|
| Nielsen 10 | **93/100** | c58 92 + c77 +1 |
| a11y | **9/10** | c58 도달 (WCAG 2.1 AA), 2.2 신규 미적용 |
| 반응형 | **9/10** | 1024 graceful, <1024 banner |
| i18n | **9/10** | ko/en 1250 leaf 대칭 + lefthook |
| 차별점 | **9.95/10** | 22 차별점 catalog |
| **GitKraken 대체 가능성** | **9.3/10** | research.md Codex 보정 |
| god comp ≥200 | **0** | c75 마일스톤 |
| 잠복 god comp ≥150 | **9건** | UltraPlan 범위 |

### 4축 통합 결과

**A. 누락/미흡 보강** — research.md 13건 + plan/30 §11 Tier 2 5건 + 잠복 god comp 9건 + GK Settings 누락 4건 = **31 항목**

**B. GitKraken Settings 매트릭스** — 15 GK 영역 × git-fried 10 sub-component 매핑. 누락 4건 (Editor 외부 통합 / Keybindings custom / SSH per-repo / Linear-Jira PR 통합)

**C. Per-repo identity** — 사용자 핵심 요구. 현 schema `repos.forge_account_id` **부재** 확정. UltraPlan §3 신규 schema 설계 + UI 도입

**D. UI/UX 방법론** — 10 방법론 × git-fried 매핑. 우수 7 / 부분 2 / 미적용 1 (WCAG 2.2 / Doherty Threshold 400ms)

### Phase 분할 (4 phase)

| Phase | 범위 | 사이즈 | 의존성 |
|---|---|---|---|
| **v0.4** (출시 직전 polish) | 8 항목 — first-run / per-repo / WCAG 2.2 / 잠복 god comp wave | M+L | independent |
| **v0.5** (확장) | 6 항목 — SSH per-repo / AI quota / search 통합 / error boundary | M | v0.4 후 |
| **v0.6** (a11y deep) | 5 항목 — SR 실 + axe-core / forced-colors / aria-live / CJK | M | v0.5 후 |
| **v1.0** (release) | 4 항목 — Mac/Linux / OAuth / Telemetry opt-in / 의도 배제 항목 결정 | XL | v0.6 후 |

총 **23 항목 + 의도 배제 8 항목** 결정 매트릭스.

---

## §1 4축 입력 통합

### 축 1 — 누락 / 미흡 보강 (31 항목, 5 그룹)

#### A1. 출시 차단 (HIGH, v0.4)

| # | 항목 | 증거 | effort |
|---|---|---|---|
| 1 | **per-repo forge account override** (사용자 핵심 요구) | `repos.forge_account_id` 컬럼 부재 ([0001_initial.sql](../../apps/desktop/src-tauri/src/storage/migrations/0001_initial.sql)) | M |
| 2 | **First-run wizard (3-screen welcome)** | [useOnboardingDetect.ts](../../apps/desktop/src/composables/useOnboardingDetect.ts) — toast 1회만 | M |
| 3 | **AI quota / rate limit fallback UX** | [useAiCli.ts](../../apps/desktop/src/composables/useAiCli.ts) — `quota\|rate.limit\|429` grep 0 매치 | S |

#### A2. UX polish (MEDIUM, v0.4~v0.5)

| # | 항목 | 증거 | effort |
|---|---|---|---|
| 4 | **CommitSearchModal 통합 검색** (file content + branch + SHA) | [CommitSearchModal.vue:5](../../apps/desktop/src/components/CommitSearchModal.vue#L5) `git log --grep 동등` 주석 | M |
| 5 | **CommitSearchModal BaseModal 마이그** | 21/22 modal wrap, 1건 누락 | S |
| 6 | **component-level error fallback** (`onErrorCaptured` + `<ErrorBoundary>`) | grep 0 매치 | M |
| 7 | **drag-drop "merge/rebase/cancel" radio modal** | plan/30 §11 Tier 2 #24 | S |
| 8 | **Conflict 라벨 명료화** | plan/30 §11 Tier 2 #23 | S |
| 9 | **LFS 작업 직접 trigger** | plan/30 §11 Tier 2 #25 (panel 만) | M |
| 10 | **Bulk fetch failure 시각화 검증** | plan/30 §11 Tier 2 #26 | S |
| 11 | **TipTap PR description editor 검증** | plan/30 §11 Tier 2 #27 | S |
| 12 | **시간 기반 commit filter** (Last 24h / 7days) | Launchpad 6 token 미포함 | S |

#### A3. a11y boost (HIGH, v0.4~v0.6)

| # | 항목 | 증거 | effort |
|---|---|---|---|
| 13 | **WCAG 2.2 Focus Appearance** (focus indicator 강화) | 2.4.11 신규 | S |
| 14 | **WCAG 2.2 Target Size (24×24px)** | drag handle 12px hit (P3 c55) — 2.5.8 신규 | S |
| 15 | **WCAG 2.2 Drag Movements** (alt single-pointer) | 2.5.7 신규 | M |
| 16 | **screen reader 실 테스트 (NVDA Windows)** | DOM aria-* 만, 실 SR navigation 미검증 | L |
| 17 | **axe-core 통합** | manual 검증 | M |
| 18 | **aria-live regions 확장** | 2건만 (Toast 미포함) | S |
| 19 | **forced-colors (Windows High Contrast)** | `forced-colors\|CanvasText` grep 0 매치 | S |
| 20 | **CJK fallback** (Noto Sans JP/SC/TC) | 한글만 명시 | XS |

#### A4. 성능 / 관측성 (MEDIUM, v0.5~)

| # | 항목 | 증거 | effort |
|---|---|---|---|
| 21 | **Doherty Threshold 400ms 진척 banner** | LongRunningProgress 30s/1m/4m, 400ms 적용 0 | M |
| 22 | **shortcut 충돌 검출** (사용자 customization 도입 시) | useShortcuts SoT, conflict 검출 0 | M |
| 23 | **bench/baseline.json 측정** | plan/30 §10 외부 BENCH_REPO 미설정 | S |

#### A5. 잠복 god comp wave (MEDIUM, v0.4~v0.5)

| # | 파일 | LOC | 추출 후보 |
|---|---|---|---|
| 24 | CommitGraph.vue | 197 | useGlobalCommitJumpHook (window hook 분리) |
| 25 | GitKrakenToolbar.vue | 172 | useToolbarLayout (icon order + tooltip) |
| 26 | RemoteManageModal.vue | 168 | c53 useRemoteInteraction 확장 |
| 27 | StatusBar.vue | 167 | useStatusBarSegments (segment 별 computed) |
| 28 | FullscreenDiffView.vue | 165 | lifecycle 분리 |
| 29 | StatusPanel.vue | 163 | mutation 분리 |
| 30 | PrPanel.vue | 159 | usePrPanelActions 신규 |
| 31 | ReflogModal.vue | 158 | useReflogFilter 신규 |
| 32 | CloneRepoModal.vue | 157 | useCloneFormState 신규 |

### 축 2 — GitKraken Settings 매트릭스

| # | GitKraken 영역 | git-fried 대응 | 평가 | 액션 |
|---|---|---|---|---|
| 1 | Profiles (사용자별) | [ProfilesSection.vue](../../apps/desktop/src/components/ProfilesSection.vue) ✅ | **동등+** (1-click 토글 + signing/SSH 통합) | 유지 |
| 2 | Integrations (PAT/OAuth) | [ForgeSetup.vue](../../apps/desktop/src/components/ForgeSetup.vue) ✅ | **동등** (PAT only) | OAuth v1.x |
| 3 | GitKraken Cloud Account | ❌ 의도 배제 | (dogfood 정체성, plan/26) | 유지 |
| 4 | Workspaces (Cloud sync) | 로컬 workspaces 4 ✅ | **동등-** (Cloud 의도 배제) | 유지 |
| 5 | PR AI / Linear / Jira / Trello | AI 자체 ✅ + Linear/Jira **placeholder** ⏸ | **부분** | v0.4~ Linear/Jira |
| 6 | Themes (light/dark/custom) | [useTheme.ts](../../apps/desktop/src/composables/useTheme.ts) + [useCustomTheme.ts](../../apps/desktop/src/composables/useCustomTheme.ts) ✅ | **동등+** (custom JSON export/import) | 유지 |
| 7 | **Editor (외부 통합 — VSCode/Sublime)** | [SettingsEditor.vue](../../apps/desktop/src/components/SettingsEditor.vue) (placeholder) ⚠ | **미흡** | v0.4 도입 |
| 8 | **Keybindings (사용자 custom)** | [useShortcuts.ts](../../apps/desktop/src/composables/useShortcuts.ts) SoT, custom 부재 ⚠ | **미흡** | v0.5 도입 |
| 9 | Plugins / Add-ons | [SettingsPluginIntegration.vue](../../apps/desktop/src/components/SettingsPluginIntegration.vue) (v0.4 placeholder) ⏸ | (v0.4+ planned) | v0.4 |
| 10 | **SSH (default + per-repo override)** | Profile `ssh_key_path` 메모만 + per-repo 부재 ⚠ | **미흡** | v0.5 per-repo |
| 11 | GPG (signing + verify) | RepoSpecificForm `commit.gpgsign` + `user.signingkey` ✅ | **동등** | 유지 |
| 12 | Terminal | xterm + PtyRegistry ✅ + Settings ⏸ | **동등** | 유지 |
| 13 | Notifications | [useNotification.ts](../../apps/desktop/src/composables/useNotification.ts) + Tauri plugin ✅ | **동등** | 유지 |
| 14 | Privacy (telemetry) | 0 telemetry (opt-out 자동) ✅ | **동등+** | 유지 |
| 15 | Updates (auto / release notes) | Tauri updater (추정) | **동등** | 검증 |

**누락 영역 4건 (HIGH 후보)**:

- **GK7 — Editor 외부 통합 (VSCode / Sublime / IntelliJ)** — git-fried `SettingsEditor.vue` 가 placeholder. Tauri 의 `shell.open` 으로 가능. v0.4 도입.
- **GK8 — Keybindings custom** — `useShortcuts.ts` SoT 의 외부 customization. JSON config + 충돌 검출 동반.
- **GK10 — SSH key per-repo override** — 현재 Profile 의 `ssh_key_path` 만 (전역). 외부 사례: Tower 6+. `git config core.sshCommand` 직접 wrapper.
- **GK5 부분 — Linear / Jira PR 통합** — `SettingsPluginIntegration.vue` placeholder. v0.4+ planned.

### 축 3 — Per-repo identity (사용자 핵심 요구)

#### 현 상태 (Claude 코드 verification)

```
┌──────────────────────────────────────────────────────────────────┐
│ Profile (사용자별, 1-click 전역 토글)                              │
│  ├─ git_user_name / git_user_email (git config --global)         │
│  ├─ signing_key / ssh_key_path (메모만, 실 적용 사용자 책임)        │
│  └─ default_forge_account_id → forge_accounts(id)                │
│                                                                  │
│ ForgeAccount (PAT 저장)                                          │
│  ├─ forge_kind (gitea / github)                                  │
│  ├─ base_url + username                                          │
│  └─ keychain_ref (OS keychain entry)                             │
│                                                                  │
│ Repo (저장소)                                                    │
│  ├─ workspace_id / name / local_path                             │
│  ├─ forge_kind / forge_owner / forge_repo                        │
│  └─ ❌ forge_account_id 컬럼 부재                                 │
│                                                                  │
│ RepoSpecificForm (12 fields, .git/config 직접 wrapper)           │
│  ├─ core.hooksPath                                               │
│  ├─ i18n.commitEncoding / logOutputEncoding                      │
│  ├─ gitflow.branch.master/develop + gitflow.prefix.*             │
│  ├─ commit.gpgsign / user.signingkey                             │
│  └─ ❌ forge_account / user.email per-repo override 부재          │
└──────────────────────────────────────────────────────────────────┘
```

#### Codex 외부 사례 (1차 합의)

| GUI | per-repo identity 영역 |
|---|---|
| **Tower 6+** | name / email / signingkey **+ SSH key** override (git config core.sshCommand) |
| **SourceTree** | Repository Settings 일부 (gitconfig 노출) |
| **Fork** | Email per-repo 만 |
| **GitKraken** | Cloud Profile + workspace Profile 만 (per-repo PAT **미지원**) |
| **GitUp / Magit** | git config 직접 의존 (UI 노출 약함) |

**git-fried 차별점 가능 영역**: Tower/Fork/SourceTree/GitKraken 모두 **per-repo PAT 미지원**. git-fried 가 첫 도입 가능.

#### 권장 모델 (Claude × Codex 1차 합의 — 옵션 A)

**옵션 A — repos.forge_account_id 컬럼 추가 + UI 드롭다운 (Profile default + override)**

```sql
-- migration N: repo per-account override
ALTER TABLE repos ADD COLUMN forge_account_id INTEGER REFERENCES forge_accounts(id);
ALTER TABLE repos ADD COLUMN ssh_key_path TEXT;  -- Profile 기본 override
ALTER TABLE repos ADD COLUMN git_user_email TEXT;  -- .git/config user.email override
```

**Resolution chain** (forge account 결정 우선순위):
1. `repos.forge_account_id` (per-repo override, 사용자 명시)
2. `profiles.default_forge_account_id` (active Profile)
3. forge_kind / base_url 자동 매칭 (best-effort fallback)

**UI 변경**:
- `RepoSpecificForm.vue` 에 신규 입력 3개:
  - "Forge 계정" 드롭다운 (Profile default · 또는 명시 선택)
  - "SSH key 경로 override" (Profile 의 ssh_key_path override)
  - "user.email override" (.git/config 직접)
- `useProfiles().active` 변경 시 per-repo override 가 cascade 안 됨 (의도적 — Codex 의문 #2 답)
- UI 에 "현재 활성 Profile: X / 본 repo override: Y" 표시 (Recognition over Recall)

**Codex 의 의문 (검증 필요)**:
- Q1: Tower 의 per-repo SSH key 동작 — `git config core.sshCommand` 또는 SSH agent 통합? → **Claude 답**: Tower 공식 docs 검증 필요. 단 git config core.sshCommand 가 git 자체 표준 메커니즘이라 첫 도입 안전.
- Q2: Profile 변경 시 repos override cascade — reset vs 보존? → **권장**: 보존 (사용자 명시 override 가 Profile 토글로 사라지면 위험)
- Q3: forge_account 변경 시 사용자 확인 dialog? → **권장**: 있음 (Recognition over Recall + Error prevention)

#### Phase별 도입

- **v0.4** — `repos.forge_account_id` 컬럼 + UI 드롭다운 (옵션 A 핵심)
- **v0.5** — `repos.ssh_key_path` + `repos.git_user_email` (SSH per-repo + email override)
- **v0.6** — UI polish (cascade visualization / "현재 활성" 명시)

### 축 4 — UI/UX 방법론 매트릭스

| 방법론 | 현 적용 | 평가 | 보강 후보 |
|---|---|---|---|
| **Nielsen 10 heuristics** | plan/30 92/100 | 우수 ✅ | — |
| **Hick's Law** (선택지 ↓ → 결정 시간 ↓) | CommandPalette 카테고리 그룹 / FullscreenDiff mode 통합 (Compare+Range) | 우수 ✅ | — |
| **Fitts' Law** (클릭 대상 크기·거리) | Mini 24px hit (P1-2 c55) / Drag handle 12px hit > 2px visible (P3 c55) | 우수 ✅ | WCAG 2.2 Target Size 24×24 보강 |
| **Miller 7±2** (단기 기억) | Sidebar 9 sections (위반?) — plan/30 P1-5 검토됨 | **부분** ⚠ | Sidebar grouping 재검토 |
| **Gestalt** (proximity/similarity/closure) | 8-color hash visual identity (PALETTE + AVATAR_PALETTE) / commit graph lane | 우수 ✅ | — |
| **WCAG 2.1 AA** | c55-c58 도달 ✅ | 우수 ✅ | — |
| **WCAG 2.2 신규** | Focus Appearance / Drag Movements / Target Size / Accessible Auth | **미적용** ❌ | A3-13/14/15 HIGH |
| **Doherty Threshold** (400ms 응답) | LongRunning 30s/1m/4m, 400ms 적용 0 | **미적용** ❌ | A4-21 MEDIUM |
| **Aesthetic-Usability Effect** | shadcn-vue tokens + Tailwind + custom theme | 우수 ✅ | — |
| **Jakob's Law** (mental model 차용) | GitKraken parity 32 매트릭스 ✅ | 우수 ✅ | — |
| **Progressive disclosure** (간단 → 깊이) | Settings 10 sub + RepoSpecific 12 fields | 우수 ✅ | — |
| **Recognition over Recall** | aria-label 115 + tooltip + 차별점 catalog | 우수 ✅ | per-repo override "현재 활성" 명시 추가 |
| **Error prevention** | ConfirmDialog 파괴적 가드 / AI security gate 30s TTL | 우수 ✅ | per-repo account 변경 confirm |
| **Flexibility & Efficiency** | CommandPalette + 57 shortcut + custom theme | 우수 ✅ | Keybindings custom 도입 (GK8) |
| **Help & Documentation** | HelpModal `?` + IdentityCard 5분 onboarding | 부분 | First-run wizard + deep tour |

**우수 11 / 부분 2 / 미적용 2** = 13/15. 보강 후보 4건.

---

## §2 v0.4 — 출시 직전 polish (Phase 1)

### ✅ 진행 결과 (2026-05-13 c81 자율 종료 — 7/8 완료, 87.5%)

commit `b69691a` (28 files, +1179 / -164, 6 신규 composable + 1 신규 component + 1 migration).

| # | 항목 | 상태 | 결과 / 비고 |
|---|---|---|---|
| 1 | per-repo forge account override | ✅ DONE | migration 0006 + Resolution chain 3단 + RepoSpecificForm dropdown |
| 2 | First-run 3-screen wizard | ✅ DONE | FirstRunWizard.vue + useFirstRunWizard + useOnboardingDetect 7s trigger (Q1 옵션 c) |
| 3 | AI quota / rate limit fallback | ✅ DONE | QUOTA_PATTERNS 7 regex + 60s cooldown + confirmAiSend 차단 |
| 4 | WCAG 2.2 Focus + Target + Drag | ✅ DONE | scroll-margin-top 4rem + HANDLE_WIDTH 12→24 + ArrowLeft/Right (c55 P2-2 통과) |
| 5a | god comp wave A | ✅ DONE | GitKrakenToolbar 172→149 + RemoteManageModal 168→72 (-57%) |
| 6 | Editor 외부 통합 (GK7) | ✅ DONE | useExternalEditor URI scheme 7 launcher + SettingsEditor dropdown |
| 7 | Linear / Jira PR | ⏸ **v0.5+ 미룸** | 외부 API key 검증 세션 내 불가 — placeholder UI 만 가능 |
| 8 | Doherty 400ms 진척 | ✅ DONE | stage 'doherty' + DOHERTY_THRESHOLD_MS 400 export + tick 100ms |

vitest 892 PASS / cargo 225 PASS / typecheck 0 / i18n ko·en 1250 → 1297 (+47) 대칭.

### 범위 (8 항목)

| # | 항목 | 축 | 사이즈 | 의존성 | 회귀 위험 |
|---|---|---|---|---|---|
| 1 | **per-repo forge account override** (`repos.forge_account_id` + UI) | 1+3 | M | none | LOW (신규 컬럼, fallback chain) |
| 2 | **First-run wizard (3-screen welcome)** | 1+4 | M | useOnboardingDetect 정책 충돌 (Codex Q5) | MEDIUM |
| 3 | **AI quota / rate limit fallback** | 1 | S | useAiCli error path | LOW |
| 4 | **WCAG 2.2 Focus Appearance + Target Size + Drag** | 1+4 | M (3 sub) | none | LOW |
| 5 | **잠복 god comp wave A** (CommitGraph 197 + GitKrakenToolbar 172 + RemoteManageModal 168) | 1 | M | Pattern 9 family | LOW |
| 6 | **GK7 Editor 외부 통합** (VSCode / Sublime / IntelliJ launcher) | 2 | M | Tauri shell.open | LOW |
| 7 | **GK5 부분 — Linear / Jira PR placeholder → 실제 통합** | 2 | M | API key (사용자별 PAT) | MEDIUM |
| 8 | **Doherty 400ms 진척 banner 1단계** (status 갱신 / branch list 갱신만) | 1+4 | S | useLongRunningProgress 확장 | LOW |

### 핵심 결정

1. **First-run wizard vs 현 onboarding 정책 충돌** (Codex Q5):
   - 현재 `useOnboardingDetect` 의도적 "modal 자동 open 안 함" (friction 최소)
   - 3-screen wizard 도입 시 modal 강제 표시 = 정책 변경
   - **권장**: 옵션 — 사용자가 toast click 시에만 wizard 열림 (modal 자동 X)
   - 또는 사용자 결정 (CLAUDE.md § User Decision Triage Protocol)

2. **Per-repo forge account UI 위치**:
   - RepoSpecificForm 안 (Repository Settings 내부)
   - vs 별도 "Repo Identity" 영역 (Recognition over Recall 강화)
   - **권장**: RepoSpecificForm 안 + 상단에 "현재 활성 Profile / Repo override" 명시 banner

### v0.4 종료 후 점수 목표

- GitKraken 대체 가능성 9.3 → **9.5** (per-repo + first-run + Editor 통합 +3 효과)
- a11y 9 → **9.5** (WCAG 2.2 도달)
- god comp ≥150 9건 → 6건

### ✅ v0.4 c81 종료 시점 실 점수 (2026-05-13)

- GitKraken 대체 가능성 9.3 → **~9.45** (Linear/Jira 미적용으로 9.5 미달 -0.05)
- a11y 9 → **9.5** ✅ (WCAG 2.2 SC 2.4.11 + 2.5.8 도달)
- god comp ≥150 9건 → **7건** (GitKrakenToolbar 149 + RemoteManageModal 72 추출, 2 항목 감소)
- i18n ko·en 1250 → **1297** (+47 keys: repoIdentity 8 + ai.cooldown 3 + settings.editor.external 10 + wizard 26)
- 신규 composable 6 — useActiveRepoBreadcrumb / useExternalEditor / useFirstRunWizard / useRemoteMutations + useAiCli·useLongRunningProgress 확장

---

## §3 v0.5 — 확장 (Phase 2)

### 범위 (6 항목)

| # | 항목 | 축 | 사이즈 | 의존성 | 회귀 위험 |
|---|---|---|---|---|---|
| 9 | **SSH key per-repo override** (GK10) | 2+3 | M | git config core.sshCommand + UI | LOW |
| 10 | **user.email per-repo override** | 3 | S | RepoSpecificForm 확장 | LOW |
| 11 | **CommitSearchModal 통합 검색** (file content + branch + SHA) | 1 | M | Tauri IPC 신규 + ripgrep wrapper | MEDIUM |
| 12 | **CommitSearchModal BaseModal 마이그** | 1 | XS | a11y 일관 | LOW |
| 13 | **Component-level error fallback** (`<ErrorBoundary>`) | 1 | M | onErrorCaptured + global handler 보완 | LOW |
| 14 | **Doherty 400ms 진척 banner 확장** | 1+4 | S | A4-21 후속 | LOW |
| 15 | **GK8 Keybindings custom** | 2 | M | useShortcuts JSON config + 충돌 검출 | MEDIUM |
| 16 | **잠복 god comp wave B** (StatusBar 167 + FullscreenDiffView 165 + StatusPanel 163) | 1 | M | Pattern 9 family | LOW |

### 핵심 결정

1. **SSH key per-repo 방식** (Codex Q1):
   - `git config core.sshCommand "ssh -i ~/.ssh/work_id_rsa"` 패턴 (git 표준)
   - 또는 Tauri 측 ssh-agent forward (복잡)
   - **권장**: git config 표준 (Tower 와 동등)

2. **Keybindings custom JSON config**:
   - `~/.config/git-fried/keybindings.json` 또는 SQLite table
   - 충돌 검출 — 같은 shortcut 에 2+ 액션 매핑 시 경고
   - **권장**: SQLite table (다른 설정과 동일 backend)

### v0.5 종료 후 점수 목표

- GitKraken 대체 가능성 9.5 → **9.7**
- Search 7 → **9** (file content 통합)
- god comp ≥150 6건 → 3건

---

## §4 v0.6 — A11y deep (Phase 3)

### 범위 (5 항목)

| # | 항목 | 축 | 사이즈 | 의존성 | 회귀 위험 |
|---|---|---|---|---|---|
| 17 | **NVDA 실 SR 테스트 + axe-core 통합** | 1+4 | L | 인간 테스터 + axe-core npm | LOW |
| 18 | **forced-colors (Windows High Contrast)** | 1+4 | S | main.css `@media (forced-colors: active)` | LOW |
| 19 | **aria-live regions 확장** (Toast 통합) | 1 | S | useToast 변경 | LOW |
| 20 | **CJK fallback** (Noto Sans JP/SC/TC) | 1 | XS | main.css font-family 확장 | LOW |
| 21 | **잠복 god comp wave C** (PrPanel 159 + ReflogModal 158 + CloneRepoModal 157) | 1 | M | Pattern 9 family | LOW |
| 22 | **shortcut 충돌 검출** | 1+4 | M | useShortcuts 확장 | LOW |
| 23 | **bench/baseline.json 실 측정** | 1 | S | 사용자 환경 (외부 BENCH_REPO) | LOW |

### v0.6 종료 후 점수 목표

- a11y 9.5 → **10** (NVDA 실 통과 + forced-colors)
- GitKraken 대체 가능성 9.7 → **9.8**
- god comp ≥150 3건 → 0

---

## §5 v1.0 — Release (Phase 4)

### 범위 (4 항목 + 의도 배제 결정)

| # | 항목 | 결정 |
|---|---|---|
| 24 | **macOS / Linux 빌드** (plan/17 v1.3/v1.4) | 사용자 결정 — Tauri 의 강점 활용 |
| 25 | **OAuth (GitHub / Gitea)** (plan/17 v1.x) | 사용자 결정 — Cloud 의도 배제와 별개로 보안 강화 |
| 26 | **Telemetry opt-in** (Sentry / 등) | 사용자 결정 — privacy by default 정책 유지 vs error 수집 |
| 27 | **TipTap PR editor 활성화 + 검증** | plan/30 §11 Tier 2 #27 |

### 의도 배제 영역 (사용자 결정 후 별도 plan)

| # | 항목 | 사유 (현재 의도 배제) | UltraPlan 권장 |
|---|---|---|---|
| 28 | **GitKraken Cloud Account** | 단일 사용자 dogfood 정체성 | 유지 (배제) |
| 29 | **Cloud Workspace sync** | (동일) | 유지 (배제) |
| 30 | **RTL 지원** | 사용자 분포 의존 | 사용자 의사 결정 |
| 31 | **Magit single-letter actions** | CommandPalette 정책 충돌 | 사용자 의사 결정 |

### v1.0 종료 후 점수 목표

- GitKraken 대체 가능성 9.8 → **9.95 (사실상 1.0)**
- Cross-platform (Mac/Linux) — 새 사용자 군 도달
- Nielsen 10 → **95** (release 수준 polish)

---

## §6 Effort 매트릭스 (시간 라벨 금지)

| Phase | 총 effort | 항목 수 | 의존성 |
|---|---|---|---|
| v0.4 | M × 5 + S × 3 = **MM+MM** | 8 | independent |
| v0.5 | M × 5 + S × 1 + XS × 1 = **MMM** | 7 | v0.4 후 |
| v0.6 | L × 1 + M × 2 + S × 2 + XS × 1 = **LL** | 7 | v0.5 후 |
| v1.0 | XL × 1 (macOS) + L × 1 (OAuth) + 기타 = **XL** | 4 | v0.6 후 |

**총 31 actionable + 4 사용자 결정 + 4 의도 배제 = 39 항목**.

---

## §7 위험 요소

### A. Codex Q5 — First-run wizard friction 정책 충돌

현재 `useOnboardingDetect` 가 "modal 자동 open 안 함" 의도적 선택. 3-screen welcome wizard 가 modal 강제 표시 = 정책 변경. **사용자 결정 필요**:
- 옵션 (a): 정책 유지 — toast 만, click 시 wizard 열림
- 옵션 (b): 정책 변경 — 첫 실행 시 자동 modal (Codex 권장)
- 옵션 (c): 절충 — 첫 실행 시 toast 7s 후 자동 modal (사용자 dismiss 가능)

### B. Per-repo forge account cascade (Codex Q2)

Profile 변경 시 repos override 가 reset 되어야 하는지 보존되어야 하는지. **권장: 보존** (Error prevention) — 사용자 명시 override 가 Profile 토글로 사라지면 위험. 다만 UI 에 "현재 활성 Profile: X / 본 repo override: Y" 명시 (Recognition over Recall).

### C. SSH key per-repo 방식 (Codex Q1)

`git config core.sshCommand` 표준 vs SSH agent forward 복잡. **권장: git config 표준** (Tower 와 동등, git 자체 메커니즘).

### D. Keybindings 충돌 검출

같은 shortcut 에 2+ 액션 매핑 시 경고. useShortcuts SoT 외 외부 customization 도입 = 큰 변경. v0.5 phase 까지 미룸 — v0.4 안에 처리 안 함.

### E. AI quota fallback UX

Claude / Codex CLI 가 quota 소진 시 사용자 명확 알림 부재. v0.4 A1-3 에 포함 — 단순 toast + 1분 cooldown.

### F. NVDA 실 SR 테스트

axe-core 자동화 + 인간 테스터 1회 통과 필요. v0.6 phase. effort L — 외부 사용자 (a11y 전문가) 협업 후보.

### G. Mac/Linux 빌드 (v1.0)

Tauri 의 cross-platform 강점 활용. 단 webkit2gtk 한글 IME 알려진 issue (Codex 미탐색 #10). plan/17 v1.3/v1.4 의존.

### H. 의도 배제 4건의 사용자 결정 시점

RTL / Magit single-letter / Cloud Account / Cloud Workspace — 사용자 결정 후 별도 plan. v1.0 release 전 결정 권고.

---

## §8 검증 + 회귀 보호

각 phase 종료 시 다음 검증 BLOCKING:

| 검증 | 기준 |
|---|---|
| cargo test | 225+ PASS, 회귀 0 |
| vitest run | 89+/891+ PASS, 회귀 0 |
| typecheck | 0 error |
| lefthook pre-push | 통과 |
| i18n-symmetry | ko·en leaf 일치 |
| god comp ≥200 | 0 유지 |
| god comp ≥150 | phase 별 목표 |
| Nielsen 점수 | plan/30 catalog 갱신 |
| WCAG 검증 | axe-core 자동 (v0.6+) |
| Playwright e2e | smoke 9건 + 신규 시나리오 PASS |

---

## §9 사용자 결정 매트릭스

다음 결정은 UltraPlan 진행 전 또는 phase 별 사용자 명시 필요:

| # | 결정 | 영향 phase | 권장 |
|---|---|---|---|
| Q1 | First-run wizard 정책 (friction 최소 vs 자동 modal) | v0.4 | 옵션 (c) 절충 |
| Q2 | Profile 변경 시 repos override cascade (보존 vs reset) | v0.4 | 보존 |
| Q3 | SSH per-repo 방식 (git config vs ssh-agent) | v0.5 | git config |
| Q4 | Keybindings JSON 위치 (SQLite vs ~/.config) | v0.5 | SQLite |
| Q5 | Linear / Jira PR 통합 도입 시점 (v0.4 vs v0.5) | v0.4 | v0.4 |
| Q6 | macOS / Linux 빌드 진행 | v1.0 | 진행 (Tauri 강점) |
| Q7 | OAuth 도입 | v1.0 | 진행 (보안 강화) |
| Q8 | Telemetry opt-in | v1.0 | 미진행 (privacy by default) |
| Q9 | RTL 지원 | v1.0 후 | 사용자 분포 의존 |
| Q10 | Magit single-letter | v1.0 후 | CommandPalette 정책 유지 |

---

## §10 다음 단계

본 UltraPlan 확정 시:

1. **사용자 §9 매트릭스 결정** (Q1~Q10 응답)
2. **v0.4 sprint 분할** — `/plan v0.4-per-repo-identity` / `/plan v0.4-first-run-wizard` 등
3. **Phase 별 점수 갱신** — plan/30 catalog 와 동일 형식 (Nielsen / a11y / 반응형 / i18n / 차별점 / 대체 가능성)
4. **본 UltraPlan 자체 갱신** — 진행 결과 반영 (v0.4 종료 후 §2 status 변경)

---

## §11 Codex 의 의문 / 추가 검증 (1차 합의)

Codex 백그라운드 task (`b8q4nj81c`, sandbox 권한 제한으로 31 lines partial) 가 직접 답변 못 한 항목은 본 plan 의 § 7 "위험 요소" 및 § 9 "사용자 결정 매트릭스" 에 통합. 추가 Codex 검증 후속:

- **Codex 2차 — UltraPlan v0.4 detail review** (별도 task) — phase 분할 합리성 + 의존성 그래프 + 누락 항목 cross-check
- **Codex 3차 — 외부 GUI 의 per-repo identity 정확 모델** (Tower 공식 docs cross-validate) — v0.5 phase 진입 전

---

## §12 참조

- [research.md](../../research.md) — 본 UltraPlan 의 입력 (13 미탐색 + 비교 매트릭스 13 차원 × 10 GUI)
- [plan/30-ux-comprehensive-c55-batch.md](30-ux-comprehensive-c55-batch.md) — c58 baseline (808 LOC)
- [plan/05-roadmap-v0.1-v1.0.md](05-roadmap-v0.1-v1.0.md) — v0.x/v1.x 큰 roadmap (본 UltraPlan 의 super-set)
- [plan/17-v1.x-roadmap.md](17-v1.x-roadmap.md) — Mac/Linux/OAuth/Telemetry 의존
- [docs/analyze/2026-05-13-160000-codex-cross-verify.md](../analyze/2026-05-13-160000-codex-cross-verify.md) — Codex cross-verify 메타 학습
- ~/.claude/projects/d--01-Work-08-rf-git-fried/memory/MEMORY.md — sprint catalog 인덱스 (c80+ 종료 시점)
