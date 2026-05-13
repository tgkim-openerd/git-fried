// AI CLI 감지 공용 composable — Sprint B7 의 Explain / Stash 진입점에서 재사용.
//
// 현재 CommitMessageInput 이 자체 useQuery 로 detect 하고 있는데, 진입점 늘면서
// 통일된 1회 cache + 모든 컴포넌트 재사용 패턴이 더 깔끔.
import { computed, ref, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { aiDetectClis, type AiCli, type AiProbe } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import { useNotification } from '@/composables/useNotification'
import { confirmDialog } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

export function useAiCli() {
  const {
    data: probes,
    isFetching,
    refetch,
  } = useQuery<AiProbe[]>({
    queryKey: ['aiProbes'],
    queryFn: aiDetectClis,
    staleTime: STALE_TIME.STATIC,
  })

  const available = computed<AiCli | null>(() => {
    const p = probes.value
    if (!p) return null
    if (p.find((x) => x.cli === 'claude' && x.installed)) return 'claude'
    if (p.find((x) => x.cli === 'codex' && x.installed)) return 'codex'
    return null
  })

  const installedClis = computed<AiCli[]>(() => {
    return (probes.value ?? []).filter((p) => p.installed).map((p) => p.cli)
  })

  return { probes, available, installedClis, isFetching, refetch }
}

/**
 * 회사 보안정책 강제 공통 confirm — Promise<boolean> resolve.
 *  - true: 송출 동의
 *  - false: 취소 / Esc / backdrop
 *
 * Sprint c33 — window.confirm() 의 OS 다이얼로그 → 커스텀 ConfirmDialog 마이그레이션.
 * vue setup context 외부에서도 호출되므로 i18n.global.t 사용 (useI18n() 안 됨).
 *
 * Sprint c45 UX-5 — 30s TTL 캐시. 사용자가 한 번 동의하면 30초 내 다른 AI composable 호출 시
 * 자동 true 반환 (5 composable AI confirm 중복 마찰 해소).
 */
const AI_CONFIRM_TTL_MS = 30_000
let lastAiConfirmAt = 0

export function confirmAiSend(): Promise<boolean> {
  // v0.4 #3 — cooldown 진행 중이면 즉시 거부 (Doherty: 400ms 안 응답).
  const cooldownRemain = getAiCooldownRemainingMs()
  if (cooldownRemain > 0) {
    const t = i18n.global.t
    const sec = Math.ceil(cooldownRemain / 1000)
    return confirmDialog({
      title: t('ai.cooldown.title'),
      message: t('ai.cooldown.message', { sec }),
      danger: false,
      confirmText: t('ai.cooldown.dismiss'),
    }).then(() => false)
  }
  const now = Date.now()
  if (now - lastAiConfirmAt < AI_CONFIRM_TTL_MS) {
    return Promise.resolve(true)
  }
  const t = i18n.global.t
  return confirmDialog({
    title: t('confirm.aiSendTitle'),
    message: t('confirm.aiSendMessage'),
    danger: true,
  }).then((ok) => {
    if (ok) lastAiConfirmAt = Date.now()
    return ok
  })
}

/** 테스트 / 보안 reset — TTL 캐시 즉시 만료. */
export function __resetAiConfirmCache(): void {
  lastAiConfirmAt = 0
}

// ====== AI quota / rate limit fallback (v0.4 #3, UltraPlan plan/31 §2) ======
//
// Claude / Codex CLI 가 quota 소진 / rate limit 시 사용자 친화 메시지 + cooldown 표시.
// 5 AI composable (Commit/PrBody/Composer/Resolve/Review) 의 onError 에서 통합 사용.
//
// stderr 메시지에서 quota / rate-limit 패턴 감지 (CLI 자체가 plain text 출력).

/** quota / rate-limit 메시지 패턴. 한 줄이라도 매칭하면 quota error 로 분류. */
const QUOTA_PATTERNS: RegExp[] = [
  /quota\s*(exceeded|reached|limit)/i,
  /rate\s*limit/i,
  /too\s*many\s*requests/i,
  /\b429\b/,
  /usage\s*limit/i,
  /limit\s*reached/i,
  /api\s*key\s*(quota|usage)/i,
]

/** Claude/Codex CLI stderr 중 quota 패턴 발견. */
function isQuotaErrorText(text: string): boolean {
  if (!text) return false
  return QUOTA_PATTERNS.some((re) => re.test(text))
}

/** 60s cooldown — confirmAiSend 가 차단. */
const AI_QUOTA_COOLDOWN_MS = 60_000
let aiQuotaCooldownUntil = 0

/** cooldown 진행 중 남은 ms. 0 이면 해제. */
export function getAiCooldownRemainingMs(): number {
  const remain = aiQuotaCooldownUntil - Date.now()
  return remain > 0 ? remain : 0
}

/** AI 호출 흐름의 catch 분기에서 호출. quota 인식 시 cooldown 활성화. */
export function reportAiError(err: unknown): {
  kind: 'quota' | 'unknown'
  message: string
  cooldownRemainingMs: number
} {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : String(err)
  if (isQuotaErrorText(message)) {
    aiQuotaCooldownUntil = Date.now() + AI_QUOTA_COOLDOWN_MS
    return { kind: 'quota', message, cooldownRemainingMs: AI_QUOTA_COOLDOWN_MS }
  }
  return { kind: 'unknown', message, cooldownRemainingMs: 0 }
}

/** 테스트 — cooldown 즉시 해제. */
export function __resetAiQuotaCooldown(): void {
  aiQuotaCooldownUntil = 0
}

// ====== AI 호출 카운터 (Sprint c36, IdentityCard dogfood 통계) ======
//
// Sprint c36 코드 리뷰 ARCH-001 fix — module-scope reactive ref + localStorage 이중 동기화.
//   - increment 시점에 ref.value 직접 갱신 → IdentityCard 가 reactive 표시 (poll 불필요)
//   - localStorage 영속화 → 앱 재시작 후 카운터 복원
//   - SEC-c36-01 fix — Number.isFinite guard 로 NaN persistence 방어 (다른 앱이 같은 키 오염 시)
//
// 5 AI composable (Commit/PrBody/ResolveConflict/Composer/Review) 의 onSuccess 에서
// notifyAiDone 호출 → incrementAiCallCount 자동 측정 (1 곳에서).
export const AI_COUNT_KEY = 'git-fried.identity.aiCallCount'

function readPersistedCount(): number {
  try {
    const raw = Number(localStorage.getItem(AI_COUNT_KEY) ?? '0')
    return Number.isFinite(raw) && raw >= 0 ? raw : 0
  } catch {
    // localStorage 비활성 (시크릿 모드 / SSR) — silent fallback.
    return 0
  }
}

/** module-scope reactive ref — IdentityCard 가 직접 import 해서 template 에 노출. */
export const aiCallCountRef: Ref<number> = ref(readPersistedCount())

/**
 * AI 응답 완료 시 OS notification (window 미focus 시).
 * Sprint D7 — 모든 AI 진입점 공용.
 *
 * Sprint c36 — AI 호출 카운터 자동 증가 (IdentityCard dogfood 통계).
 */
export function notifyAiDone(title: string, body?: string) {
  const { notify } = useNotification()
  void notify(`✨ ${title}`, body)
  incrementAiCallCount()
}

/**
 * AI 호출 카운터 +1. reactive ref + localStorage 동시 갱신.
 * 실패 시 ref 만 증가 (localStorage 비활성 환경 fallback).
 */
export function incrementAiCallCount(): void {
  aiCallCountRef.value += 1
  try {
    localStorage.setItem(AI_COUNT_KEY, String(aiCallCountRef.value))
  } catch {
    // silent — ref 는 이미 갱신됨, localStorage 만 실패.
  }
}

/** 테스트 / 외부 read helper. ref 직접 노출도 가능하나 read-only intent 명시용. */
export function readAiCallCount(): number {
  return aiCallCountRef.value
}

/** 테스트 전용 — 카운터 reset (localStorage + ref). */
export function __resetAiCallCountForTest(): void {
  aiCallCountRef.value = 0
  try {
    localStorage.removeItem(AI_COUNT_KEY)
  } catch {
    // ignore
  }
}
