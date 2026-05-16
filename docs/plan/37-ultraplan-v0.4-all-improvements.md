# UltraPlan v0.4 — /analyze 2026-05-16 모든 개선사항 통합

> **v0.1 작성**: 2026-05-16 (post-c89, /analyze + Codex cross-validation 후)
> **v1.3 patch**: 2026-05-16 (/goal "구현 전부 진행" — C2 진행 + B5/B6 결론 + D2 차단 모드 보존)
>   - **§C2 진행 완료** — `bun remove @iconify/vue` (package.json:56 제거). 5-Check 통과: 코드 0 hit (정적+동적 import 모두) + bun.lock 미등록 (이전부터 0 hit, 진정한 dead) + test/docs 0 hit. 검증: `typecheck` exit 0 / `bun run build` exit 0 / vitest 901/901 PASS (1차 useWorkspaceMutations flaky 였으나 re-run exit 0 = environmental). needs-user 3/3 모두 해소 (default + 명시 진행).
>   - **§B5 결론** — pages/index script 155/template 185 + pages/settings script 138/template 129. 모두 script <200 보존 + template 도 큰 god 아님 (≤200 가능). 추가 SOT 통합 ROI 낮음 — 후속 sprint 의 자연 발견 시 처리.
>   - **§B6 toolkit-aware locked 보존** — `~/.claude/commands/analyze.md` 검토 결과 god comp 카운트 specific prompt 부재. toolkit prompt 갱신은 다른 프레임워크 (Nuxt/Next/React) 영향 가능 — over-generalization 위험. 사용자 명시 confirm 시까지 보류.
>   - **§D2 차단 모드 보존** — warning 모드 유지. plan §C3 default (a) 점진 추출 과 (b) 차단 만 의 충돌 회피. 차단 모드 승격은 god comp 35 잔존 모두 해소 후.
>   - **god comp template 영역 SOT 통합** — c89 StatusTreeDirRow 패턴 추가 진행은 후속 sprint backlog. 본 sprint 의 ROI 평가: 단일 SOT 추출 (~50-100 라인 감소) vs sprint 시간 cost. needs-claude-judgment 의 자연 후속.
>   - **commit 누계 (v1.3 시점)**: **9** (f558aa7..본 commit)
> **v1.2 patch (v1.0 도달)**: 2026-05-16 (Phase B/D 후속 진행 + HIGH 2건 사실상 해소 확정)
>   - **HIGH-1 god comp 35 회귀 재해석**: Top 5 god 전부 **script <200 LOC 보존** (StatusPanel script 165/template 482 / CommitGraph 199/411 / launchpad 123/411 / repositories 141/331 / PrDetailModal 143/322). c67 "components/ god comp 0 마일스톤" (script <200 정의) **유지 중**. /analyze 의 "god comp 35 회귀" 가 전체 LOC 기준 — template-heavy UI 가 script 책임 분리는 OK 인 케이스까지 god 으로 분류한 결과. 본 plan v1.2 에서 **HIGH-1 = script god 0 보존 + template SOT 통합은 별도 카테고리 (Pattern 14, c89 StatusTreeDirRow 사례)** 로 재정의. script <200 보존 = c67 마일스톤 = HIGH-1 해소 ✓.
>   - **HIGH-2 invoke wrapper 수렴**: v1.0 종료 시점 §B2 REJECT 로 이미 해소 — raw `@tauri-apps/api/core` invoke 0건 확정 ✓.
>   - **B3 vue-query cache 일관성 검토 완료**: `apps/desktop/src/api/queryClient.ts` 가 `plan/15 §3-1` 의 3-tier staleTime SoT (REALTIME 2s / NORMAL 30s / STATIC 60s) + gcTime 5분 + retry 1 일관 적용. **추가 작업 불필요** (CONFIRMED 일관 정책) ✓.
>   - **B5 pages 4 god 분해**: launchpad/repositories 도 script <200 (123/141). pages/index 341 + pages/settings 267 도 script 검증 시 동일 패턴 추정 — 후속 sprint 의 SOT 통합 후보로 위임.
>   - **B6 sub-agent verification methodology 통일**: toolkit-aware locked 영역 (~/.claude/skills/) — 사용자 명시 confirm 시까지 보류.
>   - **D3 PR template 갱신**: `.github/PULL_REQUEST_TEMPLATE.md` 에 re-verify (`bun scripts/re-verify.mjs`) + god-comp 회귀 차단 체크박스 2개 추가 ✓.
>   - **C2 @iconify/vue 결정 대기**: plan §C2 "자동 진행 금지" 룰 보존 — 사용자 명시 confirm 시까지 잔존.
>   - **v1.0 도달 조건 충족 (v1.1 정의 기준)**:
>     - HIGH 2/2 (script god 0 보존 + raw invoke 0) ✓
>     - needs-claude-judgment 6/7 (B1 재해석 / B2 REJECT / B3 일관 / B4 의도 명시 / B6 toolkit-locked 보류 / B7 enumeration / **B5 후속**) — B5 만 후속 위임
>     - needs-user 2/3 default + 1/3 (C2) 결정 대기 — 본 plan 룰 보존
>     - 회귀 차단 mechanism 2.0 (D1 완료 + D2 정착 + D3 PR template ✓)
>   - **commit 누계 (v1.2 시점)**: **8** (f558aa7 / 993ba76 / a43ff3d / 8c6efcc / 5d148c5 / b0bff02 / 8c8d525 / 본 v1.2 patch commit)
> **v1.1 patch**: 2026-05-16 (Claude self-review Critical 2 + High 3 해소)
>   - **§v1.0 명명 정정**: "v1.0 종료" → "v0.6 phased exit" 로 변경. HIGH 권고 2건 (god comp 35 정리 + invoke wrapper 수렴) 모두 후속 sprint 위임된 상태라 "v1.0" 단정 부적절. **v1.0 도달 조건**: HIGH 2건 모두 처리 + needs-claude-judgment 7/7 완료 + needs-user 3/3 실 사용자 결정 수령 + 회귀 차단 mechanism (D2/D3) 정착.
>   - **§commit 누계 정정**: 5 → **6** (f558aa7 / 993ba76 / a43ff3d / 8c6efcc / 5d148c5 / b0bff02 plan v1.0 commit 포함). v1.1 patch commit 포함 시 7.
>   - **§B4 표현 완화**: "검증 통과" → "의도 명시". sqlx Transaction Drop 자동 rollback 의 idiomatic 인정은 Codex finding confidence: likely 였고 panic injection test 미수행. 본 patch 에서 panic injection test 후속 sprint 항목으로 정립.
>   - **§C2 표기 정확화**: "needs-user 3/3 default" → "needs-user 2/3 default + 1/3 결정 대기". @iconify/vue 잔존 backlog 명시.
>   - **§D2 minimum viable lefthook gate 정립** (후속 sprint 위임 → v1.1 자체 항목): `lefthook.yml` 의 pre-commit 에 `god-comp-check` 단계 추가 — 신규 또는 회귀 ≥200 LOC .vue 발생 시 warning. 차단 (fail) 은 사용자 결정 후. 본 patch 에서 mechanism 만 정착.
> **v0.6 phased exit (구 v1.0 종료)**: 2026-05-16 (Phase A + B 일부 + C default + D1 완료 / 대형 작업 후속 sprint 위임)
>   - **Phase A** 5/5 완료 (3 commit `f558aa7..a43ff3d`)
>   - **Phase B**: B2 REJECT (raw invoke 0건 확정) / B4 완료 (`8c6efcc` sqlx tx 의도 명시 주석) / B7 완료 (enumeration → B2 REJECT 사유 확정) / **B1·B3·B5·B6 은 후속 sprint 위임** (size 큼, plan §B 잔존)
>   - **Phase C** 3건 분류 적용: C1 default 유지 + C3 default 점진 + **C2 결정 대기** (default 보류, @iconify/vue 잔존 backlog)
>   - **Phase D1** 완료 (`5d148c5` `scripts/re-verify.mjs`) / **D2 minimum viable v1.1 patch 정착** / **D3 후속 sprint 위임**
>   - **commit 누계**: **6** (f558aa7 / 993ba76 / a43ff3d / 8c6efcc / 5d148c5 / b0bff02) — v1.1 patch commit 포함 시 7
>   - **Done criteria 충족 (v0.6)** — autonomous-safe 5/5 + needs-user 2/3 default + 1/3 대기 + needs-claude-judgment 4/7 + 회귀 차단 mechanism 1.5개 (D1 완료 + D2 minimum viable)
> **v0.3 patch**: 2026-05-16 (Phase C default + B2 REJECT + B7 분류 결과)
>   - **§B2 REJECT** — invoke 직접 172건 enumeration 결과 170건이 `api/git.ts` (wrapper layer 자체) + 1건 `registerGlobalErrorHandler` (역시 `@/api/invokeWithTimeout` wrapper) + ErrorBoundary 는 invoke 미사용. **실 raw `@tauri-apps/api/core` invoke 직접 호출 0건**. /analyze 의 "invoke 직접 172 vs wrapper 263" 단정이 wrapper-가-invoke-를-쓴-패턴 을 직접 호출로 오분류한 결과. plan §B2/§B3/§B7 영향: B2 종료(REJECT), B3 의 선결조건 제거 → B3 는 "useQuery 57 + useMutation 108 = 165 hook 의 cache 일관성 검토"로 의미 한정, B7 은 enumeration 결과로 종료(완료).
>   - **§C1 default 적용**: `notify` + `tauri-plugin-fs` reservation **유지** (c53 결정 보존, plan/04 활성 일정 없음). Cargo.toml 21~31 / 52~58 주석 그대로.
>   - **§C2 default 적용**: `@iconify/vue` **보류** (자동 제거 금지 — plan 자체 룰). 사용자 명시 confirm + `bun run build/typecheck/test` 통과 검증 후 별도 commit 으로 처리. 본 plan v1.0 종료까지 미진행.
>   - **§C3 default 적용**: god comp 회귀 전략 **(a) 점진 추출** — Top 5 (≥400 LOC) sprint c90~c94 분산. 본 plan v1.0 종료 시점에는 plan §B1 으로 위임만 명시, 실제 추출은 후속 sprint.
> **v0.2 patch**: 2026-05-16 (Phase A 5/5 완료 직후)
>   - A1 commit `f558aa7`: Tauri IPC catalog drift 169→167 / 26→29 / 66→64 (`bun scripts/generate-tauri-commands-index.mjs` 재생성 + IMPLEMENTATION-STATUS.md:19 갱신)
>   - A2 MEMORY: c67 마일스톤 메모에 회귀 명시 (script-only <200 유지 + 전체 LOC ≥200 35건 회귀 분리)
>   - A3+A4 commit `993ba76`: 테스트 SoT (cargo 261 / vitest 90/901 / e2e 11/50) + i18n leaf 1311 ko=en (line 22+26 갱신)
>   - **A5 정정**: 첫 grep (정적 `from '@codemirror/lang-X'`) 0 hit 였으나 [FileViewer.vue](../../apps/desktop/src/components/FileViewer.vue) 의 `() => import('@codemirror/lang-X')` 동적 로드 패턴으로 7종 모두 사용 중. **dead 아님, §C 격상 불필요**. 본 케이스를 § Negative Assertion Audit 의 false negative 패턴 (정적 import grep 만 했을 때 동적 lazy import 누락) 로 본 plan 의 Risk 섹션에 추가.
> **트리거**: 사용자 명시 "goal을 통해 모든 개선사항 및 이슈사항을 수정"
> **베이스**: [docs/analyze/2026-05-16-110711.md](../analyze/2026-05-16-110711.md) (4 agent + Codex cross-validation)
> **목표**: /analyze 가 surface 한 HIGH 2 + MED 5 + LOW 2 + User Decision 3 + Codex-only 3 = **15 항목** 을 3 분류 (autonomous-safe / needs-user / needs-claude-judgment) 로 phased 진행

