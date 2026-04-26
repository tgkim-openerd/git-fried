# 15. 품질 / UI 일관성 cleanup sprint

작성: 2026-04-27 / 트리거: 76 commits 단일 세션 후 디자인 시스템 + 코드 품질 audit

> **목적**: 76 commits / 41 components / 28 composables / 89 IPC / 285 unwrap / 13 modals 가 단일 세션 1일에 만들어진 결과로 발생한 (a) UI/UX 일관성 미흡 (b) 코드 품질 미흡 (c) 테스트 커버리지 결손 (d) Lint/빌드 blocking 을 모두 잡는 cleanup sprint. 새 기능 추가 0, 품질 정합성만.
>
> **검증 출처**: 2 audit agent 병렬 (UI/UX 일관성 + 코드베이스 품질) 결과 통합. 정량 수치 모두 grep / read 검증.
>
> **연계**: [12 plan v3](./12-ui-improvement-plan.md) (작업량 보정 0.1~0.2x), [13 diff](./13-implementation-vs-plan-diff.md), [14 잔여 catalog](./14-additional-gitkraken-gaps.md). 본 plan 은 14 와 독립 — 어느 쪽 먼저든 진행 가능.

---

## 1. 30초 요약

| 트랙 | 발견 | 우선순위 분포 |
| --- | --- | --- |
| **UI/UX 일관성** | 8 카테고리, 9 미흡 영역 | P0=0 / P1=4 / P2=4 / P3=2 |
| **코드베이스 품질** | 8 카테고리, 13 미흡 영역 | **P0=2** / P1=5 / P2=6 |
| **즉시 수정 가능 (5~30분)** | ESLint v9 / tsconfig 토글 / migration INDEX | 3건 |
| **Sprint 분할** | 3 sprint (Blocking → Quality → Polish) | ~3~5일 (AI pair 보정) |

**가장 critical 2건**:
1. ⚠️ **ESLint v9 마이그레이션 미완** — `npm run lint` 실행 실패 (BLOCKING)
2. ⚠️ **Rust unwrap() 285개** (production), 위험 path 80개 (`conflict_prediction.rs` / `rebase.rs`) — panic 위험

**가장 큰 미흡 (UI)**:
- **Focus trap 0/13 modals** (WCAG 2.1 AA 미달성)
- **BaseModal 미추출** — 13 modals 가 Teleport+backdrop 패턴 중복 (z-index z-40 vs z-50 분산)

**평가 점수** (audit agent 종합):
- UI/UX 일관성: **7.5/10** (디자인 토큰 우수, focus/한글 미흡)
- 코드 품질: **7.2/10** (typecheck 0 에러 / Cargo test 74 pass, 그러나 ESLint blocking + unwrap 과다)

---

## 2. UI/UX audit 결과 (8 카테고리)

### 2-1. Modal 패턴 ⭐ P1

| 항목 | 발견 |
| --- | --- |
| 13 modals 모두 `Teleport to="body"` + `open` prop + `@close` emit | ✅ 일관 |
| z-index | ❌ 7개 z-50 / 7개 z-40 분산 |
| Backdrop opacity | ❌ `bg-black/50` vs `bg-black/40` (FileHistory만 다름) |
| Padding | ❌ `p-6` vs `p-4` 혼용 |
| max-width | ❌ `max-w-[600px]` ~ `max-w-7xl` (`w-[680px]` `w-[720px]` `w-[1000px]` 고정값 다수) |
| Header (title + ✕) | ❌ 각 modal 자체 구현 |

→ **BaseModal.vue 추출 권장** (Header slot + body slot + 표준 z-50/p-6/rounded-lg/shadow-xl). 13 migration. **작업량 M (~6h)**.

### 2-2. ContextMenu 공용 컴포넌트 ⭐ P2

| 항목 | 발견 |
| --- | --- |
| ContextMenu.vue 공용 컴포넌트 | ❌ 미존재 |
| `@contextmenu` 핸들러 사용 | 3/41 components만 (CommitGraph / StashPanel / StatusPanel) |
| CommitGraph 의 자체 inline menu (`headerMenuOpen` state) | ❌ 중복 구현 |

