import { describe, expect, it } from 'vitest'
import { statusColor, statusLabel } from './statusFormat'
import type { ChangeStatus } from '@/types/git'

describe('statusLabel', () => {
  const cases: Array<[ChangeStatus, string]> = [
    ['added', '추가'],
    ['modified', '수정'],
    ['deleted', '삭제'],
    ['renamed', '이름변경'],
    ['copied', '복사'],
    ['typechange', '타입변경'],
  ]
  for (const [status, label] of cases) {
    it(`${status} → "${label}"`, () => {
      expect(statusLabel(status)).toBe(label)
    })
  }

  it('unknown status → "?"', () => {
    expect(statusLabel('weird-future-status' as ChangeStatus)).toBe('?')
  })
})

describe('statusColor', () => {
  it('added → emerald', () => {
    expect(statusColor('added')).toBe('text-emerald-500')
  })
  it('modified → amber', () => {
    expect(statusColor('modified')).toBe('text-amber-500')
  })
  it('deleted → rose', () => {
    expect(statusColor('deleted')).toBe('text-rose-500')
  })
  it('renamed / copied → sky (둘 다 같음)', () => {
    expect(statusColor('renamed')).toBe('text-sky-500')
    expect(statusColor('copied')).toBe('text-sky-500')
  })
  it('typechange / unknown → muted', () => {
    expect(statusColor('typechange')).toBe('text-muted-foreground')
    expect(statusColor('weird' as ChangeStatus)).toBe('text-muted-foreground')
  })
})
