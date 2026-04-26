<script setup lang="ts">
// Reflog viewer — HEAD 의 reflog 표시 (실수로 잃은 commit 복구용).
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listReflog } from '@/api/git'
import { describeError } from '@/api/errors'
import { useReposStore } from '@/stores/repos'
import { formatDateLocalized } from '@/composables/useUserSettings'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useReposStore()
const repoId = computed(() => store.activeRepoId)

const reflogQuery = useQuery({
  queryKey: computed(() => ['reflog', repoId.value]),
  queryFn: () => {
    if (repoId.value == null) return Promise.resolve([])
    return listReflog(repoId.value, 'HEAD', 200)
  },
  enabled: computed(() => props.open && repoId.value != null),
})

function fmtDate(unix: number): string {
  return formatDateLocalized(unix, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function actionColor(action: string): string {
  if (action.includes('commit')) return 'text-emerald-500'
  if (action.includes('reset')) return 'text-amber-500'
  if (action.includes('rebase')) return 'text-violet-500'
  if (action.includes('merge')) return 'text-sky-500'
  if (action.includes('checkout')) return 'text-muted-foreground'
  return 'text-foreground'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6"
      @click.self="emit('close')"
    >
      <div class="flex h-full w-full max-w-4xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <header class="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 class="text-sm font-semibold">📜 Reflog (HEAD)</h2>
          <button class="text-muted-foreground hover:text-foreground" @click="emit('close')">✕</button>
        </header>
        <p class="border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          💡 실수로 reset / rebase / branch 삭제로 잃은 commit 을 복구할 때 사용. SHA 복사 후
          <code class="rounded bg-muted px-1">git reset &lt;sha&gt;</code> 또는
          <code class="rounded bg-muted px-1">git checkout -b 복구브랜치 &lt;sha&gt;</code>.
        </p>

        <div
          v-if="reflogQuery.error.value"
          class="m-3 rounded border border-destructive bg-destructive/10 p-2 text-xs"
        >
          {{ describeError(reflogQuery.error.value) }}
        </div>

        <div class="flex-1 overflow-auto">
          <table class="w-full text-xs">
            <thead class="sticky top-0 bg-card text-[10px] text-muted-foreground">
              <tr>
                <th class="px-3 py-1.5 text-left font-normal w-24">ref</th>
                <th class="px-3 py-1.5 text-left font-normal w-16">SHA</th>
                <th class="px-3 py-1.5 text-left font-normal w-20">action</th>
                <th class="px-3 py-1.5 text-left font-normal">메시지</th>
                <th class="px-3 py-1.5 text-left font-normal w-24">시각</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(e, i) in reflogQuery.data.value"
                :key="`${e.refLabel}-${i}`"
                class="border-t border-border/50 hover:bg-accent/30"
              >
                <td class="px-3 py-1 font-mono">{{ e.refLabel }}</td>
                <td class="px-3 py-1 font-mono text-muted-foreground">{{ e.shortSha }}</td>
                <td :class="['px-3 py-1', actionColor(e.action)]">{{ e.action }}</td>
                <td class="px-3 py-1 truncate">{{ e.subject }}</td>
                <td class="px-3 py-1 text-muted-foreground">{{ fmtDate(e.at) }}</td>
              </tr>
              <tr v-if="reflogQuery.data.value && reflogQuery.data.value.length === 0">
                <td colspan="5" class="p-4 text-center text-muted-foreground">reflog 비어있음</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Teleport>
</template>
