<script setup lang="ts">
// Issue 상세 모달 — `docs/plan/22 §3 V-11`.
//
// v0.x 단계: read-only (제목 / body / state / author / labels / comments count + 외부 link).
// v1.x: 코멘트 스레드 / state change / labels / assignee.
//
// IssuesPanel row click 시 진입 — IssuesPanel 의 외부 link-only 행동을 self-modal 로 격상.
import BaseModal from './BaseModal.vue'
import UserAvatar from './UserAvatar.vue'
import { formatDateLocalized } from '@/composables/useUserSettings'
import type { ForgeIssue } from '@/api/git'

defineProps<{
  issue: ForgeIssue | null
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()

function fmtDate(unix: number): string {
  return formatDateLocalized(unix, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function stateColor(s: string): string {
  return s === 'open' ? 'text-emerald-500' : 'text-violet-500'
}
</script>

<template>
  <BaseModal
    :open="open && issue != null"
    max-width="3xl"
    panel-class="max-h-[85vh]"
    @close="emit('close')"
  >
    <template #header>
      <h2 v-if="issue" class="text-sm font-semibold">
        <span :class="['mr-2 text-[10px] uppercase', stateColor(issue.state)]">
          {{ issue.state }}
        </span>
        <span class="font-mono">#{{ issue.number }}</span>
        <span class="ml-2">{{ issue.title }}</span>
      </h2>
    </template>

    <div v-if="issue" class="p-4 text-sm">
      <div class="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <UserAvatar
          :username="issue.author.username"
          :avatar-url="issue.author.avatarUrl"
          size-class="w-4 h-4"
        />
        <span>{{ issue.author.username }}</span>
        <span>·</span>
        <span>{{ fmtDate(issue.createdAt) }}</span>
        <span v-if="issue.updatedAt > issue.createdAt">
          (updated {{ fmtDate(issue.updatedAt) }})
        </span>
        <span class="ml-auto">💬 {{ issue.comments }}</span>
      </div>

      <div v-if="issue.labels.length" class="mb-3 flex flex-wrap gap-1">
        <span
          v-for="l in issue.labels"
          :key="l.name"
          class="rounded px-1.5 py-0.5 text-[10px]"
          :style="{ backgroundColor: l.color + '33', color: l.color }"
        >
          {{ l.name }}
        </span>
      </div>

      <pre class="whitespace-pre-wrap rounded border border-border bg-muted/30 p-3 font-mono text-[12px]">{{ issue.bodyMd || '(본문 없음)' }}</pre>

      <p class="mt-3 text-[10px] text-muted-foreground">
        💡 코멘트 스레드 / state change / labels 는 v1.x.
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-between text-xs">
        <span v-if="issue" class="text-muted-foreground">
          {{ issue.forgeKind }} · {{ issue.owner }}/{{ issue.repo }}
        </span>
        <a
          v-if="issue"
          :href="issue.htmlUrl"
          target="_blank"
          rel="noopener"
          class="rounded border border-border px-3 py-1 hover:bg-accent/40"
        >
          ↗ 외부 열기
        </a>
      </div>
    </template>
  </BaseModal>
</template>
