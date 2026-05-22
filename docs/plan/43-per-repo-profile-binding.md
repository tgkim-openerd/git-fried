# 43. Per-Repo Profile Binding — identity + credential 레포별 프로필

> 선행: [02 §3 Profiles](02-user-git-patterns.md) · [42 Repo-Specific Settings](42-repo-specific-settings-gap-impl.md)
> 트리거: 사용자 듀얼 포지(회사/개인 + Gitea/GitHub) 에서 레포마다 다른 git 신원·push 계정이 필요.
> 실증: 2026-05-22 `~/.gitconfig` 수동 `includeIf` 구성 — 한 디렉토리(`08.rf/`) 안에 TaeGyumKim / RoastFried 프로필이 섞여 있어 폴더 기반 분기 불가가 확인됨.

## 1. 현재 상태 (이미 있는 것 / 없는 것)

| 구성요소 | 위치 | 상태 |
|---|---|---|
| Profile 모델 (name/email/signingKey/sshKey/forgeAccount/isActive) | `profiles.rs` + `ProfilesSection.vue` | ⚠️ 부분 — Rust 모델 완비, 단 ProfilesSection 폼에 forge-account selector 미렌더 |
| Profile activate → `git config --global` 일괄 적용 | `profiles.rs::activate` | ✅ — 단 name/email/signingkey 만 기입 (sshKey·forgeAccount 는 git config 미반영) |
| 레포별 identity override 수동 폼 (`user.name/email/signingkey`) | `config_local.rs` + `RepoSpecificForm.vue` | ✅ (수동 입력) |
| 레포별 forge account override | migration `0006` | ✅ |
| 레포별 SSH key override | migration `0007` | ⚠️ DB/Rust only — `api/git.ts` IPC setter 미연결 |
| **레포 ↔ 프로필 바인딩** (레포에 프로필을 지정) | — | ❌ |
| **push 자격 증명(credential) 프로필 라우팅** | — | ❌ (`default_forge_account_id` 는 forge **API** 전용, `git push` 인증 아님) |

핵심 공백: 프로필은 "전역 1개 수동 토글" 뿐. 레포별 신원은 `RepoSpecificForm` 에서 **필드를 손으로 채워야** 한다. "이 레포는 X 프로필" 이라는 1급 개념이 없다.

## 1.5 벤치마킹 — 경쟁 git GUI 의 프로필 처리

