<script setup lang="ts">
// Bulk fetch 결과 상세 (`docs/plan/22 §2 C1`).
//
// Sidebar 의 bulkFetch 가 5+ 실패 시 toast 가 절단되던 문제 해소.
// 결과 전체를 표 형태로 표시 + 실패 stderr 전체 expand.
// Sprint 22-5 Q-1/Q-2: BaseModal 마이그레이션.
import { computed } from 'vue'
import { humanizeGitError } from '@/api/errors'
import { useBulkFetchResult } from '@/composables/useBulkFetchResult'
import { formatDateLocalized } from '@/composables/useUserSettings'
import BaseModal from './BaseModal.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { last } = useBulkFetchResult()

const failedCount = computed(
  () => last.value?.results.filter((r) => !r.success).length ?? 0,
)
const okCount = computed(
  () => (last.value?.results.length ?? 0) - failedCount.value,
)

function fmtTime(ms: number): string {
  return formatDateLocalized(Math.floor(ms / 1000), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<template>
  <BaseModal :open="open" max-width="3xl" panel-class="max-h-[80vh]" @close="emit('close')">
    <template #header>
      <h2 class="text-sm font-semibold">
        📡 일괄 Fetch 결과
        <span v-if="last" class="ml-2 text-[11px] text-muted-foreground">
          {{ fmtTime(last.ranAt) }} · {{ okCount }}/{{ last.results.length }} 성공
          <span v-if="failedCount > 0" class="ml-1 text-amber-500">
            · {{ failedCount }} 실패
          </span>
        </span>
      </h2>
    </template>
    <div class="p-4 text-sm">
      <p
        v-if="!last"
        class="text-center text-xs text-muted-foreground"
      >
        아직 일괄 Fetch 를 실행하지 않았습니다.
      </p>
      <table v-else class="w-full text-xs">
        <thead class="sticky top-0 bg-card text-muted-foreground">
          <tr>
            <th class="px-2 py-1 text-left font-normal">Repo</th>
            <th class="px-2 py-1 text-left font-normal w-16">상태</th>
            <th class="px-2 py-1 text-left font-normal">메시지 / Error</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in last.results"
            :key="r.repoName"
            class="border-t border-border align-top hover:bg-accent/30"
          >
            <td class="px-2 py-1 font-mono">{{ r.repoName }}</td>
            <td
              class="px-2 py-1"
              :class="r.success ? 'text-emerald-500' : 'text-red-500'"
            >
              {{ r.success ? '✓ ok' : '✕ fail' }}
            </td>
            <td class="px-2 py-1">
              <pre
                v-if="!r.success && r.error"
                class="whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground"
                >{{ humanizeGitError(r.error) }}</pre
              >
              <span
                v-else-if="r.success"
                class="text-[10px] text-muted-foreground"
              >
                fetched
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #footer>
      <div class="flex justify-end text-xs">
        <button
          type="button"
          class="rounded border border-border px-3 py-1 hover:bg-muted/40"
          @click="emit('close')"
        >
          닫기
        </button>
      </div>
    </template>
  </BaseModal>
</template>
