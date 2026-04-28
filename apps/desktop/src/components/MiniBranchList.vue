<script setup lang="ts">
// Sprint c27-1 (ARCH-003 fix) — Sidebar 의 로컬 브랜치 mini list.
// ActiveRepoQuickActions 에서 분리. data fetching + UI 둘 다 본 컴포넌트가 책임.

import { computed } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useBranches } from '@/composables/useBranches'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { useStatusCounts } from '@/composables/useStatusCounts'
import { useReposStore } from '@/stores/repos'
import { dispatchShortcut } from '@/composables/useShortcuts'
import { switchBranch } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import MiniSection from './MiniSection.vue'

const store = useReposStore()
const toast = useToast()
const invalidate = useInvalidateRepoQueries()
const repoIdRef = computed(() => store.activeRepoId)

const { data: branches } = useBranches(repoIdRef)
const { counts } = useStatusCounts(repoIdRef)

const localBranches = computed(() => {
  const all = branches.value ?? []
  return all.filter((b) => b.kind === 'local')
})
const miniBranches = computed(() => {
  const list = [...localBranches.value]
  list.sort((a, b) => {
    if (a.isHead && !b.isHead) return -1
    if (b.isHead && !a.isHead) return 1
    return 0
  })
  return list.slice(0, 5)
})
const moreCount = computed(() =>
  Math.max(0, localBranches.value.length - miniBranches.value.length),
)

const switchMut = useMutation({
  mutationFn: ({ id, name }: { id: number; name: string }) => switchBranch(id, name),
  onSuccess: (_res, vars) => {
    invalidate(store.activeRepoId)
    toast.success('브랜치 전환', vars.name)
  },
  onError: (e) => toast.error('브랜치 전환 실패', describeError(e)),
})

function onSwitchBranch(name: string, isHead: boolean) {
  if (isHead) return
  if (store.activeRepoId == null) return
  // SEC-009 — dirty working tree 시 confirm.
  if (counts.value.total > 0) {
    if (
      !confirm(
        `변경사항 있음 (${counts.value.total} files) — '${name}' 으로 체크아웃 진행?\n\n` +
          `• git checkout 이 거부할 수 있음 (overwrite 위험)\n` +
          `• 안전하게 진행하려면 stash 먼저 권장\n\n` +
          `그래도 시도하시겠습니까?`,
      )
    ) {
      return
    }
  }
  switchMut.mutate({ id: store.activeRepoId, name })
}
</script>

<template>
  <MiniSection
    v-if="miniBranches.length > 0"
    title="로컬 브랜치"
    :count="localBranches.length"
    storage-key="active-repo-quick.branches"
    full-tooltip="전체 브랜치 패널 (⌘B)"
    @full="dispatchShortcut('newBranch')"
  >
    <ul class="space-y-0.5">
      <li
        v-for="b in miniBranches"
        :key="`mb-${b.name}`"
        class="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px]"
        :class="
          b.isHead
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'text-foreground hover:bg-accent/40 cursor-pointer'
        "
        :title="
          b.isHead
            ? '현재 HEAD (체크아웃 됨)'
            : `${b.name} 으로 체크아웃 (clean working tree 권장)`
        "
        @click="onSwitchBranch(b.name, b.isHead)"
      >
        <span class="shrink-0 w-3 text-center">{{ b.isHead ? '●' : '' }}</span>
        <span class="flex-1 truncate font-mono">{{ b.name }}</span>
        <span v-if="b.ahead || b.behind" class="text-[9px]">
          <span v-if="b.ahead" class="text-emerald-500">↑{{ b.ahead }}</span>
          <span v-if="b.behind" class="ml-0.5 text-rose-500">↓{{ b.behind }}</span>
        </span>
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