→ **신규 `ContextMenu.vue`** (Position abs + 키보드 ↑↓Enter/Esc + outside-click close). CommitGraph / StashPanel / StatusPanel 마이그레이션. **작업량 S~M (~3h)**.

### 2-3. Loading / Empty / Error state ⭐ P2

| 항목 | 발견 |
| --- | --- |
| `useToast` + `describeError` 패턴 | ✅ 55/55 mutations 일관 |
| Loading 표현 = 텍스트 ("불러오는 중...") | ❌ 7/41 만 표시, skeleton/spinner 부재 |
| Empty state | ✅ 25+ 일관 메시지 ("변경 없음" 등), 아이콘은 부재 |
| `String(error)` 회귀 | ✅ 0건 |

→ **신규 `LoadingSpinner.vue` + `EmptyState.vue`**. 16 components 마이그레이션. **작업량 M (~4h)**.

### 2-4. Tailwind 토큰 / spacing / animation ⭐ P2

| 항목 | 발견 |
| --- | --- |
| Tailwind 토큰 일관성 (`border-border`, `bg-card`, ...) | ✅ 우수 |
| Hardcoded color (`#fff`, `bg-blue-500`) | ✅ 0건 (Canvas 제외 정당) |
| `rounded`: 102 md / 92 기본 / 14 lg / 5 full | 🟡 일부 분산 |
| `transition-*` 사용 | ❌ 3/41 만 (CommitGraph 2건 + 1건) — 상태 변경 부자연스러움 |

→ **글로벌 transition 정책** (state=200ms, color=150ms, opacity=100ms) → 37 components 적용. **작업량 S (~3h)**.

### 2-5. Toast / Notification ✅ P3 (이미 우수)

| 항목 | 발견 |
| --- | --- |
| `useToast` 자동 닫힘 시간 (success 3s / info 4s / warning 6s / error 8s) | ✅ 정의 |
| 55 mutations 의 `onError` 일관 | ✅ |
| 중복 toast 방지 | ❌ 미구현 — 같은 작업 반복 시 stacking |
| `useNotification` (OS) vs `useToast` (in-app) 분기 | ✅ 명확 |

→ 중복 방지만 추가 (Map<key, lastShownAt> + dedup window 1s). **작업량 S (~1h)**.

### 2-6. 한글 / overflow ⭐ P1

| 항목 | 발견 |
| --- | --- |
| `truncate` 사용 | 30/41 components |
| 한글 너비 가정 (한글 1자 ≈ 영문 2자) | ❌ CSS 주석에만 명시 (`main.css:57`), 실제 너비 미고려 |
| `overflow-auto + truncate` 혼용 | DiffViewer=scroll / CommitTable=truncate |
| textarea line-height 1.5 | ✅ |

→ **width 재계산 + ellipsis 표준화** (긴 한글 ref / commit / PR title). BranchPanel / CommitTable / PrPanel 우선. **작업량 M (~5h)**.

### 2-7. Dark mode / theme ✅ (이미 우수, P3 보강)

- Tailwind `darkMode: ['class']` ✓
- 모든 색상 CSS 변수 (`--background` 등) ✓
- `dark:` Tailwind variant 미사용 (CSS var 의존) — 정상
- **`useCustomTheme` JSON parse 후 색상 유효성 검증 부재** → 잘못된 HSL 값 깨짐 가능. **작업량 S (~1h)**.

### 2-8. 키보드 접근성 / Focus 관리 ⭐ P1 ★ WCAG 미달

| 항목 | 발견 |
| --- | --- |
| `isInputFocused()` 정책 | ✅ 일관 적용 |
| Esc 처리 | ✅ 일부 (Palette / Graph / RepoSwitcher) |
| Modal 열림 시 auto-focus | ❌ 3/13 만 (CommitGraph / RepoSwitcher / Palette) |
| **Modal 닫힘 시 trigger 로 focus 복원** | ❌ 0/13 |
| **Tab cycling (focus trap)** | ❌ 0/13 |

