#!/usr/bin/env node
// Tauri command index 자동 생성 — `apps/desktop/src-tauri/src/ipc/*.rs` 의
// `#[tauri::command]` attribute + 직후 함수 시그니처를 추출해
// `docs/api/tauri-commands.md` 에 카테고리별 카탈로그를 그린다.
//
// 실행: bun scripts/generate-tauri-commands-index.mjs
//   또는: node scripts/generate-tauri-commands-index.mjs
//
// 산출:
//   - prefix (`list`/`get`/`ai`/...) 별 그룹
//   - 파일 (`commands.rs`/`v02_commands.rs`/...) 별 분포
//   - 각 항목: `name(args) -> Result` 한 줄 시그니처
//
// /analyze 후속 — 170 commands god module 추적용.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IPC_DIR = join(ROOT, 'apps/desktop/src-tauri/src/ipc');
const OUT_FILE = join(ROOT, 'docs/api/tauri-commands.md');

/**
 * 한 .rs 파일에서 #[tauri::command] 직후의 함수를 모두 추출.
 * - macro 와 fn 사이에 doc-comment / `#[derive...]` 같은 속성이 끼어도 OK.
 * - `pub async fn name(...)` / `pub fn name(...)` / `async fn name(...)` 모두 매칭.
 */
function extractCommands(source) {
  const lines = source.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed !== '#[tauri::command]') continue;

    // attribute 직후 부터 fn 시그니처 등장까지 스캔.
    let signature = null;
    let docs = [];
    for (let j = i + 1; j < lines.length && j < i + 40; j += 1) {
      const cur = lines[j];
      const c = cur.trim();
      if (c.startsWith('///')) {
        docs.push(c.replace(/^\/\/\/\s?/, ''));
        continue;
      }
      if (c.startsWith('#[')) continue; // 추가 속성
      if (c === '') continue;
      // fn 시그니처 — 멀티라인일 수 있으므로 `{` 또는 `;` 까지 합치기.
      if (/\bfn\s+\w/.test(c) || /\b(pub\s+)?(async\s+)?fn\b/.test(c)) {
        const buf = [cur];
        let k = j;
        while (k < lines.length && !buf[buf.length - 1].includes('{')) {
          k += 1;
          if (k >= lines.length) break;
          buf.push(lines[k]);
        }
        signature = buf.join('\n');
        break;
      }
      break;
    }
    if (!signature) continue;

    // `pub async fn name(...) -> Type {` 에서 name / args / return 분리.
    const headBeforeBrace = signature.split('{')[0].trim();
    const m = headBeforeBrace.match(/fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^]*?)\)\s*(?:->\s*([^]*))?$/);
    if (!m) continue;
    const [, name, argsRaw, retRaw] = m;

    // args 정리: 줄바꿈/연속공백 압축 + state 인자 숨기기.
    const args = argsRaw
      .replace(/\s+/g, ' ')
      .replace(/state:\s*tauri::State<'_,\s*Arc<AppState>>,?\s*/g, '')
      .replace(/_state:\s*tauri::State<'_,\s*Arc<AppState>>,?\s*/g, '')
      .replace(/,\s*$/, '')
      .trim();
    const ret = (retRaw || '').replace(/\s+/g, ' ').trim();

    out.push({ name, args, ret, docs });
  }
  return out;
}

function categoryOf(name) {
  // snake_case 의 1번째 토큰을 카테고리로. `ai_commit_message` → `ai`.
  const idx = name.indexOf('_');
  return idx === -1 ? name : name.slice(0, idx);
}

function fmtRet(ret) {
  if (!ret) return '()';
  // `AppResult<Vec<Workspace>>` → 그대로. `Result<T, E>` 도 OK.
  return ret;
}

async function main() {
  const entries = await readdir(IPC_DIR);
  const rsFiles = entries.filter((e) => e.endsWith('.rs')).sort();

  /** @type {Array<{file: string, cmds: ReturnType<typeof extractCommands>}>} */
  const byFile = [];
  /** @type {Map<string, Array<{file: string, name: string, args: string, ret: string, docs: string[]}>>} */
  const byCategory = new Map();

  for (const f of rsFiles) {
    const full = join(IPC_DIR, f);
    const src = await readFile(full, 'utf8');
    const cmds = extractCommands(src);
    byFile.push({ file: f, cmds });
    for (const c of cmds) {
      const cat = categoryOf(c.name);
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push({ file: f, ...c });
    }
  }

  const total = byFile.reduce((sum, x) => sum + x.cmds.length, 0);

  let md = `# Tauri Commands Index\n\n`;
  md += `> 자동 생성: \`bun scripts/generate-tauri-commands-index.mjs\`\n`;
  md += `> 소스: \`apps/desktop/src-tauri/src/ipc/*.rs\`\n\n`;
  md += `**총 ${total} commands**, ${rsFiles.length} 파일, ${byCategory.size} 카테고리.\n\n`;

  // 1. 파일별 분포
  md += `## 파일별 분포\n\n`;
  md += `| 파일 | commands |\n|---|---:|\n`;
  for (const { file, cmds } of [...byFile].sort((a, b) => b.cmds.length - a.cmds.length)) {
    md += `| \`ipc/${file}\` | ${cmds.length} |\n`;
  }
  md += `\n`;

  // 2. 카테고리별 분포
  md += `## 카테고리별 분포 (prefix snake_case 1번째 토큰)\n\n`;
  md += `| 카테고리 | commands |\n|---|---:|\n`;
  const sortedCats = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [cat, cmds] of sortedCats) {
    md += `| \`${cat}_*\` | ${cmds.length} |\n`;
  }
  md += `\n`;

  // 3. 카테고리별 상세 (signature)
  md += `## 카테고리별 상세\n\n`;
  for (const [cat, cmds] of sortedCats) {
    md += `### \`${cat}_*\` (${cmds.length})\n\n`;
    for (const c of cmds) {
      const argsLabel = c.args ? c.args : '';
      md += `- **\`${c.name}(${argsLabel}) -> ${fmtRet(c.ret)}\`** — \`ipc/${c.file}\``;
      if (c.docs.length) md += `  \n  ${c.docs[0]}`;
      md += `\n`;
    }
    md += `\n`;
  }

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, md, 'utf8');

  console.log(`generated: ${relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);
  console.log(`  commands: ${total}`);
  console.log(`  files:    ${rsFiles.length}`);
  console.log(`  cats:     ${byCategory.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
