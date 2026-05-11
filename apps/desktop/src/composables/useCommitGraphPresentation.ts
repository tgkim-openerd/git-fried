// Sprint c65 — CommitGraph god comp 추출 (presentation helpers).
//
// CommitGraph.vue 의 pure helper 4종 (~40 LOC) 분리. 테스트 가치 높음 (pure 함수
// + branching) + 향후 CommitTable 등 다른 컴포넌트 재사용 가능.
//
// 책임:
//   - bodyFirstLine — commit body 의 첫 줄 (80 char trim)
//   - refPillClass — branch/remote/tag/stash 색상 분기 + solo override
//   - authorInitial — 한글 2자 / 영문 1자 (P3-5)
//   - authorAvatarBg — 8 color hash (useGraphCanvasRenderer PALETTE 와 동일 시스템)
//
// 호출 contract:
//   const { bodyFirstLine, refPillClass, authorInitial, authorAvatarBg } =
//     useCommitGraphPresentation({ soloRef, refKindOf })
import type { Ref } from 'vue'
import type { HiddenRefKind } from '@/api/git'

export const REF_KIND_CLASS: Record<HiddenRefKind, string> = {
  branch: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  remote: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  tag: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  stash: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
}

export const REF_PILL_SOLO_CLASS =
  'bg-orange-500/20 text-orange-700 dark:text-orange-500 ring-1 ring-orange-500/40'

/** 8 stable color hash — useGraphCanvasRenderer PALETTE 와 동일 시스템. */
export const AVATAR_PALETTE = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-yellow-500',
  'bg-cyan-500',
]

export function bodyFirstLine(body: string | undefined | null): string {
  if (!body) return ''
  const first = body.trim().split('\n')[0]?.trim() ?? ''
  return first.length > 80 ? first.slice(0, 80) + '…' : first
}

/**
 * 한글 1글자 (가-힯) 시작 → 첫 2자 (e.g. 김태길 → 김태).
 * 영문/기타 → 첫 1자 대문자.
 * null/빈 → '?'.
 */
export function authorInitial(name: string | undefined | null): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  if (/^[가-힯]/.test(trimmed)) return trimmed.slice(0, 2)
  return trimmed.charAt(0).toUpperCase()
}

/** 이름 hash → 8 색상 중 1개. null → bg-muted. */
export function authorAvatarBg(name: string | undefined | null): string {
  if (!name) return 'bg-muted'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

export interface UseCommitGraphPresentationOptions {
  /** 현재 solo ref 이름 (null 이면 solo 미지정). 반응성 위해 ref. */
  soloRef: Ref<string | null>
  /** ref 이름 → HiddenRefKind (branch/remote/tag/stash) 매핑. */
  refKindOf: (refName: string) => HiddenRefKind
}

/**
 * refPillClass 만 반응성 (soloRef) 필요 → composable. 다른 helpers (bodyFirstLine /
 * authorInitial / authorAvatarBg) 는 named export 로 직접 import 가능.
 */
export function useCommitGraphPresentation(opts: UseCommitGraphPresentationOptions) {
  function refPillClass(refName: string): string {
    return opts.soloRef.value === refName
      ? REF_PILL_SOLO_CLASS
      : REF_KIND_CLASS[opts.refKindOf(refName)]
  }

  return {
    refPillClass,
    // re-export pure helpers (편의)
    bodyFirstLine,
    authorInitial,
    authorAvatarBg,
  }
}