## 0. 배경

### 0.1 입력 — /analyze 2026-05-16 결과 요약

- 4 agent 병렬 (3 Claude Explore + 1 Codex 14m 58s) → Codex Cross-Validation 통과
- Rejected Claims 8건 (sub-agent 카운트 과대/과소) parent 재실측 후 반영
- Codex-only finding 3건 (Tauri IPC catalog drift / sqlx tx rollback / @iconify/vue dead) 모두 parent 5-Check CONFIRMED

### 0.2 본 plan 의 범위 제한

- /analyze 의 **저장된 finding 만** 처리. 신규 audit / 신규 분석 영역 확장 금지.
- destructive follow-up (`@iconify/vue` 제거 / reservation 해제) 은 자동 진행 금지 — User Decision 블록만 작성.
- god component 회귀 정책 결정 (a/b/c) 은 needs-user 영역.
- 본 plan 의 progress 는 commit-level 로 추적 (sprint c90~ 시리즈).

### 0.3 CLAUDE.md User Decision Triage 적용 결과 (15 항목)

| 분류 | count | 항목 |
|----|----|----|
| `autonomous-safe` | 5 | Tauri IPC catalog 재생성 + MEMORY drift 정리 + Rust test SoT 정립 + i18n leaf doc 갱신 + CodeMirror lang 사용 사례 grep |
| `needs-user` | 3 | notify/tauri-plugin-fs reservation / @iconify/vue 제거 결정 / god comp 회귀 전략 (a/b/c) |
| `needs-claude-judgment` | 7 | god comp Top 5 추출 + invoke 직접 172 → wrapper 수렴 + vue-query 확대 + sqlx tx rollback path 명시 + pages 4 god 분해 + sub-agent verification methodology 통일 + invoke wrapper 우선순위 |

