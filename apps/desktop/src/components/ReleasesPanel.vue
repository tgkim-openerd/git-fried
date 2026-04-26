<script setup lang="ts">
// Forge release 목록 (Gitea + GitHub).
// release-please 봇 자동 생성된 release 도 포함.
import { useReleases } from '@/composables/useIssuesReleases'
import { describeError } from '@/api/errors'
import { formatDateLocalized } from '@/composables/useUserSettings'

const props = defineProps<{ repoId: number | null }>()
const { data: releases, isFetching, error } = useReleases(() => props.repoId)

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
      <div v-if="isFetching" class="px-2 py-3 text-xs text-muted-foreground">불러오는 중...</div>

      <ul>
        <li
          v-for="r in releases"
          :key="r.tag"
          class="rounded px-2 py-1.5 hover:bg-accent/40"
        >
          <a :href="r.htmlUrl" target="_blank" rel="noopener" class="block">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs">
                <span v-if="r.draft" class="rounded bg-amber-500/30 px-1 py-0.5 text-[10px] text-amber-500 mr-1">draft</span>
                <span v-if="r.prerelease" class="rounded bg-violet-500/30 px-1 py-0.5 text-[10px] text-violet-500 mr-1">pre</span>
                {{ r.tag }}
              </span>
              <span class="text-[10px] text-muted-foreground">{{ fmtDate(r.createdAt) }}</span>
            </div>
            <div class="truncate text-sm">{{ r.name }}</div>
          </a>
        </li>
        <li
          v-if="releases && releases.length === 0 && !isFetching"
          class="px-2 py-3 text-center text-xs text-muted-foreground"
        >
          Release 없음
        </li>
      </ul>
    </div>
  </div>
</template>
