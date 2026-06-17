<script setup lang="ts">
// PR 상세 모달 — 본문 + 코멘트 스레드 + Approve/Request changes/Comment + Merge/Close.
//
// v0.x 단계: line 코멘트 (특정 diff 라인) 는 v1.x. 일반 issue-comment 만.
// 전체 PR review submit (verdict + body) 는 GitHub/Gitea API 직접 호출.
import { computed, ref, watch, useTemplateRef } from 'vue'
import { useQuery, useMutation } from '@tanstack/vue-query'
import { getPullRequest, listPrComments, switchBranch } from '@/api/git'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'
// Sprint c31 god comp 분리 3/N — Files Changed tab 분리.
import PrFilesTab from './PrFilesTab.vue'
// Sprint c103 (B-2) god comp 분리 — Conversation tab 분리 (코멘트/리뷰/suggestion/AI).
import PrConversationTab from './PrConversationTab.vue'
// Sprint c40 → c103 분할 — footer action mutation(merge/close/reopen + confirm).
import { usePrActionMutations } from '@/composables/usePrActionMutations'
import type { MergeMethod, PullRequest } from '@/api/git'
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

// 코멘트 — nav 탭 카운트 배지용. PrConversationTab 도 동일 queryKey 로 구독하므로
// vue-query 가 캐시 공유(단일 fetch) — thread 본문은 PrConversationTab 소유.
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

// === Sprint 22-3 V-2: Files Changed tab — Sprint c31 PrFilesTab.vue 로 분리 ===
// filesQuery / expandedFiles / toggleFileExpand / expandAllFiles / collapseAllFiles /
// statusBadge 모두 PrFilesTab 내부로 이전. PrDetailModal 은 activeTab 토글만 관리.
type PrTab = 'conversation' | 'files'
const activeTab = ref<PrTab>('conversation')

const mergeMethod = ref<MergeMethod>('merge')

// Sprint c40 → c103 분할 — footer action mutation(merge/close/reopen + confirm dialog).
const { mergeMut, closeMut, reopenMut, onMerge, onClose } = usePrActionMutations({
  repoId: () => props.repoId,
  number: () => props.number,
  mergeMethod,
  onMergeClose: () => emit('close'),
})

// Conversation 탭(코멘트/리뷰/suggestion/AI)은 PrConversationTab.vue 가 소유.
const convTab = useTemplateRef<{ prefillSuggestion: (path: string, line: number) => void }>(
  'convTab',
)

// E3 (plan #44) — Files 탭 diff 라인 "+" 클릭 → conversation 탭 전환 + suggestion prefill.
function onCommentLine(target: { path: string; line: number }) {
  activeTab.value = 'conversation'
  convTab.value?.prefillSuggestion(target.path, target.line)
}

// 모달 닫힐 때 tab 상태 초기화 (conversation 폼 reset 은 PrConversationTab 내부 watch).
watch(
  () => props.open,
  (o) => {
    if (!o) activeTab.value = 'conversation'
  },
)

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

    <!-- Sprint c103 (B-2) — Conversation tab (PrConversationTab.vue 로 분리) -->
    <PrConversationTab
      v-show="activeTab === 'conversation'"
      ref="convTab"
      :repo-id="repoId"
      :number="number"
      :open="open"
      :detail="detailQuery.data.value ?? null"
      :detail-error="detailQuery.error.value"
    />

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
