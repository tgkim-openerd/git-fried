#!/usr/bin/env node
// c59-2 — i18n leaf-key 카운트 SoT.
// MEMORY.md / IMPLEMENTATION-STATUS.md 의 'i18n ko/en N' 통계 단일 출처.
// 사용: `bun run i18n:count` (또는 `node scripts/i18n-leaf-count.mjs`)
//
// 출력 예:
//   ko.json    : 1102 leaf-keys
//   en.json    : 1102 leaf-keys
//   symmetry   : OK (대칭)
//
// drift 발생 시 exit 1 — CI 가드 후보.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dirname, '..', 'apps', 'desktop', 'src', 'locales')

// Sprint c89-B (compound: i18n-json-top-level-duplicate-key-silent-drop) — JSON.parse
// 이전 raw regex 로 top-level namespace 중복 검출. last-write-wins silent drop 차단.
//
// 검출 패턴: `^  "<name>":` — 2-space indent 의 top-level (root 객체 직속) key 만.
// 중첩 key (4-space 이상) 는 카운트 안 함 (정상 nested namespace).
function checkDuplicateTopLevelKeys(file, text) {
  const matches = [...text.matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1])
  const counts = matches.reduce((acc, k) => {
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const dups = Object.entries(counts).filter(([, c]) => c > 1)
  if (dups.length === 0) return null
  return {
    file,
    dups: dups.map(([k, c]) => `${k} (×${c})`),
  }
}

function countLeafKeys(obj, path = []) {
  let count = 0
  const keys = []
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const sub = countLeafKeys(v, [...path, k])
      count += sub.count
      keys.push(...sub.keys)
    } else {
      count++
      keys.push([...path, k].join('.'))
    }
  }
  return { count, keys }
}

// dup-key 검출 — JSON.parse 이전 raw regex (last-write-wins 회피).
const koText = readFileSync(join(localesDir, 'ko.json'), 'utf8')
const enText = readFileSync(join(localesDir, 'en.json'), 'utf8')
const dupResults = [
  checkDuplicateTopLevelKeys('ko.json', koText),
  checkDuplicateTopLevelKeys('en.json', enText),
].filter(Boolean)
if (dupResults.length > 0) {
  console.error('duplicate-keys: DRIFT — top-level namespace 중복 검출')
  for (const r of dupResults) {
    console.error(`  ${r.file}: ${r.dups.join(', ')}`)
  }
  console.error(
    '  → JSON.parse last-write-wins 로 silent drop 발생. namespace 를 단일 block 으로 merge 하세요.',
  )
  console.error(
    '  → 상세: docs/solutions/i18n-json-top-level-duplicate-key-silent-drop.md',
  )
  process.exit(1)
}

const ko = JSON.parse(koText)
const en = JSON.parse(enText)

const koResult = countLeafKeys(ko)
const enResult = countLeafKeys(en)

const koKeys = new Set(koResult.keys)
const enKeys = new Set(enResult.keys)
const koOnly = [...koKeys].filter((k) => !enKeys.has(k))
const enOnly = [...enKeys].filter((k) => !koKeys.has(k))

console.log(`ko.json    : ${koResult.count} leaf-keys`)
console.log(`en.json    : ${enResult.count} leaf-keys`)

if (koOnly.length === 0 && enOnly.length === 0) {
  console.log(`symmetry   : OK (대칭)`)
  process.exit(0)
}

console.log(`symmetry   : DRIFT`)
if (koOnly.length > 0) {
  console.log(`  ko-only (${koOnly.length}): ${koOnly.slice(0, 10).join(', ')}${koOnly.length > 10 ? ', ...' : ''}`)
}
if (enOnly.length > 0) {
  console.log(`  en-only (${enOnly.length}): ${enOnly.slice(0, 10).join(', ')}${enOnly.length > 10 ? ', ...' : ''}`)
}
process.exit(1)
