// Sprint c32 god comp 분리 8/N — CommitMessageInput.vue 의 AI commit message
// 영역 (aiProbes / availableCli / aiMut + 결과 parsing) 을 composable 로 분리.
//
// 책임:
//   - aiDetectClis 1회 query (STATIC staleTime, 모듈 공용)
//   - availableCli computed (Claude > Codex 우선)
//   - generate(): confirm + aiCommitMessage IPC 호출 + onResult 콜백 (parsed 결과)
//   - parsed 결과 = { freeMessage, conventional?: {type/scope/breaking/subject/body} }
//   - 부모는 결과만 받아 ref 갱신 — confirm dialog / Conventional 패턴 매칭 / IPC
//     세부는 composable 안에 캡슐화.
//
// 다른 곳 (AI PR body / AI explain branch 등) 도 동일 패턴 재사용 가능.
import { computed } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { aiCommitMessage, aiDetectClis, type AiCli } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { notifyAiDone } from '@/composables/useAiCli'
import { isConventionalType, type ConventionalType } from '@/types/git'

export interface ParsedAiCommitMessage {
  /** AI 가 만든 raw text (free 모드 fallback). */
  freeMessage: string
  /** Conventional commits 패턴 매치 시. */
  conventional?: {
    type: ConventionalType
    scope: string
    breaking: boolean
    subject: string
    body: string
  }
}

export interface UseAiCommitMessageOptions {
  /** AI 결과 (parsed) — 부모가 ref 갱신용으로 사용 */
  onResult: (parsed: ParsedAiCommitMessage) => void
  /** AI 응답 실패 / 호출 실패 (cancelled 는 swallow). 미지정 시 silent */
  onError?: (e: unknown) => void
}

/** AI 응답 텍스트 → Conventional commit 패턴 매치 시 분해 (모듈 export — test 가능). */
export function parseAiResult(raw: string): ParsedAiCommitMessage {
  const text = raw.trim()
  const lines = text.split(/\r?\n/)
  const m = lines[0]?.match(/^(\w+)(?:\(([^)]+)\))?(!?):\s*(.+)$/)
  if (m && isConventionalType(m[1])) {
    let body = ''
    const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() === '')
    if (bodyStart > 0) {
      body = lines
        .slice(bodyStart + 1)
        .join('\n')
        .trim()
    }
    return {
      freeMessage: text,
      conventional: {
        type: m[1] as ConventionalType,
        scope: m[2] || '',
        breaking: m[3] === '!',
        subject: m[4] ?? '',
        body,
      },
    }
  }
  return { freeMessage: text }
}

export function useAiCommitMessage(
  repoIdGetter: () => number | null,
  opts: UseAiCommitMessageOptions,
) {
  const { data: aiProbes } = useQuery({
    queryKey: ['aiProbes'],
    queryFn: aiDetectClis,
    staleTime: STALE_TIME.STATIC,
  })

  const availableCli = computed<AiCli | null>(() => {
    const p = aiProbes.value
    if (!p) return null
    if (p.find((x) => x.cli === 'claude' && x.installed)) return 'claude'
    if (p.find((x) => x.cli === 'codex' && x.installed)) return 'codex'
    return null
  })

  const generate = useMutation({
    mutationFn: () => {
      const id = repoIdGetter()
      if (id == null || availableCli.value == null) {
        return Promise.reject(new Error('AI 사용 불가'))
      }
      if (!confirm('⚠ staged diff 가 외부 LLM 으로 송출됩니다.\n회사 보안정책을 확인하셨나요?')) {
        return Promise.reject(new Error('cancelled'))
      }
      return aiCommitMessage(id, availableCli.value, true)
    },
    onSuccess: (out) => {
      if (out.success) {
        notifyAiDone('AI commit message 생성', out.text.split(/\r?\n/)[0] ?? '')
        opts.onResult(parseAiResult(out.text))
      } else {
        opts.onError?.(new Error(out.stderr || out.text))
      }
    },
    onError: (e) => {
      const msg = describeError(e)
      if (msg.includes('cancelled')) return
      opts.onError?.(e)
    },
  })

  return {
    availableCli,
    generate,
    /** 직접 parser export — test / 다른 로직 재사용 */
    parseAiResult,
  }
}
