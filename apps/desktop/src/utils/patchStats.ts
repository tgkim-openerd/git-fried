// Unified diff patch 의 +/- 라인 / file 카운트 단순 파싱.
// CommitDetailSidebar 가 commit metadata 옆에 표시하는 file stats 용.
//
// 정밀도 한계: hunk header (`@@ ... @@`) / 'diff --git' 외 file change 형식 (rename / mode)
// 도 하나의 file 로 카운트. ratio 의 정확도가 아니라 dogfood 시 사용자 인지 가능한 근사값.

export type PatchFileChange = 'modified' | 'added' | 'deleted' | 'renamed'

export interface PatchFile {
  path: string
  /** rename 시 from path. 그 외엔 null. */
  oldPath: string | null
  change: PatchFileChange
}

export interface PatchStats {
  /** `+` 로 시작하는 라인 수 (header `+++` 제외) */
  adds: number
  /** `-` 로 시작하는 라인 수 (header `---` 제외) */
  dels: number
  /** `diff --git ...` 헤더 등장 횟수 = 변경 파일 수 */
  files: number
  /** Sprint c30 / GitKraken UX — 파일 목록 (커밋 상세 패널 file list 용). */
  paths: PatchFile[]
}

const DIFF_HEADER_RE = /^diff --git a\/(.+?) b\/(.+?)$/

/**
 * Empty / whitespace-only patch 는 0 stats 반환.
 */
export function parsePatchStats(patch: string | null | undefined): PatchStats {
  if (!patch) return { adds: 0, dels: 0, files: 0, paths: [] }
  const adds = (patch.match(/^\+[^+]/gm) ?? []).length
  const dels = (patch.match(/^-[^-]/gm) ?? []).length

  // 파일 별 헤더 블록을 파싱해 path + change kind 추출.
  // 각 file 블록은 "diff --git a/X b/Y" 로 시작하고 다음 헤더 또는 EOF 까지.
  const paths: PatchFile[] = []
  const lines = patch.split('\n')
  let i = 0
  while (i < lines.length) {
    const m = DIFF_HEADER_RE.exec(lines[i])
    if (!m) {
      i++
      continue
    }
    const aPath = m[1]
    const bPath = m[2]
    // 헤더 다음 ~10 줄에서 change kind 식별.
    let change: PatchFileChange = 'modified'
    let oldPath: string | null = null
    const probeEnd = Math.min(lines.length, i + 12)
    for (let j = i + 1; j < probeEnd; j++) {
      const l = lines[j]
      if (l.startsWith('diff --git')) break
      if (l.startsWith('new file mode')) change = 'added'
      else if (l.startsWith('deleted file mode')) change = 'deleted'
      else if (l.startsWith('rename from ')) {
        change = 'renamed'
        oldPath = l.slice('rename from '.length)
      } else if (l.startsWith('rename to ')) {
        change = 'renamed'
      }
    }
    paths.push({
      path: bPath !== aPath || change === 'renamed' ? bPath : aPath,
      oldPath: change === 'renamed' ? (oldPath ?? aPath) : null,
      change,
    })
    i++
  }

  return { adds, dels, files: paths.length, paths }
}
