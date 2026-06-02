<script setup lang="ts">
// Stash 매니저 — list / push / apply / pop / drop / show diff.
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@tanstack/vue-query'
import { useStash } from '@/composables/useStash'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { clearWipNote, useWipNote } from '@/composables/useWipNote'
import { useSectionCollapse } from '@/composables/useSectionCollapse'

const collapsedNew = useSectionCollapse('stash.new')
const { t } = useI18n()
import { pushStash, pushStashStaged } from '@/api/git'
import { parseDiffWithHunks } from '@/utils/parseDiff'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
// Sprint c79-D — 6 simple action + AI stash mutation 통합 composable 위임.
import { useStashPanelActions } from '@/composables/useStashPanelActions'
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

// c79-D — 6 simple action + AI stash mutation composable 위임.
const { ai, aiMut, onApply, onPop, onDrop, onShow, onStashToBranch, onEditMessage, onApplyFile } =
  useStashPanelActions({
    repoId: () => props.repoId,
    previewText,
    previewIndex,
    newMessage,
    includeUntracked,
  })

const previewFiles = computed(() =>
  previewText.value == null ? [] : parseDiffWithHunks(previewText.value),
)
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
        <span v-if="collapsedNew" class="ml-1 text-3xs font-normal text-muted-foreground">
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
            <span class="text-3xs text-muted-foreground">
              {{ formatDateLocalized(s.createdAt) }}
            </span>
          </div>
          <div class="truncate text-xs">{{ s.message }}</div>
          <div class="mt-1 flex gap-1 text-xs">
            <button
              class="rounded px-2 py-1 min-h-[24px] hover:bg-accent/40"
              :aria-label="`stash@{${s.index}} diff 보기`"
              @click="onShow(s.index)"
            >
              show
            </button>
            <button
              class="rounded px-2 py-1 min-h-[24px] hover:bg-accent/40"
              :aria-label="`stash@{${s.index}} apply (working tree 에 적용)`"
              @click="onApply(s.index)"
            >
              apply
            </button>
            <button
              class="rounded px-2 py-1 min-h-[24px] hover:bg-accent/40"
              :aria-label="`stash@{${s.index}} pop (apply + 제거)`"
              @click="onPop(s.index)"
            >
              pop
            </button>
            <!-- Sprint c38 / plan/29 E3 — stash → 새 브랜치로 복원. -->
            <button
              class="rounded px-2 py-1 min-h-[24px] hover:bg-accent/40"
              :title="t('stash.toBranchTitle')"
              :aria-label="t('stash.toBranchAria', { idx: s.index })"
              @click="onStashToBranch(s.index)"
            >
              → branch
            </button>
            <button
              class="rounded px-2 py-1 min-h-[24px] hover:bg-accent/40"
              :title="t('stash.editMessageButtonTitle')"
              :aria-label="t('stash.editMessageTitle', { idx: s.index })"
              @click="onEditMessage(s.index, s.message)"
            >
              edit msg
            </button>
            <button
              class="rounded px-2 py-1 min-h-[24px] text-destructive hover:bg-destructive/10"
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
        <button
          type="button"
          class="flex items-center justify-center rounded min-h-[24px] min-w-[24px] p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          :aria-label="t('stash.closePreviewAria')"
          :title="t('stash.closePreviewTitle')"
          @click="previewText = null"
        >
          ×
        </button>
      </div>
      <ul v-if="previewFiles.length > 0" class="mb-2 space-y-0.5">
        <li
          v-for="f in previewFiles"
          :key="f.fileName"
          class="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40"
        >
          <span class="flex-1 truncate font-mono text-2xs">{{ f.fileName }}</span>
          <span class="text-3xs text-muted-foreground">
            {{ f.hunks.length }} hunk{{ f.hunks.length === 1 ? '' : 's' }}
          </span>
          <button
            type="button"
            class="rounded border border-border px-2 py-1 min-h-[24px] text-xs hover:bg-accent/60"
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
      <details class="text-2xs" open>
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
