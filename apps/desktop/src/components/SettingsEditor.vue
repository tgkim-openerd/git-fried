<script setup lang="ts">
// Sprint c40 후속 — settings.vue 의 Editor / Terminal 영역 sub-component.
//
// 단순 표시 영역 (zoom 정보 외 props 0). zoomPx 는 useUiState 에서 직접 조회.
import { useUiState } from '@/composables/useUiState'

const uiState = useUiState()
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <h2 class="text-lg font-semibold">Editor / Terminal</h2>
    <p class="text-xs text-muted-foreground">
      현재 Editor 옵션은 ⌘=/-/0 (Zoom) 와 Diff 3-mode 토글 (Hunk/Inline/Context) 로 제공. 추가 옵션
      (font / EOL / line-num / wrap) 은 v1.x.
    </p>
    <ul
      class="space-y-1 rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground"
    >
      <li>· 폰트 크기: ⌘=/-/0 (Zoom) — 현재 {{ uiState.zoomPx.value }}px</li>
      <li>· Diff 모드: CommitDiffModal 의 Hunk / Inline / Context 토글</li>
      <li>· Terminal: ⌘\` 토글, pwsh.exe / bash 자동 감지</li>
    </ul>
    <p class="text-[10px] text-muted-foreground">
      v1.x 추가: External diff/merge tool launch, Terminal font/cursor 설정.
    </p>
  </div>
</template>
