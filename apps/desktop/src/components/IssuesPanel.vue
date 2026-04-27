<script setup lang="ts">
// Forge issue 목록 (Gitea + GitHub).
// v0.3 단계: read-only. 코멘트/생성은 v1.0+.
// Sprint 22 V-11: row click → IssueDetailModal (외부 link 만 → 자체 modal).
import { ref } from 'vue'
import { useIssues } from '@/composables/useIssuesReleases'
import { describeError } from '@/api/errors'
import { formatDateLocalized } from '@/composables/useUserSettings'
import UserAvatar from './UserAvatar.vue'
import IssueDetailModal from './IssueDetailModal.vue'
import EmptyState from './EmptyState.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import type { ForgeIssue } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()
const { data: issues, isFetching, error } = useIssues(() => props.repoId)

const selected = ref<ForgeIssue | null>(null)

function fmtDate(unix: number): string {
  return formatDateLocalized(unix, {
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">Issues</h3>
    </header>

    <div
      v-if="error"
      class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
    >
      {{ describeError(error) }}
    </div>

    <div class="flex-1 overflow-auto px-2 py-1 text-sm">
      <LoadingSpinner v-if="isFetching && !issues" label="이슈 목록 불러오는 중..." size="sm" />

      <ul>
        <li
          v-for="i in issues"
          :key="i.number"
          class="cursor-pointer rounded px-2 py-1.5 hover:bg-accent/40"
          @click="selected = i"
        >
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-muted-foreground">#{{ i.number }}</span>
            <span class="text-[10px] text-muted-foreground">{{ fmtDate(i.updatedAt) }}</span>
          </div>
          <div class="truncate text-sm">{{ i.title }}</div>
          <div class="text-[11px] text-muted-foreground">
            <UserAvatar
              :username="i.author.username"
              :avatar-url="i.author.avatarUrl"
              size-class="w-3.5 h-3.5"
            />
            {{ i.author.username }} · 💬 {{ i.comments }}
          </div>
          <div v-if="i.labels.length" class="mt-0.5 flex flex-wrap gap-1">
            <span
              v-for="l in i.labels"
              :key="l.name"
              class="rounded px-1 py-0.5 text-[10px]"
              :style="{ backgroundColor: l.color + '33', color: l.color }"
            >
              {{ l.name }}
            </span>
          </div>
        </li>
      </ul>
      <EmptyState
        v-if="issues && issues.length === 0 && !isFetching"
        icon="📭"
        title="Open issue 없음"
        size="sm"
      />
    </div>

    <IssueDetailModal
      :issue="selected"
      :open="selected != null"
      @close="selected = null"
    />
  </div>
</template>
