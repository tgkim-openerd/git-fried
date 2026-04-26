<script setup lang="ts">
// PR 패널 — 현재 레포의 PR 목록 (Gitea / GitHub) + 상세 read-only.
// v0.3 단계: 봇 PR 그룹핑 (release-please / dependabot / renovate) — collapsible.
import { computed, ref } from 'vue'
import { usePullRequests } from '@/composables/usePullRequests'
import { describeError } from '@/api/errors'
import { useStatus } from '@/composables/useStatus'
import PrDetailModal from './PrDetailModal.vue'
import CreatePrModal from './CreatePrModal.vue'
import UserAvatar from './UserAvatar.vue'
import type { PrState, PullRequest } from '@/api/git'

const props = defineProps<{ repoId: number | null }>()

const stateFilter = ref<PrState | null>('open')
const { data: prs, isFetching, error } = usePullRequests(
  () => props.repoId,
  () => stateFilter.value,
)

const { data: status } = useStatus(() => props.repoId)
const currentBranch = computed(() => status.value?.branch ?? '')

const selectedNumber = ref<number | null>(null)
const createOpen = ref(false)

function stateColor(s: PrState): string {
  switch (s) {
    case 'open':
      return 'text-emerald-500'
    case 'merged':
      return 'text-violet-500'
    case 'closed':
      return 'text-rose-500'
    case 'draft':
      return 'text-muted-foreground'
  }
}

function isBot(pr: PullRequest): boolean {
  const u = pr.author.username.toLowerCase()
  return (
    u.endsWith('-bot') ||
    u.endsWith('[bot]') ||
    u === 'release-please' ||
    u === 'dependabot' ||
    u === 'renovate' ||
    u === 'github-actions' ||
    u.includes('bot')
  )
}

// 사용자 vs 봇 분리
const humanPrs = computed(() => (prs.value ?? []).filter((p) => !isBot(p)))
const botPrs = computed(() => (prs.value ?? []).filter((p) => isBot(p)))

// 봇 PR 별 그룹 (author 기준)
const botGroups = computed(() => {
  const groups = new Map<string, PullRequest[]>()
  for (const p of botPrs.value) {
    const key = p.author.username
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

// 그룹별 펼침 상태
const expandedBots = ref<Record<string, boolean>>({})
function toggleBot(name: string) {
  expandedBots.value[name] = !expandedBots.value[name]
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="border-b border-border px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Pull Requests</h3>
        <div class="flex items-center gap-2">
          <div class="flex gap-1 text-[10px]">
            <button
              v-for="s in [null, 'open', 'closed'] as (PrState | null)[]"
              :key="String(s)"
              type="button"
              class="rounded px-1.5 py-0.5"
              :class="
                stateFilter === s
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground'
              "
              @click="stateFilter = s"
            >
              {{ s ?? 'all' }}
            </button>
          </div>
          <button
            type="button"
            class="rounded-md bg-primary px-2 py-0.5 text-[10px] text-primary-foreground hover:opacity-90 disabled:opacity-50"
            :disabled="!repoId"
            @click="createOpen = true"
          >
            + 새 PR
          </button>
        </div>
      </div>
    </header>

    <div
      v-if="error"
      class="m-2 rounded border border-destructive bg-destructive/10 p-2 text-xs whitespace-pre-wrap"
    >
      {{ describeError(error) }}
    </div>

    <div class="flex-1 overflow-auto px-2 py-1 text-sm">
      <div v-if="isFetching" class="px-2 py-3 text-xs text-muted-foreground">불러오는 중...</div>

      <!-- 사람이 만든 PR -->
      <ul v-if="humanPrs.length">
        <li
          v-for="pr in humanPrs"
          :key="pr.number"
          class="cursor-pointer rounded px-2 py-1.5 hover:bg-accent/40"
          :class="selectedNumber === pr.number ? 'bg-accent' : ''"
          @click="selectedNumber = pr.number"
        >
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-muted-foreground">#{{ pr.number }}</span>
            <span :class="['text-[10px] uppercase', stateColor(pr.state)]">{{ pr.state }}</span>
          </div>
          <div class="truncate text-sm">{{ pr.title }}</div>
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span class="flex items-center gap-1">
              <UserAvatar
                :username="pr.author.username"
                :avatar-url="pr.author.avatarUrl"
                size-class="w-4 h-4"
              />
              {{ pr.author.username }}
            </span>
            <span>{{ pr.headBranch }} → {{ pr.baseBranch }}</span>
          </div>
          <div v-if="pr.labels.length" class="mt-0.5 flex flex-wrap gap-1">
            <span
              v-for="l in pr.labels"
              :key="l.name"
              class="rounded px-1 py-0.5 text-[10px]"
              :style="{ backgroundColor: l.color + '33', color: l.color }"
            >
              {{ l.name }}
            </span>
          </div>
        </li>
      </ul>

      <!-- 봇 PR 그룹 -->
      <div v-if="botGroups.length" class="mt-2">
        <div
          v-for="[name, list] in botGroups"
          :key="name"
          class="border-t border-border/50"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between px-2 py-1 text-xs text-muted-foreground hover:bg-accent/40"
            @click="toggleBot(name)"
          >
            <span>
              <span class="mr-1">{{ expandedBots[name] ? '▾' : '▸' }}</span>
              🤖 {{ name }} <span class="text-[10px]">({{ list.length }})</span>
            </span>
          </button>
          <ul v-if="expandedBots[name]">
            <li
              v-for="pr in list"
              :key="pr.number"
              class="cursor-pointer rounded px-4 py-1 text-xs hover:bg-accent/40"
              :class="selectedNumber === pr.number ? 'bg-accent' : ''"
              @click="selectedNumber = pr.number"
            >
              <span class="font-mono text-[10px] text-muted-foreground">#{{ pr.number }}</span>
              <span class="ml-2 truncate">{{ pr.title }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div
        v-if="prs && prs.length === 0 && !isFetching"
        class="px-2 py-3 text-center text-xs text-muted-foreground"
      >
        PR 없음
      </div>
    </div>

    <!-- 상세 모달 -->
    <PrDetailModal
      :repo-id="repoId"
      :number="selectedNumber"
      :open="selectedNumber != null"
      @close="selectedNumber = null"
    />
    <!-- 새 PR 생성 모달 -->
    <CreatePrModal
      :repo-id="repoId"
      :open="createOpen"
      :initial-head="currentBranch"
      initial-base="main"
      @close="createOpen = false"
      @created="(n: number) => { createOpen = false; selectedNumber = n }"
    />
  </div>
</template>
