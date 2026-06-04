// prod 번들에 dev-only 테스트 훅이 새지 않았는지 검증 (Codex Step 6 #5 / 보안).
//
// invokeWithTimeout 의 fault hook, main.ts 의 raw invoke 훅은 `import.meta.env.DEV` gate 라
// release vite build 에서 dead-code 제거되어야 한다. 본 스크립트가 dist 를 grep 해 보증.
//
// 사용: node scripts/check-prod-bundle-clean.mjs            # build 후 검사
//       node scripts/check-prod-bundle-clean.mjs --no-build # 기존 dist 검사
// node 런타임, 외부 의존 0.

import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'apps/desktop/dist')
const FORBIDDEN = ['git-fried.test-fault', '__gitfriedTestFault', '__gitfriedTestInvoke']

if (!process.argv.includes('--no-build')) {
  console.log('vite build (apps/desktop)...')
  execSync('bun run --cwd apps/desktop build', { stdio: 'inherit' })
}
if (!existsSync(DIST)) {
  console.error(`FAIL — dist 없음: ${DIST} (build 먼저).`)
  process.exit(1)
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const files = walk(DIST).filter((f) => /\.(js|css|html)$/.test(f))
const hits = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const tok of FORBIDDEN) if (src.includes(tok)) hits.push(`  ${tok}  →  ${f}`)
}

if (hits.length) {
  console.error(`FAIL — dev 테스트 훅이 prod 번들에 누출됨:\n${hits.join('\n')}`)
  process.exit(1)
}
console.log(`OK — ${files.length}개 번들 파일에서 dev 훅(${FORBIDDEN.join(', ')}) 미발견.`)
