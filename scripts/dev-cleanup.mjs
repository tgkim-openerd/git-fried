// Dev server cleanup — vite child detach 회수 (Windows POSIX process group 부재 대응).
//
// 배경:
//   Sprint c51 학습 #7. `bun run dev` 를 background 로 띄우면 부모 종료 시
//   vite (node.exe) 가 detach 되어 port 1420 점유 잔존. 사용자가 `bun tauri:dev`
//   재실행 시 EADDRINUSE 충돌. design-verify cycle 마다 발생.
//
// 사용:
//   bun run dev:cleanup           — port 1420 listener 종료
//   bun run dev:cleanup -- --dry  — 종료할 PID 만 출력 (kill 안 함)
//   bun run dev:cleanup -- --port 5173 — 포트 변경
//
// 안전:
//   - 정확히 LISTEN 상태인 PID 만 타겟 (ESTABLISHED 무시)
//   - 잘못 매치 방지를 위해 PID 0 / 4 (Windows System) 는 skip
//   - dry-run flag 로 미리 확인 가능
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry') || args.includes('--dry-run')
const portIdx = args.indexOf('--port')
const port = portIdx >= 0 && args[portIdx + 1] ? Number(args[portIdx + 1]) : 1420

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[dev-cleanup] invalid port: ${args[portIdx + 1]}`)
  process.exit(2)
}

const isWin = process.platform === 'win32'

function findPidsWin(targetPort) {
  // PowerShell Get-NetTCPConnection 우선, 실패 시 netstat fallback
  try {
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
      ],
      { encoding: 'utf8' },
    )
    return [...new Set(out.split(/\s+/).map((s) => s.trim()).filter(Boolean).map(Number))]
  } catch {
    // fallback: netstat -ano
    const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/)
      if (m && Number(m[1]) === targetPort) pids.add(Number(m[2]))
    }
    return [...pids]
  }
}

function findPidsPosix(targetPort) {
  try {
    const out = execFileSync('lsof', ['-ti', `:${targetPort}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    })
    return [...new Set(out.split(/\s+/).map((s) => s.trim()).filter(Boolean).map(Number))]
  } catch {
    return []
  }
}

function killWin(pid) {
  execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
}

function killPosix(pid) {
  execFileSync('kill', ['-9', String(pid)], { stdio: 'ignore' })
}

const findPids = isWin ? findPidsWin : findPidsPosix
const killPid = isWin ? killWin : killPosix

const SYSTEM_PIDS = new Set([0, 4]) // Windows System Idle + System
const pids = findPids(port).filter((pid) => !SYSTEM_PIDS.has(pid))

if (pids.length === 0) {
  console.log(`[dev-cleanup] port ${port}: no listener (clean)`)
  process.exit(0)
}

console.log(`[dev-cleanup] port ${port}: found PID(s) ${pids.join(', ')}`)

if (dryRun) {
  console.log('[dev-cleanup] --dry: skipping kill')
  process.exit(0)
}

let killed = 0
for (const pid of pids) {
  try {
    killPid(pid)
    console.log(`[dev-cleanup] killed PID ${pid}`)
    killed++
  } catch (err) {
    console.warn(`[dev-cleanup] failed to kill PID ${pid}: ${err.message ?? err}`)
  }
}

console.log(`[dev-cleanup] done — killed ${killed}/${pids.length}`)
process.exit(killed === pids.length ? 0 : 1)