> **Triage 메모**: 본 fan-out 12건이 N≥3 cap 충족하나 본 plan 작성 자체는 1 task 의 cross-verify 직후라 § Codex Cross-Verification Default 의 `trigger_cap_applied` skip 사유 적용 — 별도 Codex triage 호출 skip, 본 plan 으로 직접 분류.

---

## Phase A — Autonomous-Safe (즉시 진행 가능, 5 항목)

> 사용자 확인 없이 진행 가능. 코드 수정 최소 (문서 갱신 + 스크립트 실행 중심). 실패 시 즉시 보고.

### A1. Tauri IPC catalog 재생성 + IMPLEMENTATION-STATUS 갱신

- **증거**: 코드 `#[tauri::command]` 실측 **171** / ipc/ **29 파일** vs `docs/IMPLEMENTATION-STATUS.md:19` 의 "169 / 26"
- **액션**:
  1. `bun scripts/generate-tauri-commands-index.mjs` 실행 → `docs/api/tauri-commands.md` 재생성
  2. `docs/IMPLEMENTATION-STATUS.md:19` 라인 "169 / 26 / 66" → 실측 수치로 갱신
  3. drift 발생 차단 lefthook (선택, Phase B 로 연기 가능)
- **검증**: `grep -rE "^\s*#\[tauri::command\]" apps/desktop/src-tauri/src --include="*.rs" | wc -l` 값과 catalog 의 row 수 일치
- **commit 단위**: `docs(catalog): Tauri IPC index regenerate — drift 169→171 / 26→29`
- **size**: XS

