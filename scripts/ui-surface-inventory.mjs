// Vue surface 인벤토리 + data-testid 커버리지 게이트 (로드맵 Step 5 / Codex GAP-11).
//
// "작은 UI/UX 전부 테스트 가능" 을 측정 가능하게: e2e 가 구동하려면 상호작용 컴포넌트에
// 안정적 셀렉터(data-testid)가 있어야 한다. 본 스크립트는 모든 .vue 를 스캔해
//   - 상호작용/surface 컴포넌트(버튼·입력·클릭·드래그·라우트 링크 등)인지 분류
//   - data-testid 보유 여부
//   - 커버리지 % + 미보유(interactive without testid) 목록
// 을 산출한다. exempt 목록(scripts/ui-surface-exempt.txt)으로 의도적 제외 표기.
//
// 사용:
//   node scripts/ui-surface-inventory.mjs            # 리포트
//   node scripts/ui-surface-inventory.mjs --json     # 기계 출력
//   node scripts/ui-surface-inventory.mjs --gate     # 미보유>0(exempt 제외) 시 exit 1
//
// node 런타임. 외부 의존 0 (toolkit 무npm 방어 정합).

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = ['apps/desktop/src/components', 'apps/desktop/src/pages']
const EXEMPT_FILE = 'scripts/ui-surface-exempt.txt'

// 상호작용/surface 신호 — <template> 에 이런 게 있으면 e2e 구동 대상으로 본다.
const INTERACTIVE_SIGNALS = [
  /<button\b/,
  /<input\b/,
  /<select\b/,
  /<textarea\b/,
  /<a\b[^>]*\bhref/,
  /<router-link\b/,
  /@click\b/,
  /@change\b/,
  /@submit\b/,
  /@keydown\b/,
  /@keyup\b/,
  /v-on:click\b/,
  /role="(button|tab|menuitem|switch|checkbox)"/,
  /\bdraggable="true"/,
  /\bcontenteditable\b/,
]

function walk(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.vue')) out.push(p)
  }
  return out
}

function loadExempt() {
  const p = join(ROOT, EXEMPT_FILE)
  if (!existsSync(p)) return new Set()
  return new Set(
    readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  )
}

function analyze() {
  const exempt = loadExempt()
  const files = SRC_DIRS.flatMap((d) => walk(join(ROOT, d))).sort()
  const rows = files.map((abs) => {
    const rel = relative(ROOT, abs).replace(/\\/g, '/')
    const src = readFileSync(abs, 'utf8')
    // <template> 영역만 (script 의 문자열 오탐 회피).
    const tpl = (src.match(/<template[\s\S]*?<\/template>/i) || [''])[0]
    const interactive = INTERACTIVE_SIGNALS.some((re) => re.test(tpl))
    const testidCount = (src.match(/data-testid=/g) || []).length
    return {
      file: rel,
      interactive,
      testids: testidCount,
      hasTestid: testidCount > 0,
      exempt: exempt.has(rel),
    }
  })
  return { rows, exempt }
}

function main() {
  const args = process.argv.slice(2)
  const { rows } = analyze()
  const total = rows.length
  const interactive = rows.filter((r) => r.interactive)
  const covered = interactive.filter((r) => r.hasTestid)
  const missing = interactive.filter((r) => !r.hasTestid && !r.exempt)
  const exemptMissing = interactive.filter((r) => !r.hasTestid && r.exempt)
  const pct = interactive.length ? Math.round((covered.length / interactive.length) * 100) : 100

  // ratchet baseline 작성 — 현재 미보유 전체를 exempt 로 기록. 신규만 게이트 대상.
  if (args.includes('--write-exempt')) {
    const all = interactive.filter((r) => !r.hasTestid).map((r) => r.file)
    const header = [
      '# Vue surface 인벤토리 게이트 — data-testid 미보유 baseline (ratchet).',
      '# `node scripts/ui-surface-inventory.mjs --gate` 가 이 목록을 제외하고 신규 미보유를 차단.',
      '# 목표: 컴포넌트에 e2e/testid 추가 시 여기서 제거 → 0 이면 "전부 커버".',
      `# baseline ${all.length}개 (커버리지 ${pct}%).`,
      '',
    ].join('\n')
    writeFileSync(join(ROOT, EXEMPT_FILE), header + all.join('\n') + '\n')
    console.log(`exempt baseline 작성: ${all.length}개 → ${EXEMPT_FILE}`)
    return
  }

  if (args.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          total,
          interactive: interactive.length,
          covered: covered.length,
          missing: missing.map((r) => r.file),
          exemptMissing: exemptMissing.map((r) => r.file),
          coveragePct: pct,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`Vue surface 인벤토리 (data-testid 커버리지)`)
    console.log(`  총 .vue: ${total}`)
    console.log(`  상호작용/surface: ${interactive.length}`)
    console.log(`  testid 보유: ${covered.length} (${pct}%)`)
    console.log(`  exempt(제외): ${exemptMissing.length}`)
    console.log(`  미보유(게이트 대상): ${missing.length}`)
    if (missing.length) {
      console.log(`\n미보유 상호작용 컴포넌트 (data-testid 없음):`)
      for (const r of missing) console.log(`  - ${r.file}`)
      console.log(`\n→ e2e 구동 대상이면 data-testid 추가, 아니면 ${EXEMPT_FILE} 에 등록.`)
    }
  }

  if (args.includes('--gate') && missing.length > 0) {
    console.error(`\nGATE FAIL: 상호작용 컴포넌트 ${missing.length}개가 data-testid 미보유.`)
    process.exit(1)
  }
}

main()
