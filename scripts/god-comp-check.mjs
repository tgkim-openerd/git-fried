#!/usr/bin/env node
// UltraPlan v0.4 §D2 — god comp regression warning gate.
//
// vue3-composable-extraction skill Pattern 20 (script vs total LOC layer 분리) 적용.
// pre-commit lefthook 에 등록되어 staged `.vue` 파일 중 god comp 임계 위반 시 warning.
//
// 두 layer 분리 측정:
//   - Layer A (script LOC ≥ SCRIPT_THRESHOLD): 단일 책임 위반 — composable 추출 필요
//   - Layer B-only (script <SCRIPT_THRESHOLD, total ≥ TOTAL_THRESHOLD): template-heavy
//     정상 패턴 — Pattern 14 SOT 통합 후보일 수 있으나 강제 추출 아님
//
// 사용: `node scripts/god-comp-check.mjs <file1.vue> <file2.vue> ...`
// 환경변수:
//   GOD_COMP_SCRIPT_THRESHOLD=200 — Layer A 임계
//   GOD_COMP_TOTAL_THRESHOLD=400  — Layer B 임계
//   GOD_COMP_FAIL=1               — Layer A 위반 차단 모드 (Phase C3 (b) 활성 시)
//
// 종료 코드: warning 모드 항상 0. 차단 모드 + Layer A 위반 시 1.

import { readFileSync, existsSync } from 'node:fs'

const SCRIPT_THRESHOLD = parseInt(process.env.GOD_COMP_SCRIPT_THRESHOLD || '200', 10)
const TOTAL_THRESHOLD = parseInt(process.env.GOD_COMP_TOTAL_THRESHOLD || '400', 10)
const FAIL_MODE = process.env.GOD_COMP_FAIL === '1'

const args = process.argv.slice(2).filter((f) => f.endsWith('.vue') && existsSync(f))
if (args.length === 0) process.exit(0)

/** Vue SFC 의 `<script>` block LOC 추출 (Pattern 20 Layer A). */
function extractScriptLoc(src) {
  const m = src.match(/<script[^>]*>[\s\S]*?<\/script>/)
  return m ? m[0].split('\n').length : 0
}

const layerA = [] // script-god (단일 책임 위반)
const layerB = [] // template-heavy (정상 패턴, 정보 제공)

for (const f of args) {
  const src = readFileSync(f, 'utf8')
  const totalLoc = src.split('\n').length
  const scriptLoc = extractScriptLoc(src)
  if (scriptLoc >= SCRIPT_THRESHOLD) {
    layerA.push({ file: f, scriptLoc, totalLoc })
  } else if (totalLoc >= TOTAL_THRESHOLD) {
    layerB.push({ file: f, scriptLoc, totalLoc })
  }
}

if (layerA.length === 0 && layerB.length === 0) {
  process.exit(0)
}

if (layerA.length > 0) {
  const tag = FAIL_MODE ? 'ERROR' : 'WARNING'
  console.error(
    `\n[god-comp-check] ${tag} (Layer A — script ≥${SCRIPT_THRESHOLD}): ${layerA.length} .vue`,
  )
  layerA.forEach((v) =>
    console.error(`  script=${v.scriptLoc.toString().padStart(4)} total=${v.totalLoc} ${v.file}`),
  )
}

if (layerB.length > 0) {
  console.error(
    `\n[god-comp-check] INFO (Layer B-only — template-heavy, script <${SCRIPT_THRESHOLD}): ${layerB.length} .vue`,
  )
  layerB.forEach((v) =>
    console.error(`  script=${v.scriptLoc.toString().padStart(4)} total=${v.totalLoc} ${v.file}`),
  )
  console.error('  → SOT 통합 후보 (Pattern 14), 강제 추출 아님 — UI 풍부함 정상')
}

console.error('\nUltraPlan v0.4 §D2 — Pattern 20 layer 분리 측정.')
console.error('  Layer A 차단 모드 활성: GOD_COMP_FAIL=1')
console.error('  점진 추출 전략 (Phase C3 default a): docs/plan/37 §B1')
console.error('  Pattern 20 정의: vue3-composable-extraction skill §Pattern 20')
console.error('')

// Layer A 위반 + 차단 모드만 exit 1. Layer B-only 는 항상 정보 제공.
process.exit(FAIL_MODE && layerA.length > 0 ? 1 : 0)
