<script setup lang="ts">
// GitKraken importer modal — `docs/plan/21`.
//
// 흐름:
//   1) detect — `%APPDATA%/.gitkraken/profiles/*` 자동 탐지
//   2) dry-run — 미리보기 (workspace N개, repo N개, pin N개, tab N개, skipped)
//   3) confirm → apply → 결과 toast
//   4) 활성 탭 path 들 → useReposStore.openTab(id) 로 복원
import { ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  importGitKrakenApply,
  importGitKrakenDetect,
  importGitKrakenDryRun,
  listRepos,
  type GitKrakenApplyResult,
  type GitKrakenDetect,
  type GitKrakenImportPlan,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { useReposStore } from '@/stores/repos'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const qc = useQueryClient()
const reposStore = useReposStore()

const phase = ref<'idle' | 'detecting' | 'preview' | 'applying' | 'done' | 'error'>(
  'idle',
)
const detect = ref<GitKrakenDetect | null>(null)
const plan = ref<GitKrakenImportPlan | null>(null)
const result = ref<GitKrakenApplyResult | null>(null)
const errorMessage = ref<string>('')

async function start() {
  phase.value = 'detecting'
  errorMessage.value = ''
  detect.value = null
  plan.value = null
  result.value = null
  try {
    const d = await importGitKrakenDetect()
    if (!d) {
      phase.value = 'error'
      errorMessage.value =
        'GitKraken 데이터를 찾을 수 없습니다. (%APPDATA%/.gitkraken/profiles/* 미존재)'
      return
    }
    detect.value = d
    plan.value = await importGitKrakenDryRun(d.profileDir)
    phase.value = 'preview'
  } catch (e) {
    phase.value = 'error'
    errorMessage.value = describeError(e)
  }
}

async function confirm() {
  if (!detect.value) return
  phase.value = 'applying'
  try {
    const r = await importGitKrakenApply(detect.value.profileDir)
    result.value = r
    phase.value = 'done'
    qc.invalidateQueries({ queryKey: ['repos'] })

    // 탭 복원: 새로 import 된 repos 의 id 를 path 로 매핑.
    if (r.tabsToOpen.length > 0) {
      try {
        const repos = await listRepos(null)
        const idByPath = new Map<string, number>()
        for (const repo of repos) {
          idByPath.set(repo.localPath.toLowerCase(), repo.id)
        }
        let opened = 0
        for (const path of r.tabsToOpen) {
          // canonical: 끝 슬래시 제거 후 lowercase
          const key = path.replace(/[/\\]+$/, '').toLowerCase()
          const id = idByPath.get(key) ?? idByPath.get(key + '/')
          if (id != null) {
            reposStore.openTab(id)
            opened++
          }
        }
        if (opened > 0) {
          toast.success(`${opened}개 탭 복원`, '활성 탭이 복원되었습니다.')
        }
      } catch (e) {
        // 탭 복원 실패는 import 자체 성공이므로 warning 만.
        toast.warning('탭 복원 실패', describeError(e))
      }
    }

    toast.success(
      `GitKraken import 완료`,
      `Workspace ${r.workspacesCreated}개 · Repo ${r.reposAdded}개 · Pin ${r.reposPinned}개${
        r.skippedPaths.length ? ` · 스킵 ${r.skippedPaths.length}` : ''
      }`,
    )
  } catch (e) {
    phase.value = 'error'
    errorMessage.value = describeError(e)
    toast.error('GitKraken import 실패', errorMessage.value)
  }
}

function reset() {
  phase.value = 'idle'
  detect.value = null
  plan.value = null
  result.value = null
  errorMessage.value = ''
}

function close() {
  reset()
  emit('close')
}

// 모달이 열릴 때 자동 detect.
watch(
  () => props.open,
  (open) => {
    if (open && phase.value === 'idle') {
      void start()
    } else if (!open) {
      reset()
    }
  },
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
        class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-xl"
      >
        <header
          class="flex items-center justify-between border-b border-border px-4 py-2"
        >
          <h2 class="text-sm font-semibold">📦 GitKraken 가져오기</h2>
          <button
            class="text-muted-foreground hover:text-foreground"
            @click="close"
          >
            ✕
          </button>
        </header>

        <div class="flex-1 overflow-auto p-4 text-sm">
          <!-- detecting -->
          <div v-if="phase === 'detecting'" class="text-muted-foreground">
            GitKraken 데이터 탐지 중...
          </div>

          <!-- preview -->
          <div v-else-if="phase === 'preview' && detect && plan">
            <p class="mb-3 text-xs text-muted-foreground">
              <code class="rounded bg-muted/40 px-1">{{ detect.profileDir }}</code>
            </p>

            <div class="mb-4 grid grid-cols-2 gap-2 text-xs">
              <div class="rounded border border-border bg-muted/20 p-2">
                <div class="text-muted-foreground">Workspace</div>
                <div class="text-lg font-semibold">
                  {{ plan.workspacesToCreate.length }}
                </div>
              </div>
              <div class="rounded border border-border bg-muted/20 p-2">
                <div class="text-muted-foreground">Repo</div>
                <div class="text-lg font-semibold">{{ plan.reposToAdd }}</div>
              </div>
              <div class="rounded border border-border bg-muted/20 p-2">
                <div class="text-muted-foreground">즐겨찾기 (Pin)</div>
                <div class="text-lg font-semibold">
                  {{ plan.reposToPin.length }}
                </div>
              </div>
              <div class="rounded border border-border bg-muted/20 p-2">
                <div class="text-muted-foreground">활성 탭</div>
                <div class="text-lg font-semibold">
                  {{ plan.tabsToOpen.length }}
                </div>
              </div>
            </div>

            <details v-if="plan.workspacesToCreate.length" class="mb-3">
              <summary class="cursor-pointer text-xs text-muted-foreground">
                새로 생성될 Workspace 목록
              </summary>
              <ul class="mt-1 ml-4 list-disc text-xs">
                <li v-for="w in plan.workspacesToCreate" :key="w">{{ w }}</li>
              </ul>
            </details>

            <details v-if="plan.skippedPaths.length" class="mb-3">
              <summary class="cursor-pointer text-xs text-amber-600">
                스킵될 path (디렉토리 존재 안 함):
                {{ plan.skippedPaths.length }}개
              </summary>
              <ul class="mt-1 ml-4 list-disc text-xs text-muted-foreground">
                <li v-for="p in plan.skippedPaths" :key="p" class="truncate">
                  {{ p }}
                </li>
              </ul>
            </details>

            <p class="mt-4 text-xs text-muted-foreground">
              ⚠ PAT (GitHub / Gitea 토큰) 은 GitKraken 자체 암호화로 가져올 수 없습니다.
              import 후 Settings → Forge 에서 재입력 필요.
            </p>
          </div>

          <!-- applying -->
          <div v-else-if="phase === 'applying'" class="text-muted-foreground">
            가져오는 중... ({{ plan?.reposToAdd }}개 레포)
          </div>

          <!-- done -->
          <div v-else-if="phase === 'done' && result">
            <p class="mb-3 text-sm font-semibold text-green-600">✅ 완료</p>
            <ul class="ml-4 list-disc text-xs">
              <li>Workspace 생성: {{ result.workspacesCreated }}</li>
              <li>Repo 추가: {{ result.reposAdded }}</li>
              <li>즐겨찾기 (Pin): {{ result.reposPinned }}</li>
              <li v-if="result.skippedPaths.length">
                스킵: {{ result.skippedPaths.length }}
              </li>
              <li v-if="result.tabsToOpen.length">
                탭 복원 시도: {{ result.tabsToOpen.length }}
              </li>
            </ul>
            <details v-if="result.warnings.length" class="mt-3">
              <summary class="cursor-pointer text-xs text-amber-600">
                경고 {{ result.warnings.length }}건
              </summary>
              <ul class="mt-1 ml-4 list-disc text-xs">
                <li v-for="w in result.warnings" :key="w">{{ w }}</li>
              </ul>
            </details>
          </div>

          <!-- error -->
          <div v-else-if="phase === 'error'" class="text-sm text-red-600">
            <p class="mb-2 font-semibold">❌ 실패</p>
            <pre class="whitespace-pre-wrap text-xs">{{ errorMessage }}</pre>
          </div>
        </div>

        <footer
          class="flex justify-end gap-2 border-t border-border px-4 py-2 text-xs"
        >
          <button
            v-if="phase === 'preview'"
            class="rounded border border-border px-3 py-1 hover:bg-muted/40"
            @click="close"
          >
            취소
          </button>
          <button
            v-if="phase === 'preview' && plan"
            class="rounded bg-primary px-3 py-1 text-primary-foreground hover:opacity-90 disabled:opacity-50"
            :disabled="plan.reposToAdd === 0 && plan.workspacesToCreate.length === 0"
            @click="confirm"
          >
            {{ plan.reposToAdd }}개 가져오기
          </button>
          <button
            v-if="phase === 'done' || phase === 'error'"
            class="rounded border border-border px-3 py-1 hover:bg-muted/40"
            @click="close"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
