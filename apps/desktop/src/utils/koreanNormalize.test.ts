import { describe, expect, it } from 'vitest'
import { isNFD, normalizeStringFields, toNFC, toNFCTrimmed } from './koreanNormalize'

// 한글 NFD/NFC 차이가 명확히 보이는 fixture.
// 한국 = U+D55C (한) U+AD6D (국) [NFC 음절]
//      = U+1112 (ㅎ) U+1161 (ㅏ) U+11AB (ㄴ) U+1100 (ㄱ) U+116E (ㅜ) U+11A8 (ㄱ) [NFD 자모]
const NFC_HANGUL = '한국'
const NFD_HANGUL = NFC_HANGUL.normalize('NFD')

describe('toNFC', () => {
  it('NFD 한글 → NFC 음절로 변환', () => {
    expect(toNFC(NFD_HANGUL)).toBe(NFC_HANGUL)
    expect(toNFC(NFD_HANGUL).length).toBe(2)
    expect(NFD_HANGUL.length).toBe(6)
  })

  it('이미 NFC 인 한글은 idempotent', () => {
    expect(toNFC(NFC_HANGUL)).toBe(NFC_HANGUL)
  })

  it('비한글 ASCII 는 그대로', () => {
    expect(toNFC('feat: refactor')).toBe('feat: refactor')
  })

  it('빈 문자열 통과', () => {
    expect(toNFC('')).toBe('')
  })

  it('혼합 (영어 + NFD 한글)', () => {
    const mixed = `feat: ${NFD_HANGUL} 버그 fix`
    const out = toNFC(mixed)
    expect(out).toBe(`feat: ${NFC_HANGUL} 버그 fix`)
  })
})

describe('toNFCTrimmed', () => {
  it('앞뒤 공백 제거 + NFC', () => {
    expect(toNFCTrimmed(`  ${NFD_HANGUL}  `)).toBe(NFC_HANGUL)
  })

  it('빈 문자열 통과', () => {
    expect(toNFCTrimmed('')).toBe('')
  })

  it('공백만 있으면 빈 문자열', () => {
    expect(toNFCTrimmed('   ')).toBe('')
  })
})

describe('isNFD', () => {
  it('NFD 한글이면 true', () => {
    expect(isNFD(NFD_HANGUL)).toBe(true)
  })

  it('NFC 한글이면 false', () => {
    expect(isNFD(NFC_HANGUL)).toBe(false)
  })

  it('ASCII 는 false', () => {
    expect(isNFD('feat')).toBe(false)
  })

  it('빈 문자열 false', () => {
    expect(isNFD('')).toBe(false)
  })
})

describe('normalizeStringFields', () => {
  it('string 필드만 NFC normalize, 다른 필드 보존', () => {
    const input = {
      title: NFD_HANGUL,
      body: `description with ${NFD_HANGUL}`,
      count: 42,
      flag: true,
      meta: { nested: 'untouched' },
    }
    const out = normalizeStringFields(input)
    expect(out.title).toBe(NFC_HANGUL)
    expect(out.body).toBe(`description with ${NFC_HANGUL}`)
    expect(out.count).toBe(42)
    expect(out.flag).toBe(true)
    expect(out.meta).toBe(input.meta)
  })

  it('빈 객체 통과', () => {
    expect(normalizeStringFields({})).toEqual({})
  })

  it('mutation 안 함 (input 원본 보존)', () => {
    const input = { title: NFD_HANGUL }
    normalizeStringFields(input)
    expect(input.title).toBe(NFD_HANGUL)
  })
})
