<script setup lang="ts">
// UltraPlan v0.4 sidebar GitKraken DIFF — SB-001 fix.
//
// Sidebar 와 main 사이 drag column (4px wide, hover 시 강조).
// pointer drag → useSidebarWidth.startSidebarResize 호출.

import { useSidebarWidth, startSidebarResize } from '@/composables/useSidebarWidth'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const width = useSidebarWidth()

function onPointerDown(e: PointerEvent) {
  startSidebarResize(e, width)
}
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    :aria-label="t('sidebar.resizeHandleAriaLabel')"
    :aria-valuenow="width"
    :aria-valuemin="180"
    :aria-valuemax="400"
    data-testid="sidebar-resize-handle"
    class="h-full w-1 cursor-col-resize bg-border hover:w-1.5 hover:bg-primary/40 transition-all touch-none select-none"
    :title="t('sidebar.resizeHandleTitle')"
    @pointerdown="onPointerDown"
  />
</template>
