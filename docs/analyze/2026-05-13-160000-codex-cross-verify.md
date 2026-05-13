# Codex 독립 검증 결과 — Recommendations Deep-Dive Cross-Verify

- **Base 문서**: [2026-05-13-155359-recommendations-deep-dive.md](2026-05-13-155359-recommendations-deep-dive.md)
- **Codex agent**: `aead7b295a547acaa` (codex:codex-rescue, xhigh effort)
- **Audit 시작**: 2026-05-13 15:54 / **결과 도착**: 2026-05-13 16:00 (≈ 6분, 단 sandbox 권한 거부로 일부 명령 차단)
- **수렴 패턴**: Claude **git 실측 SoT** ↔ Codex **MEMORY.md 본문 trust** — 두 결과 disagree 시 git 실측이 우선

---

## Disagree 분석 (가장 중요)

Codex 의 verdict 표 7 항목 중 **2건 (b/c) disagree**. 두 경우 모두 **catch-22 패턴** 발생:

> Claude 의 본 검토 자체가 "MEMORY drift (c78~c80 sprint 항목이 main HEAD 에 미반영)" 를 발견한 시점에 — Codex 는 동일 MEMORY.md 본문을 SoT 로 trust 하여 "c78 에서 이미 해소됨" 판단. **즉 검증 대상이었던 drift 가 검증자 자체를 오염**.

### (b) panic hook — Claude 맞음

| 측 | 단정 | SoT |
|---|---|---|
| Claude | "lib.rs:run() 에 set_hook 없음 / git log --all 0 매치 → HIGH-1 권고 유효" | `grep -rEn 'set_hook\|panic_hook' apps/desktop/src-tauri/src` = 0 / `git log --all --oneline \| grep -iE 'panic_hook'` = 0 |
| Codex | "c78 catalog 에 panic hook 이미 정착, c79 ARCH-004 panic_hook.rs 모듈 분리 완료, 추가 권고 ROI 낮음" | MEMORY.md sprint_2026_05_12_c78.md 본문 |

**판정**: Claude. 부모 컨텍스트 재검증으로 `find apps/desktop/src-tauri -name '*panic*'` = 0 files / `grep set_hook lib.rs` = 0 매치 / `git log --all --oneline | grep -iE "panic_hook|panic hook"` = 0 매치 — 세 각도 모두 미존재.

### (c) CommitGraph sticky 분리 — Claude 맞음

| 측 | 단정 | SoT |
|---|---|---|
| Claude | "현재 script LOC 정확히 200, c75 마일스톤 197 회귀, HIGH-2 추출 권고" | `awk '/<script setup lang="ts">/.../<\/script>/' CommitGraph.vue \| wc -l` = 200 |
| Codex | "c78 에서 useCommitGraphStickyLayout + useCommitGraphLifecycle 추출하여 202→197 LOC 회복 완료" | MEMORY.md c78 본문 |

**판정**: Claude. `find apps/desktop/src/composables -name 'useCommitGraphStickyLayout*'` = 0 files, 현재 CommitGraph.vue 의 useCommitGraphStickyLayout import 0건. c78 의 추출 작업은 실 commit 미존재.

### MEMORY drift 본질

MEMORY.md 의 sprint catalog (c78~c80) 가 **main HEAD 에 반영되지 않은 워크 트리 또는 작성 오류**:
- `git worktree list` 결과 확인 가치 (별도 작업)
- 또는 단순 MEMORY 작성 시 commit hash 누락 + 작업 완료 마킹 오류

본 검증의 가치: **MEMORY.md 를 SoT 로 사용하면 다른 sub-agent / Codex / 후속 Claude 세션 모두 동일 함정에 빠짐**. § Verification Before Reporting 의 "validator SoT 우선" 룰 강화 필요.

---

## Codex 1차 verdict 표 (전체)

