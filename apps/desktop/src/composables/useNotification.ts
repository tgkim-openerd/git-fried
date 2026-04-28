// OS 데스크탑 알림 — Sprint C8 (`docs/plan/11 §26`).
//
// 사용 시점: 백그라운드 / 다른 창 보고 있을 때 긴 작업 완료 알림.
// 권한 미허용 시 silent fail.
//
// 사용:
//   const { notify } = useNotification()
//   await notify('일괄 Fetch 완료', '5/5 레포 성공')
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

let cachedGranted: boolean | null = null

async function ensurePermission(): Promise<boolean> {
  if (cachedGranted !== null) return cachedGranted
  try {
    const granted = await isPermissionGranted()
    if (granted) {
      cachedGranted = true
      return true
    }
    const next = await requestPermission()
    cachedGranted = next === 'granted'
    return cachedGranted
  } catch {
    cachedGranted = false
    return false
  }
}

export function useNotification() {
  /**
   * 데스크탑 알림 발송. 권한 없으면 silent. window 가 focus 상태면 skip.
   */
  async function notify(title: string, body?: string): Promise<void> {
    // window focus 상태면 toast 가 이미 보이니 OS notification 생략.
    if (typeof document !== 'undefined' && document.hasFocus()) return
    const ok = await ensurePermission()
    if (!ok) return
    try {
      sendNotification({ title, body })
    } catch {
      /* ignore */
    }
  }

  return { notify }
}
