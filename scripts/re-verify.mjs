#!/usr/bin/env node
// UltraPlan v0.4 §D1 — re-verify 통합 명령 SoT runner.
//
// /analyze 가 surface 한 12 항목 + 신규 회귀 차단을 한 번의 명령으로 확인.
// 각 항목은 별도 SoT 명령 (i18n-leaf-count.mjs / generate-tauri-commands-index.mjs /
// cargo test --list / grep 카운트) 호출 결과를 stdout 으로 모아 출력.
//
// 사용: `bun scripts/re-verify.mjs` 또는 `node scripts/re-verify.mjs`
//
// 종료 코드: 모든 항목 정상 0, 1+ 항목 비정상 1.

import { execSync } from 'node:child_process'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC_VUE = 'apps/desktop/src'
const SRC_RUST = 'apps/desktop/src-tauri/src'

function header(title) {
  console.log(`\n=== ${title} ===`)
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()
  } catch (e) {
    return `ERROR: ${e.message.split('\n')[0]}`
  }
}

function walkFiles(dir, ext) {
  const out = []
  function recur(d) {
    let entries
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(d, e)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) recur(p)
      else if (ext.some((x) => p.endsWith(x))) out.push(p)
    }
  }
  recur(dir)
  return out
}

let failed = 0

// 1. i18n leaf count + symmetry
header('1. i18n leaf (SoT: scripts/i18n-leaf-count.mjs)')
const i18nOut = run('node scripts/i18n-leaf-count.mjs')
console.log(i18nOut)
if (!i18nOut.includes('symmetry')) failed++

// 2. Tauri IPC catalog (regenerate 후 카운트)
header('2. Tauri IPC catalog (SoT: bun scripts/generate-tauri-commands-index.mjs)')
const catalogOut = run('bun scripts/generate-tauri-commands-index.mjs')
console.log(catalogOut)
if (!catalogOut.includes('commands:')) failed++

// 3. God component (≥200 LOC .vue 전체 카운트)
header('3. God component (≥200 LOC .vue) 카운트')
const vueFiles = walkFiles(SRC_VUE, ['.vue'])
const gods = vueFiles
  .map((f) => ({ path: relative(ROOT, f), lines: readFileSync(f, 'utf8').split('\n').length }))
  .filter((x) => x.lines >= 200)
  .sort((a, b) => b.lines - a.lines)
console.log(`총 ${gods.length}개`)
gods.slice(0, 10).forEach((g) => console.log(`  ${g.lines.toString().padStart(4)} ${g.path}`))
if (gods.length > 10) console.log(`  ...+${gods.length - 10} more`)

// 4. invoke 직접 호출 — 실 raw Tauri invoke 검출 (wrapper layer 제외)
// `from '@tauri-apps/api/core'` import 한 파일 중 `invoke` 심볼 사용 파일만 분류.
// Channel / event 같은 streaming API 는 wrapper 필요 없는 정상 패턴 — 제외.
header('4. raw `@tauri-apps/api/core` invoke 직접 호출 (wrapper layer 제외)')
const importerFiles = run(
  `grep -rlE "from ['\\\"]@tauri-apps/api/core['\\\"]" ${SRC_VUE} --include="*.ts" --include="*.vue"`,
)
const rawInvokers = importerFiles
  .split('\n')
  .filter(Boolean)
  .filter((f) => {
    const norm = f.replaceAll('\\', '/')
    if (norm.endsWith('api/git.ts') || norm.endsWith('api/invokeWithTimeout.ts')) return false // wrapper layer 자체
    const src = readFileSync(f, 'utf8')
    return /\binvoke\s*[(<]/.test(src) // `invoke(` 또는 `invoke<` 사용
  })
console.log(rawInvokers.length === 0 ? '(none — 모든 호출이 @/api/invokeWithTimeout wrapper 경유)' : rawInvokers.join('\n'))

// 5. Rust test 카운트 SoT (--no-run 컴파일 + exe --list)
header('5. Rust test 카운트 (SoT: cargo test --no-run + exe --list)')
const exeGlob = run(
  `find ${SRC_RUST}/../target/debug/deps -maxdepth 1 -name "git_fried_lib-*.exe" -newer ${SRC_RUST}/../Cargo.lock 2>/dev/null | head -1`,
)
if (exeGlob && !exeGlob.startsWith('ERROR')) {
  const count = run(`"${exeGlob}" --list 2>/dev/null | grep -cE ": (test|tokio::test)$"`)
  console.log(`최신 lib exe: ${count} tests`)
} else {
  console.log('SKIP — cargo test --no-run 먼저 실행 필요 (또는 Linux/macOS 환경)')
}

// 종료
header('SUMMARY')
console.log(`Failed: ${failed} / 5 checks`)
process.exit(failed > 0 ? 1 : 0)
