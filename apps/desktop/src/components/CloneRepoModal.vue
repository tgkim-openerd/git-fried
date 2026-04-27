<script setup lang="ts">
// Clone with options modal — `docs/plan/14 §6 E1+E2` Sprint C14-2.
//
// 기본: URL + 부모 폴더 + 폴더명. 고급 옵션 expand 시 sparse-checkout / shallow / single-branch.
// auto_register=true 면 clone 후 자동으로 git-fried workspace 에 add_repo.
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { cloneRepo, type CloneOptions } from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ open: boolean; workspaceId: number | null }>()
const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const qc = useQueryClient()

const url = ref('')
const parentPath = ref('')
const folderName = ref('')
const showAdvanced = ref(false)

// sparse paths 입력은 1줄 1path
const sparseText = ref('')
const depth = ref<number | null>(null)
const shallowSince = ref('')
const singleBranch = ref('')
const bare = ref(false)

const targetPath = computed(() => {
  const p = parentPath.value.trim().replace(/[/\\]+$/, '')
  const f = folderName.value.trim()
  if (!p || !f) return ''
  return `${p}/${f}`
})

// URL 입력 시 폴더명 자동 추정 (`https://example.com/owner/foo.git` → `foo`)
watch(url, (v) => {
  if (folderName.value) return // 사용자가 명시적으로 입력한 후에는 안 바꿈
  const m = v
    .trim()
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .pop()
  if (m) folderName.value = m
})

const sparseList = computed<string[]>(() => {
  return sparseText.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
})

const cloneMut = useMutation({
  mutationFn: () => {
    const opts: CloneOptions = {}
    if (showAdvanced.value) {
      if (sparseList.value.length > 0) opts.sparsePaths = sparseList.value
      if (depth.value && depth.value > 0) opts.depth = depth.value
      const s = shallowSince.value.trim()
      if (s) opts.shallowSince = s
      const b = singleBranch.value.trim()
      if (b) opts.singleBranch = b
      if (bare.value) opts.bare = true
    }
    return cloneRepo(url.value.trim(), targetPath.value, opts, true, props.workspaceId)
  },
  onSuccess: (r) => {
    toast.success(
      'Clone 완료',
      r.registeredRepo
        ? `${r.registeredRepo.name} 자동 등록됨`
        : r.warning ?? '경로만 clone 완료',
    )
    qc.invalidateQueries({ queryKey: ['repos'] })
    reset()
    emit('close')
  },
  onError: (e) => toast.error('Clone 실패', describeError(e)),
})

function reset() {
  url.value = ''
  parentPath.value = ''
  folderName.value = ''
  showAdvanced.value = false
  sparseText.value = ''
  depth.value = null
  shallowSince.value = ''
  singleBranch.value = ''
  bare.value = false
}

function close() {
  reset()
  emit('close')
}

const canSubmit = computed(
  () =>
    url.value.trim().length > 0 &&
    targetPath.value.length > 0 &&
    !cloneMut.isPending.value,
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      @click.self="close"
    >
      <div
        class="flex max-h-[85vh] w-full max-w-xl flex-col rounded-lg border border-border bg-card shadow-xl"
      >
        <header
          class="flex items-center justify-between border-b border-border px-4 py-2"
        >
          <h2 class="text-sm font-semibold">⬇ 레포 clone</h2>
          <button
            class="text-muted-foreground hover:text-foreground"
            @click="close"
          >
            ✕
          </button>
        </header>

        <form class="flex-1 overflow-auto p-4 text-sm" @submit.prevent="cloneMut.mutate()">
          <label class="block">
            <span class="text-xs font-medium">URL</span>
            <input
              v-model="url"
              required
              placeholder="https://github.com/owner/repo.git 또는 git@host:owner/repo.git"
              class="mt-1 w-full rounded border border-input bg-background px-2 py-1 font-mono text-[12px]"
            />
          </label>

          <div class="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <label class="block">
              <span class="text-xs font-medium">부모 폴더</span>
              <input
                v-model="parentPath"
                required
                placeholder="D:/01.Work/01.Projects"
                class="mt-1 w-full rounded border border-input bg-background px-2 py-1 font-mono text-[12px]"
              />
            </label>
            <label class="block">
              <span class="text-xs font-medium">폴더명</span>
              <input
                v-model="folderName"
                required
                placeholder="repo"
                class="mt-1 w-40 rounded border border-input bg-background px-2 py-1 font-mono text-[12px]"
              />
            </label>
          </div>

          <p
            v-if="targetPath"
            class="mt-1 text-[10px] text-muted-foreground"
          >
            대상 경로: <span class="font-mono">{{ targetPath }}</span>
          </p>

          <!-- 고급 옵션 -->
          <button
            type="button"
            class="mt-4 text-xs text-muted-foreground hover:underline"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? '▾' : '▸' }} 고급 옵션 (sparse / shallow / branch)
          </button>

          <div
            v-if="showAdvanced"
            class="mt-2 flex flex-col gap-3 rounded border border-border bg-muted/20 p-3"
          >
            <label class="block">
              <span class="text-xs font-medium">
                E1 Sparse-checkout cone paths
                <span class="ml-1 text-[10px] text-muted-foreground">(1줄 1path)</span>
              </span>
              <textarea
                v-model="sparseText"
                rows="3"
                placeholder="apps/desktop&#10;packages/shared"
                class="mt-1 w-full rounded border border-input bg-background px-2 py-1 font-mono text-[11px]"
              />
            </label>

            <div class="grid grid-cols-2 gap-2">
              <label class="block">
                <span class="text-xs font-medium">E2 Depth (shallow)</span>
                <input
                  v-model.number="depth"
                  type="number"
                  min="1"
                  placeholder="1 = 최근 1 commit"
                  class="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                />
              </label>
              <label class="block">
                <span class="text-xs font-medium">Shallow since (date)</span>
                <input
                  v-model="shallowSince"
                  placeholder="2024-01-01"
                  class="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                />
              </label>
            </div>

            <label class="block">
              <span class="text-xs font-medium">Single branch (한 브랜치만)</span>
              <input
                v-model="singleBranch"
                placeholder="main"
                class="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
              />
            </label>

            <label class="flex items-center gap-2 text-xs">
              <input v-model="bare" type="checkbox" />
              <span>Bare clone (--bare, 작업 트리 없음)</span>
            </label>
          </div>
        </form>

        <footer
          class="flex justify-end gap-2 border-t border-border px-4 py-2 text-xs"
        >
          <button
            type="button"
            class="rounded border border-border px-3 py-1 hover:bg-muted/40"
            @click="close"
          >
            취소
          </button>
          <button
            type="button"
            class="rounded bg-primary px-3 py-1 text-primary-foreground hover:opacity-90 disabled:opacity-50"
            :disabled="!canSubmit"
            @click="cloneMut.mutate()"
          >
            {{ cloneMut.isPending.value ? '클론 중...' : 'Clone' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
