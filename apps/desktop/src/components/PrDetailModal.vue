<script setup lang="ts">
// PR 상세 모달 — 본문 + 코멘트 스레드 + Approve/Request changes/Comment + Merge/Close.
//
// v0.x 단계: line 코멘트 (특정 diff 라인) 는 v1.x. 일반 issue-comment 만.
// 전체 PR review submit (verdict + body) 는 GitHub/Gitea API 직접 호출.
import { computed, ref, watch } from 'vue'
import { useQuery, useMutation } from '@tanstack/vue-query'
import { getPullRequest, listPrComments, switchBranch } from '@/api/git'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { formatDateLocalized } from '@/composables/useUserSettings'
import BaseModal from './BaseModal.vue'
import UserAvatar from './UserAvatar.vue'
// Sprint c31 god comp 분리 3/N — Files Changed tab 분리.
import PrFilesTab from './PrFilesTab.vue'
// Sprint c35 god 15/N — AI 코드 리뷰 영역 분리.
import { useAiReview } from '@/composables/useAiReview'
// Sprint c40 god comp 분리 — 6 mutation + onMerge/onClose + suggestion 분리.
import { usePrMutations } from '@/composables/usePrMutations'
import type { MergeMethod, PullRequest, ReviewVerdict } from '@/api/git'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const toast = useToast()

