<script setup lang="ts">
// 메인 페이지 — SyncBar + 좌측(로그/그래프) + 우측 탭 패널 + 하단(commit input).
import { computed, ref } from 'vue'
import { useReposStore } from '@/stores/repos'
import { useStatus } from '@/composables/useStatus'
import CommitGraph from '@/components/CommitGraph.vue'
import StatusPanel from '@/components/StatusPanel.vue'
import SyncBar from '@/components/SyncBar.vue'
import CommitMessageInput from '@/components/CommitMessageInput.vue'
import BranchPanel from '@/components/BranchPanel.vue'
import StashPanel from '@/components/StashPanel.vue'
import SubmodulePanel from '@/components/SubmodulePanel.vue'
import LfsPanel from '@/components/LfsPanel.vue'
import ForgePanel from '@/components/ForgePanel.vue'
import WorktreePanel from '@/components/WorktreePanel.vue'

const store = useReposStore()
const { data: status } = useStatus(() => store.activeRepoId)

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)

type Tab =
  | 'status'
  | 'branches'
  | 'stash'
  | 'submodule'
  | 'lfs'
  | 'pr'
  | 'worktree'
const tab = ref<Tab>('status')
</script>

<template>
  <div class="grid h-full grid-rows-[auto_1fr] overflow-hidden">
    <SyncBar
      :repo-id="store.activeRepoId"
      :branch="branch"
      :upstream="upstream"
      :ahead="ahead"
      :behind="behind"
    />

    <div class="grid h-full grid-cols-[1fr_360px] overflow-hidden">
      <!-- 좌측: 커밋 그래프 + 로그 -->
      <CommitGraph :repo-id="store.activeRepoId" />

      <!-- 우측: 탭 (Status / Branches / Stash) + 하단 commit input -->
      <div class="grid grid-rows-[auto_1fr_auto] overflow-hidden border-l border-border">
        <nav class="flex border-b border-border bg-card text-xs">
          <button
            v-for="t in [
              'status',
              'branches',
              'stash',
              'submodule',
              'lfs',
              'pr',
              'worktree',
            ] as Tab[]"
            :key="t"
            type="button"
            class="flex-1 px-1.5 py-1.5 capitalize"
            :class="
              tab === t
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-accent/40'
            "
            @click="tab = t"
          >
            {{
              t === 'status'
                ? '변경'
                : t === 'branches'
                ? '브랜치'
                : t === 'stash'
                ? 'Stash'
                : t === 'submodule'
                ? 'Sub'
                : t === 'lfs'
                ? 'LFS'
                : t === 'pr'
                ? 'PR'
                : 'WT'
            }}
          </button>
        </nav>

        <div class="overflow-hidden">
          <StatusPanel v-if="tab === 'status'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <BranchPanel v-else-if="tab === 'branches'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <StashPanel v-else-if="tab === 'stash'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <SubmodulePanel v-else-if="tab === 'submodule'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <LfsPanel v-else-if="tab === 'lfs'" :repo-id="store.activeRepoId" class="h-full border-l-0" />
          <ForgePanel v-else-if="tab === 'pr'" :repo-id="store.activeRepoId" class="h-full" />
          <WorktreePanel v-else :repo-id="store.activeRepoId" class="h-full border-l-0" />
        </div>

        <CommitMessageInput
          :repo-id="store.activeRepoId"
          :ahead="ahead"
          :behind="behind"
        />
      </div>
    </div>
  </div>
</template>
