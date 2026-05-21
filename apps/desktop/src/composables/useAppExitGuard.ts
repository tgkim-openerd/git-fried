/**
 * R5-005 — 앱 종료 시 진행 중인 long-running 작업 보호.
 *
 * Tauri window 의 onCloseRequested 를 가로채, useLongRunningProgress 의
 * 활성 작업(clone / fetch / push 등)이 있으면 confirm 후에만 종료.
 *
 * non-Tauri(dev mock) 환경에서는 getCurrentWindow 호출이 실패 — 조용히 skip.
 */
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLongRunningProgress } from '@/composables/useLongRunningProgress'
import { confirmDialog } from '@/composables/useConfirm'

export function useAppExitGuard() {
  const { t } = useI18n()
  const progress = useLongRunningProgress()
  let unlisten: (() => void) | null = null

  onMounted(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      unlisten = await win.onCloseRequested(async (event) => {
        const ops = progress.activeOperations.value
        if (ops.length === 0) return // 작업 없음 — 정상 종료
        event.preventDefault()
        const ok = await confirmDialog({
          title: t('confirm.exitWithRunningTitle'),
          message: t('confirm.exitWithRunningMessage', { n: ops.length }),
          danger: true,
        })
        if (ok) await win.destroy()
      })
    } catch {
      /* non-Tauri 환경 — exit guard 미적용 */
    }
  })

  onUnmounted(() => unlisten?.())
}
