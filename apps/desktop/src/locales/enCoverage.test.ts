// c58 P1-8 회귀 보호 — ko/en locale 신규 키 대칭 + critical 키 존재 검증.
//
// hardcoded ko 잔여 검출은 e2e 영역 (DOM 검사) — 본 unit test 는 i18n key 자체 정합성만.

import { describe, expect, it } from 'vitest'
import ko from './ko.json'
import en from './en.json'

type AnyJson = Record<string, unknown>

function flatten(o: AnyJson, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(o)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatten(v as AnyJson, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

describe('locale ko/en 대칭 (c58 P1-8 회귀 보호)', () => {
  const koKeys = new Set(flatten(ko as AnyJson))
  const enKeys = new Set(flatten(en as AnyJson))

  it('모든 ko 키가 en 에 존재', () => {
    const missing = [...koKeys].filter((k) => !enKeys.has(k))
    expect(missing).toEqual([])
  })

  it('모든 en 키가 ko 에 존재', () => {
    const missing = [...enKeys].filter((k) => !koKeys.has(k))
    expect(missing).toEqual([])
  })

  it('c58 신규 critical 키 존재 — time.* (P3-3 EN i18n)', () => {
    expect(koKeys.has('time.justNow')).toBe(true)
    expect(koKeys.has('time.minAgo')).toBe(true)
    expect(koKeys.has('time.yearAgo')).toBe(true)
    expect(enKeys.has('time.justNow')).toBe(true)
    expect(enKeys.has('time.yearAgo')).toBe(true)
  })

  it('c58 신규 critical 키 존재 — settings.profilesSection.* (P1-8)', () => {
    expect(koKeys.has('settings.profilesSection.title')).toBe(true)
    expect(koKeys.has('settings.profilesSection.btnDelete')).toBe(true)
    expect(enKeys.has('settings.profilesSection.title')).toBe(true)
  })

  it('c58 신규 critical 키 존재 — settings.forgeSection.* (P1-8)', () => {
    expect(koKeys.has('settings.forgeSection.title')).toBe(true)
    expect(koKeys.has('settings.forgeSection.btnVerify')).toBe(true)
    expect(enKeys.has('settings.forgeSection.title')).toBe(true)
  })

  it('c57 신규 키 존재 — settings.items.* (P1-8 첫 sprint)', () => {
    expect(koKeys.has('settings.items.profiles')).toBe(true)
    expect(koKeys.has('settings.items.about')).toBe(true)
    expect(enKeys.has('settings.items.profiles')).toBe(true)
  })

  it('c57 신규 키 존재 — launchpad.header.* (P1-8 첫 sprint)', () => {
    expect(koKeys.has('launchpad.header.repo')).toBe(true)
    expect(koKeys.has('launchpad.header.updated')).toBe(true)
    expect(enKeys.has('launchpad.header.repo')).toBe(true)
  })
})
