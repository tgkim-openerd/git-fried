<script setup lang="ts">
// plan #44 E1 — Global unified search (SHA / branch / commit message / file content).
//
// ⌘⇧K 단축키 또는 CommandPalette 'Global search' 명령으로 진입 (self-contained —
// CommandPalette 와 동일하게 자체 open ref + window keydown + window.gitFriedOpenGlobalSearch hook).
// 입력 → 300ms debounce → unified_search IPC → kind 별 결과. BaseModal wrap 로 stack/focus-trap/Esc.
//
// 결과 활성화 (Enter / click):
//   fileContent → fullscreen file view 로 파일 열기 (working tree)
//   sha / commitMessage → SHA 클립보드 복사 (CommitSearchModal 와 동일 패턴)
//   branch → 브랜치명 클립보드 복사

import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useReposStore } from '@/stores/repos'
import { unifiedSearch, type SearchScope, type UnifiedSearchHit } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useFullscreenDiff } from '@/composables/useFullscreenDiff'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

const { t } = useI18n()
const store = useReposStore()
const toast = useToast()
const fsDiff = useFullscreenDiff()

const searchOpen = ref<boolean>(false)
const query = ref<string>('')
const isLoading = ref<boolean>(false)
const results = ref<UnifiedSearchHit[]>([])
const errorMsg = ref<string | null>(null)
const selectedIdx = ref<number>(0)
const inputRef = useTemplateRef<HTMLInputElement>('inputRef')

let debounceHandle: ReturnType<typeof setTimeout> | null = null
// E1 (Codex MED fix) — request 시퀀스 가드: out-of-order 응답 / 검색 중 repo 변경 시 stale 차단.
let searchSeq = 0
const trimmedQuery = computed<string>(() => query.value.trim())

function openModal() {
  searchOpen.value = true
  query.value = ''
  results.value = []
  errorMsg.value = null
  selectedIdx.value = 0
  // BaseModal focus-trap 이 첫 focusable(헤더 ✕)을 seed 하므로, 그 이후(macrotask)에 input 으로
  // focus 이동 — search 모달은 열리자마자 즉시 입력 가능해야 함.
  setTimeout(() => inputRef.value?.focus(), 80)
}

function closeSearch() {
  searchOpen.value = false
}

// query 또는 active repo 변경 시 재검색 (repo 변경도 watch 소스 → 새 repo 결과로 갱신).
watch([trimmedQuery, () => store.activeRepoId], () => {
  if (debounceHandle) clearTimeout(debounceHandle)
  errorMsg.value = null
  if (!trimmedQuery.value) {
    results.value = []
    isLoading.value = false
    return
  }
  if (store.activeRepoId == null) {
    errorMsg.value = '먼저 레포를 선택하세요.'
    results.value = []
    return
  }
  isLoading.value = true
  debounceHandle = setTimeout(async () => {
    const repoId = store.activeRepoId
    if (repoId == null) return
    const seq = ++searchSeq
    try {
      const hits = await unifiedSearch(repoId, trimmedQuery.value, {
        scope: 'unified',
        limit: 50,
      })
      if (seq !== searchSeq) return // 더 새로운 검색 시작됨 → stale 응답 무시
      results.value = hits
      selectedIdx.value = 0
    } catch (e) {
      if (seq !== searchSeq) return
      errorMsg.value = describeError(e)
      results.value = []
    } finally {
      if (seq === searchSeq) isLoading.value = false
    }
  }, 300)
})

function kindIcon(k: SearchScope): string {
  switch (k) {
    case 'sha':
      return '🔖'
    case 'branch':
      return '🌿'
    case 'commitMessage':
      return '✎'
    case 'fileContent':
      return '📄'
    default:
      return '·'
  }
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(t('toast.copied'), label)
  } catch (e) {
    toast.error(t('errors.copyFailed'), describeError(e))
  }
}

function activate(hit: UnifiedSearchHit) {
  if (hit.kind === 'fileContent' && hit.path) {
    // 파일을 fullscreen file view 로 열기 (working tree). 핵심 nav.
    fsDiff.openWip(hit.path, false)
    searchOpen.value = false
  } else if (hit.sha) {
    void copy(hit.sha, hit.sha.slice(0, 12))
  } else if (hit.kind === 'branch') {
    void copy(hit.label, hit.label)
  }
}

function onKeydown(e: KeyboardEvent) {
  // ⌘⇧K / Ctrl⇧K toggle
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (searchOpen.value) searchOpen.value = false
    else openModal()
    return
  }
  if (!searchOpen.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIdx.value = Math.min(results.value.length - 1, selectedIdx.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIdx.value = Math.max(0, selectedIdx.value - 1)
  } else if (e.key === 'Enter') {
    const r = results.value[selectedIdx.value]
    if (r) {
      e.preventDefault()
      activate(r)
    }
  }
  // Esc 는 BaseModal 이 처리 (stack-top gate).
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.gitFriedOpenGlobalSearch = openModal
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  delete window.gitFriedOpenGlobalSearch
  if (debounceHandle) clearTimeout(debounceHandle)
})
</script>

<template>
  <BaseModal
    :open="searchOpen"
    title="통합 검색 (Global search)"
    max-width="2xl"
    align="top"
    @close="closeSearch"
  >
    <input
      ref="inputRef"
      v-model="query"
      type="text"
      placeholder="검색어 — SHA / 브랜치 / 커밋 메시지 / 파일 내용 통합"
      aria-label="통합 검색 입력"
      class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
    />

    <div class="mt-3 min-h-[200px] max-h-[60vh] overflow-y-auto rounded-md border border-border">
      <div v-if="errorMsg" class="px-3 py-4 text-xs text-destructive">{{ errorMsg }}</div>
      <div v-else-if="isLoading" class="px-3 py-4 text-xs opacity-60">
        {{ t('common.searching') }}
      </div>
      <div v-else-if="!trimmedQuery" class="px-3 py-4 text-xs opacity-60">
        검색어를 입력하세요. Enter = 열기 / SHA 복사, ↑↓ = 선택, Esc = 닫기.
      </div>
      <div v-else-if="results.length === 0" class="px-3 py-4 text-xs opacity-60">
        "{{ trimmedQuery }}" 매칭 결과 없음.
      </div>
      <ul v-else class="divide-y divide-border">
        <li
          v-for="(r, i) in results"
          :key="`${r.kind}-${i}-${r.label}`"
          role="button"
          :tabindex="0"
          :aria-label="`${r.kind}: ${r.label}`"
          :class="[
            'flex cursor-pointer items-start gap-2 px-3 py-2 text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selectedIdx === i ? 'bg-accent/60' : '',
          ]"
          @click="activate(r)"
          @keydown.enter="activate(r)"
          @keydown.space.prevent="activate(r)"
          @mouseenter="selectedIdx = i"
        >
          <span class="shrink-0" :title="r.kind">{{ kindIcon(r.kind) }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate font-medium">{{ r.label }}</span>
              <span v-if="r.line" class="shrink-0 font-mono text-3xs opacity-60"
                >:{{ r.line }}</span
              >
            </div>
            <div v-if="r.detail" class="truncate text-3xs opacity-60">{{ r.detail }}</div>
          </div>
        </li>
      </ul>
    </div>

    <div class="mt-2 flex items-center justify-between text-3xs opacity-60">
      <span>{{ results.length }}개 결과 (max 50)</span>
      <span>파일 = 열기 · commit/SHA = 복사 · ⌘⇧K 토글</span>
    </div>
  </BaseModal>
</template>
