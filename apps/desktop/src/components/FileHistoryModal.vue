<script setup lang="ts">
// 파일 단위 history + blame 모달.
// 좌: 커밋 리스트 (시간 역순), 우: 선택 커밋의 blame 또는 파일 내용.
import { computed, ref } from 'vue'
import { useFileBlame, useFileHistory } from '@/composables/useFileHistory'
import { describeError } from '@/api/errors'
import { formatDateLocalized } from '@/composables/useUserSettings'
import BaseModal from './BaseModal.vue'
import type { CommitSummary } from '@/types/git'

const props = defineProps<{
  repoId: number | null
  path: string | null
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const isOpen = computed(() => props.open && props.path != null)

const tab = ref<'history' | 'blame'>('history')
const selected = ref<CommitSummary | null>(null)

const history = useFileHistory(
  () => props.repoId,
  () => props.path,
)
const blame = useFileBlame(
  () => props.repoId,
  () => (tab.value === 'blame' ? props.path : null),
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
</script>

<template>
  <BaseModal
    :open="isOpen"
    max-width="6xl"
    panel-class="h-[90vh]"
    @close="emit('close')"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <h2 class="font-mono text-sm">
          <span class="text-muted-foreground">파일:</span>
          <span class="ml-1 font-semibold">{{ path }}</span>
        </h2>
        <nav class="flex gap-1 text-xs">
          <button
            v-for="t in ['history', 'blame'] as const"
            :key="t"
            type="button"
            class="rounded-md px-2 py-0.5"
            :class="tab === t ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/40'"
            @click="tab = t"
          >
            {{ t === 'history' ? 'History' : 'Blame' }}
          </button>
        </nav>
      </div>
    </template>

        <!-- History 탭 -->
        <div v-if="tab === 'history'" class="flex flex-1 overflow-hidden">
          <div class="w-96 shrink-0 overflow-auto border-r border-border">
            <div v-if="history.error.value" class="p-3 text-xs text-destructive">
              {{ describeError(history.error.value) }}
            </div>
            <div v-else-if="history.isFetching.value" class="p-3 text-xs text-muted-foreground">
              불러오는 중...
            </div>
            <ul v-else>
              <li
                v-for="c in history.data.value"
                :key="c.sha"
                class="cursor-pointer border-b border-border px-3 py-1.5 text-xs hover:bg-accent/40"
                :class="selected?.sha === c.sha ? 'bg-accent' : ''"
                @click="selected = c"
              >
                <div class="flex items-center justify-between">
                  <span class="font-mono text-muted-foreground">{{ c.shortSha }}</span>
                  <span class="text-[10px] text-muted-foreground">{{ fmtDate(c.authorAt) }}</span>
                </div>
                <div class="truncate">{{ c.subject }}</div>
                <div class="text-[10px] text-muted-foreground">{{ c.authorName }}</div>
              </li>
              <li v-if="!history.isFetching.value && (history.data.value?.length ?? 0) === 0"
                class="p-3 text-center text-xs text-muted-foreground"
              >
                이 파일의 history 없음
              </li>
            </ul>
          </div>
          <div class="flex-1 overflow-auto p-4 text-sm">
            <div v-if="!selected" class="text-center text-xs text-muted-foreground">
              왼쪽에서 커밋을 선택하세요
            </div>
            <div v-else>
              <div class="mb-2 font-mono text-xs text-muted-foreground">{{ selected.sha }}</div>
              <h3 class="mb-1 text-base font-semibold">{{ selected.subject }}</h3>
              <div class="mb-3 text-xs text-muted-foreground">
                {{ selected.authorName }} · {{ fmtDate(selected.authorAt) }}
              </div>
              <pre class="whitespace-pre-wrap font-mono text-[12px]">{{ selected.body || '(본문 없음)' }}</pre>
            </div>
          </div>
        </div>

        <!-- Blame 탭 -->
        <div v-else class="flex-1 overflow-auto">
          <div v-if="blame.error.value" class="m-3 rounded border border-destructive bg-destructive/10 p-2 text-xs">
            {{ describeError(blame.error.value) }}
          </div>
          <div v-else-if="blame.isFetching.value" class="p-3 text-xs text-muted-foreground">
            blame 계산 중... (큰 파일은 수 초 걸림)
          </div>
          <table v-else class="w-full font-mono text-[12px]">
            <tbody>
              <tr
                v-for="(line, i) in blame.data.value"
                :key="i"
                class="border-b border-border/50 hover:bg-accent/20"
              >
                <td class="w-16 shrink-0 px-2 text-right text-[10px] text-muted-foreground">
                  {{ line.shortSha }}
                </td>
                <td class="w-28 shrink-0 px-1 truncate text-[10px] text-muted-foreground" :title="line.summary">
                  {{ line.authorName }}
                </td>
                <td class="w-12 shrink-0 px-1 text-right text-[10px] text-muted-foreground">
                  {{ line.finalLine }}
                </td>
                <td class="px-2 whitespace-pre">{{ line.content }}</td>
              </tr>
              <tr v-if="!blame.isFetching.value && (blame.data.value?.length ?? 0) === 0">
                <td colspan="4" class="p-3 text-center text-xs text-muted-foreground">
                  blame 결과 없음 (바이너리 또는 새 파일)
                </td>
              </tr>
            </tbody>
    </table>
    </div>
  </BaseModal>
</template>
