<script setup lang="ts">
// Compare branches / commits — Sprint C3 (`docs/plan/14 §2 A1`).
//
// 두 ref 의 비교: ahead/behind 카운트 + commit list (ref1..ref2) + patch diff.
// GitKraken §17 Branch "Compare" 흡수.
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { compareRefs } from '@/api/git'
import { useBranches } from '@/composables/useBranches'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { formatDateLocalized } from '@/composables/useUserSettings'
import BaseModal from './BaseModal.vue'
// Sprint c38 / plan/29 E2 — Range Diff 모드 패널.
import RangeDiffPanel from './RangeDiffPanel.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

type CompareMode = 'diff' | 'range'

const props = defineProps<{
  repoId: number | null
  open: boolean
  /** 사전 선택값 (BranchPanel 등에서 진입 시). */
  initialRef1?: string | null
  initialRef2?: string | null
  /** Sprint c38 fix MED-3 — 초기 모드 (CommitGraph "Range diff with…" 진입). */
  initialMode?: CompareMode
}>()
defineEmits<{ close: [] }>()

const ref1 = ref<string>(props.initialRef1 ?? '')
const ref2 = ref<string>(props.initialRef2 ?? '')

// Sprint c38 / plan/29 E2 — 모드 토글: 'diff' (기존) / 'range' (range-diff).
const mode = ref<CompareMode>(props.initialMode ?? 'diff')

watch(
  () => props.open,
  (o) => {
    if (o) {
      ref1.value = props.initialRef1 ?? ref1.value
      ref2.value = props.initialRef2 ?? ref2.value
      // Sprint c38 fix MED-3 — open 마다 initialMode 재적용 (CommitGraph "Range diff with…" 진입).
      if (props.initialMode) mode.value = props.initialMode
    }
  },
)

const { data: branches } = useBranches(() => props.repoId)
const refOptions = computed(() => {
  const b = branches.value ?? []
  return b.map((br) => br.name)
})

const enabled = computed(() => props.open && !!props.repoId && !!ref1.value && !!ref2.value)

const cmpQuery = useQuery({
  queryKey: computed(() => ['compare', props.repoId, ref1.value, ref2.value] as const),
  queryFn: () => {
    if (!props.repoId || !ref1.value || !ref2.value) {
      return Promise.resolve(null)
    }
    return compareRefs(props.repoId, ref1.value, ref2.value)
  },
  enabled,
  staleTime: STALE_TIME.NORMAL,
})
const data = computed(() => cmpQuery.data.value ?? null)

function swap() {
  const a = ref1.value
  ref1.value = ref2.value
  ref2.value = a
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('compare.title')"
    panel-class="max-h-[90vh] w-[1100px]"
    max-width="full"
    @close="$emit('close')"
  >
    <!-- ref picker -->
    <div class="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
      <input
        v-model="ref1"
        list="ref-options"
        :placeholder="t('compare.ref1Placeholder')"
        class="w-40 rounded-md border border-input bg-background px-2 py-1 font-mono"
      />
      <button
        type="button"
        class="rounded-md border border-input px-2 py-1 hover:bg-accent"
        :title="t('compare.swapTitle')"
        @click="swap"
      >
        ⇄
      </button>
      <input
        v-model="ref2"
        list="ref-options"
        :placeholder="t('compare.ref2Placeholder')"
        class="w-40 rounded-md border border-input bg-background px-2 py-1 font-mono"
      />
      <datalist id="ref-options">
        <option v-for="r in refOptions" :key="r" :value="r" />
      </datalist>
      <button
        type="button"
        class="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
        :disabled="!enabled || cmpQuery.isFetching.value"
        @click="cmpQuery.refetch()"
      >
        {{ cmpQuery.isFetching.value ? '...' : t('compare.compareButton') }}
      </button>
      <!-- Sprint c38 / plan/29 E2 — 모드 토글 (Diff / Range Diff). -->
      <div
        class="ml-2 flex overflow-hidden rounded-md border border-input"
        :title="t('compare.modeToggleTitle')"
      >
        <button
          type="button"
          class="px-2 py-1 text-xs"
          :class="mode === 'diff' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
          :aria-pressed="mode === 'diff'"
          @click="mode = 'diff'"
        >
          {{ t('compare.modeDiff') }}
        </button>
        <button
          type="button"
          class="px-2 py-1 text-xs"
          :class="mode === 'range' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
          :aria-pressed="mode === 'range'"
          @click="mode = 'range'"
        >
          {{ t('compare.modeRange') }}
        </button>
      </div>
      <span v-if="mode === 'diff' && data" class="ml-auto text-muted-foreground">
        <span class="text-warning-amber">↓ {{ data.leftCount }}</span>
        {{ t('compare.ref1Only') }}
        ·
        <span class="text-diff-add">↑ {{ data.rightCount }}</span>
        {{ t('compare.ref2Only') }}
      </span>
    </div>

    <!-- Sprint c38 / plan/29 E2 — Range Diff 모드: 단일 RangeDiffPanel 렌더 -->
    <RangeDiffPanel
      v-if="mode === 'range'"
      :repo-id="repoId"
      :rev1="ref1"
      :rev2="ref2"
      :active="open && mode === 'range'"
    />

    <!-- 기존 Diff 모드 결과 -->
    <div v-else class="flex flex-1 overflow-hidden">
      <!-- 좌: commit list (ref1..ref2) -->
      <aside class="w-80 shrink-0 overflow-auto border-r border-border bg-muted/20">
        <header
          class="border-b border-border bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground"
        >
          <code>{{ ref1 || '?' }}..{{ ref2 || '?' }}</code> {{ t('compare.commitsHeader') }} ({{
            data?.commits.length ?? 0
          }})
        </header>
        <p
          v-if="cmpQuery.error.value"
          class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs"
        >
          {{ describeError(cmpQuery.error.value) }}
        </p>
        <p v-else-if="!enabled" class="p-3 text-center text-xs text-muted-foreground">
          {{ t('compare.promptInputs') }}
        </p>
        <p
          v-else-if="cmpQuery.isFetching.value && !data"
          class="p-3 text-center text-xs text-muted-foreground"
        >
          {{ t('common.loading') }}
        </p>
        <ul v-else-if="data" class="text-xs">
          <li v-for="c in data.commits" :key="c.sha" class="border-b border-border/50 px-2 py-1">
            <div class="flex items-center justify-between gap-2">
              <code class="text-muted-foreground">
                {{ c.sha.slice(0, 7) }}
              </code>
              <span class="text-[10px] text-muted-foreground">
                {{ formatDateLocalized(c.authorAt) }}
              </span>
            </div>
            <div class="mt-0.5 truncate font-mono">{{ c.summary }}</div>
            <div class="text-[10px] text-muted-foreground">
              {{ c.author }}
            </div>
          </li>
          <li v-if="data.commits.length === 0" class="p-3 text-center text-muted-foreground">
            {{ t('compare.noCommitDiff') }}
          </li>
        </ul>
      </aside>

      <!-- 우: diff text -->
      <main class="flex-1 overflow-auto bg-background">
        <pre v-if="data?.diff" class="m-0 whitespace-pre-wrap p-3 font-mono text-[11px]">{{
          data.diff
        }}</pre>
        <p v-else-if="data && !data.diff" class="p-6 text-center text-xs text-muted-foreground">
          {{ t('compare.noDiff') }}
        </p>
      </main>
    </div>
  </BaseModal>
</template>
