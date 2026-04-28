<script setup lang="ts">
// 단일 commit diff 모달 — Sprint B5 ⌘D 진입점 + B7 ✨ Explain + B1 3-mode 토글.
//
// 기존 CommitGraph 가 selectCommit emit 하는 sha 를 받아 fetch + DiffViewer 로 렌더.
// 모드 토글 (Hunk/Inline/Context) 은 git -U<n> 옵션으로 backend 에 직접 적용 —
// CodeMirror 의 mode 가 아니라 patch 자체가 변함.
//
// Sprint c26-2 — 공통 로직을 useCommitDiff composable 로 추출 (DRY).

import { computed, useTemplateRef } from 'vue'
import { describeError } from '@/api/errors'
import { DIFF_MODE_LABELS, type DiffMode } from '@/composables/useDiffMode'
import { useCommitDiff } from '@/composables/useCommitDiff'
import { toRef } from 'vue'
import AiResultModal from './AiResultModal.vue'
import BaseModal from './BaseModal.vue'
import DiffViewer, { type DiffViewerExpose } from './DiffViewer.vue'
import DiffSplitView from './DiffSplitView.vue'

const props = defineProps<{
  repoId: number | null
  sha: string | null
  open: boolean
}>()
defineEmits<{ close: [] }>()

const cd = useCommitDiff({
  repoId: () => props.repoId,
  sha: () => props.sha,
  enabled: () => props.open,
})

const MODES: DiffMode[] = ['compact', 'default', 'context', 'split']
const isSplit = computed(() => cd.diffMode.mode.value === 'split')

// Hunk navigation (split 모드 외에서만 활성, TYPE-003/ARCH-004 fix: 공통 expose 타입).
const diffRef = useTemplateRef<DiffViewerExpose>('diffRef')
function onPrevHunk() {
  if (!cd.hunkNavDisabled.value) diffRef.value?.prevHunk()
}
function onNextHunk() {
  if (!cd.hunkNavDisabled.value) diffRef.value?.nextHunk()
}

// c26-3 / ARCH-002 fix — modal 의 open 을 enabledRef 로 캡슐화 (Panel 과 동시 mount 시 충돌 방지).
const openRef = toRef(props, 'open')
cd.registerHunkNavShortcut(diffRef, openRef)
</script>

<template>
  <BaseModal
    :open="open"
    panel-class="max-h-[90vh] w-[1000px]"
    max-width="full"
    :show-close-button="false"
    @close="$emit('close')"
  >
    <template #header>
      <div class="flex w-full items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 font-mono text-sm">
          <!-- ARCH-010 fix — Modal/Panel badge 일관 정책 (둘 다 mode badge). -->
          <span class="rounded bg-sky-500/15 px-1.5 text-[10px] font-bold text-sky-500">
            MODAL DIFF
          </span>
          <span>commit</span>
          <span v-if="sha" class="ml-1 text-muted-foreground">{{ sha.slice(0, 12) }}</span>
          <span v-if="cd.isFetching.value" class="ml-2 text-xs text-muted-foreground">불러오는 중...</span>
        </h2>
        <div class="flex items-center gap-2">
            <!-- Sprint c25-4 §5 — Hunk ↑↓ 네비게이션 (split 모드 제외, 1-hunk 이하 disabled) -->
            <div
              v-if="!isSplit"
              class="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 px-0.5"
              :title="
                cd.hunkNavDisabled.value
                  ? '이 commit 은 hunk 1개 이하 — nav 불필요'
                  : `${cd.hunkCount.value}개 hunk — ↑↓ 로 이동`
              "
            >
              <button
                type="button"
                class="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
                :disabled="cd.hunkNavDisabled.value"
                title="이전 hunk"
                aria-label="이전 hunk"
                @click="onPrevHunk"
              >
                ↑
              </button>
              <button
                type="button"
                class="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
                :disabled="cd.hunkNavDisabled.value"
                title="다음 hunk"
                aria-label="다음 hunk"
                @click="onNextHunk"
              >
                ↓
              </button>
            </div>
            <!-- 3-mode 토글 (Sprint B1) -->
            <div class="flex gap-0.5 rounded-md border border-border bg-muted/40 p-0.5 text-[10px]">
              <button
                v-for="m in MODES"
                :key="m"
                type="button"
                class="rounded px-1.5 py-0.5"
                :class="
                  cd.diffMode.mode.value === m
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-accent/40'
                "
                :title="
                  m === 'compact'
                    ? '변경 라인만 (-U0)'
                    : m === 'default'
                    ? '기본 컨텍스트 3 라인 (-U3)'
                    : m === 'context'
                    ? '확장 컨텍스트 25 라인 (-U25)'
                    : 'Split — side-by-side (다중 파일 picker)'
                "
                @click="cd.diffMode.setMode(m)"
              >
                {{ DIFF_MODE_LABELS[m] }}
              </button>
            </div>
            <!-- Sprint 22-4 V-3: action button group -->
            <div
              v-if="sha"
              class="flex items-center gap-1 border-l border-border pl-2"
            >
              <button
                type="button"
                class="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent/40"
                title="현재 HEAD 에 cherry-pick"
                @click="cd.onCherryPick"
              >
                🍒 Cherry-pick
              </button>
              <button
                type="button"
                class="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent/40"
                title="이 commit 을 revert (새 commit 생성)"
                @click="cd.onRevert"
              >
                ↩ Revert
              </button>
              <div class="flex items-center gap-0.5 rounded border border-border bg-muted/40 p-0.5">
                <select
                  v-model="cd.resetMode.value"
                  class="rounded bg-transparent px-1 text-[10px] text-muted-foreground focus:outline-none"
                  title="Reset 모드 선택"
                >
                  <option value="soft">soft</option>
                  <option value="mixed">mixed</option>
                  <option value="hard">hard ⚠</option>
                </select>
                <button
                  type="button"
                  class="rounded px-1.5 py-0.5 text-[11px] hover:bg-accent/40"
                  :class="cd.resetMode.value === 'hard' ? 'text-destructive' : ''"
                  title="HEAD reset to this commit"
                  @click="cd.onReset"
                >
                  ⏮ Reset
                </button>
              </div>
            </div>
            <button
              v-if="sha && cd.ai.available.value"
              type="button"
              class="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent/40 disabled:opacity-50"
              :disabled="cd.explainMut.isPending.value"
              :title="`✨ ${cd.ai.available.value} 로 설명`"
              @click="cd.explain"
            >
              ✨ {{ cd.explainMut.isPending.value ? '...' : '설명' }}
            </button>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground"
              aria-label="닫기"
              @click="$emit('close')"
            >
              ✕
            </button>
        </div>
      </div>
    </template>
    <div class="h-full">
          <p
            v-if="cd.error.value"
            class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs"
          >
            {{ describeError(cd.error.value) }}
          </p>
          <p
            v-else-if="!sha"
            class="p-6 text-center text-sm text-muted-foreground"
          >
            먼저 그래프에서 commit 을 선택하세요. (J/K 또는 클릭)
          </p>
          <DiffSplitView
            v-else-if="cd.data.value && isSplit"
            :patch="cd.data.value"
            class="h-full"
          />
          <DiffViewer v-else-if="cd.data.value" ref="diffRef" :patch="cd.data.value" class="h-full" />
    </div>
  </BaseModal>

  <AiResultModal
    :open="cd.explainOpen.value"
    title="Commit 설명"
    :content="cd.explainContent.value"
    :loading="cd.explainMut.isPending.value"
    :error="cd.explainError.value"
    @close="cd.explainOpen.value = false"
  />
</template>