| # | Claude 단정 | Codex verdict | confidence | 보정 (Claude 검증 후) |
|---|---|---|---|---|
| (a-1) | e2e REJECTED | INSUFFICIENT_EVIDENCE — sandbox `Get-ChildItem -File e2e` 거부 | uncertain | **Claude REJECTED 유지** (root `e2e/` 디렉토리 10 spec 직접 ls 확인) |
| (a-2) | 빈 catch REJECTED | INSUFFICIENT_EVIDENCE — 빈 catch grep 결과 전체 미수집 | uncertain | **Claude REJECTED 유지** (multi-pattern grep + 표본 검증) |
| (b)   | panic hook 권고 (HIGH-1) | LIKELY VALID "이미 c78 정착" (실제 disagree) | likely | **Claude HIGH-1 유지** (git 실측 SoT) |
| (c)   | CommitGraph sticky (HIGH-2) | LIKELY VALID "c78 해소" (실제 disagree) | likely | **Claude HIGH-2 유지** (file 실측 200 LOC) |
| (d)   | god comp 17건 | INSUFFICIENT_EVIDENCE — 시점/임계 명시 부족 | uncertain | **Claude 17건 (≥150 LOC) 유지** — 임계 명시 보강 가능 |
| (e)   | bun outdated 우선순위 | INSUFFICIENT_EVIDENCE — 실 실행 결과 미수집 | uncertain | **Claude 결과 유지** — bun outdated 직접 실행 결과 보유 |
| (f)   | MEMORY drift | LIKELY VALID — WARNING 메시지 직접 인용 + c78 catalog 자체 정정 기록 | likely | **상호 CONFIRMED** |

**상호 CONFIRMED**: 1건 (f)
**Codex INSUFFICIENT_EVIDENCE → Claude 자체 검증 통과**: 4건 (a-1, a-2, d, e)
**Disagree → Claude SoT 우위**: 2건 (b, c)

---

## Codex 가 발견한 NEW 후보 (2차)

### NEW HIGH — MEMORY.md 24.4KB hard limit 초과 운영 리스크

**증거**: 본 세션 상단 system reminder:
```
WARNING: MEMORY.md is 26.9KB (limit: 24.4KB) — index entries are too long.
Only part of it was loaded. Keep index entries to one line under ~200 chars;
move detail into topic files.
```

**Codex 평가**: "후속 세션의 컨텍스트 로드가 부분적 — drift 보정 자체가 부분 로드 환경에서 이루어질 가능성. drift 의 근본 원인."

**Claude 보정**: 합리적. 본 검토에서 MEMORY drift 의 영향이 직접 surface 됨. Sprint c80 묶음에 **선행 처리** 가치 있음.

**액션 (S effort)**:
- MEMORY.md 의 c78~c80 sprint 항목 (각 ~500자) → topic 파일로 이동 (`memory/sprint_2026_05_12_c78.md` 등 이미 존재할 가능성, 인덱스만 슬림화)
- 인덱스 한 줄 cap ~200자 강제 (현재 일부 항목 ~3000자)
- 추가: c78~c80 항목 중 실 commit 미반영분 검증 후 별도 마킹 ("⚠ MEMORY ONLY — main 미반영") 또는 제거

### NEW MEDIUM — prettier multi-line 자동 분해 toolkit /teach 미정착

**증거**: Codex 가 MEMORY 의 c76/c78/c79 catalog 에서 prettier multi-line 회귀 패턴 3회 반복 검출:
- c76-fix `0688302`: "prettier multi-line 회복 (god comp <200 유지)" — 실제 202 회복 (MEMORY 부정확)
- c78 catalog: "prettier multi-line 자동 분해 회피 (const + return 명시 split)"
- c79 catalog: "prettier import multi-line 자동 분해 함정"

**Codex 평가**: "c79 catalog 가 명시적으로 'toolkit /teach 후보' 로 표시했으나 실제 skill 정착 commit 없음 — 동일 함정 재발 가능."

**Claude 보정**: 단 c78~c79 자체가 main 미반영 가능성 (MEMORY drift) — 함정 자체는 실재 (Claude 본 deep-dive 문서에서도 HIGH-2 회귀 가드로 동일 우려 표명).

**액션 (S effort)**:
- ~/.claude/skills/universal/dev/ 에 `prettier-multiline-safe-extraction` 스킬 신설 (Pattern: named function + 1-line destructure + printWidth 100 미만 가드)
- 또는 기존 `vue3-composable-extraction` skill (1121 LOC) 에 Pitfall 9 로 추가

---

## Codex 의 sandbox 한계 (참고)

Codex `codex-rescue` 의 PowerShell sandbox 에서 거부된 명령 5건:
- `git rev-parse --short HEAD; git branch --show-current` — chained 명령 거부
- `rg -n "test:e2e|playwright|@playwright"` — quote escape 문제
- `Get-ChildItem -File e2e` — 디렉토리 ls 거부 (별도 격리 정책)
- `Get-ChildItem -File e2e | Select-Object` — 동일

