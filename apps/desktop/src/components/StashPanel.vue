<script setup lang="ts">
// Stash 매니저 — list / push / apply / pop / drop / show diff.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@tanstack/vue-query'
import { useStash } from '@/composables/useStash'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { clearWipNote, useWipNote } from '@/composables/useWipNote'
import { useSectionCollapse } from '@/composables/useSectionCollapse'

const collapsedNew = useSectionCollapse('stash.new')
const { t } = useI18n()
import {
  aiStashMessage,
  applyStash,
  applyStashFile,
  dropStash,
  editStashMessage,
  popStash,
  pushStash,
  pushStashStaged,
  showStash,
  stashToBranch,
} from '@/api/git'
import { parseDiffWithHunks } from '@/utils/parseDiff'
import { computed } from 'vue'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
// Sprint c38 fix MED-1 — promptDialog 추가 import (window.prompt 2곳 마이그).
import { confirmDialog, promptDialog } from '@/composables/useConfirm'
import { formatDateLocalized } from '@/composables/useUserSettings'
import DiffViewer from './DiffViewer.vue'
import EmptyState from './EmptyState.vue'
import SkeletonBlock from './SkeletonBlock.vue'

const toast = useToast()

const props = defineProps<{ repoId: number | null }>()
const { data: stashes, isFetching: stashFetching } = useStash(() => props.repoId)
const invalidate = useInvalidateRepoQueries()

const newMessage = ref('')
const includeUntracked = ref(false)
// Sprint c38 / plan/29 E3 — Smart Stash: stage-only stash 모드 (Git 2.35+ `-S`).
// false = 기존 동작 (인덱스+워킹트리 모두 stash), true = staged-only (`push -S`).
const stagedOnly = ref(false)
const previewText = ref<string | null>(null)
const previewIndex = ref<number | null>(null)

// Sprint J — WIP 노트 prefill: 빈 입력 + repo 변경 시 wipNote 값으로 채움.
watch(
  () => props.repoId,
  (id) => {
    if (id == null) return
    const wip = useWipNote(id)
    if (!newMessage.value && wip.value) newMessage.value = wip.value
  },
  { immediate: true },
)

const pushMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null) return Promise.reject(new Error('no repo'))
    // Sprint c38 / plan/29 E3 — staged-only 모드는 -u 와 양립 불가 (인덱스만 대상).
    if (stagedOnly.value) {
      return pushStashStaged(props.repoId, newMessage.value || null)
    }
    return pushStash(props.repoId, newMessage.value || null, includeUntracked.value)
  },
  onSuccess: () => {
    newMessage.value = ''
    // Sprint J — stash 로 옮겨진 WIP 의도 → 그래프 상단 노트 클리어.
    if (props.repoId != null) clearWipNote(props.repoId)
    invalidate(props.repoId)
  },
  onError: (e) => toast.error(t('stash.pushFailed'), describeError(e)),
})

// Sprint c38 / plan/29 E3 — stash → 새 브랜치 (`git stash branch <name> stash@{n}`).
// Sprint c38 fix MED-1 — promptDialog (a11y + 한글 IME).
async function onStashToBranch(idx: number) {
  if (props.repoId == null) return
  const name = await promptDialog({
    title: t('stash.branchPromptTitle'),
    message: t('stash.branchPromptMessage'),
    defaultValue: `stash-${idx}-recover`,
  })
  if (name === null) return
  const trimmed = name.trim()
  if (!trimmed) return
  await stashToBranch(props.repoId, idx, trimmed)
    .then(() => {
      toast.success(t('stash.branchSuccess'), trimmed)
      invalidate(props.repoId)
    })
    .catch((e) => toast.error(t('stash.branchFailed'), describeError(e)))
}

async function onApply(idx: number) {
  if (props.repoId == null) return
  await applyStash(props.repoId, idx).catch((e) => toast.error('Apply 실패', describeError(e)))
  invalidate(props.repoId)
}
async function onPop(idx: number) {
  if (props.repoId == null) return
  await popStash(props.repoId, idx).catch((e) => toast.error('Pop 실패', describeError(e)))
  invalidate(props.repoId)
}
async function onDrop(idx: number) {
  if (props.repoId == null) return
  const ok = await confirmDialog({
    title: t('confirm.deleteStashTitle'),
    message: t('confirm.deleteStashMessage', { idx }),
    danger: true,
  })
  if (!ok) return
  await dropStash(props.repoId, idx).catch((e) => toast.error('Drop 실패', describeError(e)))
  invalidate(props.repoId)
}
async function onShow(idx: number) {
  if (props.repoId == null) return
  previewIndex.value = idx
  previewText.value = await showStash(props.repoId, idx).catch((e) => describeError(e))
}