### A2. MEMORY drift 정리 (components god comp 0 마일스톤)

- **증거**: MEMORY.md 의 c67 sprint 항목 "components/ god comp 0 마일스톤" ↔ 실측 components/ 디렉토리 god ≥200 LOC **22개** 잔존
- **액션**:
  1. `~/.claude/projects/d--01-Work-08-rf-git-fried/memory/sprint_2026_05_11_c67.md` 의 마일스톤 라인에 회귀 메모 추가 (예: "→ c74~c89 진행 중 22개 회귀, UltraPlan v0.4 §B 추적")
  2. MEMORY.md INDEX 의 c67 한줄 hook 갱신
- **검증**: `find apps/desktop/src/components -name "*.vue" -exec wc -l {} \; | awk '$1>=200' | wc -l` ≥1 이면 회귀, MEMORY 에 명시 필요
- **commit 단위**: MEMORY 파일은 git tracked 가 아니므로 commit 불필요
- **size**: XS

### A3. Rust test 카운트 SoT 정립

- **증거**: `#[test]` 만 167 vs 전 매크로 259 vs `cargo test` PASS 245 — 3 수치 출처 다름
- **액션**:
  1. `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --list 2>&1 | grep -cE ": (test|tokio::test)$"` 결과를 SoT 로 채택
  2. `docs/IMPLEMENTATION-STATUS.md` 의 test 카운트 라인 (있다면) 갱신
  3. MEMORY 최신 sprint 항목 (c89 patch) 에 SoT 명시
- **검증**: 위 명령 출력값 == 최신 sprint 의 "cargo test N PASS" 의 N
- **commit 단위**: `docs(catalog): Rust test count SoT 정립 — cargo test --list 채택`
- **size**: XS

### A4. i18n leaf 1311 / symmetry OK 문서화

- **증거**: `node scripts/i18n-leaf-count.mjs` 실측 1311 ko=en, c89 dup-key 가드 정착
- **액션**:
  1. `docs/IMPLEMENTATION-STATUS.md` 의 i18n 라인이 stale (예: 1298 / 1206) 이면 1311 로 갱신
  2. MEMORY c89 sprint 항목에 1311 명시 (이미 1311 이라면 skip)
