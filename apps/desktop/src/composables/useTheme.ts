// 다크 / 라이트 테마 토글.
//
// 1. `<html>.dark` 클래스 토글 → CSS 변수 (`:root` ↔ `.dark`) 적용
// 2. localStorage 영속
// 3. Tauri 2.x — webview window 의 chrome (title bar / scrollbar 등) 도 동기화.
//    실패해도 silent (web build / non-Tauri 환경 호환).
import { onMounted, ref, watch } from 'vue'

async function applyTauriWindowTheme(value: 'dark' | 'light'): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const w = getCurrentWindow()
    await w.setTheme(value)
  } catch {
    // 비-Tauri 환경 (vitest / SSR) 또는 권한 거부 → silent.
  }
}

export function useTheme() {
  const theme = ref<'dark' | 'light'>('dark')

  function apply(value: 'dark' | 'light') {
    const root = document.documentElement
    root.classList.toggle('dark', value === 'dark')
    localStorage.setItem('git-fried.theme', value)
    void applyTauriWindowTheme(value)
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
