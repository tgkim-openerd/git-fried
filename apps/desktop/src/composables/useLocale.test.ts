// Sprint c31 — useLocale composable + i18n 인프라 단위 테스트.
import { describe, expect, it, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { i18n, setLocale } from '@/i18n'
import { useLocale } from './useLocale'

const STORAGE_KEY = 'git-fried.locale.v1'

beforeEach(() => {
  localStorage.clear()
  // 초기화 — 테스트 격리 위해 ko 로 reset.
  i18n.global.locale.value = 'ko'
})

function mountWithI18n(setup: () => unknown) {
  const Comp = defineComponent({
    setup,
    render: () => h('div'),
  })
  return mount(Comp, { global: { plugins: [i18n] } })
}

describe('useLocale', () => {
  it('초기 locale 은 ko', () => {
    let captured: ReturnType<typeof useLocale> | undefined
    mountWithI18n(() => {
      captured = useLocale()
    })
    expect(captured!.currentLocale.value).toBe('ko')
  })

  it('setLocale("en") 호출 시 currentLocale 이 en 으로 변경', async () => {
    let captured: ReturnType<typeof useLocale> | undefined
    mountWithI18n(() => {
      captured = useLocale()
    })
    captured!.setLocale('en')
    await nextTick()
    expect(captured!.currentLocale.value).toBe('en')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')
  })

  it('toggleLocale 호출 시 ko ↔ en 반전', async () => {
    let captured: ReturnType<typeof useLocale> | undefined
    mountWithI18n(() => {
      captured = useLocale()
    })
    expect(captured!.currentLocale.value).toBe('ko')
    captured!.toggleLocale()
    await nextTick()
    expect(captured!.currentLocale.value).toBe('en')
    captured!.toggleLocale()
    await nextTick()
    expect(captured!.currentLocale.value).toBe('ko')
  })

  it('setLocale 은 <html lang> 도 갱신', () => {
    setLocale('en')
    expect(document.documentElement.lang).toBe('en')
    setLocale('ko')
    expect(document.documentElement.lang).toBe('ko')
  })
})

describe('i18n messages', () => {
  it('common.ok 가 ko 에서 "확인", en 에서 "OK"', () => {
    i18n.global.locale.value = 'ko'
    expect(i18n.global.t('common.ok')).toBe('확인')
    i18n.global.locale.value = 'en'
    expect(i18n.global.t('common.ok')).toBe('OK')
  })

  it('status.staged 는 ko/en 모두 "Staged" (proper noun)', () => {
    i18n.global.locale.value = 'ko'
    expect(i18n.global.t('status.staged')).toBe('Staged')
    i18n.global.locale.value = 'en'
    expect(i18n.global.t('status.staged')).toBe('Staged')
  })

  it('settings.categories.start 는 ko 에서 "시작·마이그레이션", en 에서 "Start & Migration"', () => {
    i18n.global.locale.value = 'ko'
    expect(i18n.global.t('settings.categories.start')).toBe('시작·마이그레이션')
    i18n.global.locale.value = 'en'
    expect(i18n.global.t('settings.categories.start')).toBe('Start & Migration')
  })

  it('locale 별 messages 키 카운트 동일 (ko / en 누락 키 없음)', () => {
    function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'object' && v != null) {
          return flatten(v as Record<string, unknown>, path)
        }
        return [path]
      })
    }
    const koMessages = i18n.global.messages.value.ko
    const enMessages = i18n.global.messages.value.en
    const koKeys = flatten(koMessages as Record<string, unknown>).sort()
    const enKeys = flatten(enMessages as Record<string, unknown>).sort()
    expect(koKeys).toEqual(enKeys)
  })

  it('fallbackLocale = ko (en 누락 키는 ko 로 fallback)', () => {
    // 일부러 존재하지 않는 키 — fallbackLocale 검증은 missing 키로는 불가.
    // 대신 i18n 설정 확인.
    expect(i18n.global.fallbackLocale.value).toBe('ko')
  })
})
