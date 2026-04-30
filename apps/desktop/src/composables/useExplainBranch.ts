// Sprint c32 god comp 분리 9/N — BranchPanel.vue 의 AI Explain branch 영역 분리.
//
// 책임:
//   - explainOpen / explainTitle / explainContent / explainError / explainPending state
//   - explain(repoId, head, base) — aiExplainBranch IPC 호출 + 결과 ref 갱신
//   - 미사용 시 부모에서 close (AiResultModal @close)
//
// 부모 (BranchPanel) 는 head 추출 (localName) + base prompt + close 만 담당.
import { ref } from 'vue'
import { aiExplainBranch, type AiCli } from '@/api/git'
import { describeError } from '@/api/errors'
import { notifyAiDone } from '@/composables/useAiCli'

export function useExplainBranch() {
  const explainOpen = ref(false)
  const explainTitle = ref('')
  const explainContent = ref('')
  const explainError = ref<string | null>(null)
  const explainPending = ref(false)

  /**
   * AI Explain branch 실행 — modal open + IPC 호출 + 결과 ref 갱신.
   *
   * @param repoId  active repo id
   * @param cli     사용 CLI (claude / codex)
   * @param head    비교 head 브랜치 (localName 적용된)
   * @param base    비교 base 브랜치 (사용자 입력 trim 된)
   */
  async function explain(repoId: number, cli: AiCli, head: string, base: string): Promise<void> {
    explainOpen.value = true
    explainTitle.value = `Branch ${head} (vs ${base})`
    explainContent.value = ''
    explainError.value = null
    explainPending.value = true
    try {
      const out = await aiExplainBranch(repoId, cli, head, base, true)
      if (out.success) {
        explainContent.value = out.text
        notifyAiDone('AI 브랜치 설명', `${head} vs ${base}`)
      } else {
        explainError.value = out.stderr || out.text || '응답 실패'
      }
    } catch (e) {
      explainError.value = describeError(e)
    } finally {
      explainPending.value = false
    }
  }

  function close(): void {
    explainOpen.value = false
  }

  return {
    explainOpen,
    explainTitle,
    explainContent,
    explainError,
    explainPending,
    explain,
    close,
  }
}
