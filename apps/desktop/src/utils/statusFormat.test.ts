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
  it('added → diff-add (semantic)', () => {
    expect(statusColor('added')).toBe('text-diff-add')
  })
  it('modified → warning-amber (semantic)', () => {
    expect(statusColor('modified')).toBe('text-warning-amber')
  })
  it('deleted → diff-delete (semantic)', () => {
    expect(statusColor('deleted')).toBe('text-diff-delete')
  })
  it('renamed / copied → diff-rename (둘 다 같음)', () => {
    expect(statusColor('renamed')).toBe('text-diff-rename')
    expect(statusColor('copied')).toBe('text-diff-rename')
  })
  it('typechange / unknown → muted', () => {
    expect(statusColor('typechange')).toBe('text-muted-foreground')
    expect(statusColor('weird' as ChangeStatus)).toBe('text-muted-foreground')
  })
})
