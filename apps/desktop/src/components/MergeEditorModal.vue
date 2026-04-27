<script setup lang="ts">
// 3-way merge editor — CodeMirror 의 unifiedMergeView / MergeView 사용.
//
// v0.x 단계 minimal: ours / theirs / result 3 패널 (textarea).
// 사용자가 result 직접 편집 → "stage" 클릭 → working tree write + git add.
// 또는 "ours 사용" / "theirs 사용" 단축 (전체 파일).
//
// CodeMirror merge view 는 visual 좋지만 setup 복잡 — v0.x 는 textarea 기반.
// 추후 v1.x 에서 @codemirror/merge 의 MergeView 적용.
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  aiDetectClis,
  aiResolveConflict,
  readConflicted,
  takeSide,
  writeResolved,
} from '@/api/git'
import type { AiCli } from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import { notifyAiDone } from '@/composables/useAiCli'
import { useInvalidateRepoQueries } from '@/composables/useStatus'

const toast = useToast()

const props = defineProps<{
  repoId: number | null
  path: string | null
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()
const qc = useQueryClient()
const invalidate = useInvalidateRepoQueries()

const conflictQuery = useQuery({
  queryKey: computed(() => ['conflicted', props.repoId, props.path]),
  queryFn: () => {
    if (props.repoId == null || !props.path)
      return Promise.reject(new Error('no selection'))
    return readConflicted(props.repoId, props.path)
  },
  enabled: computed(
    () => props.open && props.repoId != null && !!props.path,
  ),
})

const resolved = ref('')

// open 또는 query 변경 시 working tree (충돌 마커) 를 result 디폴트로
watch(
  () => conflictQuery.data.value,
  (cf) => {
    if (cf) {
      // 디폴트는 working (사용자가 conflict marker 보면서 직접 수정)
      resolved.value = cf.working ?? cf.ours ?? cf.theirs ?? ''
    }
  },
)

watch(
  () => props.open,
  (o) => {
    if (!o) resolved.value = ''
  },
)

const stageMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || !props.path)
      return Promise.reject(new Error('no selection'))
    return writeResolved(props.repoId, props.path, resolved.value)
  },
  onSuccess: () => {
    invalidate(props.repoId)
    qc.invalidateQueries({ queryKey: ['conflicted'] })
    emit('close')
  },
  onError: (e) => toast.error('충돌 해결 저장 실패', describeError(e)),
})

const sideMut = useMutation({
  mutationFn: (side: 'ours' | 'theirs') => {
    if (props.repoId == null || !props.path)
      return Promise.reject(new Error('no selection'))
    return takeSide(props.repoId, props.path, side)
  },
  onSuccess: () => {
    invalidate(props.repoId)
    qc.invalidateQueries({ queryKey: ['conflicted'] })
    emit('close')
  },
  onError: (e) => toast.error('Take side 실패', describeError(e)),
})

function applyOurs() {
  if (conflictQuery.data.value?.ours != null)
    resolved.value = conflictQuery.data.value.ours
}
function applyTheirs() {
  if (conflictQuery.data.value?.theirs != null)
    resolved.value = conflictQuery.data.value.theirs
}
function applyBase() {
  if (conflictQuery.data.value?.base != null)
    resolved.value = conflictQuery.data.value.base
}

function takeFullSide(side: 'ours' | 'theirs') {
  if (
    !window.confirm(
      `'${side}' 버전으로 ${props.path} 전체를 덮고 stage 합니다. 진행할까요?`,
    )
  )
    return
  sideMut.mutate(side)
}

// === AI merge resolve (Claude / Codex CLI) ===
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

const aiMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || !props.path || !availableCli.value)
      return Promise.reject(new Error('AI 사용 불가'))
    if (
      !window.confirm(
        '⚠ 충돌 파일 (ours/theirs/base) 가 외부 LLM 으로 송출됩니다.\n회사 보안정책을 확인하셨나요?',
      )
    ) {
      return Promise.reject(new Error('cancelled'))
    }
    return aiResolveConflict(props.repoId, availableCli.value, props.path, true)
  },
  onSuccess: (out) => {
    if (out.success) {
      // result textarea 에 자동 채움 — 사용자 검토 후 저장
      resolved.value = out.text.trim()
      notifyAiDone('AI 충돌 해결 제안', props.path ?? undefined)
    } else {
      toast.error('AI 응답 실패', out.stderr || out.text)
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
      v-if="open && path"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6"
      @click.self="emit('close')"
    >
      <div class="flex h-full w-full max-w-7xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <header class="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 class="text-sm font-semibold">
            <span class="text-muted-foreground">3-way merge:</span>
            <span class="ml-2 font-mono">{{ path }}</span>
          </h2>
          <button class="text-muted-foreground hover:text-foreground" @click="emit('close')">✕</button>
        </header>

        <!-- 단축 액션 -->
        <div class="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2 text-xs">
          <span class="text-muted-foreground">전체 파일을 한 쪽으로:</span>
          <button
            class="rounded-md border border-input px-2 py-1 hover:bg-accent"
            @click="takeFullSide('ours')"
          >
            🟦 ours 전부
          </button>
          <button
            class="rounded-md border border-input px-2 py-1 hover:bg-accent"
            @click="takeFullSide('theirs')"
          >
            🟪 theirs 전부
          </button>
          <button
            v-if="availableCli"
            class="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-violet-500 hover:bg-violet-500/20 disabled:opacity-50"
            :disabled="aiMut.isPending.value"
            :title="`${availableCli} CLI 가 ours/theirs/base 분석 후 result 추천`"
            @click="aiMut.mutate()"
          >
            {{ aiMut.isPending.value ? '✨ 분석 중...' : '✨ AI 추천' }}
          </button>
          <span class="ml-auto text-muted-foreground">또는 아래에서 직접 수정 →</span>
        </div>

        <!-- 3 패널 -->
        <div class="flex flex-1 overflow-hidden">
          <!-- ours -->
          <div class="flex w-1/3 flex-col border-r border-border">
            <header class="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1">
              <span class="text-xs font-semibold">🟦 OURS (현재 브랜치)</span>
              <button
                class="text-[10px] text-muted-foreground hover:text-foreground"
                @click="applyOurs"
              >
                → 결과로 복사
              </button>
            </header>
            <pre
              class="flex-1 overflow-auto bg-muted/10 p-2 font-mono text-[11px] text-muted-foreground"
            >{{ conflictQuery.data.value?.ours ?? '(없음)' }}</pre>
          </div>

          <!-- 결과 (편집 가능) -->
          <div class="flex w-1/3 flex-col border-r border-border">
            <header class="flex items-center justify-between border-b border-border bg-emerald-500/10 px-2 py-1">
              <span class="text-xs font-semibold text-emerald-500">✓ RESULT (편집)</span>
              <button
                v-if="conflictQuery.data.value?.base != null"
                class="text-[10px] text-muted-foreground hover:text-foreground"
                @click="applyBase"
              >
                base 사용
              </button>
            </header>
            <textarea
              v-model="resolved"
              spellcheck="false"
              class="flex-1 resize-none bg-background p-2 font-mono text-[11px] outline-none"
            />
          </div>

          <!-- theirs -->
          <div class="flex w-1/3 flex-col">
            <header class="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1">
              <span class="text-xs font-semibold">🟪 THEIRS (들어오는)</span>
              <button
                class="text-[10px] text-muted-foreground hover:text-foreground"
                @click="applyTheirs"
              >
                → 결과로 복사
              </button>
            </header>
            <pre
              class="flex-1 overflow-auto bg-muted/10 p-2 font-mono text-[11px] text-muted-foreground"
            >{{ conflictQuery.data.value?.theirs ?? '(없음)' }}</pre>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t border-border px-4 py-2 text-xs">
          <span class="mr-auto text-muted-foreground">
            💡 결과 편집기에서 conflict marker (&lt;&lt;&lt;&lt; / ==== / &gt;&gt;&gt;&gt;) 모두 제거 후 stage.
          </span>
          <button
            class="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
            @click="emit('close')"
          >
            취소
          </button>
          <button
            class="rounded-md bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50"
            :disabled="stageMut.isPending.value"
            @click="stageMut.mutate()"
          >
            {{ stageMut.isPending.value ? '저장 중...' : '결과로 stage' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