| 도구 | 프로필 개념 | per-repo 수동 override | per-repo **자동** 바인딩 | `includeIf` 존중 |
|------|------------|:---:|:---:|:---:|
| **GitKraken** (1차 대체 대상) | ✅ name/email/SSH/GPG/통합계정, 전역 `.gitconfig` sync | ❌ — repo-specific preferences 에 name/email **미포함** (공개 feature request #202050) | ❌ — command palette 수동 전환만 | 수동 전환만 |
| **Tower** | ✅ | ✅ preferences 의 per-repo account (가장 근접) | ❌ (수동) | ✅ |
| **Fork** | 일부 | per-remote SSH 키 선택 | ❌ | ✅ |
| **SourceTree** | 기본 author 설정 | ✅ Repo Settings → Advanced 의 per-repo name/email | ❌ (수동) | ✅ 존중 |
| **GitHub Desktop** | 단일계정 중심 | ✅ Repo Settings → Git Config (+email mismatch 경고) | ❌ | ❌ 무시 |
| **Sublime Merge** | ✗ | git config 직접 의존 | ❌ | △ 과거 미지원 보고(issue #30), 현행 불명 |
| git native | — | `.git/config --local` | `includeIf gitdir:`(2.13+) / `hasconfig:remote.url`(2.36+) | (네이티브) |

**시사점**:

1. **어떤 경쟁 GUI 도 per-repo *자동* 바인딩이 없다** — GitHub Desktop·SourceTree·Tower 는 수동 override 까지, GitKraken 은 그조차 없음. git-fried 는 §2 에서 **규칙 기반 계정 자동 매칭을 core 로 제공**(수동 바인딩 + 자동 매칭) — 자동 per-repo 바인딩을 갖는 첫 GUI. §7 의 "감지→제안" 은 그 위에 얹는 *후속 확장 레이어*(낮은 신뢰도 케이스의 ML/휴리스틱 제안)이지 core 자체가 아님 (iter4 R-6).
2. **GitKraken 은 per-repo name/email 수동 override 조차 없다** — 1차 대체 대상의 명확한 공백 (공개 feature request). git-fried 는 수동 폼(§1 기존 `RepoSpecificForm`)을 이미 갖췄고 + 프로필 바인딩까지 하면 두 단계 우위.
3. **git-fried 는 real `git` shell-out (`git_run`) 아키텍처** — config 해석을 git 본체가 하므로 `includeIf` 를 자동으로 올바르게 존중. GitHub Desktop(무시)·Sublime Merge(과거 미지원 보고)와 대비되는 구조적 강점. §2 native precedence 활용이 이에 기반.

### GitKraken 정밀 대조 (사용자 #4 — "모두 제공 불가능한가?")

| GitKraken 프로필 요소 | git-fried 대응 | 제공 가능? |
|---|---|---|
| author name / email | `profile.git_user_name/email` | ✅ 이미 있음 |
| SSH key | `profile.ssh_key_path` + §3 P3(2) | ✅ |
| GPG / signing key | `profile.signing_key` | ✅ 이미 있음 |
| 통합(forge) 계정 (PR/Issue용) | `profile.default_forge_account_id` + `forge_accounts` | ✅ 이미 있음 (단 forge **API** 라우팅 한정) |
| 전역 `.gitconfig` sync ("keep updated") | `profiles.rs::activate` (`--global` 기입) | ✅ 이미 있음 |
| 프로필 전환 (command palette) | 빠른 지정 버튼 **+ 계정 기반 자동 매칭(§2)** | ✅ 초과 |
| git **push** credential 라우팅 | §3 P3 신규 구현 (3a→3b) | ⚠️ 신규 — 기존 미보유, GitKraken 도 프로필 단위론 약함 |
| **per-repo 자동 바인딩** | 본 plan §2 | ✅ **GitKraken 미제공 — git-fried 우위** |
| 프로필별 app preferences / tab set | (git 신원 무관 UI 상태) | ⚠️ 본 plan 범위 밖 — 별도 기능, 신원/credential 과 무관 |

**결론** (Codex A1 반영): GitKraken 의 **git 신원 프로필 기능(name/email/SSH/GPG)은 전부 제공 가능** — 대부분 이미 구현. **push credential 프로필 라우팅은 GitKraken·git-fried 둘 다 기존엔 약함** — git-fried 가 §3 P3 로 신규 구현하면 오히려 앞선다 ("이미 parity" 아님 — 신규 구현 영역). UI preferences/tab set 만 범위 밖(신원과 무관). → "모두 제공 불가" 아님: **신원은 parity, credential 은 신규 구현으로 초과, 자동 바인딩은 GitKraken 미보유.**

## 1.6 리턴 (ROI) — 왜 할 가치가 있나

- **실증된 사용자 페인** — 사용자(tgkim) 본인이 3 프로필(TaeGyeomKim/RoastFried/Gitea) × 20+ 레포. 2026-05-22 세션에서 `~/.gitconfig` 에 수동 `includeIf` 를 직접 짰고, **`tgkim-openerd/git-fried` push 가 잘못된 gh 계정으로 거부**된 사고가 실제 발생. 가설이 아니라 측정된 수요.
- **경쟁 차별화** — GitKraken 미구현 + 공개 feature request 영역. "GitKraken 대체" 포지션을 실질 기능으로 뒷받침.
- **초기 ROI — 양호** — D1~D7 전부 확정(§5)으로 Phase 게이트 해제. P1(DB, 사이즈 **M** — `is_default` invariant + 스키마 확장 포함) + P2(identity, S)로 identity 라인을 먼저 닫고, P3(credential, M~L)는 후속. 작은 비용으로 "레포별 신원" 가치를 먼저 확보 — P3 대비 identity 라인의 초기 ROI 가 우수.
- **리턴 > 리스크** — §4 의 리스크는 모두 명시 게이트(D1~D7)·acceptance 로 관리 가능. 레포별 바인딩 키는 `--local` 전용이고, 글로벌 config 변형은 `is_default` 전파 1경로로만 한정 (§4 red flag 1 — "변형 없음" 이 아니라 "단일 통제 경로"). 미구현 시 음의 시나리오(잘못된 author 커밋 누적 + push 실패 반복)가 git-fried 의 핵심 가치 identity-core 와 정면 배치 — 안 하면 손해가 큼.

## 2. 목표 모델 (사용자 결정 반영, 2026-05-22)

**설계 원칙** (사용자 #1) — default 는 사용자가 손대지 않아도 동작하는 zero-config, 그 외 모든 필드·바인딩은 사용자가 직접 커스텀 가능. "쉬운 기본값 + 완전한 커스터마이즈" 양립.

- **공용(default) 프로필 1개 — zero-config 최종 fallback** — 레포에 매칭/지정이 없으면 항상 이 프로필. 첫 실행 시 현재 git 전역 설정(`user.name/email`)에서 자동 생성.
- **계정 기반 자동 매칭** (사용자 #2) — 레포를 등록하면 그 레포의 remote/forge 계정에 맞는 프로필을 자동 선택해 바인딩. 매번 수동 지정 불요. ('pre-fetch' = forge API 에서 Profile 을 가져오는 게 아니라 — Profile 은 사용자 생성 엔티티 — 자동 매칭이 쓸 `프로필 ↔ 연결된 forge 계정` 매핑을 메모리에 적재하는 것. F-12 정정.) **org 레포 한계** (iter2 #9) — org 소유 레포는 `forge_owner≠username` 이라 자동 매칭이 안 되지만, **공용 프로필 fallback 으로 "zero-config 동작" 은 유지** (매칭 실패 = 공용 프로필 자동 적용). 정확한 프로필은 1-click 제안/수동 지정 — zero-config 는 "모든 레포가 완벽 매칭" 이 아니라 "설정 안 해도 동작" 의 의미.
- **레포별 명시 지정이 자동 매칭을 override** — 자동 매칭이 틀렸거나 사용자가 다르게 원하면 UI 에서 직접 지정 (저장소 전용 설정 + 빠른 지정 버튼). 수동 지정은 **pin** 되어 이후 자동 매칭이 덮어쓰지 않음.
- **credential 라우팅 포함** — 신원(commit author) + push 인증 계정 둘 다 프로필이 결정.

### 우선순위 (해석 규칙)

`repos.profile_id` 단일 바인딩 컬럼이 "이 레포의 프로필" 을 가리킨다. 값의 출처는 2가지:

```
repos.profile_id 바인딩  ← ① 사용자 수동 지정(pin)  >  ② 계정 기반 자동 매칭
  └ NULL → 공용 프로필 (git config --global)
      └ git system config
```

- 바인딩된 프로필의 identity 는 `.git/config --local` 로 기입 → git native precedence 가 자동으로 local 우선. 커스텀 resolver 불필요.
- 자동 매칭은 `profile_id IS NULL AND profile_pinned = 0` 인 경우에만 채운다. `repos.profile_pinned` (D7 확정) 가 "수동 지정" 을 표시 — 자동 매칭이 수동 선택을 덮어쓰지 않음. `profile_id` 만으로는 "미매칭" 과 "수동으로 공용 선택" 을 구분 못 함.
- "공용 프로필" = `profiles.is_default = 1` 인 프로필 (D2 — `is_active` 와 별개 컬럼). **F-04 해소**: 레포 바인딩이 없을 때 fallback 은 `git config --global` 이고 그 값이 항상 `is_default` 프로필과 일치해야 한다 → `is_default` 설정/변경 시 즉시 그 프로필을 `git config --global` 에 기입(`activate` 경로 재사용). 전역 git config 기입 대상은 **오직 `is_default` 프로필** — 기존 `is_active`(임의 프로필을 전역에 쓰던 토글)의 전역-기입 역할은 `is_default` 로 일원화 (별도 프로필이 전역에 써지면 fallback 의미가 깨짐). `is_active` 컬럼은 UI 강조 용도로만 잔존 또는 `is_default` 와 동기.

## 3. Phase 분해

### P1 — DB: repo ↔ profile 바인딩 (Tier HIGH, 사이즈 M)

- 신규 migration `0009_repo_profile_binding.sql` (현재 최신 = `0008` — 0009 는 본 plan 산출물, iter3 B-9) — **0006/0007 과 동일하게 `repos`/`profiles` 에 컬럼 추가** (별도 테이블·`repo_path` PK 금지 — R2-F1: 경로 변경/삭제 시 stale binding):
  ```sql
  ALTER TABLE repos    ADD COLUMN profile_id INTEGER
    REFERENCES profiles(id) ON DELETE SET NULL;
  ALTER TABLE repos    ADD COLUMN profile_pinned INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN is_default     INTEGER NOT NULL DEFAULT 0;
  -- 기존 is_active=1 → is_default=1 이행. multi-active 손상 상태 방어 (iter5 F1):
  -- MIN(rowid) 1개만 승격(collapse) → 아래 unique index 생성이 실패하지 않도록.
  -- is_active row 가 0개면 subquery 가 NULL → 아무 row 도 승격 안 됨 (backfill 이 처리).
  UPDATE profiles SET is_default = 1
    WHERE rowid = (SELECT MIN(rowid) FROM profiles WHERE is_active = 1);
  -- is_default 최대 1개 보장 (cold-read F5/F14) — 위 collapse 후라 안전
  CREATE UNIQUE INDEX profiles_is_default_one ON profiles(is_default) WHERE is_default = 1;
  -- profile_id JOIN 용 인덱스 (0006 의 forge_account_id 인덱스와 일관, iter3 B-6)
  CREATE INDEX idx_repos_profile_id ON repos(profile_id);
  ```
  - `profile_id` — 바인딩된 프로필. 프로필 삭제 시 `SET NULL` → 공용 fallback (레포 row 보존). **단** `ON DELETE SET NULL` 은 `profile_id` 만 NULL 로 바꿈 — 삭제 핸들러(또는 SQLite trigger)가 그 프로필에 바인딩됐던 레포의 `profile_pinned` 도 `0` 으로 리셋해야 함 (iter3 B-2: 안 하면 '수동 공용 선택'(`pinned=1`)과 '삭제로 풀린 바인딩' 을 구별 못 해 auto-matching 이 영구 억제됨).
  - `profile_pinned` (**D7 확정**) — `1` = 사용자 수동 지정, 자동 매칭이 덮어쓰지 않음. `0` = 자동 매칭 대상.
  - `profiles.is_default` (**D2 확정**) — 공용(default) 프로필 표식. `is_active`("전역 활성"=`activate` 가 global 기입)와 의미 분리.
- **`is_default` invariant** (cold-read F5/F14) — partial unique index 로 "최대 1개". **backfill — 단일 경로** (iter2 #5): `Db::open` 의 `sqlx::migrate!` 직후 Rust 후처리 한 곳에서만 생성 — default 가 0개면 현재 git 전역 설정에서 공용 프로필 1개 생성·`is_default=1`. 첫 실행 wizard 는 *생성하지 않고* 이미 생성된 기본 프로필을 검토·수정만 (wizard+후처리 동시 생성으로 인한 중복 차단). default 프로필 삭제 = **거부**(F-06): `delete_profile` IPC 가 `is_default=1` 이면 `AppError::validation` 반환 — 사용자는 다른 프로필을 먼저 `is_default` 로 지정 후 삭제.
- **`activate`/`is_active` 통합** (iter2 #2 / R-01) — F-04 의 "전역 write 는 `is_default` 만" 을 코드에 반영: 기존 `activate_profile` IPC + `profiles::activate` 의 전역 config write 경로를 `is_default` 설정과 일원화. `activate_profile(id)` = 그 프로필을 `is_default=1` set + `git config --global` 기입(단일 동작). 별도 `is_active` 기반 전역 write 폐기 — `is_active` 컬럼 제거 또는 `is_default` 와 동기화. P1 migration 에서 현재 `is_active=1` row 를 `is_default=1` 로 이행 (전역 config 2중 write 위험 제거).
- **스키마 확장 범위** (cold-read F10) — DB 컬럼뿐 아니라: Rust `Repo` struct(`db.rs`)·TS `Repo` type(`types/git.ts`)에 `profileId`/`profilePinned`, `Profile`(`profiles.rs`)·TS profile 타입에 `isDefault` 추가, `devMock.ts` mock 갱신, Vue query invalidation 까지 P1 범위.
- **"공용 선택" vs "바인딩 해제" 상태 계약** (cold-read F6) — 둘 다 `profile_id=NULL` 이되: 사용자가 명시적으로 공용 선택 → `profile_pinned=1`(자동 매칭 재개 안 함), 단순 해제 → `profile_pinned=0`(자동 매칭 재개). `storage/db.rs` 의 get/set/clear helper API 계약으로 고정 (0006/0007 helper 와 대칭).

### P2 — identity 적용 (Tier HIGH, 사이즈 S)

- 레포에 프로필 지정 시: 그 프로필의 `git_user_name / git_user_email / signing_key` 를 `config_local.rs::set_one` 으로 `.git/config --local` 에 기입 (`user.name / user.email / user.signingkey`). identity 기입 *자체*는 기존 `set_one` 재사용. **단 무결성 검사 5종(특히 ③ GPG/SSH 키 존재 확인·① all-or-nothing·⑤ rollback)은 신규 로직** — `config_local` 너머 신규 검증 모듈 필요 (cold-read F2 — "신규 git 로직 0" 은 부정확, 정정).
- 지정 해제(바인딩 해제) 시: 프로필이 SET 했던 키만 `--unset` (공용 프로필 = global 로 fallback). **provenance** (F-05 + iter4 R-3) — 프로필 적용 시 `.git/config` 의 git-fried 전용 섹션에 기입한 **키 + 기입한 값** 을 함께 기록(`git-fried.profileManaged.<key> = <적용값>`). 바인딩 해제·전환 시 unset 전에 **현재 `.git/config` 값 == git-fried 가 기입했던 값** 인지 비교 — 다르면(사용자가 그 키를 손으로 수정) unset 하지 않고 보존. 값 비교 없는 목록-기반 unset 은 사용자 수정을 덮어쓰므로 금지.
- **부분 프로필 정책** (Codex F8, D5): 프로필의 optional 필드(예: `signing_key`)가 비어 있으면 그 키를 레포에서 `--unset` 하지 **않는다** — 적용 = 비어있지 않은 필드만 SET (기존 local 값 보존). 빈 필드로 인한 의도치 않은 unset 금지. `--unset` 은 명시적 '바인딩 해제' 액션에서만.
- **프로필 전환 시 잔재 정리** (iter3 B-1) — 프로필 A→B 전환 시, A 가 기록한 `profileManagedKeys` 중 B 가 SET 하지 않는 키는 unset (이전 프로필 잔재 제거). 전환 = `(A managed keys − B managed keys)` unset + B SET. 위 '빈 필드 보존' 은 *사용자가 손으로 박은* 값 보존이지 *이전 프로필 잔재* 보존이 아님 — `profileManagedKeys` provenance 로 구분.
- 트리거 시점: 명시 지정 액션 시 즉시 적용. **예외** (iter2 #4) — P2.5 자동 매칭이 conflict-free 로 판정한 경우는 명시 액션 없이 자동 적용 (충돌 시 deferred — P2.5 참조). 그 외 레포 열 때 무조건 재기입은 X — 사용자가 `.git/config` 를 직접 만졌을 때 silent overwrite 방지.
- **무결성 검사** (D3 결정 — 즉시 기입하되 기입 직전·직후 검사, Codex A4 반영):
  - ① **값 일괄 검증** — 적용할 모든 필드(`user.name/email/signingkey`)를 *기입 전 한 번에* 검증(`reject_dash_prefix` 등). 일부만 통과해도 부분 적용 금지 — all-or-nothing.
  - ② **충돌 diff** — `read_snapshot` 으로 현재 값을 읽어, 손으로 박힌 값이 프로필 값과 다르면 `현재값 → 프로필값` diff 고지 후 확인 (overwrite 안전성 — 최초 바인딩 선행 조건).
  - ③ **서명 정합** — `commit.gpgsign=true` 인데 서명 키가 없으면 경고: `gpg.format=openpgp` 면 프로필 `signing_key` 의 GPG secret key, `ssh` 면 SSH 서명 키 존재를 각각 확인. 프로필에 설정된 `signing_key` 자체를 검사 (email 추정 아님).
  - ④ **기입 후 검증** — 기입 직후 `read_snapshot` 재호출로 실제 반영 확인 (silent 실패 차단).
  - ⑤ **rollback** (F-03) — `set_one` 순차 기입 중 일부 성공 후 후속 기입·검증(④) 실패 시, 적용 전 `read_snapshot` 스냅샷으로 **복원**(이미 쓴 키 되돌리기). 값 일괄 검증(①)이 1차 방어지만 디스크/권한 등 기입 단계 실패에 대비 — all-or-nothing 의 실질 보장은 이 rollback 경로.
  - 하나라도 실패 시 즉시 기입 보류(또는 rollback) + 사용자 확인.
- **dry-run / apply 2-step IPC** (cold-read F9) — 즉시 기입이되 무결성 검사 결과를 사용자가 보고 확인하므로 IPC 를 2단계로: ① `preview_profile_apply(repoId, profileId)` → 필드별 `{현재값, 신규값, 충돌여부, 검사결과}` DTO 반환 ② `apply_profile_binding(repoId, profileId)` → 실제 기입(all-or-nothing). 기존 `read_repo_config`/`apply_repo_config` 형태를 답습하되 **preview DTO 를 신규 정의** — P2 착수 전 이 계약 고정. `repoId`/`profileId` 는 기존 IPC 와 일관되게 **numeric id** (`remote_commands.rs`/`api/git.ts` 의 `repoId: number` 패턴 — path string 아님, iter3 B-8).
- **NULL 상태 2종 IPC 분리** (iter9 9-1 + iter10-1) — `apply_profile_binding` 은 특정 프로필 바인딩 전용. `profile_id=NULL` 의 두 의미(§5 D7)는 numeric `profileId` 단일 시그니처로 표현 불가 → **별도 엔드포인트**: `select_default_profile(repoId)` → `profile_id=NULL, profile_pinned=1`(명시적 공용 선택, 자동 매칭 재개 안 함) / `clear_profile_binding(repoId)` → `profile_id=NULL, profile_pinned=0`(바인딩 해제, 자동 매칭 재개). P4 의 picker "공용" 선택 = 전자, "[바인딩 해제]" 버튼 = 후자. **두 엔드포인트 모두 이전 바인딩의 profile-managed local 키를 정리**(provenance 값 비교 후 unset — §3 P2 규칙, 사용자 수정 키는 보존) — 안 그러면 stale `user.*` local 키가 공용(global) 프로필 의도를 override (iter10-1).
- **IPC 구현 체크리스트** (기존 패턴 `remote_commands.rs` / `api/git.ts` 답습): Rust DB helper → Tauri command(`#[instrument]` tracing 부착) → `api/git.ts` wrapper → **`devMock.ts` 에 대응 mock 추가** (Tauri 부재 환경·e2e 깨짐 방지) → Vue query invalidation → 신규 IPC 타입은 `#[serde(rename_all = "camelCase")]` 적용 (camelCase 불일치 회귀 차단).

### P2.5 — 계정 기반 자동 매칭 (Tier HIGH, 사이즈 M — backend/domain)

Codex A3(FLAW): 자동 매칭은 durable repo 상태(`repos.profile_id`)를 쓰고 identity 적용을 유발하므로 **P4 UI 가 아닌 backend/domain 단계**. P4 는 결과 표시·override 만.

- **트리거 지점** (cold-read F1 + F-01 / iter2 #1) — 자동 매칭을 **단일 공유 도메인 함수 `register_repo`** 에 둔다: `add_repo` IPC 와 `clone_repo` 자동 등록(`repo_commands.rs` — 둘 다 `DbExt::add_repo` 호출)이 이 한 함수를 호출하도록 funnel (두 IPC 호출처가 개별 hook 하지 않음 — 단일 진입점 강제). frontend store `setActiveRepo` 아님. 실행 조건 = `profile_id IS NULL AND profile_pinned = 0`.
- **backfill 실행 지점** (F-07) — 기존 레포는 `Db::open` 의 `sqlx::migrate!` 직후 **Rust 후처리 단계**에서 1회 평가 (`sqlx::migrate!` 는 SQL 전용이라 Rust hook 필요). 대상 = `profile_id IS NULL AND profile_pinned=0` — 자동 매칭이 NULL 만 채우므로 재실행해도 idempotent (별도 마커 불요), pre-fetch 미완 시 skip → 다음 실행 재시도.
- **매칭 키** (cold-read F8) — 레포 `repos.forge_owner` + remote host vs. 프로필의 forge 계정(`forge_accounts.base_url` + `username`). remote URL 정규화(대소문자 / `.git` suffix / SSH↔HTTPS) 선행.
- **base_url 정규화** (F-11) — `forge_accounts.base_url` 은 API 호스트 형식(`https://api.github.com`)일 수 있고 git remote 는 `github.com` 이라 **API-host→git-host 매핑** 필요 (GitHub `api.github.com`→`github.com`, Gitea 동일 호스트). 매칭 *시점* 정규화 — 기존 row 의 base_url 저장값은 건드리지 않음(마이그레이션 아님).
- **매칭 규칙 (신뢰도 임계값)** — **host + owner 정확 일치만 자동 바인딩**. `forge_owner` 가 org 라 계정 `username` 과 다르면(정확 일치 실패) **자동 안 함** → 공용 유지 + 토스트 1-click 제안. (org 멤버십 기반 매칭은 비범위 — 향후 per-profile `owner allowlist` 로 확장.) host 만 일치·다중 후보도 동일하게 제안 처리.
- **pre-fetch 정의** (F-12) — forge API 에서 Profile 을 가져오는 게 아니다. pre-fetch = 자동 매칭이 쓸 `(profile ↔ profile.default_forge_account_id → forge_accounts host/username)` 매핑을 메모리에 적재. forge 계정 연결/변경 시 갱신. 적재 실패·미완료 시 자동 매칭 skip → 공용 fallback (에러 아님).
- **stale 처리** (iter3 B-5 + iter4 R-5) — 다음 시 `profile_pinned=0` auto-bound 레포 재평가: (a) forge 계정 삭제 (b) 프로필의 `default_forge_account_id` 변경 (c) forge 계정 host/username 변경. **주의** — forge 계정 upsert conflict key 는 `(forge_kind, base_url, username)` 이라 host/username 변경 = 사실상 **신규 row + old row 고아화**. 따라서 host/username 변경은 'old row 삭제' 와 동일 경로로 처리 — old row 에 매칭됐던 `pinned=0` 레포를 재평가(재매칭 실패 시 공용 fallback). 트리거 = 프로필 update / forge 계정 upsert·삭제 IPC 후처리. `pinned=1` 은 항상 유지.
- **forge 계정 삭제 FK + 순서 주의** (iter6 F6-1 + iter7 F7-1 + iter8 F8-2) — `forge_accounts(id)` 를 참조하는 FK 가 **둘**: `profiles.default_forge_account_id` 와 `repos.forge_account_id`(0006). 둘 다 `ON DELETE SET NULL` 이 없어(RESTRICT 기본) 참조 중인 forge 계정을 그냥 `DELETE` 하면 **FK violation 으로 삭제 차단**. 삭제 핸들러의 **정확한 순서**: ① `UPDATE profiles SET default_forge_account_id=NULL WHERE default_forge_account_id=?` ② `UPDATE repos SET forge_account_id=NULL WHERE forge_account_id=?` ③ `DELETE FROM forge_accounts` — ①②③ 는 가능하면 단일 transaction ④ **DB 삭제 성공 후** keychain token 삭제. 현재 코드는 keychain 을 DB 보다 *먼저* 지워 DB delete 실패 시 token 만 유실되므로 **순서 역전 필수**. (app-level — SQLite FK 재생성은 table recreate 필요해 비용 큼.) 그 후 위 stale 재평가.
- **자동 매칭과 confirm 의 관계** (F-02) — 자동 매칭은 `profile_id` 바인딩만 set. identity `.git/config` 기입은 무결성 검사 ②(충돌 diff)가 **충돌 없음**이면 즉시 자동 적용, **충돌 있음**이면 기입 보류 + '프로필 적용 대기' 배지 → 사용자가 P2 의 preview/confirm 으로 확정. 즉 backend 자동 매칭은 confirm 불요 케이스만 즉시 적용, confirm 필요 케이스는 deferred — P2 의 preview/confirm 요구와 모순 없음.

### P3 — credential / SSH 라우팅 (Tier HIGH, 사이즈 M~L)

현재 `git/sync.rs` 의 네트워크 op(**fetch / fetch_all / pull / push** — F-09 + iter3 B-4)는 전부 `GitRunOpts::default()` 로 실행 — credential·SSH 라우팅이 **전무**(Codex F3). 다음 넷을 모든 네트워크 op 에 신규 wiring. **`bulk_fetch` 경로 포함** (iter8 F8-1) — `bulk_fetch` IPC(`sync_commands.rs` → `bulk.rs` → `git_sync::fetch_all`)도 같은 routing 대상. SSH/credential 이 repo DB context 를 받도록 `fetch_all` 시그니처가 바뀌면 `bulk.rs` caller 까지 전파해야 함 (routing 누락·compile break 방지):

**(1) HTTPS credential**
- **3a (interim, 사이즈 M)** — `credential.<url>.username` 을 `.git/config --local` 에 기입. git 문법은 host 가 아니라 **URL 컨텍스트** — `credential.https://github.com.username` (Codex F4). 외부 helper(gh multi-account / store)가 username 으로 토큰 해석.
- **3b (target, 사이즈 L)** — git-fried 가 자체 git credential helper 로 동작 → 레포 프로필 → `forge_accounts` PAT 직접 서빙. gh 의존 제거, identity-core 정합. **D4 확정**: git-fried helper 를 `credential.helper` chain **선두**에 두되, 바인딩 없는 레포엔 빈 응답 → 시스템 helper(Windows Credential Manager)로 자연 fallback. git-fried 는 바인딩 레포만 책임 — 기존 자격 증명 불파손.

**(2) SSH** — SSH 키를 `git/sync.rs` 의 **fetch / fetch_all / pull / push** 호출 전부에 `GIT_SSH_COMMAND` 로 주입 (iter6 F6-2 — `fetch_all` 누락 금지, 모든 네트워크 op 원칙). `runner.rs` 에 GIT_SSH_COMMAND 경로는 있으나 **sync.rs 가 안 씀 → 신규 wiring 필요**(Codex F3). **precedence** (F-08) — `repos.ssh_key_path`(per-repo override, 0007) > 바인딩 프로필의 `ssh_key_path` > 없음. per-repo override 가 최우선. `validate_ssh_key_path`(`profiles.rs`) 통과 필수. **부수 작업** (F-13) — 기존 `repos.ssh_key_path` override 의 IPC setter 미연결(§1)도 P3 범위에서 해소: `set_repo_ssh_key_path` Tauri command 등록(`lib.rs`) + `api/git.ts` wrapper + `devMock.ts` + `RepoSpecificForm` UI 필드.

**(3) 동적 키 전달** (Codex F6) — `credential.<url>` 의 `<url>` 은 레포 remote 호스트마다 달라 `RepoConfigSnapshot` 의 static 필드로 표현 불가. credential 키는 **별도 IPC**(`set_repo_credential_identity(repo, url, username)`)로 전달 → `KEYS` allowlist 확장 불요. **URL 선택 규칙** (F-10 + iter3 B-3/B-4 + iter4 R-2) — `<url>` = 각 네트워크 op 가 **실제로 향하는 remote** 의 URL. push 는 push remote 의 `pushUrl`, fetch/pull 은 그 remote 의 `fetchUrl` (RemoteInfo 가 분리 보유). **remote 미지정 시 origin 고정 가정 금지** — git 의 실제 해석을 따른다: fetch/pull = `branch.<cur>.remote` → 없으면 `origin`; push = `branch.<cur>.pushRemote` → `remote.pushDefault` → `branch.<cur>.remote` → `origin`. credential URL 은 git 이 실제 선택한 remote 의 URL 이어야 함 (upstream 설정 있는 레포에서 엉뚱한 remote 에 credential 적용 방지). **`fetch_all`** 은 다중 remote 대상이라 단일 키 불가 → 각 remote 의 `credential.<url>.username` 이 per-repo local config 에 이미 기입돼 있으면 `git fetch --all` 이 자동 해석 (fetch_all 자체는 추가 wiring 불요 — per-remote credential local config 가 선결 조건). **검증 규칙** (iter2 #6) — `set_repo_credential_identity` 는 `KEYS` allowlist 를 우회하므로 IPC 자체에서 검증: `<url>` 은 `https://` scheme + host allowlist 만 허용, `username` 은 `reject_dash_prefix` + 제어문자 차단. 키는 `credential.<검증된 url>.username` 형태로만 조립 (자유 키 입력 금지).

**(4) forge API 계정** (R2-F2 + iter4 R-1) — 현재 `forge_client_for_repo` 는 bound profile 을 안 봄. 레포가 프로필에 바인딩되면 forge API 계정 해석 우선순위를 `repo forge_account_override(0006) → bound profile.default_forge_account_id → is_default 프로필.default_forge_account_id → kind match` 로 확장. **`active` 폐기** — F-04/iter2#2 로 `is_active` 전역 역할이 `is_default` 로 일원화됐으므로 resolver 의 fallback 도 `active` 가 아니라 `is_default` 프로필 (`profile_id=NULL` repo 의 fallback 이 §2 우선순위와 단일 경로로 일치). 현재 resolver 는 `per-repo override → active Profile default → kind match`(`forge_commands.rs`) 라, bound profile 분기 + `active`→`is_default` 교체는 한 줄 변경이 아니라 `repos.profile_id` JOIN + `profiles` 조회 query 신규 설계 필요 (cold-read F13, 사이즈 재평가 요인).

**same-host 다중계정** (D6 확정) — github.com 2계정처럼 호스트가 같으면 username 힌트만으론 credential 캐시 충돌. `credential.useHttpPath = true`(전체 URL 단위 캐싱)를 **영향받는 host/repo 에 scoped 적용** (전역 blanket 금지 — 불필요한 재프롬프트 회피). **적용 방식** (iter2 #7) — `useHttpPath` 는 `.git/config --local` 에 기입(해당 레포 한정). '영향받는' 판별 = `forge_accounts` 에 같은 host 의 계정이 2개 이상인 레포. 바인딩 해제 시 함께 unset. host 비교는 §3 P2.5 의 **API-host→git-host 정규화를 재사용** (raw `base_url` 비교 금지 — `api.github.com` 과 `github.com` 을 동일 host 로 카운트, iter3 B-7).

**routing 범위 경계** (iter9 9-2) — `sync.rs` 의 fetch/fetch_all/pull/push 외에 `lfs_fetch`·`lfs_pull`·`init_submodules`·`update_submodules --remote` 도 `GitRunOpts::default()` 사용 + 네트워크 op 라 같은 remote 인증 영향권. P3 는 이들에도 **동일 SSH/credential routing helper 를 재사용** — acceptance 에 포함. (의도적 비범위로 둘 경우 명시 사유 필요 — 현 plan 은 재사용 채택.)

**보안 — PAT 평문 절대 금지** (Codex 4-3): 3a 는 `credential.<url>.username` **만** — password/PAT 토큰은 `.git/config` 에 절대 금지 (평문, 레포 동봉). 토큰은 keyring(`auth.rs`)에만. 3b helper 는 PAT 를 stdout 으로 넘기므로 `secret_mask` 를 helper 경로까지 확장 (현재 `error.rs`/`panic_hook.rs` 마스킹만 — helper stdout 마스킹 별도 설계).

→ **D1 확정**: 3a + SSH wiring 으로 동작 확보 → 3b 후속. (`sync.rs` 에 credential 라우팅이 0 이므로 3a 가 PAT 저장 없이 즉시 가치. 3b 직행은 helper 프로토콜·마스킹·패키징 비용을 선부담하고 identity 가치를 지연시킴.)

### P4 — UI (Tier MEDIUM, 사이즈 M)

- **저장소 전용 설정**에 "프로필" 섹션 추가 — `RepoSpecificForm.vue` 상단에 프로필 picker (드롭다운: 공용 / 프로필 목록). 선택 시 P2/P3 적용.
- **빠른 지정** — 레포 탭/사이드바 우클릭 컨텍스트 메뉴 "프로필 지정 ▸".
- 현재 적용 프로필을 **status bar + `RepoSpecificForm` 헤더**에 배지로 표시 (공용/자동매칭/수동 구분). `IdentityCard.vue` 는 dogfood 메트릭 패널이라 용도가 달라 미사용 (F-15) — 필요 시 별도 경량 status 컴포넌트.
- **자동 매칭 결과 표시·override** — 자동 매칭 *로직*은 P2.5(backend/domain). P4 는 현재 바인딩(자동/수동/공용)을 배지로 표시하고, 사용자가 override(수동 지정 → `profile_pinned=1`)할 수 있게 함.
- 신원과 별개로 수동 override(기존 `RepoSpecificForm` 의 raw `user.name/email` 필드)도 유지 — 프로필 picker 가 채우되 사용자가 덮어쓸 수 있게.
- **ProfilesSection forge-account selector** (Codex F7) — `ProfilesSection.vue` 는 `defaultForgeAccountId` state 만 있고 폼에 selector 미렌더. P3(4) 의 forge API 라우팅이 동작하려면 이 selector 를 P4 에서 실제 렌더 (§1 표 "부분 구현" 해소).
- **divergence UX** (Codex F9) — 레포가 프로필 바인딩 상태인데 `.git/config` 가 프로필 값과 다르면(사용자 수동 편집) "프로필과 불일치" 배지 + [재동기화 / 바인딩 해제] 선택. silent 재기입 금지 (P2 원칙과 일관).
- **부분 프로필 capability 배지** (D5 구현 위치) — 프로필 picker / 상세 패널에서 각 필드별로 "이 프로필이 SET 함" vs "비어 있어 기존 local 값 유지" 를 배지로 명시 (경고 아님). 사용자가 빈 필드를 unset 으로 오해하지 않게 — §3 P2 부분 프로필 정책의 UI 표현.
- **i18n** — 신규 UI 문자열은 `ko.json`/`en.json` 양쪽 대칭 추가 (현재 leaf 1597, symmetric 불변). dup top-level namespace 금지 (silent drop 함정).

### P5 — 엣지 / 마이그레이션 (Tier MEDIUM, 사이즈 S)

- **멀티 remote 레포** (예: origin=opnd-io, backup=tgkim-openerd) — 프로필은 레포 단위 1개. remote 별 분기는 비범위. 명시 지정이 곧 단일 해답. **단** push remote 의 호스트가 바인딩 프로필의 credential 호스트와 다르면 (`git/remote.rs` 의 fetch/push URL 비교) P3 에서 경고 UX 노출 — silent 인증 실패 방지.
- **서명 키 부재** — 프로필의 `signing_key` 가 가리키는 키가 없으면 commit 서명 실패. 적용 전 §3 P2 무결성 검사 ③ 과 동일 규칙: `gpg.format` 분기(`openpgp` → GPG secret key / `ssh` → SSH 서명 키)로 **`signing_key` 자체를 검증** → 경고 토스트. (email 추론 금지 — P2 규칙과 일치.)
- **기존 per-repo `user.email` 충돌** — diff 고지는 P2 acceptance 로 이관 (§3 P2 참조).
- `profiles` 삭제 시 `repos.profile_id` 가 `ON DELETE SET NULL` 로 NULL **+ 삭제 핸들러가 `profile_pinned` 도 0 으로 reset**(iter8 F8-4 — FK 만으론 부족, §3 P1 참조) — 해당 레포는 공용 프로필로 자동 복귀하고 auto-matching 재개 (레포 row 보존, CASCADE-삭제 아님).

### P6 — 검증 전략 (Tier HIGH, 사이즈 S)

각 Phase 의 acceptance 를 테스트로 고정:

- **P1 DB** — `profiles.rs` 의 CRUD round-trip 테스트 패턴 답습: `repos.profile_id` set/get/clear + `profiles` 삭제 시 `ON DELETE SET NULL` (해당 레포 `profile_id` NULL + **`profile_pinned` 도 0 으로 리셋**, 레포 row 보존) 동작 cargo 테스트. **회귀 주의** (iter6 F6-3) — 기존 `test_profiles_crud_round_trip` 의 fresh-DB `len()==0` 단정은 P1 backfill 이 default 프로필 1개를 생성하므로 깨짐 → 단정을 `len()==1` 로 수정하거나 backfill 을 테스트에서 분리. P1 구현 시 함께 수정 (안 하면 `cargo test` gate 가 P1 직후 실패).
- **P2 identity** — 임시 repo 에 프로필 적용 → `.git/config --local` 의 `user.name/email/signingkey` 가 프로필 값과 일치하는지 / 해제 시 `--unset` cargo 테스트. 충돌 diff·무결성 검사 5종(부분 적용 금지 / 기입 후 검증 / gpg.format 분기 / rollback 포함) 케이스화. **provenance 값 비교** (iter5 F2) — 사용자가 managed 키를 손으로 수정한 뒤 바인딩 해제·전환 시 그 키가 unset 되지 않고 *보존*되는지 (현재값 ≠ git-fried 기입값) 테스트.
- **P2.5 자동 매칭** — remote URL 정규화(대소문자 / `.git` / SSH↔HTTPS) 단위 테스트 / host+owner 정확 일치 → 자동 바인딩 vs 부분·다중 후보 → 자동 안 함(공용 유지) 케이스 / pre-fetch 실패 시 공용 fallback (에러 아님) / **`profile_pinned=1` 레포는 자동 매칭이 건드리지 않음(pin 보호)** / **stale 재평가 3 트리거 전부**(iter5 F3 — forge 계정 삭제 / 프로필 `default_forge_account_id` 변경 / forge 계정 host·username 변경=old row 고아화) cargo 테스트.
- **P3 credential** — 3a: 별도 IPC 로 URL-context 키(`credential.https://github.com.username` 형태) 기입 확인. **PAT 가 `.git/config` 에 절대 안 들어가는 negative 테스트** 필수. 3b: credential helper I/O 마스킹 단위 테스트. SSH: `GIT_SSH_COMMAND` 가 **fetch / fetch_all / pull / push + `bulk_fetch` + `lfs_fetch` / `lfs_pull` / `init_submodules` / `update_submodules --remote`** 전부에 주입되는지 검증 (iter7 F7-2 + iter8 F8-1 + iter10-2 — P3 routing 범위 전체와 일치).
- **P4 UI** — `useRepoConfig` 패턴의 composable 테스트(`useRepoConfig.test.ts` 참고) + i18n ko/en 대칭 카운트 검증.
- **회귀** — `cargo test` exit 0 + `vitest` 전건 PASS + `i18n` symmetric 를 Phase 완료 게이트로.

## 4. Red flags

1. **글로벌 config 변형** — 레포별 바인딩 키(`user.*`/`credential.*`/SSH)는 `--local` 전용. **예외**(iter4 R-4): `is_default` 프로필 전파는 `git config --global` 기입 (F-04 — 레포 바인딩 없을 때 fallback SoT). 즉 "글로벌 변형 없음" 이 아니라 "글로벌 변형은 `is_default` 전파 1경로로 한정". `profiles.rs` 자체 주석의 `--global` 위험과 동일 — UI 에서 명확 고지. (P3-3b credential helper 도 별도.)
2. **credential helper 보안** — 3b 채택 시 git-fried 가 PAT 를 stdout 으로 git 에 넘김. helper I/O 가 로그·crash dump 에 새지 않도록 격리 필요.
3. **silent overwrite** — `.git/config` 자동 재기입은 사용자 수동 편집을 지움. P2 는 명시 액션 시에만 적용 (레포 열 때 자동 X).
4. **공용 프로필 미설정** — 이론상 공용 프로필이 0개면 fallback 이 git system config 로 새지만, **이는 불변식 위반 상태로 설계상 도달 불가**: P1 의 `is_default` partial unique index + post-migration backfill(단일 경로) + 삭제 거부 정책(red flag 7)이 "정확히 1개" 를 보장.
5. **자동 매칭 오매칭** (Codex A5) — host/owner 매칭이 틀리면 잘못된 author/credential 로 커밋·push. → P2.5 는 정확 일치만 자동, 부분 일치는 제안. P2 무결성 검사 ②(충돌 diff)가 2차 방어.
6. **stale pre-fetch / forge 계정 삭제** (Codex A5) — pre-fetch 된 프로필이 오래되거나 forge 계정 삭제 시 매칭이 어긋남. → `profile_pinned=0` 바인딩은 재평가, pre-fetch 실패 시 공용 fallback (에러 아님, P2.5).
7. **`is_default` 0개/다중** (cold-read F14) — partial unique index 가 다중은 막지만 default 프로필 삭제 시 0개 가능 → P1 의 삭제 **거부** 정책(F-06 — '이전' 옵션 폐기) + post-migration backfill 로 항상 정확히 1개 보장. (§3 P1 invariant + §3 P5 `ON DELETE SET NULL` 은 *비-default* 프로필 삭제 케이스 — 상호 보완.)

## 5. 결정 (D1~D7 — 전부 확정)

> D3 는 사용자 결정. D1·D2·D4·D5·D6·D7 은 사용자 위임(#5·#6)에 따라 Codex 페어 round 4 검토로 확장성·유지보수성·아키텍처 정합 기준 비교 후 확정 — 사용자 override 가능.

- **D1** ✅ — credential: **3a(`credential.<url>.username`) 먼저 → 3b(자체 helper) 후속**. 근거: `sync.rs` 현재 credential 라우팅 0 → 3a 가 PAT 저장 없이 즉시 가치, 3b 직행은 helper 프로토콜·마스킹·패키징 비용 선부담 + identity 가치 지연.
- **D2** ✅ — **`profiles.is_default` 신규 컬럼**. `is_active`("전역 활성"=`activate` 가 global 기입)와 의미 분리 — 재사용 시 repo fallback 이 global 변형과 결합되는 혼동 회피.
- **D3** ✅ (사용자) — 즉시 `.git/config` 기입 + §3 P2 **무결성 검사 5종**(값 일괄검증 / 충돌 diff / 서명 정합 / 기입 후 검증 / rollback). `.git/config` 가 SoT → CLI 와 항상 일관.
- **D4** ✅ — git-fried helper 를 `credential.helper` chain **선두**, 미지원(바인딩 없음) 시 빈 응답 → 시스템 helper(WCM) fallback. git-fried 는 바인딩 레포만 책임, 기존 자격 증명 불파손.
- **D5** ✅ — 부분 프로필을 **경고가 아니라 capability/missing-field 배지**로 표시 ("이 필드 SET" vs "기존값 유지" 명시).
- **D6** ✅ — `credential.useHttpPath=true` 를 영향 host/repo 에 **scoped 적용** (전역 blanket 시 불필요한 재프롬프트).
- **D7** ✅ — **`repos.profile_pinned` 신규 컬럼**. `profile_id` 만으로는 "자동 바인딩 vs 수동 선택", "미매칭 vs 수동으로 공용 선택" 구분 불가.

자동 매칭의 신뢰도 임계값·다중 후보 ambiguity UX·pre-fetch 실패 fallback 은 별도 미해결 결정이 아니라 §3 P2.5 에 설계 확정 (정확 일치만 자동 / 부분·다중은 토스트 제안 / pre-fetch 실패는 공용 fallback).

## 6. 비범위

- `includeIf` 메커니즘 — 계정 기반 자동 매칭 *동작*은 §2 범위 내지만, *구현 메커니즘*은 git-fried 가 `.git/config --local` 직접 기입으로 한다 (`includeIf hasconfig` 비채택 — git-fried 단일 제어점 유지, divergence 검사 가능). 2026-05-22 `~/.gitconfig` 수동 구성은 CLI 용 별도 솔루션으로 유지.
- remote 별(레포 내 remote 단위) 프로필 분기.
- 프로필 import/export, 팀 공유.

## 7. 확장성 노트

- `repos.profile_id` 바인딩이 생기면 향후 "워크스페이스/디렉토리 단위 기본 프로필" 도 같은 override 컬럼 패턴으로 확장 가능.
- §2 의 계정 기반 자동 매칭이 코어로 진입 — 후속 확장: 워크스페이스/디렉토리 단위 자동 매칭 규칙, 매칭 신뢰도가 낮을 때 자동 적용 대신 토스트 제안(1-click).
- credential helper(3b) 가 서면 forge API 토큰과 push 토큰이 `forge_accounts` 한 곳으로 통일 — gh CLI 의존 제거.

## 8. 진입 순서

D1~D7 전부 확정(§5) → 모든 Phase 게이트 해제. **단 P1/P2 코딩 전 계약 고정 필수** (cold-read F16): P1 의 `is_default` invariant·스키마 확장 범위, P2 의 `preview`/`apply` DTO, P2.5 의 trigger 지점·매칭 키 — 이 계약들을 먼저 확정해야 구현자 분기 방지. 순서:

- **P1 (DB)** — `repos.profile_id`/`profile_pinned` + `profiles.is_default` migration. 즉시 착수.
- **P2 (identity 적용)** — 무결성 검사 5종. P1 후.
- **P2.5 (자동 매칭)** — backend/domain. P1·P2 후 (P2 의 적용 경로 재사용).
- **P3 (credential/SSH)** — 3a + SSH wiring → 3b 후속.
- **P4 (UI)** — picker + 배지 + 자동매칭 결과표시·override + forge selector + divergence.
- **P5 (엣지) / P6 (검증)** — 각 Phase 에 내장. Phase 완료 게이트 = `cargo test` exit 0 + `vitest` PASS + i18n ko/en 대칭.
