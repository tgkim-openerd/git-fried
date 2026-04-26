<script setup lang="ts">
// Stash 매니저 — list / push / apply / pop / drop / show diff.
import { ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useStash } from '@/composables/useStash'
import { useInvalidateRepoQueries } from '@/composables/useStatus'
import {
  aiStashMessage,
  applyStash,
  dropStash,
  popStash,
  pushStash,
  showStash,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useAiCli, confirmAiSend } from '@/composables/useAiCli'

const toast = useToast()

const props = defineProps<{ repoId: number | null }>()
const { data: stashes } = useStash(() => props.repoId)
const invalidate = useInvalidateRepoQueries()

const newMessage = ref('')
const includeUntracked = ref(false)
const previewText = ref<string | null>(null)
const previewIndex = ref<number | null>(null)

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
    <header class="border-b border-border px-3 py-2">
      <h3 class="text-sm font-semibold">Stash</h3>
    </header>

    <!-- 새 stash -->
    <div class="flex flex-col gap-1 border-b border-border px-3 py-2">
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
              {{ new Date(s.createdAt * 1000).toLocaleString('ko-KR') }}
            </span>
          </div>
          <div class="truncate text-xs">{{ s.message }}</div>
          <div class="mt-1 flex gap-1 text-[11px]">
            <button class="hover:underline" @click="onShow(s.index)">show</button>
            <button class="hover:underline" @click="onApply(s.index)">apply</button>
            <button class="hover:underline" @click="onPop(s.index)">pop</button>
            <button class="hover:underline text-destructive" @click="onDrop(s.index)">
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

    <!-- 미리보기 (추후 DiffViewer 로 교체) -->
    <div
      v-if="previewText !== null"
      class="max-h-60 overflow-auto border-t border-border bg-muted/30 px-2 py-1"
    >
      <div class="mb-1 flex items-center justify-between">
        <span class="text-xs text-muted-foreground">stash@{{ '{' }}{{ previewIndex }}{{ '}' }} diff</span>
        <button class="text-xs" @click="previewText = null">×</button>
      </div>
      <pre class="font-mono text-[11px]">{{ previewText }}</pre>
    </div>
  </section>
</template>