→ **신규 `useFocusTrap` composable** + 13 modals 적용. WCAG 2.1 AA 통과. **작업량 M (~6h)**.

---

## 3. 코드베이스 audit 결과 (8 카테고리)

### 3-1. Vue composable 일관성 ⭐ P1

| 항목 | 정량 |
| --- | --- |
| `useQuery`/`useMutation` 사용 | 14/28 (50%) |
| **`enabled` guard 누락** | **16/28** (57%) — repoId null 시 호출 위험 |
| queryKey 패턴 일관 | 14/28 불일치 (`['domain', repoId]` 표준 미통일, 일부 `['aiProbes']` 같은 단일 key) |
| staleTime 정책 | 60s / 30s / 2s 분산 (정책 문서 부재) |
| `onError` 콜백 | **11/14 누락** (mutation 에서 toast 미호출 가능) |

→ **enabled guard 16개 일괄 추가** + **queryKey 표준화** (`[domain, repoId, ...context] as const`) + **staleTime 정책 3 tier** (2s realtime / 30s 일반 / 60s 정적) + **onError 11곳 통합**. **작업량 M (~5h)**.

### 3-2. TypeScript 타입 ⭐ P2

| 항목 | 정량 |
| --- | --- |
| `any` | ✅ 0건 |
| `as` 캐스팅 | 62건 (대부분 정당, **unsafe 7건** — `as unknown as GlobalHandles` 등) |
| 누락 return type | ✅ 0건 |
| **tsconfig `noUnusedLocals` / `noUnusedParameters`** | ❌ **둘 다 false** — 검사 비활성화 |

→ unsafe `as` 7건을 type guard 또는 `satisfies` 로 / tsconfig 두 플래그 `true` 활성화 + 검사 통과 (`auto-imports.d.ts` 등 generated 제외). **작업량 S (~2h)**.

### 3-3. IPC API wrapper ✅ (P2 미세)

- Frontend wrapping 일관 85%+ ✓ (`{ args: { ... } }` vs `{ repoId }` 직접 — 5건 불일치)
- camelCase ↔ snake_case 변환 ✓
- 에러 처리: API 레이어 무처리 → UI 처리 (설계 명확)

→ 5건 표준화. **작업량 S (~30분)**.

### 3-4. Rust 코드 품질 ⭐⭐ P0 ★ panic 위험

| 항목 | 정량 |
| --- | --- |
| **`unwrap()` (production, test 제외)** | **285개** ⚠️ |
| 위험 hot path | `conflict_prediction.rs` / `rebase.rs` 각 30+ |
| `clone()` | 32개 — 양호 |
| **`let _ = ...` 에러 무시** | 19개 (test cleanup 안전 14 + **위험 5건**) |
| `as` 캐스팅 (i64 ↔ u64) | 12건 |
| `#[allow(dead_code)]` | 4건 (정당성 불명) |

→ **Phase 1 — 위험 hot path 80개 우선** (`conflict_prediction.rs` / `rebase.rs`): `.unwrap()` → `.context("...")?` (anyhow). 위험 `let _` 5건 → `?` or `tracing::warn!`. `#[allow(dead_code)]` 4건 검토. **작업량 L (~8h, AI pair 보정 후 ~1.5h)**.

> Phase 2 (전체 285개) 는 별도 sprint — 본 plan 에 포함 안 함.

### 3-5. Migration 안전성 ⭐ P2

| 항목 | 정량 |
| --- | --- |
| 0001~0004 멱등성 (IF NOT EXISTS) | ✅ 0001/0002 확인, 0003/0004 검증 필요 |
| FOREIGN KEY CASCADE | ✅ 일관 |
| INDEX | ✅ `idx_repos_workspace`, `idx_repo_ref_hidden_kind` / **❌ `commits(repo_id, author_at DESC)` 누락** — 검색 쿼리 성능 영향 |
| 한글 round-trip 테스트 | ✅ `0002` 의 `git/hide.rs` cargo test 6개 (한글 ref `feature/한글` 등) |

