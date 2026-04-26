// 다크 모드 토글 — `<html>` 의 .dark 클래스 + localStorage 저장.
import { onMounted, ref, watch } from 'vue'

export function useTheme() {
  const theme = ref<'dark' | 'light'>('dark')

  function apply(value: 'dark' | 'light') {
    const root = document.documentElement
    root.classList.toggle('dark', value === 'dark')
    localStorage.setItem('git-fried.theme', value)
  }

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  onMounted(() => {
    const stored = localStorage.getItem('git-fried.theme')
    if (stored === 'light' || stored === 'dark') {
      theme.value = stored
    }
    apply(theme.value)
  })

  watch(theme, (v) => apply(v))

  return { theme, toggle }
}
