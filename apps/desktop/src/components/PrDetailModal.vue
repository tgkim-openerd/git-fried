<script setup lang="ts">
// PR 상세 모달 — 본문 + 코멘트 스레드 + Approve/Request changes/Comment + Merge/Close.
//
// v0.x 단계: line 코멘트 (특정 diff 라인) 는 v1.x. 일반 issue-comment 만.
// 전체 PR review submit (verdict + body) 는 GitHub/Gitea API 직접 호출.
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  addPrComment,
  addReviewComment,
  aiCodeReview,
  aiDetectClis,
  closePr,
  getPullRequest,
  listPrComments,
  listPrFiles,
  mergePr,
  reopenPr,
  submitPrReview,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { useNotification } from '@/composables/useNotification'
import { notifyAiDone } from '@/composables/useAiCli'
import { formatDateLocalized } from '@/composables/useUserSettings'
import UserAvatar from './UserAvatar.vue'
import DiffViewer from './DiffViewer.vue'
import type {
  AiCli,
  MergeMethod,
  PrFile,
  PullRequest,
  ReviewVerdict,
} from '@/api/git'

const toast = useToast()
const notification = useNotification()

const props = defineProps<{
  repoId: number | null
  number: number | null
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()
const qc = useQueryClient()

// PR 본문
const detailQuery = useQuery({
  queryKey: computed(() => ['pr', props.repoId, props.number]),
  queryFn: () => {
    if (props.repoId == null || props.number == null)
      return Promise.reject(new Error('no selection'))
    return getPullRequest(props.repoId, props.number)
  },
  enabled: computed(
    () => props.open && props.repoId != null && props.number != null,
  ),
})

// 코멘트
const commentsQuery = useQuery({
  queryKey: computed(() => ['pr-comments', props.repoId, props.number]),
  queryFn: () => {
    if (props.repoId == null || props.number == null) return Promise.resolve([])
    return listPrComments(props.repoId, props.number)
  },
  enabled: computed(
    () => props.open && props.repoId != null && props.number != null,
  ),
})

// === Sprint 22-3 V-2: Files Changed tab ===
type PrTab = 'conversation' | 'files'
const activeTab = ref<PrTab>('conversation')
const expandedFiles = ref<Set<string>>(new Set())

const filesQuery = useQuery({
  queryKey: computed(() => ['pr-files', props.repoId, props.number]),
  queryFn: () => {
    if (props.repoId == null || props.number == null) return Promise.resolve([])
    return listPrFiles(props.repoId, props.number)
  },
  // tab 진입 시점에만 fetch — conversation 만 보면 무관 endpoint 호출 회피
  enabled: computed(
    () =>
      props.open &&
      activeTab.value === 'files' &&
      props.repoId != null &&
      props.number != null,
  ),
  staleTime: STALE_TIME.NORMAL,
})

function toggleFileExpand(path: string) {
  if (expandedFiles.value.has(path)) expandedFiles.value.delete(path)
  else expandedFiles.value.add(path)
  // 새 Set 으로 reactivity 강제 (Set 자체 mutation 은 추적 안 됨)
  expandedFiles.value = new Set(expandedFiles.value)
}

function expandAllFiles() {
  const list = filesQuery.data.value ?? []
  expandedFiles.value = new Set(list.filter((f) => f.patch).map((f) => f.path))
}

function collapseAllFiles() {
  expandedFiles.value = new Set()
}

function statusBadge(s: PrFile['status']): { label: string; cls: string } {
  switch (s) {
    case 'added':
      return { label: 'A', cls: 'bg-emerald-500/20 text-emerald-500' }
    case 'removed':
      return { label: 'D', cls: 'bg-rose-500/20 text-rose-500' }
    case 'renamed':
      return { label: 'R', cls: 'bg-violet-500/20 text-violet-500' }
    case 'copied':
      return { label: 'C', cls: 'bg-violet-500/20 text-violet-500' }
    default:
      return { label: 'M', cls: 'bg-amber-500/20 text-amber-500' }
  }
}

const newComment = ref('')
const reviewBody = ref('')
const verdict = ref<ReviewVerdict>('comment')
const mergeMethod = ref<MergeMethod>('merge')

watch(
  () => props.open,
  (o) => {
    if (!o) {
      newComment.value = ''
      reviewBody.value = ''
      verdict.value = 'comment'
      // suggestion form 도 초기화
      suggestionOpen.value = false
      sugPath.value = ''
      sugLine.value = null
      sugNewCode.value = ''
      sugContext.value = ''
      // Sprint 22-3 V-2: tab 상태 초기화
      activeTab.value = 'conversation'
      expandedFiles.value = new Set()
    }
  },
)

// === Sprint C14-3 F1 (`docs/plan/14 §7 F1`): Code suggestion ===
const suggestionOpen = ref(false)
const sugPath = ref('')
const sugLine = ref<number | null>(null)
const sugNewCode = ref('')
const sugContext = ref('') // optional 추가 설명

const suggestionMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || props.number == null)
      return Promise.reject(new Error('no selection'))
    if (!sugPath.value.trim() || sugLine.value == null || sugLine.value < 1) {
      return Promise.reject(new Error('path / line 입력 필요'))
    }
    if (!sugNewCode.value.trim()) {
      return Promise.reject(new Error('새 코드 입력 필요'))
    }
    // ```suggestion wrap (GitHub + Gitea 공통 markdown 패턴)
    const ctx = sugContext.value.trim()
    const body =
      (ctx ? `${ctx}\n\n` : '') +
      '```suggestion\n' +
      sugNewCode.value.replace(/\n+$/, '') +
      '\n```'
    return addReviewComment(
      props.repoId,
      props.number,
      sugPath.value.trim(),
      sugLine.value,
      body,
    )
  },
  onSuccess: () => {
    toast.success('Suggestion 등록', `${sugPath.value}:${sugLine.value}`)
    suggestionOpen.value = false
    sugPath.value = ''
    sugLine.value = null
    sugNewCode.value = ''
    sugContext.value = ''
    qc.invalidateQueries({ queryKey: ['pr-comments', props.repoId, props.number] })
  },
  onError: (e) => toast.error('Suggestion 등록 실패', describeError(e)),
})

const addCommentMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || props.number == null)
      return Promise.reject(new Error('no selection'))
    return addPrComment(props.repoId, props.number, newComment.value)
  },
  onSuccess: () => {
    newComment.value = ''
    qc.invalidateQueries({ queryKey: ['pr-comments', props.repoId, props.number] })
  },
  onError: (e) => toast.error('코멘트 등록 실패', describeError(e)),
})

const reviewMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || props.number == null)
      return Promise.reject(new Error('no selection'))
    return submitPrReview(props.repoId, props.number, verdict.value, reviewBody.value)
  },
  onSuccess: () => {
    reviewBody.value = ''
    verdict.value = 'comment'
    qc.invalidateQueries({ queryKey: ['pr-comments'] })
    qc.invalidateQueries({ queryKey: ['pr'] })
    qc.invalidateQueries({ queryKey: ['prs'] })
    qc.invalidateQueries({ queryKey: ['launchpad-prs'] })
  },
  onError: (e) => toast.error('리뷰 제출 실패', describeError(e)),
})

const mergeMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || props.number == null)
      return Promise.reject(new Error('no selection'))
    return mergePr(props.repoId, props.number, mergeMethod.value)
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['pr'] })
    qc.invalidateQueries({ queryKey: ['prs'] })
    qc.invalidateQueries({ queryKey: ['launchpad-prs'] })
    toast.success('PR 머지 완료', `#${props.number ?? ''}`)
    void notification.notify('PR 머지 완료', `#${props.number ?? ''}`)
    emit('close')
  },
  onError: (e) => toast.error('PR 머지 실패', describeError(e)),
})

const closeMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || props.number == null)
      return Promise.reject(new Error('no selection'))
    return closePr(props.repoId, props.number)
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['pr'] })
    qc.invalidateQueries({ queryKey: ['prs'] })
  },
  onError: (e) => toast.error('PR 닫기 실패', describeError(e)),
})

const reopenMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || props.number == null)
      return Promise.reject(new Error('no selection'))
    return reopenPr(props.repoId, props.number)
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['pr'] })
    qc.invalidateQueries({ queryKey: ['prs'] })
  },
  onError: (e) => toast.error('PR 다시 열기 실패', describeError(e)),
})

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
  switch (s) {
    case 'open':
      return 'text-emerald-500'
    case 'merged':
      return 'text-violet-500'
    case 'closed':
      return 'text-rose-500'
    case 'draft':
      return 'text-muted-foreground'
  }
}

function onMerge() {
  if (
    !window.confirm(
      `⚠ '${mergeMethod.value}' 방식으로 PR #${props.number} 을 머지합니다. 진행할까요?`,
    )
  )
    return
  mergeMut.mutate()
}
function onClose() {
  if (!window.confirm(`PR #${props.number} 을 닫으시겠습니까?`)) return
  closeMut.mutate()
}

// === AI 코드 리뷰 ===
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

const aiReviewMut = useMutation({
  mutationFn: () => {
    const d = detailQuery.data.value
    if (props.repoId == null || props.number == null || !d || !availableCli.value)
      return Promise.reject(new Error('AI 사용 불가'))
    if (
      !window.confirm(
        '⚠ PR diff 가 외부 LLM 으로 송출됩니다.\n회사 보안정책을 확인하셨나요?',
      )
    ) {
      return Promise.reject(new Error('cancelled'))
    }
    return aiCodeReview({
      repoId: props.repoId,
      cli: availableCli.value,
      headBranch: d.headBranch,
      baseBranch: d.baseBranch,
      prTitle: d.title,
      prBody: d.bodyMd,
      userApproved: true,
    })
  },
  onSuccess: (out) => {
    if (out.success) {
      // 리뷰 본문 textarea 에 자동 채움 → 사용자가 verdict 선택 후 제출
      reviewBody.value = out.text.trim()
      notifyAiDone('AI 코드 리뷰', `#${props.number ?? ''}`)
    } else {
      toast.error('AI 리뷰 실패', out.stderr || out.text)
    }
  },
  onError: (e) => {
    const msg = describeError(e)
    if (msg.includes('cancelled')) return
    toast.error('AI 호출 실패', msg)
  },
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && number != null"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6"
      @click.self="emit('close')"
    >
      <div class="flex h-full w-full max-w-4xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <header class="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 class="text-sm font-semibold">
            <span v-if="detailQuery.data.value">
              <span :class="['mr-2 text-[10px] uppercase', stateColor(detailQuery.data.value.state)]">
                {{ detailQuery.data.value.state }}
              </span>
              <span class="font-mono">#{{ number }}</span>
              <span class="ml-2">{{ detailQuery.data.value.title }}</span>
            </span>
            <span v-else>#{{ number }}</span>
          </h2>
          <button class="text-muted-foreground hover:text-foreground" @click="emit('close')">✕</button>
        </header>

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
            <span class="ml-1 text-[10px] text-muted-foreground">
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
            <span class="ml-1 text-[10px] text-muted-foreground">
              <template v-if="filesQuery.data.value">
                {{ filesQuery.data.value.length }}
              </template>
              <template v-else-if="filesQuery.isFetching.value">…</template>
            </span>
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
              <a :href="detailQuery.data.value.htmlUrl" target="_blank" rel="noopener" class="ml-2 hover:underline">
                ↗ 외부 열기
              </a>
            </div>
            <pre class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-2 font-mono text-[11px]">{{ detailQuery.data.value.bodyMd || '(본문 없음)' }}</pre>
          </div>

          <!-- 코멘트 스레드 -->
          <h3 class="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            코멘트 ({{ commentsQuery.data.value?.length ?? 0 }})
          </h3>
          <ul class="mb-3 space-y-2">
            <li
              v-for="c in commentsQuery.data.value"
              :key="c.id"
              class="rounded border border-border bg-muted/20 p-2"
            >
              <div class="flex items-center justify-between text-[11px] text-muted-foreground">
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
            <li v-if="commentsQuery.data.value && commentsQuery.data.value.length === 0"
              class="text-xs text-muted-foreground"
            >
              코멘트 없음
            </li>
          </ul>

          <!-- 새 코멘트 -->
          <div class="mb-4">
            <textarea
              v-model="newComment"
              placeholder="새 코멘트 (마크다운, 한국어 OK)"
              rows="3"
              class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
            />
            <div class="mt-1 flex justify-end gap-2">
              <button
                type="button"
                class="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent"
                title="코드 라인 변경 제안 (`docs/plan/14 §7 F1`)"
                @click="suggestionOpen = !suggestionOpen"
              >
                {{ suggestionOpen ? '✕ Suggestion' : '+ Code suggestion' }}
              </button>
              <button
                class="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
                :disabled="!newComment.trim() || addCommentMut.isPending.value"
                @click="addCommentMut.mutate()"
              >
                {{ addCommentMut.isPending.value ? '...' : '코멘트 등록' }}
              </button>
            </div>
          </div>

          <!-- Code suggestion form (Sprint C14-3 F1) -->
          <section
            v-if="suggestionOpen"
            class="mb-4 rounded-md border border-violet-500/40 bg-violet-500/5 p-3"
          >
            <h3 class="mb-2 text-xs font-semibold text-violet-500">
              💡 Code suggestion — diff 의 특정 라인을 새 코드로 제안
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
              placeholder="새 코드 (해당 line 을 이 내용으로 대체) — multi-line OK"
              rows="3"
              class="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs"
            />
            <textarea
              v-model="sugContext"
              placeholder="(선택) 변경 이유 / 추가 설명"
              rows="2"
              class="mt-2 w-full rounded border border-input bg-background px-2 py-1 text-xs"
            />
            <p class="mt-1 text-[10px] text-muted-foreground">
              GitHub 와 Gitea 모두
              <code class="rounded bg-muted/40 px-1">```suggestion</code>
              형식으로 자동 wrap. PR diff 의 RIGHT side (새 코드) 기준 line.
            </p>
            <div class="mt-2 flex justify-end gap-2">
              <button
                type="button"
                class="rounded border border-border px-2 py-1 text-xs hover:bg-muted/40"
                @click="suggestionOpen = false"
              >
                취소
              </button>
              <button
                type="button"
                class="rounded bg-violet-500 px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
                :disabled="
                  !sugPath.trim() ||
                  sugLine == null ||
                  !sugNewCode.trim() ||
                  suggestionMut.isPending.value
                "
                @click="suggestionMut.mutate()"
              >
                {{ suggestionMut.isPending.value ? '등록 중...' : '제안 등록' }}
              </button>
            </div>
          </section>

          <!-- 리뷰 제출 -->
          <section class="rounded-md border border-border p-3">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-xs font-semibold">리뷰 제출</h3>
              <button
                v-if="availableCli"
                type="button"
                class="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-500 hover:bg-violet-500/20 disabled:opacity-50"
                :disabled="aiReviewMut.isPending.value"
                :title="`${availableCli} CLI 가 PR diff 분석 후 리뷰 추천`"
                @click="aiReviewMut.mutate()"
              >
                {{ aiReviewMut.isPending.value ? '✨ 분석 중...' : '✨ AI 리뷰' }}
              </button>
            </div>
            <div class="mb-2 flex gap-1 text-xs">
              <button
                v-for="v in ['comment', 'approve', 'request_changes'] as ReviewVerdict[]"
                :key="v"
                type="button"
                class="rounded-md border border-input px-2 py-1"
                :class="
                  verdict === v
                    ? v === 'approve'
                      ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                      : v === 'request_changes'
                      ? 'bg-rose-500/20 text-rose-500 border-rose-500/40'
                      : 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground'
                "
                @click="verdict = v"
              >
                {{ v === 'approve' ? '✓ Approve' : v === 'request_changes' ? '✕ Request changes' : '💬 Comment' }}
              </button>
            </div>
            <textarea
              v-model="reviewBody"
              placeholder="리뷰 본문 (Comment 일 땐 비워도 OK, Approve/Request changes 는 권장)"
              rows="3"
              class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
            />
            <div class="mt-1 flex justify-end">
              <button
                class="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
                :disabled="reviewMut.isPending.value"
                @click="reviewMut.mutate()"
              >
                {{ reviewMut.isPending.value ? '...' : '리뷰 제출' }}
              </button>
            </div>
          </section>
        </div>

        <!-- Sprint 22-3 V-2 — Files Changed tab -->
        <div v-show="activeTab === 'files'" class="flex-1 overflow-auto p-3 text-sm">
          <div
            v-if="filesQuery.error.value"
            class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
          >
            {{ describeError(filesQuery.error.value) }}
          </div>

          <div
            v-if="filesQuery.isFetching.value && !filesQuery.data.value"
            class="p-4 text-center text-xs text-muted-foreground"
          >
            파일 목록 불러오는 중...
          </div>

          <template v-else-if="filesQuery.data.value">
            <div class="mb-2 flex items-center justify-between text-[10px]">
              <span class="text-muted-foreground">
                {{ filesQuery.data.value.length }} files /
                +{{
                  filesQuery.data.value.reduce((s, f) => s + f.additions, 0)
                }}
                / -{{
                  filesQuery.data.value.reduce((s, f) => s + f.deletions, 0)
                }}
              </span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent/40"
                  @click="expandAllFiles"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  class="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent/40"
                  @click="collapseAllFiles"
                >
                  Collapse all
                </button>
              </div>
            </div>

            <ul class="space-y-1">
              <li
                v-for="f in filesQuery.data.value"
                :key="f.path"
                class="rounded border border-border bg-muted/10"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-accent/30"
                  @click="toggleFileExpand(f.path)"
                >
                  <span class="text-[10px] text-muted-foreground">
                    {{ expandedFiles.has(f.path) ? '▼' : '▸' }}
                  </span>
                  <span
                    class="rounded px-1.5 text-[10px] font-bold"
                    :class="statusBadge(f.status).cls"
                    :title="f.status"
                  >
                    {{ statusBadge(f.status).label }}
                  </span>
                  <span class="flex-1 truncate font-mono text-xs">
                    <span v-if="f.previousPath" class="text-muted-foreground">
                      {{ f.previousPath }} →
                    </span>
                    {{ f.path }}
                  </span>
                  <span class="text-[10px] text-emerald-500">+{{ f.additions }}</span>
                  <span class="text-[10px] text-rose-500">-{{ f.deletions }}</span>
                </button>
                <div v-if="expandedFiles.has(f.path)" class="border-t border-border">
                  <div
                    v-if="!f.patch"
                    class="p-3 text-center text-[11px] text-muted-foreground"
                  >
                    이 파일은 너무 커서 forge 가 patch 를 생략했습니다 (binary 또는 large file).
                    <a
                      v-if="detailQuery.data.value"
                      :href="`${detailQuery.data.value.htmlUrl}/files`"
                      target="_blank"
                      rel="noopener"
                      class="ml-1 underline"
                    >
                      ↗ 외부에서 열기
                    </a>
                  </div>
                  <DiffViewer v-else :patch="f.patch" />
                </div>
              </li>
              <li
                v-if="filesQuery.data.value.length === 0"
                class="p-4 text-center text-xs text-muted-foreground"
              >
                변경된 파일 없음
              </li>
            </ul>
          </template>
        </div>

        <!-- 푸터: Merge / Close / Reopen -->
        <footer
          v-if="detailQuery.data.value"
          class="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs"
        >
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground">머지 방식:</span>
            <select
              v-model="mergeMethod"
              class="rounded-md border border-input bg-background px-2 py-1"
            >
              <option value="merge">merge (traditional)</option>
              <option value="squash">squash</option>
              <option value="rebase">rebase</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="detailQuery.data.value.state === 'closed' && !detailQuery.data.value.merged"
              class="rounded-md border border-input px-3 py-1 hover:bg-accent disabled:opacity-50"
              :disabled="reopenMut.isPending.value"
              @click="reopenMut.mutate()"
            >
              다시 열기
            </button>
            <button
              v-if="detailQuery.data.value.state === 'open' || detailQuery.data.value.state === 'draft'"
              class="rounded-md border border-input px-3 py-1 hover:bg-accent disabled:opacity-50"
              :disabled="closeMut.isPending.value"
              @click="onClose"
            >
              닫기
            </button>
            <button
              v-if="detailQuery.data.value.state === 'open'"
              class="rounded-md bg-violet-500 px-4 py-1 text-white disabled:opacity-50"
              :disabled="mergeMut.isPending.value"
              @click="onMerge"
            >
              {{ mergeMut.isPending.value ? '머지 중...' : '머지' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
