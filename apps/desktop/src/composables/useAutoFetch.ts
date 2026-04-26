// Auto-Fetch 폴링 — Sprint D2.
//
// general.autoFetchIntervalMin 값에 따라 setInterval 로 bulkFetch 호출.
// 0 이면 폴링 없음. 변경 시 자동 재설정 (clearInterval + 새 setInterval).
// window 이 hidden (visibilitychange) 일 때는 skip — 사용자 unblock 시점에 한 번 실행.

import { onMounted, onUnmounted, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { bulkFetch } from '@/api/git'
import { useReposStore } from '@/stores/repos'
import { useGeneralSettings } from '@/composables/useUserSettings'

export function useAutoFetch() {
  const general = useGeneralSettings()
  const store = useReposStore()
  const qc = useQueryClient()

  let timerId: ReturnType<typeof setInterval> | null = null
  let lastRun = 0
  let running = false

  async function tick() {
    if (running) return
    if (typeof document !== 'undefined' && document.hidden) return
    running = true
    try {
      const results = await bulkFetch(store.activeWorkspaceId)
      lastRun = Date.now()
      qc.invalidateQueries({ queryKey: ['status'] })
      qc.invalidateQueries({ queryKey: ['log'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['branches'] })
      qc.invalidateQueries({ queryKey: ['conflict-prediction'] })
      // 결과는 silent — Sidebar 의 수동 bulkFetch 가 toast/notify 담당.
      void results
    } catch {
      /* silent — 다음 tick 으로 */
    } finally {
      running = false
    }
  }

  function clearTimer() {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
  }

  function setupTimer() {
    clearTimer()
    const minutes = general.value.autoFetchIntervalMin
    if (!Number.isFinite(minutes) || minutes <= 0) return
    const ms = Math.max(60_000, minutes * 60_000) // 최소 1분 (안전).
    timerId = setInterval(tick, ms)
  }

  function onVisibilityChange() {
    if (typeof document === 'undefined') return
    if (document.hidden) return
    // 숨김 → 표시 전환 시 마지막 실행이 interval 보다 오래 됐으면 즉시 한 번.
    const minutes = general.value.autoFetchIntervalMin
    if (!Number.isFinite(minutes) || minutes <= 0) return
    if (Date.now() - lastRun >= minutes * 60_000) {
      void tick()
    }
  }

  onMounted(() => {
    setupTimer()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  })

  onUnmounted(() => {
    clearTimer()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  // 설정 변경 시 reactive 재설정.
  watch(
    () => general.value.autoFetchIntervalMin,
    () => setupTimer(),
  )
}