→ 0003/0004 IF NOT EXISTS 검증 + commits INDEX 추가 migration. **작업량 S (~30분)**.

### 3-6. 테스트 커버리지 ⭐ P1 ★ frontend 전무

| 항목 | 정량 |
| --- | --- |
| Cargo test (`#[test]` + `#[tokio::test]`) | **74개** ✅ (git 40 / storage 20 / ipc 10 / commands 4) |
| Vitest 파일 | **2개 만** (`git.test.ts`, `parseDiff.test.ts`) |
| **신규 28 composables / 41 components 의 unit test** | **0개** ❌ |

→ **Critical path composables 5개 unit test** (useHiddenRefs / useDiffMode / useShortcuts / useCommitColumns / useLaunchpadMeta) + **5 components snapshot test** (CommitGraph / BranchPanel / Palette / StatusPanel / Sidebar). `vitest run` CI 통합. **작업량 M (~4h)**.

### 3-7. Dead code / 중복 ⭐ P2

| 항목 | 정량 |
| --- | --- |
| 미사용 import | ✅ 0건 |
| `#[allow(dead_code)]` | 4건 (sprint 준비용? 검증 필요) |
| **중복 패턴** — Modal Teleport + backdrop + Esc | 13 modals 동일 → BaseModal 추출 가치 ⭐ |

→ `#[allow(dead_code)]` 4건 검토 + BaseModal 추출은 §2-1 과 통합. **작업량 S (~30분)**.

### 3-8. Lint / 빌드 ⭐⭐ P0 ★ BLOCKING

| 항목 | 정량 |
| --- | --- |
| **ESLint v9 마이그레이션** | ❌ `.eslintrc.cjs` 잔존, `eslint.config.js` 부재 → `npm run lint` 실패 |
| `bun run typecheck` | ✅ 0 에러 |
| `cargo clippy --all-targets -- -D warnings` | 🟡 환경 (Rust 버전 호환) 문제로 검증 미완 |
| Cargo test | ✅ 74 pass |
| Vitest 실행 | ❌ 부재 |

→ **즉시 수정 (5분)** — `.eslintrc.cjs` 삭제 + `eslint.config.js` 신규 (flat config). **작업량 S (~30분)**.

---

## 4. 종합 우선순위 매트릭스

| # | 영역 | 트랙 | 정량 | 우선 | 작업량 |
| - | --- | --- | --- | --- | --- |
| **1** | **ESLint v9 마이그레이션** | 코드 | BLOCKING | ⭐⭐ P0 | S (~30분) ★ 즉시 |
| **2** | **Rust unwrap() hot path 80개** | 코드 | panic 위험 | ⭐⭐ P0 | L (~1.5h AI pair) |
| **3** | Vue composable enabled guard 16개 | 코드 | crash 위험 | ⭐ P1 | S (~1h) |
| **4** | queryKey 표준화 14개 + staleTime 정책 | 코드 | 캐시 일관 | ⭐ P1 | S (~2h) |
| **5** | onError → toast 11곳 통합 | 코드 | UX 회귀 차단 | ⭐ P1 | S (~1h) |
| **6** | Modal Focus trap (`useFocusTrap` + 13 modal) | UI | WCAG 2.1 AA | ⭐ P1 | M (~6h) |
| **7** | **BaseModal 추출 + 13 migration** | UI | 일관성 | ⭐ P1 | M (~6h) |
| **8** | 한글 너비 / ellipsis 표준화 | UI | i18n 품질 | ⭐ P1 | M (~5h) |
| **9** | Vitest 5 composable + 5 component test | 코드 | 회귀 차단 | ⭐ P1 | M (~4h) |
| **10** | ContextMenu 공용 컴포넌트 + 3 마이그레이션 | UI | 일관성 | · P2 | S (~3h) |
| **11** | LoadingSpinner / EmptyState + 16 마이그레이션 | UI | UX 폴리시 | · P2 | M (~4h) |
| **12** | Transition 정책 + 37 components | UI | 폴리시 | · P2 | S (~3h) |
| **13** | unsafe `as` 7건 + tsconfig noUnusedLocals/Parameters | 코드 | 타입 안전 | · P2 | S (~2h) |
| **14** | IPC wrapper 5건 표준화 | 코드 | 일관 | · P2 | S (~30분) |
| **15** | commits INDEX 추가 migration | 코드 | 성능 | · P2 | S (~30분) |
| **16** | `#[allow(dead_code)]` 4건 검토 | 코드 | dead code | · P2 | S (~30분) |
| **17** | Toast 중복 방지 + Custom theme 색상 검증 | UI | 안정성 | · P3 | S (~2h) |

