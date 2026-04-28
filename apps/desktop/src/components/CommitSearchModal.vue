<script setup lang="ts">
// Sprint F-P5 — Commit message 검색 modal (`git log --grep` 동등).
//
// ⌘⇧F 단축키 / CommandPalette 의 'Commit message 검색' 명령으로 진입.
// 입력 → 300ms debounce → search_commits_by_message IPC → 결과 list 표시.
// 결과 클릭 → SHA 클립보드 복사 + toast (graph navigate 통합은 follow-up).

import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useReposStore } from '@/stores/repos'
import { searchCommitsByMessage } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import type { CommitSummary } from '@/types/git'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useReposStore()
const toast = useToast()

const query = ref('')
const caseInsensitive = ref(true)
const isLoading = ref(false)
const results = ref<readonly CommitSummary[]>([])
const errorMsg = ref<string | null>(null)
const selectedIdx = ref(0)
const inputRef = useTemplateRef<HTMLInputElement>('inputRef')

let debounceHandle: ReturnType<typeof setTimeout> | null = null

const trimmedQuery = computed(() => query.value.trim())

watch(
  () => props.open,
  async (open) => {
    if (open) {
      query.value = ''
      results.value = []
      errorMsg.value = null
      selectedIdx.value = 0
      await nextTick()
      inputRef.value?.focus()
    } else if (debounceHandle) {
      clearTimeout(debounceHandle)
      debounceHandle = null
    }
  },
  { immediate: true },
)

watch([trimmedQuery, caseInsensitive], () => {
  if (debounceHandle) clearTimeout(debounceHandle)
  errorMsg.value = null
  if (!trimmedQuery.value) {
    results.value = []
    isLoading.value = false
    return
  }
  if (store.activeRepoId == null) {
    errorMsg.value = '먼저 레포를 선택하세요.'
    return
  }
  isLoading.value = true
  debounceHandle = setTimeout(async () => {
    const repoId = store.activeRepoId
    if (repoId == null) return
    try {
      results.value = await searchCommitsByMessage(repoId, trimmedQuery.value, {
        limit: 50,
        caseInsensitive: caseInsensitive.value,
      })
      selectedIdx.value = 0
    } catch (e) {
      errorMsg.value = describeError(e)
      results.value = []
    } finally {
      isLoading.value = false
    }
  }, 300)
})

async function copySha(sha: string) {
  try {
    await navigator.clipboard.writeText(sha)
    toast.success('SHA 복사', sha.slice(0, 12))
  } catch (e) {
    toast.error('복사 실패', describeError(e))
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIdx.value = Math.min(results.value.length - 1, selectedIdx.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIdx.value = Math.max(0, selectedIdx.value - 1)
  } else if (e.key === 'Enter') {
    const r = results.value[selectedIdx.value]
    if (r) {
      e.preventDefault()
      void copySha(r.sha)
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20"
      @click.self="emit('close')"
    >
      <div
        role="dialog"
        aria-label="Commit message 검색"
        class="flex w-full max-w-2xl flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-2xl"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold">Commit message 검색</h2>
          <label class="flex items-center gap-1 text-[11px] opacity-80">
            <input v-model="caseInsensitive" type="checkbox" />
            대소문자 무시
          </label>
        </div>

        <input
          ref="inputRef"
          v-model="query"
          type="text"
          placeholder="검색어 (subject + body — git log --grep 동등)"
          class="rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        <div class="min-h-[200px] max-h-[60vh] overflow-y-auto rounded-md border border-border">
          <div v-if="errorMsg" class="px-3 py-4 text-xs text-red-400">
            {{ errorMsg }}
          </div>
          <div v-else-if="isLoading" class="px-3 py-4 text-xs opacity-60">검색 중...</div>
          <div v-else-if="!trimmedQuery" class="px-3 py-4 text-xs opacity-60">
            검색어를 입력하세요. Enter = SHA 복사, ↑↓ = 선택, Esc = 닫기.
          </div>
          <div v-else-if="results.length === 0" class="px-3 py-4 text-xs opacity-60">
            "{{ trimmedQuery }}" 매칭 commit 없음.
          </div>
          <ul v-else class="divide-y divide-border">
            <li
              v-for="(r, i) in results"
              :key="r.sha"
              :class="[
                'flex cursor-pointer items-start gap-2 px-3 py-2 text-xs hover:bg-accent/40',
                selectedIdx === i ? 'bg-accent/60' : '',
              ]"
              @click="copySha(r.sha)"
              @mouseenter="selectedIdx = i"
            >
              <span class="font-mono text-[10px] opacity-70">{{ r.shortSha }}</span>
              <div class="flex-1">
                <div class="line-clamp-2 leading-snug">{{ r.subject }}</div>
                <div class="mt-0.5 text-[10px] opacity-60">
                  {{ r.authorName }} · {{ new Date(r.authorAt * 1000).toLocaleString() }}
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div class="flex items-center justify-between text-[10px] opacity-60">
          <span>{{ results.length }}개 결과 (max 50)</span>
          <span>Enter = SHA 복사 · Esc = 닫기</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
