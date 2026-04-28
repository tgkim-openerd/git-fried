<script setup lang="ts">
// Stash 매니저 — list / push / apply / pop / drop / show diff.
import { ref, watch } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useStash } from '@/composables/useStash'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import { clearWipNote, useWipNote } from '@/composables/useWipNote'
import { useSectionCollapse } from '@/composables/useSectionCollapse'

const collapsedNew = useSectionCollapse('stash.new')
import {
  aiStashMessage,
  applyStash,
  applyStashFile,
  dropStash,
  editStashMessage,
  popStash,
  pushStash,
  showStash,
} from '@/api/git'
import { parseDiffWithHunks } from '@/utils/parseDiff'
import { computed } from 'vue'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useAiCli, confirmAiSend, notifyAiDone } from '@/composables/useAiCli'
import { formatDateLocalized } from '@/composables/useUserSettings'
import DiffViewer from './DiffViewer.vue'

const toast = useToast()

const props = defineProps<{ repoId: number | null }>()
const { data: stashes } = useStash(() => props.repoId)
const invalidate = useInvalidateRepoQueries()

const newMessage = ref('')
const includeUntracked = ref(false)
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
    return pushStash(
      props.repoId,
      newMessage.value || null,
      includeUntracked.value,
    )
  },
  onSuccess: () => {
    newMessage.value = ''
    // Sprint J — stash 로 옮겨진 WIP 의도 → 그래프 상단 노트 클리어.
    if (props.repoId != null) clearWipNote(props.repoId)
    invalidate(props.repoId)
  },
  onError: (e) => toast.error('Stash push 실패', describeError(e)),
})

async function onApply(idx: number) {
  if (props.repoId == null) return
  await applyStash(props.repoId, idx).catch((e) =>
    toast.error('Apply 실패', describeError(e)),
  )
  invalidate(props.repoId)
}
async function onPop(idx: number) {
  if (props.repoId == null) return
  await popStash(props.repoId, idx).catch((e) => toast.error('Pop 실패', describeError(e)))
  invalidate(props.repoId)
}
async function onDrop(idx: number) {
  if (props.repoId == null) return
  if (!confirm(`stash@{${idx}} 를 삭제하시겠습니까?`)) return
  await dropStash(props.repoId, idx).catch((e) => toast.error('Drop 실패', describeError(e)))
  invalidate(props.repoId)
}
async function onShow(idx: number) {
  if (props.repoId == null) return
  previewIndex.value = idx
  previewText.value = await showStash(props.repoId, idx).catch((e) => describeError(e))
}

// === Sprint C14 D2 (`docs/plan/14 §5 D2`) — stash 메시지 수정 ===
async function onEditMessage(idx: number, current: string) {
  if (props.repoId == null) return
  const next = window.prompt(
    `stash@{${idx}} 새 메시지\n(저장 시 새 entry 가 stash@{0} 으로 이동, 원본은 drop)`,
    current,
  )
  if (next == null) return
  const trimmed = next.trim()
  if (!trimmed || trimmed === current) return
  await editStashMessage(props.repoId, idx, trimmed)
    .then(() => {
      toast.success('Stash 메시지 변경', '새 entry 가 stash@{0} 입니다.')
      invalidate(props.repoId)
    })
    .catch((e) => toast.error('메시지 변경 실패', describeError(e)))
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
      toast.success('파일 apply', `${path} 만 working tree 에 적용됨`)
      invalidate(props.repoId)
    })
    .catch((e) => toast.error('파일 apply 실패', describeError(e)))
}

// === AI stash message (Sprint B7) ===
const ai = useAiCli()
const aiMut = useMutation({
  mutationFn: () => {
    if (props.repoId == null || ai.available.value == null) {
      return Promise.reject(new Error('AI 사용 불가 — Claude/Codex CLI 미설치'))
    }
    if (!confirmAiSend()) return Promise.reject(new Error('cancelled'))
    return aiStashMessage(
      props.repoId,
      ai.available.value,
      includeUntracked.value,
      true,
    )
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
      title="우클릭 = 새 stash 폼 접기/펴기"
      @contextmenu.prevent="collapsedNew = !collapsedNew"
    >
      <h3 class="text-sm font-semibold">
        Stash
        <span
          v-if="collapsedNew"
          class="ml-1 text-[10px] font-normal text-muted-foreground"
        >
          (새 stash 폼 접힘 — 우클릭으로 펴기)
        </span>
      </h3>
    </header>

    <!-- 새 stash -->
    <div
      v-if="!collapsedNew"
      class="flex flex-col gap-1 border-b border-border px-3 py-2"
    >
      <div class="flex gap-1">
        <input
          v-model="newMessage"
          placeholder="메시지 (선택, ✨ 로 자동 생성)"
          class="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
        <button
          v-if="ai.available.value"
          type="button"
          class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
          :title="`✨ ${ai.available.value} 로 stash 메시지 생성`"
          :disabled="!repoId || aiMut.isPending.value"
          @click="aiMut.mutate()"
        >
          ✨ {{ aiMut.isPending.value ? '...' : 'AI' }}
        </button>
      </div>
      <div class="flex items-center justify-between text-xs">
        <label class="flex items-center gap-1">
          <input v-model="includeUntracked" type="checkbox" />
          untracked 포함 (-u)
        </label>
        <button
          type="button"
          class="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
          :disabled="!repoId || pushMut.isPending.value"
          @click="pushMut.mutate()"
        >
          stash push
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto px-2 py-2 text-sm">
      <ul>
        <li
          v-for="s in stashes"
          :key="s.index"
          class="group rounded px-2 py-1 hover:bg-accent/40"
        >
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
            <button
              class="hover:underline"
              title="메시지 수정 (`docs/plan/14 §5 D2`)"
              :aria-label="`stash@{${s.index}} 메시지 수정`"
              @click="onEditMessage(s.index, s.message)"
            >
              edit msg
            </button>
            <button
              class="hover:underline text-destructive"
              :aria-label="`stash@{${s.index}} 삭제`"
              @click="onDrop(s.index)"
            >
              drop
            </button>
          </div>
        </li>
        <li
          v-if="stashes && stashes.length === 0"
          class="px-2 py-3 text-center text-xs text-muted-foreground"
        >
          stash 없음
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
          <span v-if="previewFiles.length > 0">
            ({{ previewFiles.length }} files)
          </span>
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
            title="이 파일만 working tree 에 apply"
            @click="onApplyFile(f.fileName)"
          >
            ✓ 이 파일만 apply
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
