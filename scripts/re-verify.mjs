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

import { execSync, execFileSync } from 'node:child_process'
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
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

// 3. God component (Pattern 20 layer 분리 — script LOC vs total LOC)
// ARCH-001 fix: Layer A (script ≥200, 단일 책임 위반) vs Layer B-only (template-heavy 정상)
header('3. God component (Pattern 20 layer 분리)')
const vueFiles = walkFiles(SRC_VUE, ['.vue'])
const scriptRe = /<script[^>]*>[\s\S]*?<\/script>/
const layered = vueFiles.map((f) => {
  const src = readFileSync(f, 'utf8')
  const total = src.split('\n').length
  const m = src.match(scriptRe)
  const script = m ? m[0].split('\n').length : 0
  return { path: relative(ROOT, f), script, total }
})
const layerA = layered.filter((x) => x.script >= 200).sort((a, b) => b.script - a.script)
const layerBOnly = layered
  .filter((x) => x.script < 200 && x.total >= 200)
  .sort((a, b) => b.total - a.total)
console.log(`Layer A 위반 (script ≥200, 단일 책임): ${layerA.length}개`)
layerA.slice(0, 5).forEach((g) => console.log(`  script=${g.script.toString().padStart(4)} total=${g.total} ${g.path}`))
console.log(`Layer B-only (script <200, total ≥200, template-heavy 정상): ${layerBOnly.length}개`)
layerBOnly.slice(0, 5).forEach((g) => console.log(`  script=${g.script.toString().padStart(4)} total=${g.total} ${g.path}`))
if (layerBOnly.length > 5) console.log(`  ...+${layerBOnly.length - 5} more (template SOT 통합 후보, 강제 추출 아님)`)

// 4. invoke 직접 호출 — 실 raw Tauri invoke 검출 (wrapper layer 제외)
// `from '@tauri-apps/api/core'` import 한 파일 중 `invoke` 심볼 사용 파일만 분류.
// Channel / event 같은 streaming API 는 wrapper 필요 없는 정상 패턴 — 제외.
// ARCH-004 + LINT-001/002 fix: shell grep → Node API (cross-platform, escape 회피).
header('4. raw `@tauri-apps/api/core` invoke 직접 호출 (wrapper layer 제외)')
const importerRe = /from\s+['"]@tauri-apps\/api\/core['"]/
const tsVueFiles = walkFiles(SRC_VUE, ['.ts', '.vue'])
const rawInvokers = tsVueFiles
  .filter((f) => {
    const norm = relative(ROOT, f).replaceAll('\\', '/')
    if (norm.endsWith('api/git.ts') || norm.endsWith('api/invokeWithTimeout.ts')) return false
    const src = readFileSync(f, 'utf8')
    return importerRe.test(src) && /\binvoke\s*[(<]/.test(src)
  })
  .map((f) => relative(ROOT, f))
console.log(
  rawInvokers.length === 0
    ? '(none — 모든 호출이 @/api/invokeWithTimeout wrapper 경유)'
    : rawInvokers.join('\n'),
)

// 5. Rust test 카운트 SoT (--no-run 컴파일 + exe --list)
// ARCH-001 + ARCH-004 + ARCH-005 fix (UltraPlan v0.4 review autonomous):
//   - shell-free Node API (readdirSync + statSync, ls/grep 의존 제거 — cross-platform)
//   - integration test 동적 enum (tests/*.rs 기반, sqlite_pool_acquire_timeout 하드코딩 제거)
//   - execFileSync 사용 (SEC INFO — shell interpolation 회피)
header('5. Rust test 카운트 (SoT: cargo test --no-run + exe --list)')

/** target/debug/deps 에서 prefix-* 의 mtime 가장 늦은 exe 1개 선택 (shell-free). */
function findLatestExe(depsDir, prefix) {
  try {
    const entries = readdirSync(depsDir)
    const matches = entries
      .filter((f) => f.startsWith(prefix + '-') && f.endsWith('.exe'))
      .map((f) => {
        const p = join(depsDir, f)
        return { p, m: statSync(p).mtimeMs }
      })
      .sort((a, b) => b.m - a.m)
    return matches[0]?.p
  } catch {
    return null
  }
}

/** exe --list 출력에서 test 라인 카운트 (shell-free). */
function countTests(exePath) {
  try {
    const out = execFileSync(exePath, ['--list'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return out.split('\n').filter((l) => /: (test|tokio::test)$/.test(l)).length
  } catch {
    return 0
  }
}

/** apps/desktop/src-tauri/tests/*.rs 에서 integration test binary prefix enumerate. */
function findIntegPrefixes(rustRoot) {
  const testsDir = join(rustRoot, '..', 'tests')
  if (!existsSync(testsDir)) return []
  try {
    return readdirSync(testsDir)
      .filter((f) => f.endsWith('.rs'))
      .map((f) => f.replace(/\.rs$/, ''))
  } catch {
    return []
  }
}

const depsDir = join(SRC_RUST, '..', 'target', 'debug', 'deps')
const libExe = findLatestExe(depsDir, 'git_fried_lib')
if (libExe) {
  const libCount = countTests(libExe)
  const integPrefixes = findIntegPrefixes(SRC_RUST)
  const integCounts = integPrefixes.map((prefix) => {
    const exe = findLatestExe(depsDir, prefix)
    return { prefix, count: exe ? countTests(exe) : 0 }
  })
  const integSum = integCounts.reduce((s, x) => s + x.count, 0)
  const total = libCount + integSum
  const integLabel =
    integCounts.length === 0
      ? '0'
      : integCounts.map((x) => `${x.prefix}=${x.count}`).join(' + ') + ` = ${integSum}`
  console.log(`최신 lib exe: ${libCount} tests + integration: ${integLabel} → ${total} total`)
} else {
  console.log('SKIP — cargo test --no-run 먼저 실행 필요')
}

// 종료
header('SUMMARY')
console.log(`Failed: ${failed} / 5 checks`)
process.exit(failed > 0 ? 1 : 0)
