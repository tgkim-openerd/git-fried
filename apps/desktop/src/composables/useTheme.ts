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

  // Sprint c45 DS-1 — OS prefers-color-scheme 자동 감지.
  //   1) localStorage 우선 (사용자 명시 선택 보존)
  //   2) localStorage 비어있을 때만 OS 설정 적용
  //   3) localStorage 없을 때 OS 변경 watch (사용자가 OS 토글 시 즉시 반영)
  function detectOsPrefers(): 'dark' | 'light' {
    if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  onMounted(() => {
    const stored = localStorage.getItem('git-fried.theme')
    if (stored === 'light' || stored === 'dark') {
      theme.value = stored
    } else {
      theme.value = detectOsPrefers()
      // OS 변경 watch — 사용자가 OS 다크모드 토글 시 자동 반영 (단 명시 선택 시 무시).
      try {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = (e: MediaQueryListEvent) => {
          if (!localStorage.getItem('git-fried.theme')) {
            theme.value = e.matches ? 'dark' : 'light'
          }
        }
        mq.addEventListener('change', onChange)
        // cleanup 은 onUnmounted 외 영구 리스너 — useTheme 는 App.vue 한 번 호출.
      } catch {
        // matchMedia 미지원 환경 (vitest happy-dom) silent.
      }
    }
    apply(theme.value)
  })

  watch(theme, (v) => apply(v))

  return { theme, toggle }
}
