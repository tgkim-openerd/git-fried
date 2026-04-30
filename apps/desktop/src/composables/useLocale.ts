// Sprint c31 — locale 토글 composable (`docs/plan/03 §6`).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, type SupportedLocale } from '@/i18n'

export function useLocale() {
  const { locale } = useI18n()

  const currentLocale = computed<SupportedLocale>(() => locale.value as SupportedLocale)

  function toggle(): void {
    setLocale(currentLocale.value === 'ko' ? 'en' : 'ko')
  }

  function set(next: SupportedLocale): void {
    setLocale(next)
  }

  return {
    currentLocale,
    setLocale: set,
    toggleLocale: toggle,
  }
}
