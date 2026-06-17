# Plan #45 — 작업 리스트 전체 구현 계획 (Claude × Codex 페어)

> 출처: /analyze (2026-06-16) → work-list 추출(Claude×Codex) → grounding 워크플로(4 agent) → 초안 → **Codex 적대적 검토 병합** → 본 최종본.
> 범위: git-fried 본체. **codex 플러그인 remediation 제외**(별도 이슈 opnd-io/opnd-codex-plugin#18).
> 상태: **구현 완료 (2026-06-16)** — §7 완료 로그 참조. 구현·검증 가능 전 항목 Codex 페어 0건 수렴. B 는 사용자 결정(옵션 A)으로 deferred.

## 0. Grounding 요약 (계획 근거 — 모두 source-verified)

| 영역 | 핵심 사실 | 계획 영향 |
|---|---|---|
| CI | `.github/workflows/ci.yml`(Windows): **rust-test**(fmt→clippy `-D warnings`→`cargo test --all-features`) + **web-test**(typecheck→lint→vitest→ui-inventory --gate→prod-bundle-clean)이 push/PR 게이트. e2e-tauri 는 `workflow_dispatch` 수동만. tauri-build 은 main push. | acceptance = **CI checkset 전체 로컬 실행**(pre-push 는 typecheck+vitest 만 = strict subset, 회귀 위험) |
| 테스트 | vitest ~902 case(coverage gate lines15/fn37/branch78), cargo ~331 attr. 정확카운트 SoT=`node scripts/re-verify.mjs`(#5). e2e fixture: `seed_fixture_repo`(8 시나리오, `#[cfg(debug_assertions)]`) + `GIT_FRIED_DB_PATH` 격리 + `e2e/helpers/tauri-fixture.ts seedFixtureAndOpenRepo()`. | 신규 e2e 는 fixture 재사용; refactor 는 coverage 임계 하회 금지 |
| TS6 | **이미 typescript 6.0.3 설치+선언**, vue-tsc 3.2.9(TS6 호환). tsconfig bundler/verbatimModuleSyntax/isolatedModules = TS6-safe. 별도 assert 스크립트 없음, CI typecheck/build 가 이미 행사. | A = XS 정책 hygiene |
| 공급망 | cargo-deny/audit/deny.toml **전무**(greenfield). sqlx `default-features=false` 적용(rsa phantom). SECURITY.md 가 v1.x 로 defer. | E = install+deny.toml+CI step, **버전·advisory 정책 핀** |
| 보안 posture | repo_mutation_guard 66 + repo_lock 4, path 4-gate + reject_dash_prefix(CWE-88), CSP script-src 'self', capability fs **미부여**, secret_mask IPC serialize. 성숙. | M1 = confirmatory; 실결함 = H+F |
| hooksPath | `resolve_hooks_dir`(hooks.rs:177) 가 **절대/외부 override containment 검증 없이 신뢰** → `list_git_hooks(hooksPathOverride=...)` 임의 디렉토리 메타 열거 + 제한적 rename. hook **name** 만 `..` 가드. | H = 구체 결함, **High** |
| config writer | `.git/config --local` writer 4 중 3 guard/lock. **`set_repo_credential_identity`(forge_commands.rs:414)만 unguarded**(atomic+자체검증, race window). | F = guard 추가, **security 트랙** |
| deep-link | 스킴 `git-fried` **등록됨**(plugins.deep-link.desktop.schemes) + `deep-link:allow-get-current` 부여. 입력 처리 미감사. | **M8 신규** — deep-link 인자 인젝션 감사 |
| CSP | script-src 'self'(strict), **style-src `'self' 'unsafe-inline'` 존재**. | **M9 신규** — style-src 처분 결정 |
| Tauri 배포 | capability tight + updater 없음, **code signing 전무**(Windows Authenticode/macOS Developer ID+notarization). | M5 = 서명, cert 외부 → 분할 |
| 컴포넌트 | StatusPanel/CommitGraph/PrDetail script=~165/178/188 LOC, **bulk=TEMPLATE**, 이미 composable 다분해. | B = **template sub-component 추출** |
| CommitGraph perf | `drawGraph()` virtualization-aware 이나 **scroll 마다 full canvas clear+DPI resize, rAF throttle 부재**(정적 추정). | M3 = rAF + perf+**interaction** 테스트 |
| 캐시 무효화 | 중앙 helper=정확히 5키. **gap**: `annotateExistingTag`(useTagInteraction.ts:144)가 `['tags']`만 → graph tag ring stale. `refetchOnWindowFocus:true` 대부분 self-heal. | M2 = tag 무효화 fix |
| 백엔드 | DB: 9 migration, `sqlx::migrate!` 매 open, **backup/integrity/rollback 전무** → 실패 시 `lib.rs:181 .expect` abort. 장기 op: async(UI freeze 없음)이나 **clone/fetch/push/bulk_fetch timeout·cancellation·progress 전무**(child-kill 은 timeout opt-in 시만 동작). 로그: tracing/stderr sink **미마스킹**, 일부 Display 경로(bulk.rs:86/100) masked Serialize 우회. | M6/M4a-c/M7 구체 경로 |

## 1. 페이즈 구성 & 시퀀싱 (Codex 병합)

```
Phase 0  정책 결정 (코드 변경 최소)
   A TS6 caret 결정 · C reka-ui 결정 · D notify 결정
Phase 1  보안 (BE, 항목별 회귀테스트 필수)
   H hooksPath containment(first) · F config-writer guard · G git-apply 회귀
   M7 tracing 마스킹+Display 가드 · E cargo-deny baseline(버전핀)
   M8 deep-link 인자 감사 · M9 CSP style-src 처분 · M1 confirmatory sweep(last)
Phase 2  백엔드 복원력 (M6 → M4)
   M6 DB integrity/backup/recovery(M4 전) · M4a timeout · M4b cancellation
Phase 3  프론트 품질/perf (FE, Phase1~2 와 병렬)
   M2 tag 무효화(first) → M3 graph rAF+interaction(M2 후) → B template 추출(CommitGraphRow=M3 병합)
Phase 2/3 bridge
   M4c progress streaming (BE cancellation 안정화 + FE surface 안정 후)
Phase 4  배포 (cert 취득 완료 → 차단 해제; updater 는 나중)
   M5a 서명 설계+체크리스트(now) · M5b 서명/notarization 구현(now 가능)
```

**Codex 가 바꾼 시퀀싱**:
- **F·G → Phase 0 quick win 에서 Phase 1 보안 트랙으로 이동** (mutation-guard 커버리지/traversal 동작 검증이라 보안 acceptance 필요).
- **M2 → M3 앞** (graph 가 tag 상태 렌더 시 stale tag 가 M3 perf 검증 오염).
- **M6 → M4 앞** (backup/WAL/rollback 이 후속 long-op 복원력 보호).
- **M4 단일 L → M4a/M4b/M4c 분할** (timeout/cancellation/progress 는 correctness·계약 상이; M4c 는 BE/FE bridge 라 BE-only 에 숨기지 말 것).
- **M5 → M5a(설계 now)/M5b(procurement 후)** 분할.
- **M1 → H/F/M7 후 last** (알려진 결함 재발견 아닌 잔여 surface 검증).

**트랙 병렬**: Phase 1(BE 보안) · Phase 3(FE) 병렬 안전. 예외 = **M4c progress 는 Tauri Channel 로 BE↔FE 교차** → FE 가 CommitGraph/status surface 재구성 중이면 격리 불가, 마지막 bridge 로.

## 2. 항목별 구현 계획

### Phase 0 — 정책 결정

#### A. TypeScript 6.0 caret 결정 — XS / Low
- TS6 는 이미 6.0.3 설치+CI 행사 중.
- **결정(2026-06-16): 정석대로 `^6.0.3` caret 유지** — npm/semver 관례 + `bun.lock` 이 resolved 버전을 핀하므로 CI 재현성 보존(caret 가 무통제 drift 유발 안 함). `~6.0.x` 핀 불필요.
- 작업 = main CI green 확인(green 이면 TS6 이미 검증됨)만. package.json 변경 없음.
- **Acceptance**: 최신 main CI(web-test/rust-test) green 확인 기록; 로컬 typecheck/build green.

#### C. reka-ui 방향 결정 — XS / Low
- reka-ui = BaseTooltip 1곳(tooltip primitives). 나머지 overlay 는 useModalStack/useFocusTrap hand-rolled(Plan #44 투자). **권장: tooltip 전용 유지**(확대=투자 대체, ROI 낮음).
- **Acceptance**: 결정 기록 (코드 변경 없을 가능성).

#### D. notify 6.1 결정 — XS / User Decision
- **권장: 유지**(plan/04 file-watch 로드맵)+Cargo.toml 근거 주석. 또는 제거.

### Phase 1 — 보안 (항목별 회귀테스트 필수)

#### H. core.hooksPath override 경고+허용 + 대조 — M / **High** (first)
- **결함**: `resolve_hooks_dir`(hooks.rs:177)가 절대 override verbatim, 상대는 `..` 미검증 join → renderer 가 임의 `hooksPathOverride` 로 임의 디렉토리 메타 열거 + 제한적 rename.
- **결정(2026-06-16): (c) 경고+허용** — 외부 core.hooksPath 하드 거부 안 함(중앙 공유 hooks 보존). 설계:
  1. **renderer override 대조**: IPC `hooksPathOverride` 를 *임의 경로로 신뢰하지 말고* repo 의 실제 `git config core.hooksPath` 값과 대조 — 일치(또는 미지정 시 `.git/hooks`)만 사용. arbitrary 열거 벡터 차단의 핵심.
  2. **외부 경로 경고**: 해석된 hooks dir 이 repo root 밖이면 `external: true` 플래그를 응답에 실어 UI 경고 노출(차단 X).
  3. **rename 안전**: activate/deactivate 는 기존 hook-name `..` 가드 유지(이미 있음). 외부 경로에서도 동작하되 경고.
- **회귀테스트**(item-specific): (a) 실제 config 와 다른 임의 `hooksPathOverride` 전달 시 무시/거부(arbitrary 열거 불가), (b) 외부 core.hooksPath 정상 동작 + `external` 경고 플래그, (c) repo 내부 정상.

#### F. config-writer guard 추가 — S / Medium
- **결함**: `set_repo_credential_identity`(forge_commands.rs:414)가 유일 unguarded `.git/config` writer.
- 단계: repo_path 획득 후 git config write 전 `let _guard = state.repo_mutation_guard(repo_id).await;`.
- **회귀테스트**: 동일 repo 에서 credential identity ↔ apply_repo_config 동시 호출 직렬화 확인 (다른 3 writer 와 parity).

#### G. `git apply` traversal 회귀 테스트 — S / Medium
- stage.rs:88/100/118 `git apply --cached [--reverse] -`, `--unsafe-paths` 미사용.
- **테스트**: (a) `../` patch header 거부 assert, (b) CRLF/rename/binary/context-drift/한글 경로 hunk round-trip(fixture 결정성 핀 활용), (c) `--unsafe-paths`/`--directory` 미사용 정적 lock.

#### M7. tracing 마스킹 + Display 가드 — M / Medium
- **gap**: 전역 tracing sink(lib.rs:163-169) 미마스킹; `%e`·`bulk.rs:86/100 .to_string()` 가 masked Serialize 우회(현재 GitCli::Display 가 stderr 제외라 안전, fragile).
- 단계: (1) tracing 에 redacting `MakeWriter`/layer(`mask_secrets`), (2) Display 기반 String 에러를 masked 경로 전환 또는 "Display 는 secret 미포함" 불변식 테스트 고정.
- **테스트**: PAT 주입 후 tracing/stderr 마스킹 확인; bulk error String 마스킹.
- **risk**: redacting writer 가 로그 hot path → 정규식 비용 측정.

#### E. cargo-deny 공급망 baseline — M / Medium
- greenfield: (1) `cargo install cargo-deny`(**버전 핀**), (2) `deny.toml`(advisories: rsa phantom `ignore`+사유, bans: sqlx 최소 feature, licenses, sources), (3) CI 신규 step(별도 job 권장 — clippy gate 와 독립), (4) **advisory-db live vs cached 정책 결정**(Windows CI 캐싱 제약 needs-verification).
- **risk**(Codex): advisory-db/network/tool-version flakiness → 버전+advisory 동작 핀으로 CI churn 방지.
- **Acceptance**: `cargo deny check` 로컬 통과 + CI step green + rsa ignore+사유.

#### M8. deep-link 인자 인젝션 감사 — S / Medium (신규, Codex)
- **사실**: 스킴 `git-fried` 등록 + `deep-link:allow-get-current`. 입력 처리 미감사.
- 단계: deep-link payload 파싱 경로 추적 → URL/인자가 git command·path·shell 로 흐르는지 + reject_dash_prefix/path containment 적용 여부 확인. 미적용 시 가드.
- **Acceptance**: 악성 deep-link URL(traversal/dash-injection) 거부 테스트.

#### M9. CSP style-src 처분 — XS / Low (신규, Codex)
- **사실**: `style-src 'self' 'unsafe-inline'`(Vue/Tailwind inline style 때문에 제거 난이도 있음).
- **결정**: accept(문서화) / nonce·hash 로 제거 / defer. 권장: 현 단계 accept+근거 기록(Vue scoped style 의존).

#### M1. IPC guard confirmatory sweep — S / Medium (last)
- H+F 후. 66 guard + 4 repo_lock 외 destructive cmd union 누락 0 확인 + sync no-guard 정책 재확인. read-only/network 분류표 1장. 신규 결함 시 별도 항목 승격.

### Phase 2 — 백엔드 복원력 (M6 → M4)

#### M6. SQLite migration/backup 복원력 — L / Medium-High (M4 전)
- **gap**: open 실패 시 `lib.rs:181 .expect` abort. integrity/backup/rollback 전무.
- 단계(Codex 가 요구한 명세): (1) open 전 `PRAGMA quick_check`, (2) **backup 시점 명시**(migrate 직전) + **WAL checkpoint 전략**(naive file-copy 는 WAL 모드서 비일관 → `VACUUM INTO`/online backup API 검토), (3) **partial migration 실패 처리**(부분 적용 후 실패 시 복원), (4) **사용자 recovery/opt-out 경로**(abort 대신 백업복원 또는 안내+재생성), (5) **disk-space 실패 동작**.
- **회귀테스트**: 손상 DB 주입 시 abort 대신 recovery/안내; 정상 open 회귀; 대용량 DB backup 비용 측정.

#### M4a. clone/fetch/push timeout — M / Medium
- 기존 timeout 머신(runner.rs:181-200 child-kill)을 clone/fetch/push/bulk_fetch 에 bounded 옵션으로 적용. fetch/push 의 "의도적 무제한"은 **취소가능 무제한 + 상한 옵션**으로 재설계.
- **Acceptance**: timeout 시 child 종료+reap+lock 해제 확인.

#### M4b. cancellation IPC + AbortHandle — L / **High** (M4a 후)
- **gap**: in-flight git op 취소 IPC/AbortHandle 전무.
- 단계: job registry(AbortHandle) + `cancel_git_op(job_id)` IPC + runner child-kill 연결.
- **risk(Codex first-class)**: 취소가 **repo_lock 반드시 해제** + killed git child 가 **stale .git/*.lock 파일 미잔존** + credential prompt/remote negotiation 중간상태 정리 + "취소가 cleanup 완료까지 대기하는가" 정의.
- **회귀테스트**: lock 보유 중 취소 → child 종료 + lock 해제 + .git lock 파일 정리 e2e(fixture remote).

#### M4c. progress streaming — M-L / Medium (Phase 2/3 bridge, 마지막)
- Tauri `Channel<String>` 로 clone/fetch `--progress` stderr 스트리밍(ai/runner.rs v0.2 패턴) + FE 진행률 UI. **BE cancellation(M4b) 안정 + FE surface 안정 후**.

### Phase 3 — 프론트 품질 / perf (FE 트랙, Phase 1~2 병렬)

#### M2. tag 캐시 무효화 fix — S / Medium (first)
- `annotateExistingTag`(useTagInteraction.ts:144) onSuccess 에 `invalidate(id)`(5키) 또는 최소 `['graph']`+`['log']` 추가. tag 생성/삭제 경로 동일 점검.
- **회귀테스트**: tag annotate 후 graph tag ring/CommitRefPill 갱신 e2e(fixture); queryWrappers 확장.

#### M3. CommitGraph scroll perf — M / Medium (M2 후)
- (1) scroll-driven `drawGraph` rAF throttle/coalesce, (2) DPI resize 를 크기 변경 시만, (3) perf 테스트(고 maxLane + 5000행 `manybranches` fixture).
- **risk(Codex)**: rAF coalesce 가 **sticky row/selection/hover/canvas hit-test 타이밍** 변경 → perf 테스트에 **interaction correctness 포함**(프레임수만 X).
- **Acceptance**: drawGraph 가 rAF 당 1회 coalesce + interaction 회귀 green + ui:sweep.

#### B. god component template 추출 — M+M+M / Low-Medium (분할)
- **CommitGraphRow.vue**(CommitGraph.vue:507-652 + 6컬럼 switch) — **M3 후/병합**, v-memo unblock 동반.
- **StatusFileRow/StatusSection.vue**(4섹션×2모드 ~8 중복 `<li>` 통일; Staged 는 이미 FileRow) — M3 와 병렬 가능.
- **PrConversationTab/PrSuggestionForm/PrReviewForm**(PrDetailModal.vue:242-465, PrFilesTab 패턴) — 병렬 가능.
- **Acceptance**: 각 추출 후 vitest + ui:sweep(33 surface) + 시각 회귀(§UI Breakage 13범주) + coverage 임계 유지 + LOC 감소 기록. **컴포넌트별 독립 PR**.

### Phase 4 — 배포

#### M5a. 서명 설계 + 체크리스트 — M / now
- Windows Authenticode + macOS Developer ID/notarization 설정 설계(tauri.conf.json 키 + release.yml 단계) + cert 적용 체크리스트.
- **결정(2026-06-16): updater 는 나중**(defer) — 본 plan 범위 제외, 별도 threat-model 결정 시점에.

#### M5b. 서명/notarization 구현 — L / **차단 해제(cert 취득 완료)**
- **결정(2026-06-16): cert 취득 완료** → procurement 대기 불필요, M5a 직후 구현 가능. macOS 서명 트랩(openssl 3.x `-legacy` p12 등) = docs/solutions 참조.
- **Acceptance**: 서명 MSI/NSIS SmartScreen 경고 감소; release.yml 산출물 검증.

## 3. 의존성 그래프 & Tier

```
Phase 0 (A·C·D)  독립
Phase 1 (BE 보안)  H(first) ∥ F ∥ G ∥ M7 ∥ E ∥ M8 ∥ M9  → M1(last, H/F/M7 후)
Phase 2 (BE 복원력)  M6(first) → M4a → M4b → (M4c bridge)
Phase 3 (FE)  M2(first) → M3 → B(CommitGraphRow); B(StatusPanel)∥B(PR) 병렬
Phase 4  M5a(now) → M5b(cert procurement User Decision 후)

병렬: Phase1(BE) ∥ Phase3(FE). M4c 는 BE cancellation+FE surface 안정 후 bridge.
```

- **Tier HIGH**: H, F, M4b (+ A 는 빠른 hygiene).
- **Tier MEDIUM**: G, M7, E, M8, M6, M4a, M2, M3, M1.
- **Tier LOW**: M9, B, C.
- **User Decision (✅ 2026-06-16 결정 완료)**: ~~A caret~~→유지(정석), ~~H 외부 hooksPath~~→경고+허용, ~~M5 cert~~→취득완료(M5b 차단해제), ~~updater~~→나중(defer). **잔여**: D(notify, 권장 유지), C(reka-ui, 권장 tooltip 전용), E advisory-db 정책, M9 style-src 처분.

## 4. 공통 Acceptance 규율 (CLAUDE.md ci-checkset-exceeds-local)

1. **CI checkset 전체 로컬**(pre-push subset 아님): `cargo fmt --check` + `cargo clippy -- -D warnings` + `cargo test --all-features` + `bun typecheck` + `bun lint` + `bun test` + `ui-surface-inventory --gate` + `check-prod-bundle-clean`.
2. 정확 테스트 카운트 = `node scripts/re-verify.mjs`(#5, grep 금지).
3. 보안/백엔드 항목은 **item-specific 회귀 + runtime e2e**(fixture+GIT_FRIED_DB_PATH, 실 백엔드) — unit-only PASS 금지(§Verification Discipline). 항목별 named 회귀: H 외부 hooksPath / F credential writer guard / G git-apply traversal / M8 악성 deep-link / M2 tag-ring refresh / M3 scroll coalesce+interaction / M6 corrupt-DB open / M4b cancel-while-locked.
4. FE 항목은 **ui:sweep(33 surface) + §UI Breakage 13범주**.
5. 1 commit = 1 workstream; B/M4 는 분할 PR.

## 5. 비고 (이미 방어 확인 — 작업 아님)

- open-path traversal(`open_path_in_explorer` canonicalize+ancestor), SSH injection, secret_mask IPC serialize(masked), capability fs 미부여, CSP script-src 'self', git_run UTF-8/safe.directory/-c, child-kill-on-timeout(runner.rs:181-200 — M4 의 결함은 "장기 op 무제한+취소불가"이지 kill 자체는 동작).

## 6. Codex 페어 검토 병합 로그

Codex(GPT-5.x) 적대적 검토(no-shell, 인라인) 반영:

| Codex 지적 | 반영 |
|---|---|
| F/G 를 Phase 0 quick win 아닌 **보안 트랙** | Phase 1 이동 + 보안 acceptance |
| A 과대평가 | XS/Low 강등 (TS6 이미 CI 행사) |
| F 과소(XS) | S/Medium (parity 증명 필요) |
| H external hooks 호환 underweight | **선결 정책 결정** 추가 (거부/read-only/경고) |
| M4 단일 L | **M4a/M4b/M4c 분할** + M4c BE/FE bridge |
| M5 procurement 의존 | **M5a 설계/M5b 구현** 분할 |
| M6 rollback 명세 부족 | WAL checkpoint/backup 시점/partial-fail/opt-out/disk-fail 명세 |
| M2 → M3 앞 | tag stale 가 M3 perf 오염 → 순서 고정 |
| M3 interaction correctness | perf 테스트에 sticky/selection/hover/hit-test 포함 |
| M4b ↔ repo_lock first-class risk | cancel→lock 해제+.git lock 정리 회귀 명시 |
| E 버전/advisory 핀 | deny.toml + 버전핀 + advisory 정책 결정 |
| deep-link 감사(needs-verification) | **grounding 으로 해소 → 스킴 등록 확인 → M8 신규** |
| CSP style-src(needs-verification) | **grounding 으로 해소 → 'unsafe-inline' 확인 → M9 신규** |
| acceptance 항목별 named 회귀 | §4.3 에 8개 named 회귀 명시 |

**Codex 최종 build 순서**(채택, M8/M9 fold-in): ① A·C·D 결정 → ② H·F·G(파일 비충돌 시 병렬)·M8·M9 → ③ M7(②와 병렬) → ④ E(버전핀, ②③과 병렬) → ⑤ M1(H/F/M7 후) → ⑥ M6 → ⑦ M4a → ⑧ M4b(lock cleanup 테스트) → ⑨ M2(BE owner 분리 시 ⑥⑦과 병렬) → ⑩ M3(coalesce+interaction) → ⑪ B(CommitGraphRow 는 M3 후/병합; StatusPanel·PR 병렬) → ⑫ M4c(cancellation 안정 후) → ⑬ M5a → ⑭ M5b(cert 후).

## 7. 구현 완료 로그 (2026-06-16)

**18 commits** `d64d405..1060fb5` (main 직접). 전 단계 Codex 페어 적대적 리뷰 → 0건 수렴.

| Phase | 항목 | commit | Codex 페어 결과 |
|---|---|---|---|
| prereq | conflict_prediction graceful degrade (git 2.38+) | dea9b1d | baseline 복원 |
| prereq | rust-1.95 clippy 8 lint | 9c2c676 | toolchain drift |
| 1 | F credential guard | 31574ba | — |
| 1 | G git-apply traversal test | 87bbe99 | — |
| 1 | H hooksPath 서버측 해석 | a4b5520 | audit BLOCKER=false positive(검증 기각) |
| 1 | M9 CSP/hooksPath doc | 312f068 | — |
| 1 | M7 tracing/bulk 마스킹 | 6feed48 | — |
| 1 | E cargo-deny baseline | 414ff64 | CI-validated |
| 1 | M8 deep-link / M1 IPC sweep | (코드무) | M8 이미 hardened, M1 0 unguarded |
| 2 | M6 DB graceful recovery | b090306 | **BLOCKER M6.3 stale-WAL 수정** |
| 2 | M4a backstop timeout | a515ec0 | — |
| 2 | M4b cancellation 메커니즘 | 2c516cd | **BLOCKER M4b.5 unregister race 수정** |
| 2 | Phase 2 Codex fixes | c3240f6 | 재리뷰 0건 |
| 3 | M2 tag cache invalidation | 0eab72b | — |
| 3 | M3 CommitGraph rAF perf | 9cd5ed3 | M3 selection-regression refuted |
| 3 | M4c clone 취소 UI | d130b37 | — |
| 3 | Phase 3 Codex fixes (M2확장+M4c UX) | 1060fb5 | 최종리뷰 0건 |
| 4 | M5a 서명 설계 + 체크리스트 | f055f18 | M5b CI(release.yml gated signtool) pre-exists |

**검증**: cargo test 333 · vitest 929(94 files) · clippy -D warnings 0 · typecheck/lint/i18n대칭 green.

**B 진행 (2026-06-17, GUI 검증 환경 확보 후)**:
- **B-1 StatusFileRow** — ✅ 완료(commit ee22fcf). StatusPanel 5 중복 `<li>`(staged-tree / modified-path / modified-tree / untracked-path / untracked-tree) → DOM-identical 공용 컴포넌트(7 prop + 액션 slot). title/span-title 은 depth 파생, Conflicted 2 변형은 구조 상이(destructive)라 의도적 제외, Staged-path 는 기존 FileRow 유지. 검증: typecheck 0 / lint 0 / vitest 929 / **ui:sweep 시각 회귀 0**(route-01-index ✓ clip0 off0, console 0). StatusPanel 668→630, god-comp Layer A 이탈(template-heavy INFO 만).
- **B-3 CommitGraphRow / B-2 PrConversationTab** — deferred (증거 기반, clean template lift 아님):
  - **B-3**: commit row 헬퍼가 `useGraphRefVisibility`(soloRef/hiddenRefs **state**) + `useCommitGraphPresentation` 출처. sticky overlay(부모, CommitGraph.vue:459)와 rows 가 동일 ref-visibility state 공유 → 자식 composable 재인스턴스화 시 state desync → ~18 prop/함수번들 하향(Vue anti-pattern) 필요. clean 형태(v-memo unblock)는 outer wrapper div 재설계(DOM 변경)인데 코드 주석(CommitGraph.vue:507-509)이 이미 별도 sprint 로 명시.
  - **B-2**: `usePrMutations`(PrDetailModal:103)가 conversation 탭(addComment/review/suggestion) + 항상-표시 `#footer`(merge/close/reopen, :477-527) **양쪽 공급** → PrFilesTab 식 자체-소유 불가. clean 형태는 composable 분할(shared infra 변경) 필요.
  - 둘 다 *hacky* 추출(함수번들 prop / composable 중복)은 god comp 보다 유지보수성 **악화** → B 목적 역행. **composable 분할(B-2) / v-memo wrapper 재설계(B-3)** 를 다루는 별도 focused sprint 로 분리 권고.

**미완 (deferred, 사용자 결정)**:
- **M5b tauri.conf.json 서명 키 + macOS** — cert 보유 후 사용자 적용 (CI scaffold 는 완료). updater 는 defer.
