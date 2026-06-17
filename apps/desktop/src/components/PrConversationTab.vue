<script setup lang="ts">
// Sprint c103 (B-2) — PrDetailModal 의 Conversation 탭 분리 (PrFilesTab 패턴).
//
// V-2 Conversation tab 의 책임(코멘트 스레드 fetch + 새 코멘트 + code suggestion form +
// 리뷰 제출 + AI 리뷰)을 자체 흡수. 부모(PrDetailModal)는 detail/open prop 만 내리고
// Files 탭의 "+" 클릭(comment-line) 시 prefillSuggestion(defineExpose)으로 prefill.
//
// mutation 은 usePrConversationMutations(usePrMutations 분할의 conversation 축) 소유.
import { ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listPrComments } from '@/api/git'
import type { PullRequest, ReviewVerdict } from '@/api/git'
import { describeError } from '@/api/errors'
import { formatDateLocalized } from '@/composables/useUserSettings'
import { usePrConversationMutations } from '@/composables/usePrConversationMutations'
import { useAiReview } from '@/composables/useAiReview'
import { useToast } from '@/composables/useToast'
import UserAvatar from './UserAvatar.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const toast = useToast()

const props = defineProps<{
  repoId: number | null
  number: number | null
  /** 모달 open 상태 — 코멘트 fetch 게이트 + 닫힐 때 폼 reset */
  open: boolean
  /** PR 상세 (부모 detailQuery 결과 — 헤더/CI/본문 표시용) */
  detail: PullRequest | null
  /** PR 상세 fetch 에러 (부모 detailQuery.error) */
  detailError: unknown
}>()

// 코멘트 스레드 — 본 탭 소유 (PrDetailModal 에서 이전).
const commentsQuery = useQuery({
  queryKey: computed(() => ['pr-comments', props.repoId, props.number]),
  queryFn: () => {
    if (props.repoId == null || props.number == null) return Promise.resolve([])
    return listPrComments(props.repoId, props.number)
  },
  enabled: computed(() => props.open && props.repoId != null && props.number != null),
})

// 코멘트 / 리뷰 폼 상태.
const newComment = ref<string>('')
const reviewBody = ref<string>('')
const verdict = ref<ReviewVerdict>('comment')

// conversation mutations (usePrMutations 분할 — addComment / review / suggestion).
const conv = usePrConversationMutations({
  repoId: () => props.repoId,
  number: () => props.number,
  newComment,
  reviewBody,
  verdict,
})
const addCommentMut = conv.addCommentMut
const reviewMut = conv.reviewMut
const {
  open: suggestionOpen,
  path: sugPath,
  line: sugLine,
  newCode: sugNewCode,
  context: sugContext,
  mut: suggestionMut,
  reset: resetSuggestion,
} = conv.suggestion

// AI 코드 리뷰 — useAiReview composable (리뷰 본문 자동 채움).
const aiR = useAiReview({
  repoId: () => props.repoId,
  number: () => props.number,
  detail: () => props.detail,
  onResult: (text) => {
    reviewBody.value = text
  },
  onError: (e) => toast.error(t('pr.aiInvokeFailed'), describeError(e)),
})
const availableCli = aiR.availableCli
const aiReviewMut = aiR.generate
async function onAiReview(): Promise<void> {
  await aiR.run()
}

// E3 (plan #44) — Files 탭 diff 라인 "+" 클릭 → suggestion form prefill.
// 부모(PrDetailModal)가 activeTab 전환 후 본 메서드 호출 (defineExpose).
function prefillSuggestion(path: string, line: number) {
  sugPath.value = path
  sugLine.value = line
  suggestionOpen.value = true
}
defineExpose({ prefillSuggestion })

// 모달 닫힐 때 폼 초기화 (PrDetailModal 의 reset-on-close 에서 이전).
watch(
  () => props.open,
  (o) => {
    if (!o) {
      newComment.value = ''
      reviewBody.value = ''
      verdict.value = 'comment'
      resetSuggestion()
    }
  },
)