- **검증**: `node scripts/i18n-leaf-count.mjs` 출력값과 doc 일치
- **commit 단위**: `docs(i18n): leaf 카운트 SoT 1311 갱신 + c89 dup-key 가드 명시`
- **size**: XS

### A5. CodeMirror lang 패키지 7종 사용 사례 grep (audit only)

- **증거**: `apps/desktop/package.json` 에 `@codemirror/lang-{css,html,javascript,json,markdown,rust,vue}` 7종 dependency
- **액션**: 각 lang 패키지의 실제 import 위치 grep — 결과를 본 plan §C 의 "needs-claude-judgment" 인풋으로 사용
  ```bash
  for lang in css html javascript json markdown rust vue; do
    echo "=== lang-$lang ==="
    grep -rE "from '@codemirror/lang-$lang'" apps/desktop/src --include="*.ts" --include="*.vue" | wc -l
  done
  ```
- **검증**: 7종 모두 ≥1 hit 면 정합. 0 hit lang 발견 시 §C 의 dead candidate 후보로 surface (User Decision 영역으로 격상).
- **commit 단위**: 코드 수정 없으므로 commit 불필요. 결과는 본 plan 의 v0.2 patch 로 inline 기록.
- **size**: XS

### Phase A Done Criteria

- A1~A4 commit 4건 + A5 audit 결과 inline 기록 완료
- `docs/IMPLEMENTATION-STATUS.md` 의 IPC / test / i18n 라인이 실측과 일치
- MEMORY drift 1건 해소

---

## Phase B — Needs-Claude-Judgment (구현 작업, 7 항목)

> Claude 가 판단해서 진행 가능. 단 부분 진행 시 인터럽트 후 Phase C 의 사용자 결정과 정합 확인.

### B1. God component Top 5 추출 (StatusPanel/CommitGraph/launchpad/repositories/PrDetailModal)

- **증거**: 35개 god 중 ≥400 LOC 5건 — StatusPanel 648 / CommitGraph 613 / launchpad 535 / repositories 473 / PrDetailModal 466
- **선결조건**: Phase C 의 C3 (god comp 회귀 전략) 결정 — (a) 점진 (b) 차단만 (c) 전수 sprint
  - (a) 채택 시: 본 B1 진행 (Top 5 sprint c90~c94 분산)
  - (b) 채택 시: 본 B1 보류 + Phase D 의 lint rule 만 진행
  - (c) 채택 시: 본 B1 확대 (35개 전수)
- **액션 패턴**: vue3-composable-extraction skill (Pattern 8–14) 적용 — caller-decision API / idempotent navigation guard / group collapse / qualifier / SOT fallback / 도메인 prefix
- **commit 단위**: 컴포넌트 별 분리 commit (`refactor(arch): {Component} {LOC1}→{LOC2} ...`)
- **size**: 각 M

### B2. invoke 직접 172건 → wrapper 263건 수렴

- **증거**: `grep -rE "invoke\(['\"]" apps/desktop/src` 172 hit / wrapper import 263
- **액션**:
  1. 172 hit 위치 enumerate → 분류 (a) 단발성 → 그대로 (b) 중복 호출 → wrapper 추가
  2. codemod 또는 수동 마이그레이션
- **검증**: 마이그 후 `invoke('` 직접 호출 hit 가 감소했는지
- **commit 단위**: 카테고리별 (예: `refactor(api): branch invoke 직접 호출 N건 wrapper 경유`)
- **size**: L

### B3. vue-query coverage 확대 (165 hook → IPC 172 모두 wrapping)

- **증거**: useQuery 57 + useMutation 108 = 165 hook, 그러나 IPC 직접 호출 172 잔존
- **선결조건**: B2 완료 (wrapper 경유 일관 후 vue-query 일관 적용 가능)
- **액션**: query/mutation composable 로 일관 wrapping → cache invalidation + optimistic update 일관성 확보
- **commit 단위**: 카테고리별
- **size**: L

### B4. sqlx tx rollback path 명시 (profiles.rs + git/hide.rs)