// === Sprint C14 D2 (`docs/plan/14 §5 D2`) — stash 메시지 수정 ===
// Sprint c38 fix MED-1 — window.prompt → promptDialog + i18n.
async function onEditMessage(idx: number, current: string) {
  if (props.repoId == null) return
  const next = await promptDialog({
    title: t('stash.editMessageTitle', { idx }),
    message: t('stash.editMessageMessage'),
    defaultValue: current,
  })
  if (next === null) return
  const trimmed = next.trim()
  if (!trimmed || trimmed === current) return
  await editStashMessage(props.repoId, idx, trimmed)
    .then(() => {
      toast.success(t('stash.editMessageSuccess'), t('stash.editMessageSuccessDetail'))
      invalidate(props.repoId)
    })
    .catch((e) => toast.error(t('stash.editMessageFailed'), describeError(e)))
}

// === Sprint C2 (`docs/plan/14 §5 D1`) — stash 안 단일 파일만 apply ===
const previewFiles = computed(() => {
  if (previewText.value == null) return []
  return parseDiffWithHunks(previewText.value)
})
async function onApplyFile(path: string) {
  if (props.repoId == null || previewIndex.value == null) return
  await applyStashFile(props.repoId, previewIndex.value, path)
    .then(() => {
      toast.success(t('toast.fileApply'), `${path} 만 working tree 에 적용됨`)
      invalidate(props.repoId)
    })
    .catch((e) => toast.error(t('errors.fileApplyFailed'), describeError(e)))
}

// === AI stash message (Sprint B7) ===
const ai = useAiCli()
const aiMut = useMutation({
  mutationFn: async () => {
    if (props.repoId == null || ai.available.value == null) {
      throw new Error('AI 사용 불가 — Claude/Codex CLI 미설치')
    }
    if (!(await confirmAiSend())) throw new Error('cancelled')
    return aiStashMessage(props.repoId, ai.available.value, includeUntracked.value, true)
  },
  onSuccess: (out) => {
    if (out.success) {
      // 첫 줄만 사용 (한 줄 prompt 응답).
      newMessage.value = out.text.trim().split(/\r?\n/)[0] ?? ''
      notifyAiDone('AI stash 메시지', newMessage.value)
    } else {
      toast.error('AI 응답 실패', out.stderr || out.text)
    }
  },
  onError: (e) => {
    const m = describeError(e)
    if (m.includes('cancelled')) return
    toast.error('AI 호출 실패', m)
  },
})
</script>