**합계**:
- P0 = 2건 (~2h)
- P1 = 7건 (~25h)
- P2 = 7건 (~13.5h)
- P3 = 1건 (~2h)

**총 ~42h** (1인 풀타임 5~6일) → AI pair 0.15x 보정 = **~6~7h** 단일 세션 가능.

---

## 5. Sprint 분해

### Sprint 1 (P0 + 즉시 수정, ~3h) ★ 다음 세션 진입 즉시

1. **ESLint v9 마이그레이션** (~30분) — `.eslintrc.cjs` → `eslint.config.js` flat config
2. **Rust unwrap() hot path 80개** (~1.5h) — `conflict_prediction.rs` + `rebase.rs` 우선
3. **commits INDEX 추가** (~30분) — migration `0005_commits_lookup_index.sql`
4. **`#[allow(dead_code)]` 4건 검토** (~30분)

→ 1 PR. cargo test 74 + 신규 후 통과 / `npm run lint` 통과 / `cargo clippy -- -D warnings` 통과.

### Sprint 2 (P1 코드 품질, ~4h)

1. **Vue composable enabled guard 16개** (~1h)
2. **queryKey 표준화 + staleTime 3 tier 정책** (~2h)
3. **onError → toast 11곳 통합** (~1h)
4. **unsafe `as` 7건 + tsconfig noUnusedLocals/Parameters** (~30분, 필요 시 Sprint 3 으로)
5. **IPC wrapper 5건 표준화** (~30분)

→ 2 PR (composable refactor / type tighten).

### Sprint 3 (P1 UI 일관성, ~6h)

1. **BaseModal 추출 + 13 modal migration** (~3h)
2. **`useFocusTrap` composable + 13 modal 적용** (~2h, BaseModal 위에 통합 가능)
3. **한글 너비 / ellipsis 표준화** (~1h, 우선 BranchPanel/CommitTable/PrPanel)

→ 1 PR (UX foundation).

### Sprint 4 (P2 폴리시, ~3h)

1. **ContextMenu 공용** (~1h)
2. **LoadingSpinner / EmptyState** (~1h)
3. **Transition 정책 적용** (~1h)

→ 1 PR.

### Sprint 5 (테스트 + P3, ~5h)

1. **Vitest 5 composable + 5 component test** (~4h)
2. **Toast 중복 방지 + Custom theme 검증** (~1h)

→ 1 PR.

**합계 5 sprint = ~6~8 commit** (사용자 본인 dogfood 결과 보고 후 우선순위 재조정 가능).

---

## 6. 즉시 수정 가능 항목 (5~30분)

### 6-1. ESLint v9 마이그레이션 (5분)

```bash
cd apps/desktop
bun add -D @eslint/js eslint-plugin-vue @typescript-eslint/parser
rm .eslintrc.cjs
```

신규 `apps/desktop/eslint.config.js`:

```js
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import parserTs from '@typescript-eslint/parser'

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: { parser: parserTs, ecmaVersion: 2022 },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  { ignores: ['dist/**', 'src-tauri/target/**', 'auto-imports.d.ts', 'components.d.ts'] },
]
```

### 6-2. tsconfig 토글 (1줄)

```jsonc
// apps/desktop/tsconfig.json
{
  "compilerOptions": {
    "noUnusedLocals": true,        // false → true
    "noUnusedParameters": true     // false → true
  }
}
```