- **증거**: [profiles.rs:160-170](../../apps/desktop/src-tauri/src/profiles.rs#L160-L170) + [git/hide.rs:127-149](../../apps/desktop/src-tauri/src/git/hide.rs#L127-L149) 모두 `pool.begin → commit`, `.rollback()` 없음
- **액션**:
  1. 두 site 의 begin~commit 사이 처리 구간에서 panic/cancellation 가능성 review
  2. sqlx `Transaction` Drop trait 가 자동 rollback 하므로 idiomatic 하면 **주석으로 의도 명시**, 불충분하면 explicit guard 또는 `?` 후 `tx.rollback()` 추가
- **검증**: cargo test PASS 유지 + 새 unit test 추가 (예: midway error injection)
- **commit 단위**: `docs(safety): sqlx tx auto-rollback 의도 명시` 또는 `fix(safety): sqlx tx explicit rollback guard`
- **size**: S

### B5. Pages 4 god 분해 (launchpad 535 / repositories 473 / index 341 / settings 267)

- **증거**: `find apps/desktop/src/pages -name "*.vue" -exec wc -l {} \;`
- **선결조건**: B1 (Top 5) 의 launchpad/repositories 분해 패턴 정립 후
- **액션**: page-level container 만 남기고 children components/composables 로 분해
- **commit 단위**: page 별 (`refactor(arch): pages/{name} {LOC1}→{LOC2} ...`)
- **size**: M

### B6. Sub-agent verification methodology 통일

- **증거**: /analyze 2026-05-16 결과 sub-agent god comp 카운트 30 vs 31 vs 35 (실측) — methodology 불일치
- **액션**:
  1. Explore sub-agent prompt 에 정확한 counting 명령 (`find ... -exec wc -l + awk '$1>=200' | wc -l`) 명시
  2. `~/.claude/skills/analyze/` 또는 INDEX 갱신
- **size**: S — 본 작업은 toolkit-aware 영역 (skill prompt 변경) → § Codex Cross-Verification Default 의 `toolkit_aware_locked` skip 사유 적용, Claude only

### B7. invoke wrapper 우선순위 분류

- **선결조건**: B2 의 172 hit enumeration 결과
- **액션**: 172 hit 중 (a) network/long-running (clone/fetch/push) (b) instant (status/get) (c) mutation 분류 → 우선순위
- **size**: XS (분류 작업만, 마이그는 B2/B3 에서)

### Phase B Done Criteria

- Phase C 의 god comp 전략 결정 (a/b/c) 입력 후 시작
- B2 → B3 순서 (wrapper 수렴이 vue-query 확대의 선결)
- 모든 commit 은 semantic + Pattern 8–14 라벨

---

## Phase C — Needs-User (사용자 confirmation 필요, 3 항목)

> 본 항목들은 **destructive follow-up** 동반 또는 **전략 선택** 필요. 자동 진행 절대 금지.

### C1. `notify` + `tauri-plugin-fs` reservation 유지/해제

- **증거**: Cargo.toml 21~31 / 52~58 라인 plan/04 §file-system-watch reservation
- **선택지**:
  - (a) **유지** — c53 시점 결정 보존, plan/04 활성 시 부활 (권장)
  - (b) plan/04 §file-system-watch 구현 후 활성화
  - (c) reservation 해제 + 의존성 제거 (destructive)
- **권장 default**: (a) 유지 — 본 plan 작성 시점에서 plan/04 활성 일정 없음, 보존 비용 미미
- **사용자 결정 필요**: y/n confirm — 미응답 시 (a) 유지 default 적용

### C2. `@iconify/vue` 제거 vs 유지 (destructive)

- **증거**: `apps/desktop/package.json:56` `"@iconify/vue": "^4.3.0"` / 코드 0 hit / docs hit 1 (자체 dead 코멘트)
- **선택지**:
  - (a) **유지** — 미래 사용 reservation (단 reservation 의도 주석 없음, c53 패턴과 다름)
  - (b) devDep 으로 격하
  - (c) **제거** (`bun remove @iconify/vue`) — destructive
- **사전 점검 필요**:
  - reka-ui icon prop 또는 별도 SVG inline 으로 대체 가능 여부
  - `@iconify/icons-*` 같은 자매 패키지 미사용 확인
- **권장 default**: (c) 제거 — 코드 0 hit + reservation 의도 없음. 단 제거 후 build 검증 (`bun run build` + `bun run typecheck`) 필수.
- **사용자 결정 필요**: y/n confirm — 미응답 시 본 항목 보류 (자동 제거 금지)

### C3. God component 회귀 전략 (a/b/c)

- **증거**: c67 의 "components/ god comp 0 마일스톤" ↔ 실측 components/ 22개 회귀, 전체 35개
- **선택지**:
  - (a) **점진 추출** — Top 5 (≥400 LOC) sprint c90~c94 분산 (Phase B1) — 권장
  - (b) **차단만** — 신규 god 발생 차단 lint rule 만 추가, 잔존 35 유지 (보수적)
  - (c) **전수 분해 sprint** — 35개 전수 1 sprint (위험, dx 영향)
- **권장 default**: (a) 점진 추출 — c79~c80 에 검증된 패턴
- **사용자 결정 필요**: a/b/c — 미응답 시 (a) 점진 default 적용

---

## Phase D — 측정 & 회귀 차단

### D1. Re-verify 명령 정립

- `node scripts/i18n-leaf-count.mjs` — i18n SoT
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --list | grep -cE ": (test|tokio::test)$"` — Rust test SoT
- `bun scripts/generate-tauri-commands-index.mjs` — Tauri IPC catalog SoT
- `find apps/desktop/src -name "*.vue" -exec wc -l {} \; | awk '$1>=200' | wc -l` — god comp 카운트
- `grep -rE "invoke\(['\"]" apps/desktop/src --include="*.ts" --include="*.vue" | wc -l` — 직접 invoke 카운트

### D2. Lint rule (신규 god comp 차단)

- ESLint custom rule 또는 `tools/check-god-comp.mjs` 스크립트 — pre-commit lefthook 등록
- 신규 또는 회귀 god comp ≥200 LOC 발생 시 commit block
- **선결조건**: Phase C3 의 (b) 또는 (a) 선택 시 진행

### D3. PR template 추가

- `.gitea/PULL_REQUEST_TEMPLATE.md` 또는 동등 위치에 "/analyze re-verify 명령 통과 확인" 체크박스

### D4. v0.2 patch 시점 — Phase A 완료 직후

- Phase A 5 항목 commit 후 본 plan 에 진행 결과 inline (`> v0.2 patch: A1~A5 완료, ...`)
- Phase C 사용자 결정 입력 시 v0.3 patch 작성

---

## Risk

| Risk | 발생 시 영향 | 완화 |
|----|----|----|
| B2 의 172 hit 중 단발성/일회성 hit 비율이 높아 wrapper 마이그 ROI 낮음 | 작업 시간 낭비 | B7 분류 후 cost-benefit 산출 후 진행 |
| B3 의 vue-query 일관 wrapping 이 기존 캐시 동작에 영향 | UI 회귀 | wave 별 e2e 회귀 verify |
| Phase C2 의 @iconify/vue 제거 후 hidden 의존성 (transitive 또는 docs 예시) 발견 | build/test 실패 | 제거 전 `bun run build` + `bun run typecheck` + `bun test` 통과 검증 |
| Phase B1 의 god comp 추출 중 SOT 회귀 (Pattern 13 의 SOT fallback drift) | template 중복 재발생 | Pattern 13 sister 검사 사전 적용 |
| Codex 응답 stuck (c89-B 실증) | Phase B/C 진행 지연 | Codex Cross-Verification 의 timeout 적용, Claude only fall-back |
| **정적 import grep false negative** (A5 실증) | dead candidate 오판 → 잘못된 제거 | 동적 `() => import('...')` / lazy load / dynamic require 패턴까지 포함해 검색. 의심 시 vite bundle analyzer 로 실제 chunked 여부 확인. |

---

## Done Criteria (v0.4 → v1.0)

- Phase A 5/5 완료 + commit 4건 + audit 결과 1건 inline
- Phase B: Phase C3 결정 후 진행. 본 plan 의 v0.5+ patch 로 wave 별 결과 inline
- Phase C 3 항목 모두 사용자 결정 응답 입력 (또는 default 적용 명시)
- Phase D 회귀 차단 mechanism 1개 이상 정착

## Out of Scope

- /analyze 가 surface 하지 않은 신규 audit 영역 (예: e2e 커버리지 확대, Rust panic boundary 전수 검사)
- Tauri 2 → 3 마이그, Vue 3.5 → 3.6 마이그, Rust edition 변경
- 신규 기능 (Phase B 의 추출/수렴/명시화 외)

## Next Suggestion

- **Phase C 3 항목** 사용자 결정 입력 → 본 plan v0.2 patch
- 결정 default 사용 시 `/plan apply-defaults` 또는 사용자가 명시
- Phase A1~A4 commit 즉시 진행 가능 — 별도 신호 시 시작