<template>
  <section class="flex h-full flex-col border-l border-border bg-card">
    <header
      class="cursor-pointer select-none border-b border-border px-3 py-2"
      :title="t('stash.newFormToggleHint')"
      @contextmenu.prevent="collapsedNew = !collapsedNew"
    >
      <h3 class="text-sm font-semibold">
        {{ t('stash.title') }}
        <span v-if="collapsedNew" class="ml-1 text-[10px] font-normal text-muted-foreground">
          {{ t('stash.newFormCollapsed') }}
        </span>
      </h3>
    </header>

    <!-- 새 stash -->
    <div v-if="!collapsedNew" class="flex flex-col gap-1 border-b border-border px-3 py-2">
      <div class="flex gap-1">
        <input
          v-model="newMessage"
          :placeholder="t('stash.messagePlaceholder')"
          class="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
        <button
          v-if="ai.available.value"
          type="button"
          class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
          :title="t('stash.aiButtonTitle', { cli: ai.available.value })"
          :disabled="!repoId || aiMut.isPending.value"
          @click="aiMut.mutate()"
        >
          ✨ {{ aiMut.isPending.value ? '...' : 'AI' }}
        </button>
      </div>
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1">
            <input v-model="includeUntracked" type="checkbox" :disabled="stagedOnly" />
            {{ t('stash.includeUntracked') }}
          </label>
          <!-- Sprint c38 / plan/29 E3 — staged-only stash (Git 2.35+ `-S`). -->
          <label class="flex items-center gap-1" :title="t('stash.stagedOnlyTitle')">
            <input v-model="stagedOnly" type="checkbox" />
            {{ t('stash.stagedOnly') }}
          </label>
        </div>
        <button
          type="button"
          class="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
          :disabled="!repoId || pushMut.isPending.value"
          @click="pushMut.mutate()"
        >
          {{ t('stash.pushButton') }}
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto px-2 py-2 text-sm">
      <ul>
        <li v-for="s in stashes" :key="s.index" class="group rounded px-2 py-1 hover:bg-accent/40">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs">stash@{{ '{' }}{{ s.index }}{{ '}' }}</span>
            <span class="text-[10px] text-muted-foreground">
              {{ formatDateLocalized(s.createdAt) }}
            </span>
          </div>
          <div class="truncate text-xs">{{ s.message }}</div>
          <div class="mt-1 flex gap-1 text-[11px]">
            <button
              class="hover:underline"
              :aria-label="`stash@{${s.index}} diff 보기`"
              @click="onShow(s.index)"
            >
              show
            </button>
            <button
              class="hover:underline"
              :aria-label="`stash@{${s.index}} apply (working tree 에 적용)`"
              @click="onApply(s.index)"
            >
              apply
            </button>
            <button
              class="hover:underline"
              :aria-label="`stash@{${s.index}} pop (apply + 제거)`"
              @click="onPop(s.index)"
            >
              pop
            </button>
            <!-- Sprint c38 / plan/29 E3 — stash → 새 브랜치로 복원. -->
            <button
              class="hover:underline"
              :title="t('stash.toBranchTitle')"
              :aria-label="t('stash.toBranchAria', { idx: s.index })"
              @click="onStashToBranch(s.index)"
            >
              → branch
            </button>
            <button
              class="hover:underline"
              :title="t('stash.editMessageButtonTitle')"
              :aria-label="t('stash.editMessageTitle', { idx: s.index })"
              @click="onEditMessage(s.index, s.message)"
            >
              edit msg
            </button>
            <button
              class="hover:underline text-destructive"
              :aria-label="t('stash.dropAria', { idx: s.index })"
              @click="onDrop(s.index)"
            >
              drop
            </button>
          </div>
        </li>
        <!-- Sprint 22-18 — 첫 로딩 skeleton + empty state visual -->
        <li v-if="stashFetching && !stashes" class="px-1 pt-2">
          <SkeletonBlock :count="3" height="md" />
        </li>
        <li v-else-if="stashes && stashes.length === 0">
          <EmptyState icon="📦" :title="t('stash.empty')" size="sm" />
        </li>
      </ul>
    </div>

    <!-- 미리보기 — 파일별 apply 가능 (Sprint C2 / `docs/plan/14 §5 D1`) -->
    <div
      v-if="previewText !== null"
      class="max-h-72 overflow-auto border-t border-border bg-muted/30 px-2 py-1"
    >
      <div class="mb-1 flex items-center justify-between">
        <span class="text-xs text-muted-foreground">
          stash@{{ '{' }}{{ previewIndex }}{{ '}' }} diff
          <span v-if="previewFiles.length > 0"> ({{ previewFiles.length }} files) </span>
        </span>
        <button class="text-xs" @click="previewText = null">×</button>
      </div>
      <ul v-if="previewFiles.length > 0" class="mb-2 space-y-0.5">
        <li
          v-for="f in previewFiles"
          :key="f.fileName"
          class="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
        >
          <span class="flex-1 truncate font-mono text-[11px]">{{ f.fileName }}</span>
          <span class="text-[10px] text-muted-foreground">
            {{ f.hunks.length }} hunk{{ f.hunks.length === 1 ? '' : 's' }}
          </span>
          <button
            type="button"
            class="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent/60"
            :title="t('stash.applyFileTitle')"
            @click="onApplyFile(f.fileName)"
          >
            {{ t('stash.applyFileButton') }}
          </button>
        </li>
      </ul>
      <!-- Sprint 22-9 V-8 — raw <pre> → CodeMirror DiffViewer 로 교체 (V-5 StatusPanel 패턴 일치).
           Diff mode toggle (compact/default/split) 은 showStash IPC 의 contextLines 파라미터 추가 필요 → v0.2 단계.
      -->
      <details class="text-[11px]" open>
        <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
          unified diff (CodeMirror)
        </summary>
        <div class="mt-1 max-h-80 overflow-auto rounded border border-border">
          <DiffViewer :patch="previewText" />
        </div>
      </details>
    </div>
  </section>
</template>
