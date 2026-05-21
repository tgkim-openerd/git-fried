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
import { useToast } from '@/composables/useToast'
import { i18n } from '@/i18n'

let cachedGranted: boolean | null = null
// A-24/UXF-18 — 안내 toast 는 세션당 1회만 (매 알림마다 노출 방지).
// TYPE-W01 — 권한 거부와 전송 실패는 원인이 달라 별도 플래그 (한쪽이 다른 쪽을 묵음 처리하지 않도록).
let permDeniedNoticeShown = false
let sendFailNoticeShown = false

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
  const toast = useToast()

  /**
   * 데스크탑 알림 발송. window 가 focus 상태면 skip.
   * 권한 거부 시 — silent swallow 대신 세션당 1회 toast 안내 (A-24/UXF-18).
   */
  async function notify(title: string, body?: string): Promise<void> {
    // window focus 상태면 toast 가 이미 보이니 OS notification 생략.
    if (typeof document !== 'undefined' && document.hasFocus()) return
    const ok = await ensurePermission()
    if (!ok) {
      if (!permDeniedNoticeShown) {
        permDeniedNoticeShown = true
        toast.info(
          i18n.global.t('notification.deniedTitle'),
          i18n.global.t('notification.deniedBody'),
        )
      }
      return
    }
    try {
      // TYPE-004 — Promise reject 도 catch 로 잡히도록 await.
      await sendNotification({ title, body })
    } catch {
      // SEC MED-2 — sendNotification 실패 시 raw 에러(String(e)) 노출 금지.
      // 내부 경로/권한 정보가 섞일 수 있어 고정 i18n 메시지만 표시 (세션당 1회).
      if (!sendFailNoticeShown) {
        sendFailNoticeShown = true
        toast.info(
          i18n.global.t('notification.deniedTitle'),
          i18n.global.t('notification.deniedBody'),
        )
      }
    }
  }

  return { notify }
}

/** 테스트 전용 — 모듈 레벨 상태 reset (TYPE-N02). */
export function __resetNotificationStateForTest(): void {
  cachedGranted = null
  permDeniedNoticeShown = false
  sendFailNoticeShown = false
}