→ 활성화 후 `bun run typecheck` 실행 → 위반 항목 (예상 2~3건) 수동 수정.

### 6-3. commits INDEX migration (3줄)

```sql
-- apps/desktop/src-tauri/src/storage/migrations/0005_commits_lookup_index.sql
CREATE INDEX IF NOT EXISTS idx_commits_lookup
    ON commits(repo_id, author_at DESC);
```

---

## 7. 검증 체크리스트 (sprint 별 PR)

각 PR 머지 직전:

- [ ] `bun run typecheck` 0 에러
- [ ] **`bun run lint` 통과** (Sprint 1 PR 부터 BLOCKING)
- [ ] `cargo test --lib` 통과 (74 → 새 test 추가 후 +N)
- [ ] **`cargo clippy --all-targets -- -D warnings` 통과** (Sprint 1 PR 부터)
- [ ] `bunx vitest run` 통과 (Sprint 5 PR 부터)
- [ ] 한글 ref / commit / PR 메시지 round-trip 회귀 없음
- [ ] memory baseline +20% 이내
- [ ] 사용자 본인 레포 1개에 dogfood (commit / branch / diff / hide / hunk-stage)
- [ ] commit message HEREDOC + `'EOF'` 한글 안전 / `Co-Authored-By` 금지 / "Generated with Claude" 금지

---

## 8. 결정 로그 (2026-04-27)

| # | 결정 | 근거 |
| --- | --- | --- |
| 1 | **ESLint v9 마이그레이션 = P0 즉시** | `npm run lint` 실행 실패, blocking |
| 2 | **Rust unwrap Phase 1 = hot path 80개만** (전체 285 아님) | scope discipline — production 위험 path 우선, 나머지는 별도 sprint |
| 3 | **BaseModal 추출 + Focus trap 통합** (1 sprint) | 둘 다 13 modal 영향 → 같이 migration 효율적 |
| 4 | **테스트 커버리지 5+5 dummy 시작** | 28+41 전체는 과한 scope, critical path 만 |
| 5 | **`useFocusTrap` 신규 composable** | reka-ui 의 FocusScope 직접 도입은 alpha 의존도 증가 |
| 6 | **본 plan 은 14 와 독립** | 어느 쪽도 먼저 진입 가능. 권장 순서: 15 (P0 blocking) → 14 (잔여 catalog) → Line-stage v2 |

---

## 9. 다음 plan 후보 갱신

기존 13/14 의 다음 plan 후보:
- 14 (✅ 완료) = GitKraken 잔여 catalog
- 15 = Line-stage v2

→ **갱신 후**:
- **14** ✅ GitKraken 잔여 catalog
- **15 (본 문서)** ✅ 품질 cleanup sprint
- **16** = Line-stage v2 (`16-line-stage-v2.md`)
- **17** = v1.x roadmap
- **18** = dogfood feedback

---

## 10. 다음 세션 진입 권장 순서

3가지 옵션:

### 옵션 A — Quality first (권장 ★)
**Sprint 1 (P0)** ~3h → blocking 해소 + panic 위험 감소 → 이후 자유롭게 14 또는 16

### 옵션 B — 14번 잔여 기능 catalog 우선
**Sprint A14** (⌘⇧H + Stash 부분 apply + Compare) ~반나절 → 사용자 일상 가치 빠르게 추가 → 이후 15

### 옵션 C — Line-stage v2 (`parseDiff.ts` 진행 중) 즉시
다음 세션 시작 시 `parseDiff.ts` 의 작업 상태 read 후 재개

→ **권장 = A** (Sprint 1 P0 만 ~3h 투입하면 이후 모든 sprint 가 lint/typecheck/clippy 통과 보장)

```text
"docs/plan/15 §5 Sprint 1 진입.
ESLint v9 마이그레이션 + unwrap hot path 80개 + commits INDEX + dead_code 4건 검토.
1 PR, ~3h."
```

---

다음 문서 → `16-line-stage-v2.md` (parseDiff.ts 작업 진입 시)
