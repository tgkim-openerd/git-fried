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
import { readConflicted, takeSide, writeResolved } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useAiResolveConflict } from '@/composables/useAiResolveConflict'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import BaseModal from './BaseModal.vue'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'

const { t } = useI18n()
const toast = useToast()

const props = defineProps<{
  repoId: number | null
  path: string | null
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const isOpen = computed(() => props.open && props.path != null)
const qc = useQueryClient()
const invalidate = useInvalidateRepoQueries()

const conflictQuery = useQuery({
  queryKey: computed(() => ['conflicted', props.repoId, props.path]),
  queryFn: () => {
    if (props.repoId == null || !props.path) return Promise.reject(new Error('no selection'))
    return readConflicted(props.repoId, props.path)
  },
  enabled: computed(() => props.open && props.repoId != null && !!props.path),
})

const resolved = ref('')
// UXF-11/12 — dirty 판정용 원본 (편집 안 한 상태 기준).
const originalResolved = ref('')
const isResolvedDirty = computed(() => resolved.value !== originalResolved.value)

// open 또는 query 변경 시 working tree (충돌 마커) 를 result 디폴트로
watch(
  () => conflictQuery.data.value,
  (cf) => {
    if (cf) {
      // 디폴트는 working (사용자가 conflict marker 보면서 직접 수정)
      resolved.value = cf.working ?? cf.ours ?? cf.theirs ?? ''
      originalResolved.value = resolved.value
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
    if (props.repoId == null || !props.path) return Promise.reject(new Error('no selection'))
    return writeResolved(props.repoId, props.path, resolved.value)
  },
  onSuccess: () => {
    invalidate(props.repoId)
    qc.invalidateQueries({ queryKey: ['conflicted'] })
    emit('close')
  },
  onError: (e) => toast.error(t('errors.conflictResolveSaveFailed'), describeError(e)),
})

const sideMut = useMutation({
  mutationFn: (side: 'ours' | 'theirs') => {
    if (props.repoId == null || !props.path) return Promise.reject(new Error('no selection'))
    return takeSide(props.repoId, props.path, side)
  },
  onSuccess: () => {
    invalidate(props.repoId)
    qc.invalidateQueries({ queryKey: ['conflicted'] })
    emit('close')
  },
  onError: (e) => toast.error('Take side 실패', describeError(e)),
})

// UXF-12 — 편집 결과가 dirty 면 ours/theirs/base 적용 전 confirm (실수 덮어쓰기 방어).
async function guardOverwrite(): Promise<boolean> {
  if (!isResolvedDirty.value) return true
  return confirmDialog({
    title: t('confirm.overwriteMergeResultTitle'),
    message: t('confirm.overwriteMergeResultMessage'),
    danger: true,
  })
}
async function applyOurs() {
  if (conflictQuery.data.value?.ours == null) return
  if (!(await guardOverwrite())) return
  resolved.value = conflictQuery.data.value.ours
}
async function applyTheirs() {
  if (conflictQuery.data.value?.theirs == null) return
  if (!(await guardOverwrite())) return
  resolved.value = conflictQuery.data.value.theirs
}
async function applyBase() {
  if (conflictQuery.data.value?.base == null) return
  if (!(await guardOverwrite())) return
  resolved.value = conflictQuery.data.value.base
}

// UXF-11 — 편집 결과 미저장 상태로 닫을 때 confirm.
async function attemptClose() {
  if (isResolvedDirty.value) {
    const ok = await confirmDialog({
      title: t('confirm.discardMergeEditTitle'),
      message: t('confirm.discardMergeEditMessage'),
      danger: true,
    })
    if (!ok) return
  }
  emit('close')
}

// UXF-01 — conflict marker 잔재 감지 (라인 시작 7자 마커).
// CDX-003 — diff3/zdiff3 의 base 섹션 마커 `|||||||` 도 포함.
const CONFLICT_MARKER_RE = /^(<{7}|\|{7}|={7}|>{7})/m

async function onStage() {
  if (CONFLICT_MARKER_RE.test(resolved.value)) {
    const ok = await confirmDialog({
      title: t('confirm.stageWithMarkersTitle'),
      message: t('confirm.stageWithMarkersMessage'),
      danger: true,
    })
    if (!ok) return
  }
  stageMut.mutate()
}

async function takeFullSide(side: 'ours' | 'theirs') {
  const ok = await confirmDialog({
    title: t('confirm.takeFullSideTitle'),
    message: t('confirm.takeFullSideMessage', { side, path: props.path ?? '' }),
    danger: true,
  })
  if (!ok) return
  sideMut.mutate(side)
}

// === AI merge resolve — Sprint c33 god 13/N: useAiResolveConflict composable 위임 ===
const aiR = useAiResolveConflict({
  repoId: () => props.repoId,
  path: () => props.path,
  onResult: (text) => {
    // result textarea 에 자동 채움 — 사용자 검토 후 저장.
    resolved.value = text
  },
  onError: (e) => toast.error('AI 호출 실패', describeError(e)),
})
const availableCli = aiR.availableCli
const aiMut = aiR.generate
async function onAiResolve(): Promise<void> {
  await aiR.run()
}
</script>

<template>
  <BaseModal :open="isOpen" panel-class="h-[90vh]" max-width="full" @close="attemptClose">
    <template #header>
      <h2 class="text-sm font-semibold">
        <span class="text-muted-foreground">3-way merge:</span>
        <span class="ml-2 font-mono">{{ path }}</span>
      </h2>
    </template>

    <!-- 단축 액션 -->
    <div class="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2 text-xs">
      <span class="text-muted-foreground">{{ t('mergeEditor.entirelyToOneSide') }}</span>
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
        class="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-ai-violet hover:bg-violet-500/20 disabled:opacity-50"
        :disabled="aiMut.isPending.value"
        :title="`${availableCli} CLI 가 ours/theirs/base 분석 후 result 추천`"
        @click="onAiResolve()"
      >
        {{ aiMut.isPending.value ? '✨ 분석 중...' : '✨ AI 추천' }}
      </button>
      <span class="ml-auto text-muted-foreground">또는 아래에서 직접 수정 →</span>
    </div>

    <!-- 3 패널 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- ours -->
      <div class="flex w-1/3 flex-col border-r border-border">
        <header
          class="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1"
        >
          <span class="text-xs font-semibold">🟦 OURS (현재 브랜치)</span>
          <button
            class="rounded px-2 py-1 min-h-[24px] text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            @click="applyOurs"
          >
            → 결과로 복사
          </button>
        </header>
        <pre
          class="flex-1 overflow-auto bg-muted/10 p-2 font-mono text-2xs text-muted-foreground"
          >{{ conflictQuery.data.value?.ours ?? '(없음)' }}</pre
        >
      </div>

      <!-- 결과 (편집 가능) -->
      <div class="flex w-1/3 flex-col border-r border-border">
        <header
          class="flex items-center justify-between border-b border-border bg-emerald-500/10 px-2 py-1"
        >
          <span class="text-xs font-semibold text-diff-add">✓ RESULT (편집)</span>
          <button
            v-if="conflictQuery.data.value?.base != null"
            class="rounded px-2 py-1 min-h-[24px] text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            @click="applyBase"
          >
            base 사용
          </button>
        </header>
        <textarea
          v-model="resolved"
          spellcheck="false"
          class="flex-1 resize-none bg-background p-2 font-mono text-2xs outline-none"
        />
      </div>

      <!-- theirs -->
      <div class="flex w-1/3 flex-col">
        <header
          class="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1"
        >
          <span class="text-xs font-semibold">🟪 THEIRS (들어오는)</span>
          <button
            class="rounded px-2 py-1 min-h-[24px] text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            @click="applyTheirs"
          >
            → 결과로 복사
          </button>
        </header>
        <pre
          class="flex-1 overflow-auto bg-muted/10 p-2 font-mono text-2xs text-muted-foreground"
          >{{ conflictQuery.data.value?.theirs ?? '(없음)' }}</pre
        >
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 text-xs">
        <span class="mr-auto text-muted-foreground">
          💡 결과 편집기에서 conflict marker (&lt;&lt;&lt;&lt; / ==== / &gt;&gt;&gt;&gt;) 모두 제거
          후 stage.
        </span>
        <button
          class="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          @click="attemptClose"
        >
          취소
        </button>
        <button
          class="rounded-md bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50"
          :disabled="stageMut.isPending.value"
          @click="onStage"
        >
          {{ stageMut.isPending.value ? '저장 중...' : '결과로 stage' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
