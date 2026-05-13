---
name: prettier-multiline-extract-regression
description: god component <200 LOC 추출 후 prettier printWidth=100 자동 multi-line split 으로 라인 수가 다시 늘어나는 회귀. Codex cross-verify NEW MEDIUM 발견 사례.
category: vue3-composable-extraction
discovered: 2026-05-13 (git-fried Sprint c80+ Codex cross-verify)
related_sprints: c76 / c78 / c79 (3회 반복)
---

# Prettier multi-line 자동 분해로 god comp <200 가드 회귀

## 증상

Vue 3 god component 의 `<script setup>` LOC 가 임계 (≥200) 초과로 composable 분리 후, 추출 직후 측정에서는 임계 미만이었지만 **`bun fmt` (prettier) 실행 후 재측정 시 다시 임계 초과**. commit message 의 "god comp <200 유지" 단정이 무효화.

## 실사례 (3회 반복)

| sprint | commit | 단정 LOC | 실제 LOC (fmt 후) | 원인 |
|---|---|---|---|---|
| c76-fix | `0688302` | 197 | **202** | prettier multi-line 회귀 |
| c75-A | `7cbf4ee` | 197 | **202** | 동일 |
| c78 | `1814978` | 197 | 197 ✓ | useCommitGraphStickyLayout + useCommitGraphLifecycle 재추출로 복구 |
| c79 | `238e3f6` | — | — | fmt 일괄 정리 17 파일 (import multi-line 회피) |

## 발화 케이스 3

### 1. 익명 arrow 인자 4+ 또는 object 인자 3+

```ts
// ❌ printWidth 100 도달 → 자동 split (1 → 8 라인)
useCommitGraphSelection({ rows, containerRef, wipRowCount, rowHeight, selectRow, onScrollComplete: () => drawGraph() })

// ✅ named const 인자 추출 → 한 라인 보존
const selectionOpts = {
  rows, containerRef, wipRowCount, rowHeight, selectRow,
  onScrollComplete: () => drawGraph(),
}
const { selectAndScrollToSha } = useCommitGraphSelection(selectionOpts)
```

### 2. import multi-line 자동 분해

```ts
// ❌ printWidth 초과 시 prettier 가 7 라인으로 split
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'

// ✅ 의미 그룹 분리 — 각 라인 < 100
import { computed, ref, watch } from 'vue'
import { nextTick, onMounted, onUnmounted, useTemplateRef } from 'vue'
```

### 3. destructure 7+ 항목

```ts
// ❌ 자동 split (1 → 10 라인)
const { wipActive, wipRowCount, wipChangeCount, virtualItems, totalHeight, commitRowAt, commitTooltip, ... } = useCommitGraphRows({ ... })

// ✅ 2단계 destructure — 의미 그룹 단위
const cgRows = useCommitGraphRows({ ... })
const { wipActive, wipRowCount, wipChangeCount, virtualItems, totalHeight } = cgRows
const { commitRowAt, commitTooltip } = cgRows
```

## 검증 protocol (script LOC ≥200 god comp 추출 BLOCKING)

다음 4 단계는 모두 추출 commit 메시지의 LOC 단정 전에 통과해야 함:

1. **추출 직후 LOC 측정** — `awk '/<script setup/{flag=1;next} /<\/script>/{flag=0} flag' file.vue | wc -l`
2. **`bun fmt` 또는 `prettier --write file.vue` 실행**
3. **재측정** — (1)≠(3)이면 위 발화 케이스 1-3 적용 후 재시도
4. **commit message 의 LOC 단정은 (3) fmt 후 측정값만 사용**

```bash
# 자동화 helper (script LOC 측정 + fmt + 재측정 비교)
SCRIPT_LOC() {
  awk '/<script setup/{flag=1;next} /<\/script>/{flag=0} flag' "$1" | wc -l
}
BEFORE=$(SCRIPT_LOC "$1")
bun fmt "$1" >/dev/null
AFTER=$(SCRIPT_LOC "$1")
[ "$BEFORE" -eq "$AFTER" ] && echo "OK: $AFTER" || echo "DRIFT: $BEFORE → $AFTER"
```

## 근거

- CLAUDE.md § Verification Before Reporting — "negative assertion 은 5-Check 후 + validator SoT" 룰
- CLAUDE.md § Coverage Claim Discipline — "positive coverage 단정 (`이미 구현됨` / `다 봤음`) 도 verification 게이트 적용"
- script LOC 단정도 동일 — "추출 직후 라인 수" 는 stale, "fmt 후" 만 SoT

## 발견 경로

- 2026-05-13 git-fried Sprint c80+ /analyze Recommendations deep-dive → Codex cross-verify
- Codex 가 MEMORY.md 의 c76/c78/c79 catalog 에서 patterns 반복 검출 → NEW MEDIUM 후보 surface
- Claude 가 file:line 직접 인용으로 검증 후 git-fried 측 솔루션 정착

## 후속

- toolkit `vue3-composable-extraction` skill 의 Pitfall 9 로 흡수 (V31 HARD budget 1200 초과 — toolkit refactor sprint 후)
- 자동화 lefthook hook 후보 — `bun fmt --check` 가 pre-commit 에 이미 있음. LOC 단정 자동 검증 hook 은 별도

## See Also

- [docs/analyze/2026-05-13-160000-codex-cross-verify.md](../analyze/2026-05-13-160000-codex-cross-verify.md) — Codex disagree 분석 + NEW 후보
- `~/.claude/skills/vue/page/vue3-composable-extraction/skill.md` — Pattern 9 caller-decision + Pitfall 1-8 (Pitfall 9 추가 보류)
- CLAUDE.md § Verification Before Reporting / § Coverage Claim Discipline
