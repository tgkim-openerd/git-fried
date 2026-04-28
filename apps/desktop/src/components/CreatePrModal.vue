<script setup lang="ts">
// PR 생성 모달.
// - title / body / head / base 입력
// - ✨ AI body: head 브랜치의 commits + diff stat → Claude/Codex 한국어 PR body 자동 생성
// - draft 토글 (GitHub 만 — Gitea 는 ignored)
// - 생성 후 옵션: 새 탭으로 외부 열기 / 모달 안에서 상세
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import {
  aiDetectClis,
  aiPrBody,
  createPullRequest,
  listBranches,
} from '@/api/git'
import type { AiCli, BranchInfo } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { notifyAiDone } from '@/composables/useAiCli'
import BaseModal from './BaseModal.vue'

const toast = useToast()

const props = defineProps<{
  repoId: number | null
  open: boolean
  /** 사전 채울 head branch 이름 (현재 브랜치 등) */
  initialHead?: string | null
  /** 사전 채울 base branch (기본 main / master) */
  initialBase?: string | null
}>()
const emit = defineEmits<{ close: [], created: [number] }>()

const title = ref('')
const body = ref('')
const head = ref('')
const base = ref('main')
const draft = ref(false)

watch(
  () => props.open,
  (o) => {
    if (o) {
      title.value = ''
      body.value = ''
      head.value = props.initialHead ?? ''
      base.value = props.initialBase ?? 'main'
      draft.value = false
    }
  },
)

// 브랜치 목록 (head/base picker)
const { data: branches } = useQuery({
  queryKey: computed(() => ['branches', props.repoId]),
  queryFn: () => {
    if (props.repoId == null) return Promise.resolve([] as BranchInfo[])
    return listBranches(props.repoId)
  },
  enabled: computed(() => props.open && props.repoId != null),
})
const localBranches = computed(
  () => branches.value?.filter((b) => b.kind === 'local') ?? [],
)

// AI body
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

const aiBodyMut = useMutation({
  mutationFn: () => {
    if (
      props.repoId == null ||
      !head.value ||
      !base.value ||
      !availableCli.value
    )
      return Promise.reject(new Error('AI 사용 불가'))
    if (
      !window.confirm(
        '⚠ branch 의 commit + diff stat 이 외부 LLM 으로 송출됩니다. 회사 보안정책 확인하셨나요?',
      )
    ) {
      return Promise.reject(new Error('cancelled'))
    }
    return aiPrBody(
      props.repoId,
      availableCli.value,
      head.value,
      base.value,
      true,
    )
  },
  onSuccess: (out) => {
    if (out.success) {
      body.value = out.text.trim()
      notifyAiDone('AI PR body 생성', out.text.split(/\r?\n/)[0])
    } else {
      toast.error('AI body 생성 실패', out.stderr || out.text)
    }
  },
  onError: (e) => {
    const msg = describeError(e)
    if (msg.includes('cancelled')) return
    toast.error('AI 호출 실패', msg)
  },
})

const createMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    return createPullRequest({
      repoId: props.repoId,
      title: title.value.trim(),
      body: body.value,
      head: head.value,
      base: base.value,
      draft: draft.value,
    })
  },
  onSuccess: (pr) => {
    toast.success(`PR #${pr.number} 생성됨`, pr.title)
    emit('created', pr.number)
    emit('close')
  },
  onError: (e) => toast.error('PR 생성 실패', describeError(e)),
})

const canCreate = computed(
  () =>
    title.value.trim().length > 0 &&
    head.value.length > 0 &&
    base.value.length > 0 &&
    head.value !== base.value &&
    !createMut.isPending.value,
)

const titleLength = computed(() => title.value.length)
</script>

<template>
  <BaseModal
    :open="open"
    max-width="3xl"
    title="새 Pull Request"
    panel-class="h-[90vh]"
    @close="emit('close')"
  >
    <div class="p-4 text-sm">
          <!-- head → base -->
          <div class="mb-3 grid grid-cols-2 gap-2">
            <label class="text-xs text-muted-foreground">
              head (소스 브랜치)
              <select
                v-model="head"
                class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
              >
                <option value="">선택...</option>
                <option v-for="b in localBranches" :key="b.name" :value="b.name">
                  {{ b.name }}
                </option>
              </select>
            </label>
            <label class="text-xs text-muted-foreground">
              base (대상 브랜치)
              <input
                v-model="base"
                class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
              />
            </label>
          </div>

          <!-- title -->
          <div class="mb-3">
            <label class="text-xs text-muted-foreground">제목</label>
            <input
              v-model="title"
              placeholder="feat: 한글 제목 OK"
              class="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
            <div class="mt-0.5 text-right text-[10px] text-muted-foreground">
              {{ titleLength }}/72
            </div>
          </div>

          <!-- body + AI -->
          <div class="mb-3">
            <div class="mb-1 flex items-center justify-between">
              <label class="text-xs text-muted-foreground">본문 (마크다운)</label>
              <button
                v-if="availableCli"
                type="button"
                class="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-500 hover:bg-violet-500/20 disabled:opacity-50"
                :disabled="!head || !base || aiBodyMut.isPending.value"
                :title="`${availableCli} CLI 가 ${head} → ${base} commits 분석 후 본문 생성`"
                @click="aiBodyMut.mutate()"
              >
                {{ aiBodyMut.isPending.value ? '✨ 생성 중...' : '✨ AI body 생성' }}
              </button>
            </div>
            <textarea
              v-model="body"
              placeholder="## 요약&#10;## 변경 사항&#10;## 테스트 방법"
              rows="14"
              class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
            />
          </div>

          <!-- draft -->
          <label class="flex items-center gap-1 text-xs">
            <input v-model="draft" type="checkbox" />
            draft 로 생성 (GitHub 전용 — Gitea 는 무시)
          </label>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 text-xs">
        <span v-if="head && base && head === base" class="mr-auto text-amber-500">
          ⚠ head 와 base 가 같습니다
        </span>
        <button
          class="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          @click="emit('close')"
        >
          취소
        </button>
        <button
          class="rounded-md bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50"
          :disabled="!canCreate"
          @click="createMut.mutate()"
        >
          {{ createMut.isPending.value ? '생성 중...' : 'PR 생성' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