const props = defineProps<{
  repoId: number | null
  number: number | null
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()

// PR 본문
const detailQuery = useQuery({
  queryKey: computed(() => ['pr', props.repoId, props.number]),
  queryFn: () => {
    if (props.repoId == null || props.number == null)
      return Promise.reject(new Error('no selection'))
    return getPullRequest(props.repoId, props.number)
  },
  enabled: computed(() => props.open && props.repoId != null && props.number != null),
})

// 코멘트
const commentsQuery = useQuery({
  queryKey: computed(() => ['pr-comments', props.repoId, props.number]),
  queryFn: () => {
    if (props.repoId == null || props.number == null) return Promise.resolve([])
    return listPrComments(props.repoId, props.number)
  },
  enabled: computed(() => props.open && props.repoId != null && props.number != null),
})

// A-2 — PR head 브랜치 체크아웃 (로컬에 tracking 브랜치 생성/전환).
const invalidateRepo = useInvalidateRepoQueries()
const checkoutMut = useMutation({
  mutationFn: () => {
    const d = detailQuery.data.value
    if (props.repoId == null || !d) return Promise.reject(new Error('no PR'))
    return switchBranch(props.repoId, d.headBranch)
  },
  onSuccess: () => {
    invalidateRepo(props.repoId)
    toast.success(t('pr.checkoutSuccess'), detailQuery.data.value?.headBranch ?? '')
    emit('close')
  },
  onError: (e) => toast.error(t('pr.checkoutFailed'), describeError(e)),
})

// A-3 — PR 상세 헤더에 CI 상태 노출 (getPullRequest 응답의 ciStatus 필드).
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

// === Sprint 22-3 V-2: Files Changed tab — Sprint c31 PrFilesTab.vue 로 분리 ===
// filesQuery / expandedFiles / toggleFileExpand / expandAllFiles / collapseAllFiles /
// statusBadge 모두 PrFilesTab 내부로 이전. PrDetailModal 은 activeTab 토글만 관리.
type PrTab = 'conversation' | 'files'
const activeTab = ref<PrTab>('conversation')

const newComment = ref('')
const reviewBody = ref('')
const verdict = ref<ReviewVerdict>('comment')
const mergeMethod = ref<MergeMethod>('merge')

// Sprint c40 — 6 mutation + onMerge/onClose + suggestion form composable 위임.
const { addCommentMut, reviewMut, mergeMut, closeMut, reopenMut, suggestion, onMerge, onClose } =
  usePrMutations({
    repoId: () => props.repoId,
    number: () => props.number,
    newComment,
    reviewBody,
    verdict,
    mergeMethod,
    onMergeClose: () => emit('close'),
  })
// Template 호환성을 위해 ref 들은 같은 이름으로 노출 (ref destructure 는 reactivity 보존).
const {
  open: suggestionOpen,
  path: sugPath,
  line: sugLine,
  newCode: sugNewCode,
  context: sugContext,
  mut: suggestionMut,
  reset: resetSuggestion,
} = suggestion

// E3 (plan #44) — Files 탭 diff 라인 "+" 클릭 → suggestion form 에 path/line prefill + conversation 탭 전환.
// (기존 수동 path/line 입력 대체 — 사용자는 클릭만으로 대상 라인 지정 후 코멘트 작성.)
function onCommentLine(target: { path: string; line: number }) {
  sugPath.value = target.path
  sugLine.value = target.line
  suggestionOpen.value = true
  activeTab.value = 'conversation'
}

watch(
  () => props.open,
  (o) => {
    if (!o) {
      newComment.value = ''
      reviewBody.value = ''
      verdict.value = 'comment'
      // suggestion form 도 초기화 (composable helper).
      resetSuggestion()
      // Sprint 22-3 V-2: tab 상태 초기화 (PrFilesTab 내부 expandedFiles 는 unmount 시 GC)
      activeTab.value = 'conversation'
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

function stateColor(s: PullRequest['state']): string {
  // Sprint c36 plan/28 — light theme 가독성 (text-X-700 dark:text-X-500).
  switch (s) {
    case 'open':
      return 'text-emerald-700 dark:text-emerald-500'
    case 'merged':
      return 'text-violet-700 dark:text-violet-500'
    case 'closed':
      return 'text-rose-700 dark:text-rose-500'
    case 'draft':
      return 'text-muted-foreground'
  }
}

// === AI 코드 리뷰 — Sprint c35 god 15/N: useAiReview composable 위임 ===
const aiR = useAiReview({
  repoId: () => props.repoId,
  number: () => props.number,
  detail: () => detailQuery.data.value ?? null,
  onResult: (text) => {
    // 리뷰 본문 textarea 에 자동 채움 → 사용자가 verdict 선택 후 제출.
    reviewBody.value = text
  },
  onError: (e) => toast.error(t('pr.aiInvokeFailed'), describeError(e)),
})
const availableCli = aiR.availableCli
const aiReviewMut = aiR.generate
async function onAiReview(): Promise<void> {
  await aiR.run()
}
</script>

<template>
  <BaseModal
    :open="open && number != null"
    max-width="4xl"
    panel-class="h-[90vh]"
    @close="emit('close')"
  >
    <template #header>
      <h2 class="text-sm font-semibold">
        <span v-if="detailQuery.data.value">
          <span :class="['mr-2 text-3xs uppercase', stateColor(detailQuery.data.value.state)]">
            {{ detailQuery.data.value.state }}
          </span>
          <span class="font-mono">#{{ number }}</span>
          <span class="ml-2">{{ detailQuery.data.value.title }}</span>
        </span>
        <span v-else>#{{ number }}</span>
      </h2>
    </template>

    <!-- Sprint 22-3 V-2: Conversation / Files Changed tab -->
    <nav class="flex border-b border-border bg-muted/20 text-xs">
      <button
        type="button"
        class="px-4 py-2"
        :class="
          activeTab === 'conversation'
            ? 'border-b-2 border-primary font-semibold text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="activeTab = 'conversation'"
      >
        💬 Conversation
        <span class="ml-1 text-3xs text-muted-foreground">
          {{ commentsQuery.data.value?.length ?? 0 }}
        </span>
      </button>
      <button
        type="button"
        class="px-4 py-2"
        :class="
          activeTab === 'files'
            ? 'border-b-2 border-primary font-semibold text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="activeTab = 'files'"
      >
        📄 Files
        <!-- Sprint c31 — file count badge 는 PrFilesTab 진입 후 헤더에 표시 (lazy fetch 유지) -->
      </button>
    </nav>

    <div v-show="activeTab === 'conversation'" class="flex-1 overflow-auto p-4 text-sm">
      <div
        v-if="detailQuery.error.value"
        class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
      >
        {{ describeError(detailQuery.error.value) }}
      </div>

      <div v-if="detailQuery.data.value" class="mb-4">
        <div class="flex items-center gap-1 text-xs text-muted-foreground">
          <UserAvatar
            :username="detailQuery.data.value.author.username"
            :avatar-url="detailQuery.data.value.author.avatarUrl"
            size-class="w-4 h-4"
          />
          {{ detailQuery.data.value.author.username }} ·
          {{ fmtDate(detailQuery.data.value.createdAt) }}
          · {{ detailQuery.data.value.headBranch }} → {{ detailQuery.data.value.baseBranch }}
          <span
            v-if="detailQuery.data.value.ciStatus"
            :class="[
              'ml-1 rounded px-1.5 py-0.5 text-3xs font-medium',
              ciClass(detailQuery.data.value.ciStatus),
            ]"
          >
            {{ ciIcon(detailQuery.data.value.ciStatus) }}
            {{ ciLabel(detailQuery.data.value.ciStatus) }}
          </span>
          <a
            :href="detailQuery.data.value.htmlUrl"
            target="_blank"
            rel="noopener"
            class="ml-2 hover:underline"
          >
            {{ t('pr.openExternal') }}
          </a>
        </div>
        <pre
          class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-2 font-mono text-2xs"
          >{{ detailQuery.data.value.bodyMd || t('pr.bodyEmpty') }}</pre
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
              suggestionMut.isPending.value
                ? t('pr.suggestionSubmitting')
                : t('pr.suggestionSubmit')
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

    <!-- Sprint 22-3 V-2 — Files Changed tab (Sprint c31 PrFilesTab.vue 로 분리) -->
    <PrFilesTab
      :repo-id="repoId"
      :number="number"
      :visible="open && activeTab === 'files'"
      :detail-html-url="detailQuery.data.value?.htmlUrl"
      @comment-line="onCommentLine"
    />

    <!-- 푸터: Merge / Close / Reopen -->
    <template v-if="detailQuery.data.value" #footer>
      <div class="flex items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground">{{ t('pr.mergeMethodLabel') }}</span>
          <select
            v-model="mergeMethod"
            class="rounded-md border border-input bg-background px-2 py-1"
            :aria-label="t('pr.mergeMethodAria')"
          >
            <option value="merge">merge (traditional)</option>
            <option value="squash">squash</option>
            <option value="rebase">rebase</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <!-- A-2 — PR head 브랜치 체크아웃 -->
          <button
            v-if="
              detailQuery.data.value.state === 'open' || detailQuery.data.value.state === 'draft'
            "
            class="rounded-md border border-input px-3 py-1.5 min-h-[32px] hover:bg-accent disabled:opacity-50"
            :disabled="checkoutMut.isPending.value"
            @click="checkoutMut.mutate()"
          >
            {{ checkoutMut.isPending.value ? t('pr.checkoutPending') : t('pr.checkout') }}
          </button>
          <button
            v-if="detailQuery.data.value.state === 'closed' && !detailQuery.data.value.merged"
            class="rounded-md border border-input px-3 py-1.5 min-h-[32px] hover:bg-accent disabled:opacity-50"
            :disabled="reopenMut.isPending.value"
            @click="reopenMut.mutate()"
          >
            {{ t('pr.reopen') }}
          </button>
          <button
            v-if="
              detailQuery.data.value.state === 'open' || detailQuery.data.value.state === 'draft'
            "
            class="rounded-md border border-input px-3 py-1.5 min-h-[32px] hover:bg-accent disabled:opacity-50"
            :disabled="closeMut.isPending.value"
            @click="onClose"
          >
            {{ t('pr.close') }}
          </button>
          <button
            v-if="detailQuery.data.value.state === 'open'"
            class="rounded-md bg-violet-500 px-4 py-1.5 min-h-[32px] text-white disabled:opacity-50"
            :disabled="mergeMut.isPending.value"
            @click="onMerge"
          >
            {{ mergeMut.isPending.value ? t('pr.merging') : t('pr.merge') }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
