// 섹션 collapse — Sprint L (`docs/plan/11 §28`).
//
// 우클릭 헤더 → 섹션 접기. 사용자별 localStorage 영속.
// key 단위로 글로벌 ref 캐싱 (한 페이지에서 여러 컴포넌트가 동기화).
import { ref, watch, type Ref } from 'vue'

const STORAGE_PREFIX = 'git-fried.section-collapsed.'
const cache = new Map<string, Ref<boolean>>()

export function useSectionCollapse(key: string, initialCollapsed = false): Ref<boolean> {
  let r = cache.get(key)
  if (r) return r

  const storageKey = `${STORAGE_PREFIX}${key}`
  let initial = initialCollapsed
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(storageKey)
    if (v === '1') initial = true
    else if (v === '0') initial = false
  }
  r = ref(initial)
  watch(r, (v) => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(storageKey, v ? '1' : '0')
      } catch {
        /* ignore */
      }
    }
  })
  cache.set(key, r)
  return r
}
