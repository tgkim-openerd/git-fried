<script setup lang="ts">
// 메인 페이지: 활성 레포의 커밋 로그 표시.
// 우측 상세는 v0.1 Sprint 2 에서 추가.
import { useReposStore } from '@/stores/repos'
import CommitTable from '@/components/CommitTable.vue'

const store = useReposStore()
</script>

<template>
  <CommitTable :repo-id="store.activeRepoId" />
</template>
