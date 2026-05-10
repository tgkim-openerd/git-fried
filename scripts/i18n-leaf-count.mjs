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

const ko = JSON.parse(readFileSync(join(localesDir, 'ko.json'), 'utf8'))
const en = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8'))

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
