// c58 P3-3 회귀 보호 — formatRelativeTime ko/en 시그니처 검증.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatRelativeTime } from './useUserSettings'

describe('formatRelativeTime', () => {
  const NOW = 1700000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW * 1000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('ko fallback (no t)', () => {
    it('< 60s → "방금"', () => {
      expect(formatRelativeTime(NOW - 30)).toBe('방금')
    })
    it('< 1h → "{n}분 전"', () => {
      expect(formatRelativeTime(NOW - 300)).toBe('5분 전')
    })
    it('< 24h → "{n}시간 전"', () => {
      expect(formatRelativeTime(NOW - 7200)).toBe('2시간 전')
    })
    it('< 7d → "{n}일 전"', () => {
      expect(formatRelativeTime(NOW - 86400 * 3)).toBe('3일 전')
    })
    it('< 30d → "{n}주 전"', () => {
      expect(formatRelativeTime(NOW - 604800 * 2)).toBe('2주 전')
    })
    it('< 365d → "{n}개월 전"', () => {
      expect(formatRelativeTime(NOW - 2592000 * 5)).toBe('5개월 전')
    })
    it('≥ 365d → "{n}년 전"', () => {
      expect(formatRelativeTime(NOW - 31536000 * 2)).toBe('2년 전')
    })
  })

  describe('en (with t injection)', () => {
    const tEn = (key: string, params?: { n?: number }) => {
      const n = params?.n ?? 0
      const map: Record<string, string> = {
        'time.justNow': 'just now',
        'time.minAgo': `${n}m ago`,
        'time.hourAgo': `${n}h ago`,
        'time.dayAgo': `${n}d ago`,
        'time.weekAgo': `${n}w ago`,
        'time.monthAgo': `${n}mo ago`,
        'time.yearAgo': `${n}y ago`,
      }
      return map[key] ?? ''
    }

    it('< 60s → "just now"', () => {
      expect(formatRelativeTime(NOW - 30, tEn)).toBe('just now')
    })
    it('< 1h → "{n}m ago"', () => {
      expect(formatRelativeTime(NOW - 300, tEn)).toBe('5m ago')
    })
    it('< 24h → "{n}h ago"', () => {
      expect(formatRelativeTime(NOW - 7200, tEn)).toBe('2h ago')
    })
    it('< 7d → "{n}d ago"', () => {
      expect(formatRelativeTime(NOW - 86400 * 3, tEn)).toBe('3d ago')
    })
    it('≥ 365d → "{n}y ago"', () => {
      expect(formatRelativeTime(NOW - 31536000 * 2, tEn)).toBe('2y ago')
    })
  })
})
