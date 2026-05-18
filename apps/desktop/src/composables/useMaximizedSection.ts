// SB-015 (UltraPlan v0.4 sidebar microgap Phase 2, 2026-05-18) — Mini section header
// dblclick → maximize. Singleton ref + localStorage 영속화.
//
// 동작:
//   - dblclick → 해당 section 만 expand, 나머지 6 section 숨김
//   - 다시 dblclick → 원상복귀 (각 section 의 사용자 collapse 상태 보존)
//
// localStorage 키: `active-repo-quick.maximized` = '{storageKey}' | null

import { ref, computed, watch, type ComputedRef } from 'vue'

const STORAGE_KEY = 'active-repo-quick.maximized'

function loadMaximized(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw && raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

// Singleton ref — 모든 MiniSection 이 동일 ref 구독.
const maximizedRef = ref<string | null>(loadMaximized())

watch(maximizedRef, (next) => {
  if (typeof window === 'undefined') return
  try {
    if (next == null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // localStorage write 실패 시 silent — UI state 만 일시적
  }
})

export interface UseMaximizedSectionApi {
  /** 현재 maximize 된 section storageKey (null = no maximize). */
  readonly maximized: typeof maximizedRef
  /** 본 section 이 활성 maximize 인지 (true → 본인은 표시). */
  isMaximized: (storageKey: string) => ComputedRef<boolean>
  /** 본 section 이 다른 section 의 maximize 때문에 숨겨져야 하는지. */
  shouldHide: (storageKey: string) => ComputedRef<boolean>
  /** dblclick handler — toggle maximize for given storageKey. */
  toggleMaximize: (storageKey: string) => void
  /** maximize 해제 (Esc 또는 외부 trigger). */
  clearMaximize: () => void
}

export function useMaximizedSection(): UseMaximizedSectionApi {
  return {
    maximized: maximizedRef,
    isMaximized: (storageKey) => computed(() => maximizedRef.value === storageKey),
    shouldHide: (storageKey) =>
      computed(() => maximizedRef.value !== null && maximizedRef.value !== storageKey),
    toggleMaximize: (storageKey) => {
      maximizedRef.value = maximizedRef.value === storageKey ? null : storageKey
    },
    clearMaximize: () => {
      maximizedRef.value = null
    },
  }
}
