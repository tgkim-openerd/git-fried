// 한글 NFC normalize utility.
//
// 배경:
//   - macOS Finder 가 한글 파일명을 NFD (자음/모음 분리) 로 저장 → git add 시 mangled.
//   - Windows / Linux 는 NFC (조합형) 기본.
//   - Rust 측은 `unicode-normalization` crate 로 처리하나 frontend 입력 boundary 는 implicit JS.
//
// 적용 boundary:
//   - 커밋 메시지 (CommitMessageInput)
//   - 브랜치명 / 태그명 / stash 메시지 / remote name (rename 입력)
//   - 검색쿼리 free text (Launchpad / CommandPalette)
//   - PR title / body (작성 시점)
//
// 디자인 원칙:
//   - 항상 NFC 로 정규화 (git 표준).
//   - 빈 문자열 / null / undefined 통과.
//   - 비한글 문자열은 idempotent.

/**
 * 입력 문자열을 NFC 로 정규화.
 * - 한글 NFD (자모 분리) 가 있으면 NFC (음절) 로 합성.
 * - 한글이 아니어도 호출 안전 (동일 문자열 반환).
 */
export function toNFC(input: string): string {
  if (!input) return input
  return input.normalize('NFC')
}

/**
 * NFC 변환 후 양쪽 공백 제거.
 * 입력 폼 (브랜치명, 커밋 메시지 첫 줄) 의 표준 처리.
 */
export function toNFCTrimmed(input: string): string {
  if (!input) return input
  return input.normalize('NFC').trim()
}

/**
 * 입력이 NFD 인지 (= NFC 와 다른지) 검사.
 * UI 에서 "정규화 적용" 표시할 때 사용.
 */
export function isNFD(input: string): boolean {
  if (!input) return false
  return input !== input.normalize('NFC')
}

/**
 * 객체의 string 필드만 NFC normalize 하여 새 객체 반환.
 * non-string 필드는 그대로.
 *
 * 사용처: PR 작성 form payload, branch create payload 등 IPC 전달 직전 일괄 정규화.
 */
export function normalizeStringFields<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    out[k] = typeof v === 'string' ? toNFC(v) : v
  }
  return out as T
}
