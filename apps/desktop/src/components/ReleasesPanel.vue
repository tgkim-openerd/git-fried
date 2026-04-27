<script setup lang="ts">
// Forge release 목록 (Gitea + GitHub).
// release-please 봇 자동 생성된 release 도 포함.
// Sprint 22 V-12: row click → ReleaseDetailModal (외부 link → 자체 modal).
import { ref } from 'vue'
import { useReleases } from '@/composables/useIssuesReleases'
import { describeError } from '@/api/errors'
import { formatDateLocalized } from '@/composables/useUserSettings'
import ReleaseDetailModal from './ReleaseDetailModal.vue'
import EmptyState from './EmptyState.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import type { ForgeRelease } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()
const { data: releases, isFetching, error } = useReleases(() => props.repoId)

const selected = ref<ForgeRelease | null>(null)

function fmtDate(unix: number): string {
  return formatDateLocalized(unix, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">Releases</h3>
    </header>

    <div
      v-if="error"
      class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
    >
      {{ describeError(error) }}
    </div>

    <div class="flex-1 overflow-auto px-2 py-1 text-sm">
      <LoadingSpinner v-if="isFetching && !releases" label="릴리스 목록 불러오는 중..." size="sm" />

      <ul>
        <li
          v-for="r in releases"
          :key="r.tag"
          class="cursor-pointer rounded px-2 py-1.5 hover:bg-accent/40"
          @click="selected = r"
        >
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs">
              <span v-if="r.draft" class="rounded bg-amber-500/30 px-1 py-0.5 text-[10px] text-amber-500 mr-1">draft</span>
              <span v-if="r.prerelease" class="rounded bg-violet-500/30 px-1 py-0.5 text-[10px] text-violet-500 mr-1">pre</span>
              {{ r.tag }}
            </span>
            <span class="text-[10px] text-muted-foreground">{{ fmtDate(r.createdAt) }}</span>
          </div>
          <div class="truncate text-sm">{{ r.name }}</div>
        </li>
      </ul>
      <EmptyState
        v-if="releases && releases.length === 0 && !isFetching"
        icon="📦"
        title="Release 없음"
        size="sm"
      />
    </div>

    <ReleaseDetailModal
      :release="selected"
      :open="selected != null"
      @close="selected = null"
    />
  </div>
</template>
