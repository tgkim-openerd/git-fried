<script setup lang="ts">
// Sprint c27-1 (ARCH-003 fix) — Sidebar 의 Stash mini list.
// ActiveRepoQuickActions 에서 분리.

import { computed } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useStash } from '@/composables/useStash'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { applyStash, popStash } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import MiniSection from './MiniSection.vue'

const store = useReposStore()
const toast = useToast()
const invalidate = useInvalidateRepoQueries()
const queryClient = useQueryClient()
const repoIdRef = computed(() => store.activeRepoId)

const { data: stashes } = useStash(repoIdRef)
const miniStashes = computed(() => (stashes.value ?? []).slice(0, 3))
const moreCount = computed(() =>
  Math.max(0, (stashes.value?.length ?? 0) - miniStashes.value.length),
)

function invalidateStash() {
  queryClient.invalidateQueries({ queryKey: ['stash', store.activeRepoId] })
}

const applyStashMut = useMutation({
  mutationFn: ({ id, idx }: { id: number; idx: number }) => applyStash(id, idx),
  onSuccess: () => {
    invalidate(store.activeRepoId)
    invalidateStash()
    toast.success('Stash apply 완료', 'working tree 에 적용됨 (stash 보존)')
  },
  onError: (e) => toast.error('Stash apply 실패', describeError(e)),
})
const popStashMut = useMutation({
  mutationFn: ({ id, idx }: { id: number; idx: number }) => popStash(id, idx),
  onSuccess: () => {
    invalidate(store.activeRepoId)
    invalidateStash()
    toast.success('Stash pop 완료', 'apply + 제거')
  },
  onError: (e) => toast.error('Stash pop 실패', describeError(e)),
})

function onApply(idx: number) {
  if (store.activeRepoId == null) return
  applyStashMut.mutate({ id: store.activeRepoId, idx })
}
function onPop(idx: number) {
  if (store.activeRepoId == null) return
  // SEC-002 — hover-only 버튼 우발 클릭 방지.
  if (
    !confirm(
      `stash@{${idx}} 을 pop 합니다.\n\n` +
        `• working tree 에 적용 + stash 제거\n` +
        `• conflict 발생 시 stash 만 남고 working tree 가 더러워질 수 있음\n\n` +
        `진행하시겠습니까?`,
    )
  ) {
    return
  }
  popStashMut.mutate({ id: store.activeRepoId, idx })
}
</script>

<template>
  <MiniSection
    v-if="miniStashes.length > 0"
    title="Stash"
    :count="stashes?.length ?? 0"
    storage-key="active-repo-quick.stash"
    full-tooltip="Stash 패널 (⌘3)"
    @full="dispatchShortcut('tab3')"
  >
    <ul class="space-y-0.5">
      <li
        v-for="s in miniStashes"
        :key="`ms-${s.index}`"
        class="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-accent/30"
        :title="`stash@{${s.index}} on ${s.branch ?? 'unknown'} — ${s.message}`"
      >
        <span class="shrink-0 font-mono text-[10px] text-muted-foreground">
          @{{ s.index }}
        </span>
        <span class="flex-1 truncate">{{ s.message || '(no message)' }}</span>
        <button
          type="button"
          class="opacity-0 group-hover:opacity-100 rounded border border-border px-1 py-0 text-[9px] text-muted-foreground hover:bg-accent/40"
          title="apply (working tree 에 적용, stash 보존)"
          :disabled="applyStashMut.isPending.value"
          @click="onApply(s.index)"
        >
          apply
        </button>
        <button
          type="button"
          class="opacity-0 group-hover:opacity-100 rounded border border-border px-1 py-0 text-[9px] text-muted-foreground hover:bg-accent/40"
          title="pop (apply + 제거)"
          :disabled="popStashMut.isPending.value"
          @click="onPop(s.index)"
        >
          pop
        </button>
      </li>
      <li
        v-if="moreCount > 0"
        class="px-1 py-0.5 text-[10px] text-muted-foreground"
      >
        ⋯ +{{ moreCount }}개 더 (전체 → 클릭)
      </li>
    </ul>
  </MiniSection>
</template>
