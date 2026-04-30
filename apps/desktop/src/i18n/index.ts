// Sprint c31 / plan/03 §6 — i18n 기초 인프라 (한국어 1순위 / 영어 2순위).
//
// 사용:
//   - `<script setup>` 안: `const { t } = useI18n(); t('common.ok')`
//   - `<template>`: `{{ $t('common.ok') }}`
//   - locale 토글: `composables/useLocale.ts` 참조
//
// 추가 언어 (中文 / 日本語) 는 v1.x 외부 contributor 시.
import { createI18n } from 'vue-i18n'
import ko from '@/locales/ko.json'
import en from '@/locales/en.json'

export type SupportedLocale = 'ko' | 'en'

const STORAGE_KEY = 'git-fried.locale.v1'

function detectInitialLocale(): SupportedLocale {
  // localStorage 우선 (사용자 선택 영속).
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ko' || saved === 'en') return saved
  } catch {
    // localStorage 비활성 환경 (SSR / 시크릿 모드)
  }
  // OS / 브라우저 언어 fallback.
  const navLang = typeof navigator !== 'undefined' ? navigator.language : 'ko-KR'
  return navLang.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectInitialLocale(),
  fallbackLocale: 'ko',
  messages: { ko, en },
  // 2026-04-30 missing key warning OFF (점진 마이그레이션 중 noise 차단).
  // 마이그레이션 90% 후 ON 권장.
  missingWarn: false,
  fallbackWarn: false,
})

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignore
  }
  // <html lang> 동기화 (스크린리더 / OS 입력기 hint).
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}

// 초기 mount 시 <html lang> 세팅.
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.global.locale.value
}
