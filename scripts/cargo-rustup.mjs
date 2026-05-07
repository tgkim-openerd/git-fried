// Cargo 호출 wrapper — chocolatey rustc 1.60.0 PATH 우선 함정 회피.
//
// 배경 (Sprint c52):
//   chocolatey 의 rustc 1.60.0 이 PATH 우선이라 cargo 1.95 (rustup) 가 rustc spawn 시
//   1.60.0 호출 → `--check-cfg` 가 1.60.0 에서 unstable → cargo build/test 실패.
//   `rustup run stable cargo` 도 bun run 환경에서 PATH inherit 안정성 부족.
//
// 해법: rustup which 로 cargo / rustc 절대 path 얻고, RUSTC env 강제 후 직접 spawn.
//   - cargo: `rustup which cargo` 절대 path
//   - rustc: `RUSTC` env var 로 `rustup which rustc` 절대 path 명시
//
// 사용 (package.json):
//   "test:rust": "node scripts/cargo-rustup.mjs test --manifest-path apps/desktop/src-tauri/Cargo.toml",
//   "fmt:rust":  "node scripts/cargo-rustup.mjs fmt  --manifest-path apps/desktop/src-tauri/Cargo.toml",
import { execFileSync, spawnSync } from 'node:child_process'
import process from 'node:process'

function rustupWhich(tool) {
  try {
    return execFileSync('rustup', ['which', tool], { encoding: 'utf8' }).trim()
  } catch (err) {
    console.error(`[cargo-rustup] rustup which ${tool} 실패: ${err.message ?? err}`)
    console.error('[cargo-rustup] rustup 미설치 또는 PATH 누락. https://rustup.rs/ 참조.')
    process.exit(2)
  }
}

const cargoPath = rustupWhich('cargo')
const rustcPath = rustupWhich('rustc')
// rustdoc 도 PATH 우선 chocolatey 1.60.0 가능 — doc-test 실패 회피.
let rustdocPath = null
try {
  rustdocPath = execFileSync('rustup', ['which', 'rustdoc'], { encoding: 'utf8' }).trim()
} catch {
  // rustdoc 옵셔널 — doc-test 없는 프로젝트면 spawn 안 됨
}
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('[cargo-rustup] usage: node scripts/cargo-rustup.mjs <cargo-subcommand> [args...]')
  process.exit(2)
}

const env = { ...process.env, RUSTC: rustcPath }
if (rustdocPath) env.RUSTDOC = rustdocPath

const result = spawnSync(cargoPath, args, {
  stdio: 'inherit',
  env,
})

if (result.error) {
  console.error(`[cargo-rustup] spawn 실패: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
