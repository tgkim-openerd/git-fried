// Per-profile 탭 영속성 — Sprint B10 (`docs/plan/11 §23`).
//
// 활성 profile 별 마지막 우측 탭 (변경/브랜치/Stash/Sub/LFS/PR/WT) 기억.
// 사용자 회사 ↔ 개인 토글 시 마지막 사용 컨텍스트 자동 복원.
//
// localStorage key: `git-fried.tab.profile-<id>` = tab id.
// profile 없을 때는 globalKey `git-fried.tab.global` 사용.

import { computed, watch, type Ref } from 'vue'
import { useProfiles } from '@/composables/useProfiles'

export function useTabPerProfile<T extends string>(
  tab: Ref<T>,
  defaultTab: T,
) {
  const { active: activeProfile } = useProfiles()
  const activeKey = computed(() =>
    activeProfile.value
      ? `git-fried.tab.profile-${activeProfile.value.id}`
      : 'git-fried.tab.global',
  )

  function load(key: string): T | null {
    if (typeof localStorage === 'undefined') return null
    const v = localStorage.getItem(key)
    return v ? (v as T) : null
  }

  function save(key: string, value: T) {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  }

  // 초기 로드 + profile 전환 시 복원.
  watch(
    activeKey,
    (key) => {
      const stored = load(key) ?? defaultTab
      if (stored !== tab.value) {
        tab.value = stored
      }
    },
    { immediate: true },
  )

  // tab 변경 시 현재 profile key 에 저장.
  watch(tab, (v) => {
    save(activeKey.value, v)
  })
}
