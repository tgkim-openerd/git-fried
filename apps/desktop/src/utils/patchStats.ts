// Unified diff patch 의 +/- 라인 / file 카운트 단순 파싱.
// CommitDetailSidebar 가 commit metadata 옆에 표시하는 file stats 용.
//
// 정밀도 한계: hunk header (`@@ ... @@`) / 'diff --git' 외 file change 형식 (rename / mode)
// 도 하나의 file 로 카운트. ratio 의 정확도가 아니라 dogfood 시 사용자 인지 가능한 근사값.

export interface PatchStats {
  /** `+` 로 시작하는 라인 수 (header `+++` 제외) */
  adds: number
  /** `-` 로 시작하는 라인 수 (header `---` 제외) */
  dels: number
  /** `diff --git ...` 헤더 등장 횟수 = 변경 파일 수 */
  files: number
}

/**
 * Empty / whitespace-only patch 는 0 stats 반환.
 */
export function parsePatchStats(patch: string | null | undefined): PatchStats {
  if (!patch) return { adds: 0, dels: 0, files: 0 }
  const adds = (patch.match(/^\+[^+]/gm) ?? []).length
  const dels = (patch.match(/^-[^-]/gm) ?? []).length
  const files = (patch.match(/^diff --git /gm) ?? []).length
  return { adds, dels, files }
}