**개선 후보**: codex-rescue 의 PowerShell sandbox 정책에 chained 명령 + quote escape 허용 + 디렉토리 ls 허용 추가 (codex-companion 측 별도 작업).

---

## 보정된 Sprint c80 묶음 (Codex 의 NEW 후보 통합)

| 우선 | 항목 | Tier | Size | 의존성 | 회귀 위험 |
|---|---|---|---|---|---|
| **0** | **NEW HIGH — MEMORY.md 슬림화** (Codex 발견) | HIGH | S | 인덱스 cap 적용 + c78~c80 drift 마킹 | LOW |
| 1 | HIGH-1 Rust panic hook + mask_secrets | HIGH | M | secret_mask.rs (이미 ready) | LOW |
| 2 | HIGH-2 CommitGraph.vue 200 → 188 | HIGH | S | useCommitGraphStickyLayout 신규 | LOW |
| 3 | MEDIUM-4 patch/minor 14개 일괄 bump | MEDIUM | XS | bun.lock 동시 staging | LOW |
| 4 | **NEW MEDIUM — prettier skill /teach** (Codex 발견) | MEDIUM | S | 기존 vue3-composable-extraction skill 확장 | LOW |
| 5 | MEDIUM-1 god comp wave (≥180 4건) | MEDIUM | M | Pattern 9 family | MEDIUM |
| 6 | LOW-3 useCommandCatalog toggle 분리 | LOW | S | 측정 후 결정 | MEDIUM |

**1차 sprint (c80) 강력 권장 묶음**: **0 + 1 + 2 + 3 = 4 commit** (MEMORY 슬림화 + panic hook + CommitGraph + patch bump). 모두 회귀 위험 LOW + ROI 명확. **MEMORY 슬림화를 가장 먼저** 처리해야 후속 sprint 의 catalog 신뢰도 회복.

### 새 묶음 의의

- MEMORY 슬림화가 **사전 작업** — 이후 sprint catalog 의 "drift 가능" 메타 의심 제거
- panic hook + CommitGraph 분리는 기존 Claude 권고 유지
- prettier skill 은 god comp wave (sprint 5번) 시작 전에 정착되면 회귀 차단

---

## 종합 의견

본 cross-verify 의 핵심 발견은 **"MEMORY drift 가 Codex 검증자 자체를 오염" 시켰다는 메타 결론**. 이는 단일 외부 source 신뢰의 한계 — Codex 가 file:line 직접 grep 보다 MEMORY 본문 read 를 SoT 로 채택했고, MEMORY 가 stale 이라 verdict 가 흐려짐. CLAUDE.md § Verification Before Reporting 의 "negative assertion 은 5-Check + validator SoT" 룰은 sub-agent / Codex 모두 동일 적용해야 한다.

**Codex 의 가치는 disagree 그 자체보다 NEW 후보 발견** — MEMORY 슬림화 (HIGH) + prettier skill (MEDIUM) 둘 다 Claude 의 deep-dive 문서가 놓친 항목. § Coverage Claim Discipline (L1 키워드 매칭만으로 단정 금지) 의 적용 사례로 본 cross-verify 자체가 추가 trigger 가치 입증.

**최종 권고**: Sprint c80 묶음에 **MEMORY 슬림화 선행** + Claude HIGH-1/2 유지 + MEDIUM-4 patch bump + Codex 의 prettier skill 정착 검토. 5개 항목 단일 sprint 진행 가능 (각 commit, 회귀 위험 LOW).

---

## Decision Triage Summary

- **autonomous-safe** (2): Codex INSUFFICIENT_EVIDENCE 라벨 4건 중 Claude 자체 검증 통과 (a-1, a-2, d, e) — 사용자 결정 불필요 / MEMORY 슬림화 자동 적용 (§ Output Discipline 룰)
- **needs-user** (2):
  - Sprint c80 묶음에 MEMORY 슬림화 선행 추가 채택 여부
  - prettier multi-line skill 정착 ROI 판단 (toolkit teach 수행 시점)
- **needs-claude-judgment** (1): Codex MEMORY trust 함정 사례를 § Verification Before Reporting 에 추가 반영할지
- **skipped** (0)