function fmtDate(unix: number): string {
  return formatDateLocalized(unix, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// CI 상태 칩 (PrDetailModal 에서 이전 — conversation 헤더 전용).
function ciLabel(s: 'success' | 'pending' | 'failure'): string {
  return s === 'success'
    ? t('pr.ciStatus.passed')
    : s === 'failure'
      ? t('pr.ciStatus.failed')
      : t('pr.ciStatus.pending')
}
function ciClass(s: 'success' | 'pending' | 'failure'): string {
  return s === 'success'
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    : s === 'failure'
      ? 'bg-rose-500/15 text-danger-rose'
      : 'bg-amber-500/15 text-warning-amber'
}
function ciIcon(s: 'success' | 'pending' | 'failure'): string {
  return s === 'success' ? '✔' : s === 'failure' ? '✕' : '⏳'
}
</script>

<template>
  <div class="flex-1 overflow-auto p-4 text-sm">
    <div
      v-if="detailError"
      class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
    >
      {{ describeError(detailError) }}
    </div>

    <div v-if="detail" class="mb-4">
      <div class="flex items-center gap-1 text-xs text-muted-foreground">
        <UserAvatar
          :username="detail.author.username"
          :avatar-url="detail.author.avatarUrl"
          size-class="w-4 h-4"
        />
        {{ detail.author.username }} ·
        {{ fmtDate(detail.createdAt) }}
        · {{ detail.headBranch }} → {{ detail.baseBranch }}
        <span
          v-if="detail.ciStatus"
          :class="['ml-1 rounded px-1.5 py-0.5 text-3xs font-medium', ciClass(detail.ciStatus)]"
        >
          {{ ciIcon(detail.ciStatus) }}
          {{ ciLabel(detail.ciStatus) }}
        </span>
        <a :href="detail.htmlUrl" target="_blank" rel="noopener" class="ml-2 hover:underline">
          {{ t('pr.openExternal') }}
        </a>
      </div>
      <pre
        class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-2 font-mono text-2xs"
        >{{ detail.bodyMd || t('pr.bodyEmpty') }}</pre
      >
    </div>

    <!-- 코멘트 스레드 -->
    <h3 class="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
      {{ t('pr.commentsHeader', { n: commentsQuery.data.value?.length ?? 0 }) }}
    </h3>
    <ul class="mb-3 space-y-2">
      <li
        v-for="c in commentsQuery.data.value"
        :key="c.id"
        class="rounded border border-border bg-muted/20 p-2"
      >
        <div class="flex items-center justify-between text-2xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <UserAvatar
              :username="c.author.username"
              :avatar-url="c.author.avatarUrl"
              size-class="w-3.5 h-3.5"
            />
            {{ c.author.username }}
          </span>
          <span>{{ fmtDate(c.createdAt) }}</span>
        </div>
        <pre class="mt-1 whitespace-pre-wrap font-mono text-[12px]">{{ c.bodyMd }}</pre>
      </li>
      <li
        v-if="commentsQuery.data.value && commentsQuery.data.value.length === 0"
        class="text-xs text-muted-foreground"
      >
        {{ t('pr.commentsEmpty') }}
      </li>
    </ul>

    <!-- 새 코멘트 -->
    <div class="mb-4">
      <textarea
        v-model="newComment"
        :placeholder="t('pr.newCommentPlaceholder')"
        rows="3"
        class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
      />
      <div class="mt-1 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-input px-3 py-1.5 min-h-[28px] text-xs hover:bg-accent"
          :title="t('pr.suggestionToggleTitle')"
          @click="suggestionOpen = !suggestionOpen"
        >
          {{ suggestionOpen ? t('pr.suggestionClose') : t('pr.suggestionOpen') }}
        </button>
        <button
          class="rounded-md border border-input px-3 py-1.5 min-h-[28px] text-xs hover:bg-accent disabled:opacity-50"
          :disabled="!newComment.trim() || addCommentMut.isPending.value"
          @click="addCommentMut.mutate()"
        >
          {{ addCommentMut.isPending.value ? '...' : t('pr.addCommentButton') }}
        </button>
      </div>
    </div>

    <!-- Code suggestion form (Sprint C14-3 F1) -->
    <section
      v-if="suggestionOpen"
      class="mb-4 rounded-md border border-violet-500/40 bg-violet-500/5 p-3"
    >
      <h3 class="mb-2 text-xs font-semibold text-ai-violet">
        {{ t('pr.suggestionTitle') }}
      </h3>
      <div class="mb-2 grid grid-cols-[1fr_120px] gap-2">
        <input
          v-model="sugPath"
          placeholder="path/to/file.ts"
          class="rounded border border-input bg-background px-2 py-1 font-mono text-xs"
        />
        <input
          v-model.number="sugLine"
          type="number"
          min="1"
          placeholder="line (1-base)"
          class="rounded border border-input bg-background px-2 py-1 text-xs"
        />
      </div>
      <textarea
        v-model="sugNewCode"
        :placeholder="t('pr.suggestionNewCodePlaceholder')"
        rows="3"
        class="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs"
      />
      <textarea
        v-model="sugContext"
        :placeholder="t('pr.suggestionContextPlaceholder')"
        rows="2"
        class="mt-2 w-full rounded border border-input bg-background px-2 py-1 text-xs"
      />
      <p class="mt-1 text-3xs text-muted-foreground">
        {{ t('pr.suggestionFooterHint') }}
      </p>
      <div class="mt-2 flex justify-end gap-2">
        <button
          type="button"
          class="rounded border border-border px-2.5 py-1.5 min-h-[28px] text-xs hover:bg-muted/40"
          @click="suggestionOpen = false"
        >
          {{ t('pr.suggestionCancel') }}
        </button>
        <button
          type="button"
          class="rounded bg-violet-500 px-3 py-1.5 min-h-[28px] text-xs text-white hover:opacity-90 disabled:opacity-50"
          :disabled="
            !sugPath.trim() ||
            sugLine == null ||
            !sugNewCode.trim() ||
            suggestionMut.isPending.value
          "
          @click="suggestionMut.mutate()"
        >
          {{
            suggestionMut.isPending.value ? t('pr.suggestionSubmitting') : t('pr.suggestionSubmit')
          }}
        </button>
      </div>
    </section>

    <!-- 리뷰 제출 -->
    <section class="rounded-md border border-border p-3">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-xs font-semibold">{{ t('pr.reviewSection') }}</h3>
        <button
          v-if="availableCli"
          type="button"
          class="rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 min-h-[28px] text-xs text-ai-violet hover:bg-violet-500/20 disabled:opacity-50"
          :disabled="aiReviewMut.isPending.value"
          :title="t('pr.aiReviewTitle', { cli: availableCli })"
          @click="onAiReview()"
        >
          {{ aiReviewMut.isPending.value ? t('pr.aiReviewAnalyzing') : t('pr.aiReviewLabel') }}
        </button>
      </div>
      <div class="mb-2 flex gap-1 text-xs">
        <button
          v-for="v in ['comment', 'approve', 'request_changes'] as ReviewVerdict[]"
          :key="v"
          type="button"
          class="rounded-md border border-input px-2.5 py-1.5 min-h-[28px]"
          :class="
            verdict === v
              ? v === 'approve'
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-500 border-emerald-500/40'
                : v === 'request_changes'
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-500 border-rose-500/40'
                  : 'bg-accent text-accent-foreground'
              : 'text-muted-foreground'
          "
          @click="verdict = v"
        >
          {{
            v === 'approve'
              ? t('pr.verdictApprove')
              : v === 'request_changes'
                ? t('pr.verdictRequestChanges')
                : '💬 Comment'
          }}
        </button>
      </div>
      <textarea
        v-model="reviewBody"
        :placeholder="t('pr.reviewBodyPlaceholder')"
        rows="3"
        class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
      />
      <div class="mt-1 flex justify-end">
        <button
          class="rounded-md bg-primary px-3 py-1.5 min-h-[28px] text-xs text-primary-foreground disabled:opacity-50"
          :disabled="reviewMut.isPending.value"
          @click="reviewMut.mutate()"
        >
          {{ reviewMut.isPending.value ? '...' : t('pr.reviewSubmit') }}
        </button>
      </div>
    </section>
  </div>
</template>
