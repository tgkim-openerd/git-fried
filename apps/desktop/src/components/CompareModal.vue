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

const props = defineProps<{
  repoId: number | null
  open: boolean
  /** 사전 선택값 (BranchPanel 등에서 진입 시). */
  initialRef1?: string | null
  initialRef2?: string | null
}>()
defineEmits<{ close: [] }>()

const ref1 = ref<string>(props.initialRef1 ?? '')
const ref2 = ref<string>(props.initialRef2 ?? '')

watch(
  () => props.open,
  (o) => {
    if (o) {
      ref1.value = props.initialRef1 ?? ref1.value
      ref2.value = props.initialRef2 ?? ref2.value
    }
  },
)

const { data: branches } = useBranches(() => props.repoId)
const refOptions = computed(() => {
  const b = branches.value ?? []
  return b.map((br) => br.name)
})

const enabled = computed(
  () => props.open && !!props.repoId && !!ref1.value && !!ref2.value,
)

const cmpQuery = useQuery({
  queryKey: computed(
    () => ['compare', props.repoId, ref1.value, ref2.value] as const,
  ),
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
    title="Compare"
    panel-class="max-h-[90vh] w-[1100px]"
    max-width="full"
    @close="$emit('close')"
  >

        <!-- ref picker -->
        <div
          class="flex items-center gap-2 border-b border-border px-4 py-2 text-xs"
        >
          <input
            v-model="ref1"
            list="ref-options"
            placeholder="ref1 (예: main)"
            class="w-40 rounded-md border border-input bg-background px-2 py-1 font-mono"
          />
          <button
            type="button"
            class="rounded-md border border-input px-2 py-1 hover:bg-accent"
            title="ref1 ↔ ref2 swap"
            @click="swap"
          >
            ⇄
          </button>
          <input
            v-model="ref2"
            list="ref-options"
            placeholder="ref2 (예: feature/x)"
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
            {{ cmpQuery.isFetching.value ? '...' : '비교' }}
          </button>
          <span v-if="data" class="ml-auto text-muted-foreground">
            <span class="text-amber-500">↓ {{ data.leftCount }}</span>
            (ref1 only)
            ·
            <span class="text-emerald-500">↑ {{ data.rightCount }}</span>
            (ref2 only)
          </span>
        </div>

        <!-- 결과 -->
        <div class="flex flex-1 overflow-hidden">
          <!-- 좌: commit list (ref1..ref2) -->
          <aside
            class="w-80 shrink-0 overflow-auto border-r border-border bg-muted/20"
          >
            <header
              class="border-b border-border bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground"
            >
              <code>{{ ref1 || '?' }}..{{ ref2 || '?' }}</code> 커밋
              ({{ data?.commits.length ?? 0 }})
            </header>
            <p
              v-if="cmpQuery.error.value"
              class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs"
            >
              {{ describeError(cmpQuery.error.value) }}
            </p>
            <p
              v-else-if="!enabled"
              class="p-3 text-center text-xs text-muted-foreground"
            >
              두 ref 입력 후 [비교] 클릭
            </p>
            <p
              v-else-if="cmpQuery.isFetching.value && !data"
              class="p-3 text-center text-xs text-muted-foreground"
            >
              불러오는 중...
            </p>
            <ul v-else-if="data" class="text-xs">
              <li
                v-for="c in data.commits"
                :key="c.sha"
                class="border-b border-border/50 px-2 py-1"
              >
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
              <li
                v-if="data.commits.length === 0"
                class="p-3 text-center text-muted-foreground"
              >
                커밋 차이 없음
              </li>
            </ul>
          </aside>

          <!-- 우: diff text -->
          <main class="flex-1 overflow-auto bg-background">
            <pre
              v-if="data?.diff"
              class="m-0 whitespace-pre-wrap p-3 font-mono text-[11px]"
            >{{ data.diff }}</pre>
            <p
              v-else-if="data && !data.diff"
              class="p-6 text-center text-xs text-muted-foreground"
            >
              diff 없음
            </p>
          </main>
    </div>
  </BaseModal>
</template>
