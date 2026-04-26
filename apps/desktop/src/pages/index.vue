<script setup lang="ts">
// 메인 페이지 — 활성 레포의 SyncBar / CommitTable / StatusPanel / CommitMessageInput.
import { computed } from 'vue'
import { useReposStore } from '@/stores/repos'
import { useStatus } from '@/composables/useStatus'
import CommitTable from '@/components/CommitTable.vue'
import StatusPanel from '@/components/StatusPanel.vue'
import SyncBar from '@/components/SyncBar.vue'
import CommitMessageInput from '@/components/CommitMessageInput.vue'

const store = useReposStore()
const { data: status } = useStatus(() => store.activeRepoId)

const branch = computed(() => status.value?.branch ?? null)
const upstream = computed(() => status.value?.upstream ?? null)
const ahead = computed(() => status.value?.ahead ?? 0)
const behind = computed(() => status.value?.behind ?? 0)
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

    <!-- 본문 3분할: 그래프(추후) + 로그 / 상세 / 변경 패널 -->
    <div class="grid h-full grid-cols-[1fr_360px] overflow-hidden">
      <div class="flex flex-col overflow-hidden">
        <CommitTable :repo-id="store.activeRepoId" class="flex-1" />
      </div>
      <div class="flex flex-col overflow-hidden">
        <StatusPanel :repo-id="store.activeRepoId" class="flex-1" />
        <CommitMessageInput
          :repo-id="store.activeRepoId"
          :ahead="ahead"
          :behind="behind"
        />
      </div>
    </div>
  </div>
</template>
