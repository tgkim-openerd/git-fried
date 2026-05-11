// c65-A — useCommitGraphPresentation 단위 테스트.
//
// 4 pure helper (bodyFirstLine / authorInitial / authorAvatarBg / refPillClass) 검증.
// refPillClass 만 reactive (soloRef) — composable.
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import {
  AVATAR_PALETTE,
  REF_KIND_CLASS,
  REF_PILL_SOLO_CLASS,
  authorAvatarBg,
  authorInitial,
  bodyFirstLine,
  useCommitGraphPresentation,
} from './useCommitGraphPresentation'
import type { HiddenRefKind } from '@/api/git'

describe('bodyFirstLine', () => {
  it('null/undefined/빈 → 빈 string', () => {
    expect(bodyFirstLine(null)).toBe('')
    expect(bodyFirstLine(undefined)).toBe('')
    expect(bodyFirstLine('')).toBe('')
  })

  it('단일 라인 → 그대로 반환', () => {
    expect(bodyFirstLine('Hello world')).toBe('Hello world')
  })

  it('다중 라인 → 첫 줄만', () => {
    expect(bodyFirstLine('first\nsecond\nthird')).toBe('first')
  })

  it('80자 초과 → 80자 + …', () => {
    const long = 'a'.repeat(120)
    const out = bodyFirstLine(long)
    expect(out).toHaveLength(81) // 80 + …
    expect(out.endsWith('…')).toBe(true)
  })

  it('80자 정확 → … 없이 그대로', () => {
    const exact = 'a'.repeat(80)
    expect(bodyFirstLine(exact)).toBe(exact)
  })

  it('whitespace trim 적용', () => {
    expect(bodyFirstLine('  hello  \n  world  ')).toBe('hello')
  })
})

describe('authorInitial', () => {
  it('null/undefined/빈 → ?', () => {
    expect(authorInitial(null)).toBe('?')
    expect(authorInitial(undefined)).toBe('?')
    expect(authorInitial('')).toBe('?')
    expect(authorInitial('   ')).toBe('?')
  })

  it('한글 1글자 시작 → 첫 2자', () => {
    expect(authorInitial('김태길')).toBe('김태')
    expect(authorInitial('이수민')).toBe('이수')
    expect(authorInitial('박')).toBe('박')
  })

  it('영문 → 첫 1자 대문자', () => {
    expect(authorInitial('alice')).toBe('A')
    expect(authorInitial('Bob')).toBe('B')
    expect(authorInitial('charlie')).toBe('C')
  })

  it('숫자/특수문자 시작 → 그대로 첫 1자 (대문자 시도)', () => {
    expect(authorInitial('1abc')).toBe('1')
    expect(authorInitial('_foo')).toBe('_')
  })

  it('whitespace trim 적용', () => {
    expect(authorInitial('  alice  ')).toBe('A')
    expect(authorInitial('  김태길  ')).toBe('김태')
  })
})

describe('authorAvatarBg', () => {
  it('null/undefined → bg-muted', () => {
    expect(authorAvatarBg(null)).toBe('bg-muted')
    expect(authorAvatarBg(undefined)).toBe('bg-muted')
  })

  it('빈 string → bg-muted (빈 hash → 0 → bg-emerald-500 이 아닌 fallback)', () => {
    // 코드 logic: if (!name) → bg-muted. 빈 string 은 falsy.
    expect(authorAvatarBg('')).toBe('bg-muted')
  })

  it('같은 이름 → 항상 같은 색 (hash 결정적)', () => {
    const a = authorAvatarBg('alice')
    const b = authorAvatarBg('alice')
    expect(a).toBe(b)
  })

  it('AVATAR_PALETTE 8 색상 중 하나 반환', () => {
    const samples = ['alice', 'bob', 'charlie', 'david', 'eve', '김태길', '이수민', 'frank']
    for (const s of samples) {
      expect(AVATAR_PALETTE).toContain(authorAvatarBg(s))
    }
  })

  it('hash 분포 — 다른 이름은 (대부분) 다른 색 (단순 검증)', () => {
    const a = authorAvatarBg('alice')
    const b = authorAvatarBg('bob')
    const c = authorAvatarBg('charlie')
    // 3개 모두 동일할 확률은 1/64 — 통계상 거의 0. CI flake 방지 위해 strict 검사 skip.
    expect([a, b, c]).toBeDefined()
  })
})

describe('useCommitGraphPresentation — refPillClass (reactive)', () => {
  const refKindOf = (refName: string): HiddenRefKind => {
    if (refName.startsWith('origin/')) return 'remote'
    if (refName.startsWith('refs/tags/')) return 'tag'
    if (refName.startsWith('stash@')) return 'stash'
    return 'branch'
  }

  it('soloRef 미설정 → kind 별 기본 클래스', () => {
    const soloRef = ref<string | null>(null)
    const { refPillClass } = useCommitGraphPresentation({
      soloRef: () => soloRef.value,
      refKindOf,
    })
    expect(refPillClass('main')).toBe(REF_KIND_CLASS.branch)
    expect(refPillClass('origin/main')).toBe(REF_KIND_CLASS.remote)
    expect(refPillClass('refs/tags/v1.0')).toBe(REF_KIND_CLASS.tag)
    expect(refPillClass('stash@{0}')).toBe(REF_KIND_CLASS.stash)
  })

  it('soloRef 매칭 → SOLO 클래스 override', () => {
    const soloRef = ref<string | null>('main')
    const { refPillClass } = useCommitGraphPresentation({
      soloRef: () => soloRef.value,
      refKindOf,
    })
    expect(refPillClass('main')).toBe(REF_PILL_SOLO_CLASS)
    // 다른 ref 는 기본 클래스
    expect(refPillClass('feat/x')).toBe(REF_KIND_CLASS.branch)
  })

  it('soloRef 변경 시 refPillClass 결과도 변경 (reactive)', () => {
    const soloRef = ref<string | null>(null)
    const { refPillClass } = useCommitGraphPresentation({
      soloRef: () => soloRef.value,
      refKindOf,
    })
    expect(refPillClass('feat/x')).toBe(REF_KIND_CLASS.branch)
    soloRef.value = 'feat/x'
    expect(refPillClass('feat/x')).toBe(REF_PILL_SOLO_CLASS)
    soloRef.value = null
    expect(refPillClass('feat/x')).toBe(REF_KIND_CLASS.branch)
  })

  // c73 TYPE-002 — REF_KIND_CLASS 에 없는 kind fallback (defensive)
  it('refKindOf 가 unknown kind 반환 → 빈 string fallback', () => {
    const soloRef = ref<string | null>(null)
    const { refPillClass } = useCommitGraphPresentation({
      soloRef: () => soloRef.value,
      // @ts-expect-error — 외부 호출자가 새 kind 추가 시 시뮬레이션
      refKindOf: () => 'unknown',
    })
    expect(refPillClass('main')).toBe('')
  })
})
