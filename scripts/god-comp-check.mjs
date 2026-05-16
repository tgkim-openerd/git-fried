#!/usr/bin/env node
// UltraPlan v0.4 §D2 minimum viable — god comp regression warning gate.
//
// pre-commit lefthook 에 등록되어 staged `.vue` 파일 중 ≥200 LOC 인 파일이 발견되면
// **warning** 출력 (현재는 fail 아님 — Phase C3 (a) 점진 추출 default 와 정합).
// 사용자 결정 후 v1.2+ patch 에서 `exit 1` 로 차단 모드 승격 가능.
//
// 사용: `node scripts/god-comp-check.mjs <file1.vue> <file2.vue> ...`
// lefthook 에서 `{staged_files}` 변수 전달.
//
// 종료 코드: 항상 0 (warning only). 차단 모드 활성 시 1.

import { readFileSync, existsSync } from 'node:fs'

const THRESHOLD = 200
const FAIL_MODE = process.env.GOD_COMP_FAIL === '1' // Phase C3 (b) 차단 모드 활성화 트리거

const args = process.argv.slice(2).filter((f) => f.endsWith('.vue') && existsSync(f))
if (args.length === 0) process.exit(0)

const violations = []
for (const f of args) {
  const lines = readFileSync(f, 'utf8').split('\n').length
  if (lines >= THRESHOLD) {
    violations.push({ file: f, lines })
  }
}

if (violations.length === 0) {
  process.exit(0)
}

const tag = FAIL_MODE ? 'ERROR' : 'WARNING'
console.error(`\n[god-comp-check] ${tag}: ${violations.length} .vue file(s) ≥${THRESHOLD} LOC`)
violations.forEach((v) => console.error(`  ${v.lines.toString().padStart(4)} ${v.file}`))
console.error(`\nUltraPlan v0.4 §D2 — god comp 회귀 차단 (현재 ${FAIL_MODE ? '차단 모드' : 'warning 모드'}).`)
console.error('  차단 모드 활성: GOD_COMP_FAIL=1 환경변수')
console.error('  점진 추출 전략 (Phase C3 default a): docs/plan/37 §B1')
console.error('')

process.exit(FAIL_MODE ? 1 : 0)
