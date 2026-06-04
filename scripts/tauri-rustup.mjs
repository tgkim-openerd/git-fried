// Tauri CLI 호출 wrapper — chocolatey rustc/cargo 1.60.0 PATH 우선 함정 회피.
//
// 배경 (2026-06-04 /verify):
//   cargo-rustup.mjs 는 `cargo` 를 절대경로로 직접 spawn 하지만, `tauri dev|build` 는
//   Tauri CLI 가 내부에서 **bare `cargo run`** 을 spawn 한다. 이때 PATH 우선의 chocolatey
//   cargo 1.60.0 이 잡혀 edition-2024 transitive dep(base64ct 등)을 못 파싱 → 빌드 실패.
//   (cargo test/check 는 wrapper 가 절대경로로 우회하지만 tauri 경로는 미커버였음.)
//
// 해법: rustup toolchain bin 디렉토리를 PATH 선두에 주입 → tauri 가 spawn 하는 bare `cargo`
//   /`rustc` 가 rustup stable 로 해석. + RUSTC env 강제 (belt & suspenders).
//   Windows PATH 는 `;` 구분자라 bash 의 드라이브 콜론(`C:`) 파싱 문제 없음.
//
// 사용 (package.json):
//   "tauri:dev":   "node scripts/tauri-rustup.mjs dev",
//   "tauri:build": "node scripts/tauri-rustup.mjs build",
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import process from 'node:process'

function rustupWhich(tool) {
  try {
    return execFileSync('rustup', ['which', tool], { encoding: 'utf8' }).trim()
  } catch (err) {
    console.error(`[tauri-rustup] rustup which ${tool} 실패: ${err.message ?? err}`)
    console.error('[tauri-rustup] rustup 미설치 또는 PATH 누락. https://rustup.rs/ 참조.')
    process.exit(2)
  }
}

const cargoPath = rustupWhich('cargo')
const rustcPath = rustupWhich('rustc')
const cargoBinDir = dirname(cargoPath)
const args = process.argv.slice(2) // 예: ['dev'] / ['build', '--debug']

if (args.length === 0) {
  console.error('[tauri-rustup] usage: node scripts/tauri-rustup.mjs <tauri-subcommand> [args...]')
  console.error('[tauri-rustup] 예: node scripts/tauri-rustup.mjs dev')
  process.exit(2)
}

const sep = process.platform === 'win32' ? ';' : ':'
const env = {
  ...process.env,
  // PATH 선두에 rustup toolchain bin → tauri 가 spawn 하는 bare cargo/rustc 가 stable 해석.
  PATH: `${cargoBinDir}${sep}${process.env.PATH ?? ''}`,
  RUSTC: rustcPath,
}

// 기존 package.json 의 "tauri" 스크립트와 동일 경로: bun run --cwd apps/desktop tauri <args>
const result = spawnSync('bun', ['run', '--cwd', 'apps/desktop', 'tauri', ...args], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32', // Windows 에서 bun → bun.exe PATH 해석
})

if (result.error) {
  console.error(`[tauri-rustup] spawn 실패: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
