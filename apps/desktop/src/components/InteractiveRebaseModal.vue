<script setup lang="ts">
// Interactive rebase modal — `docs/plan/09 옵션 A` MVP.
//
// 사용자 흐름:
//   1. setup       : 마지막 N 개 commit (count) 선택
//   2. edit        : todo 리스트 — drag-drop reorder + 액션 select + reword textarea
//   3. running     : run 호출 후 결과/충돌 표시
//
// 트리거: `window.gitFriedOpenRebase()` (CommandPalette 등에서 호출).
//
// Sprint c63-B — flow state + 5 mutation + handlers 모두 useInteractiveRebaseFlow
// composable 위임. SFC 는 store→repoId 연결 + aiComposer 위임 + template 만.
import { computed, onMounted, onUnmounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { RebaseAction } from '@/api/git'
import { useReposStore } from '@/stores/repos'
// Sprint c34 god comp 14/N — AI Commit Composer 영역 분리.
import { useAiComposer } from '@/composables/useAiComposer'
// Sprint c63-B — IRR flow state + 5 mutation + handlers composable 위임.
import { useInteractiveRebaseFlow } from '@/composables/useInteractiveRebaseFlow'
import BaseModal from './BaseModal.vue'

const store = useReposStore()
const repoId = computed(() => store.activeRepoId)

const {
  open,
  step,
  count,
  todo,
  lastResult,
  status,
  prepareMut,
  runMut,
  continueMut,
  skipMut,
  abortMut,
  close,
  setAction,
  canRun,
  externalOpen,
} = useInteractiveRebaseFlow({ repoId: () => repoId.value })

// === Sprint c34 god 14/N — AI Commit Composer composable 위임 ===
const aiComp = useAiComposer({
  repoId: () => repoId.value,
  todo,
})
const ai = { available: aiComp.availableCli }
const composerMut = aiComp.generate

onMounted(() => {
  window.gitFriedOpenRebase = externalOpen
})
onUnmounted(() => {
  delete window.gitFriedOpenRebase
})
</script>

<template>
  <BaseModal
    :open="open"
    title="Interactive rebase"
    panel-class="max-h-[90vh] w-[720px]"
    max-width="full"
    @close="close"
  >
    <!-- step: setup -->
    <section v-if="step === 'setup'" class="flex flex-col gap-3 p-4">
      <p class="text-sm text-muted-foreground">마지막 몇 개 commit 을 편집할까요? (1 ~ 50)</p>
      <input
        v-model.number="count"
        type="number"
        min="1"
        max="50"
        class="w-32 rounded border border-border bg-background px-2 py-1 text-sm"
      />
      <p class="text-xs text-muted-foreground">
        진행 중 발생 가능: drop / reword / squash / fixup. 충돌 시 모달이 conflict 상태를
        표시합니다.
      </p>
      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          class="rounded border border-border px-3 py-1 text-sm hover:bg-accent/40"
          @click="close"
        >
          취소
        </button>
        <button
          type="button"
          class="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          :disabled="prepareMut.isPending.value || repoId == null"
          @click="prepareMut.mutate()"
        >
          {{ prepareMut.isPending.value ? '준비 중...' : '다음' }}
        </button>
      </div>
    </section>

    <!-- step: edit -->
    <section v-else-if="step === 'edit'" class="flex flex-1 flex-col overflow-hidden">
      <p class="border-b border-border bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
        드래그로 순서 변경 · 행마다 액션/메시지 편집 · 위쪽이 oldest, 아래쪽이 newest
      </p>
      <VueDraggable
        v-model="todo"
        tag="ul"
        class="flex-1 overflow-auto"
        handle=".rebase-drag"
        :animation="120"
      >
        <li
          v-for="(e, i) in todo"
          :key="e.sha"
          class="flex items-start gap-2 border-b border-border px-3 py-2"
        >
          <span class="rebase-drag mt-1 cursor-grab select-none text-muted-foreground"> ⋮⋮ </span>
          <select
            :value="e.action"
            class="rounded border border-border bg-background px-1 py-0.5 text-xs"
            :class="
              e.action === 'drop'
                ? 'text-danger-rose line-through'
                : e.action === 'reword'
                  ? 'text-blue-700 dark:text-blue-500'
                  : e.action === 'squash' || e.action === 'fixup'
                    ? 'text-warning-amber'
                    : ''
            "
            @change="setAction(i, ($event.target as HTMLSelectElement).value as RebaseAction)"
          >
            <option value="pick">pick</option>
            <option value="reword">reword</option>
            <option value="squash">squash</option>
            <option value="fixup">fixup</option>
            <option value="drop">drop</option>
          </select>
          <div class="min-w-0 flex-1">
            <div class="font-mono text-xs">
              <span class="text-muted-foreground">{{ e.sha.slice(0, 7) }}</span>
              <span class="ml-2 truncate">{{ e.subject }}</span>
            </div>
            <textarea
              v-if="e.action === 'reword'"
              v-model="e.newMessage"
              rows="3"
              placeholder="새 commit 메시지 (한글 OK, 빈 줄 후 본문)"
              class="mt-1.5 w-full rounded border border-blue-500/40 bg-background px-2 py-1 text-xs"
            />
          </div>
        </li>
      </VueDraggable>
      <footer class="flex justify-between gap-2 border-t border-border px-4 py-2">
        <button
          v-if="ai.available.value"
          type="button"
          class="rounded border border-border px-3 py-1 text-sm hover:bg-accent/40 disabled:opacity-50"
          :title="`✨ ${ai.available.value} 가 squash/reword/drop 제안`"
          :disabled="composerMut.isPending.value || todo.length === 0"
          @click="composerMut.mutate()"
        >
          ✨ {{ composerMut.isPending.value ? 'AI...' : 'AI 제안' }}
        </button>
        <span v-else />
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded border border-border px-3 py-1 text-sm hover:bg-accent/40"
            @click="step = 'setup'"
          >
            뒤로
          </button>
          <button
            type="button"
            class="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            :disabled="!canRun || runMut.isPending.value"
            @click="runMut.mutate()"
          >
            {{ runMut.isPending.value ? '실행 중...' : 'Run rebase' }}
          </button>
        </div>
      </footer>
    </section>

    <!-- step: result / conflict -->
    <section v-else-if="step === 'result'" class="flex flex-col gap-3 p-4">
      <div
        v-if="status?.inProgress"
        class="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
      >
        <p class="font-semibold text-warning-amber">
          Rebase 진행 중 (step {{ status.currentStep ?? '?' }} / {{ status.totalSteps ?? '?' }})
        </p>
        <p v-if="status.conflict" class="mt-1 text-xs">
          충돌 발생: <span class="font-mono">{{ status.stoppedAt?.slice(0, 7) }}</span
          >. 변경 패널 (⌘1) 에서 conflicted 파일을 해결한 후 [Continue] 클릭.
        </p>
        <p v-else class="mt-1 text-xs">사용자 개입 대기 중 (edit 액션 등).</p>
      </div>
      <div
        v-else-if="lastResult?.success"
        class="rounded border border-green-500/40 bg-green-500/10 p-3 text-sm text-diff-add"
      >
        ✔ Rebase 완료 ({{ todo.length }}개 commit 처리)
      </div>
      <div
        v-else
        class="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-danger-rose"
      >
        Rebase 실패 (exit {{ lastResult?.exitCode }})
      </div>

      <pre
        v-if="lastResult?.stderr"
        class="max-h-48 overflow-auto rounded border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground"
        >{{ lastResult.stderr }}</pre
      >

      <footer class="flex justify-end gap-2 pt-2">
        <template v-if="status?.inProgress">
          <button
            type="button"
            class="rounded border border-red-500/60 px-3 py-1 text-sm text-danger-rose hover:bg-red-500/10 disabled:opacity-50"
            :disabled="abortMut.isPending.value"
            @click="abortMut.mutate()"
          >
            Abort
          </button>
          <button
            type="button"
            class="rounded border border-border px-3 py-1 text-sm hover:bg-accent/40 disabled:opacity-50"
            :disabled="skipMut.isPending.value"
            @click="skipMut.mutate()"
          >
            Skip
          </button>
          <button
            type="button"
            class="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            :disabled="continueMut.isPending.value"
            @click="continueMut.mutate()"
          >
            {{ continueMut.isPending.value ? '...' : 'Continue' }}
          </button>
        </template>
        <button
          v-else
          type="button"
          class="rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90"
          @click="close"
        >
          닫기
        </button>
      </footer>
    </section>
  </BaseModal>
</template>
