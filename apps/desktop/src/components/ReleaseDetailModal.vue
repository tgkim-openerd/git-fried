<script setup lang="ts">
// Release 상세 모달 — `docs/plan/22 §3 V-12`.
//
// v0.x 단계: read-only (tag / name / draft·prerelease 뱃지 + bodyMd changelog + 외부 link).
// v1.x: asset list (다운로드) / signature 검증.
//
// ReleasesPanel row click 시 진입.
import BaseModal from './BaseModal.vue'
import { formatDateLocalized } from '@/composables/useUserSettings'
import type { ForgeRelease } from '@/api/git'

defineProps<{
  release: ForgeRelease | null
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
</script>

<template>
  <BaseModal
    :open="open && release != null"
    max-width="3xl"
    panel-class="max-h-[85vh]"
    @close="emit('close')"
  >
    <template #header>
      <h2 v-if="release" class="text-sm font-semibold">
        <span
          v-if="release.draft"
          class="mr-1 rounded bg-amber-500/30 px-1 py-0.5 text-[10px] text-amber-500"
        >
          draft
        </span>
        <span
          v-if="release.prerelease"
          class="mr-1 rounded bg-violet-500/30 px-1 py-0.5 text-[10px] text-violet-500"
        >
          pre
        </span>
        <span class="font-mono">{{ release.tag }}</span>
        <span class="ml-2">{{ release.name }}</span>
      </h2>
    </template>

    <div v-if="release" class="p-4 text-sm">
      <p class="mb-3 text-xs text-muted-foreground">
        {{ release.forgeKind }} · {{ release.owner }}/{{ release.repo }}
        · {{ fmtDate(release.createdAt) }}
      </p>

      <h3 class="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Changelog</h3>
      <pre class="whitespace-pre-wrap rounded border border-border bg-muted/30 p-3 font-mono text-[12px]">{{ release.bodyMd || '(changelog 없음)' }}</pre>

      <p class="mt-3 text-[10px] text-muted-foreground">
        💡 asset list / 다운로드 / signature 검증은 v1.x.
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-end text-xs">
        <a
          v-if="release"
          :href="release.htmlUrl"
          target="_blank"
          rel="noopener"
          class="rounded border border-border px-3 py-1 hover:bg-accent/40"
        >
          ↗ 외부 열기 (다운로드 링크 포함)
        </a>
      </div>
    </template>
  </BaseModal>
</template>
