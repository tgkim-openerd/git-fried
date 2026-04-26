<script setup lang="ts">
// 단축키 도움말 — `?` 키로 열림.
defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

interface Shortcut {
  keys: string
  desc: string
}
interface Group {
  title: string
  items: Shortcut[]
}

const groups: Group[] = [
  {
    title: '글로벌',
    items: [
      { keys: '⌘P / Ctrl+P', desc: 'Command Palette' },
      { keys: '⌘⇧P / Ctrl+⇧P', desc: '빠른 레포 전환' },
      { keys: '⌘F / Ctrl+F', desc: '커밋 그래프 검색' },
      { keys: '?', desc: '이 도움말' },
      { keys: 'Esc', desc: '모달 / 검색 닫기' },
    ],
  },
  {
    title: '동기화 (GitKraken 표준)',
    items: [
      { keys: '⌘L / Ctrl+L', desc: 'Fetch (모든 remote)' },
      { keys: '⌘⇧L / Ctrl+⇧L', desc: 'Pull' },
      { keys: '⌘⇧K / Ctrl+⇧K', desc: 'Push' },
    ],
  },
  {
    title: '편집',
    items: [
      { keys: '⌘Enter', desc: 'Commit (입력창에서)' },
      { keys: '⌘N', desc: '새 PR 모달' },
      { keys: '⌘B', desc: 'Branch 탭으로 이동' },
    ],
  },
  {
    title: '우측 탭 전환',
    items: [
      { keys: '⌘1', desc: '변경 (Status)' },
      { keys: '⌘2', desc: '브랜치' },
      { keys: '⌘3', desc: 'Stash' },
      { keys: '⌘4', desc: 'Submodule' },
      { keys: '⌘5', desc: 'LFS' },
      { keys: '⌘6', desc: 'PR (Forge)' },
      { keys: '⌘7', desc: 'Worktree' },
    ],
  },
  {
    title: '모달 / 명령',
    items: [
      { keys: '⌘P → "sync"', desc: 'Sync template (다중 레포 cherry-pick)' },
      { keys: '⌘P → "bisect"', desc: 'Bisect' },
      { keys: '⌘P → "reflog"', desc: 'Reflog viewer' },
    ],
  },
]
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      @click.self="$emit('close')"
    >
      <div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <header class="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 class="text-sm font-semibold">⌨ 키보드 단축키</h2>
          <button class="text-muted-foreground hover:text-foreground" @click="$emit('close')">✕</button>
        </header>
        <div class="flex-1 overflow-auto p-4 text-sm">
          <section v-for="g in groups" :key="g.title" class="mb-5 last:mb-0">
            <h3 class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              {{ g.title }}
            </h3>
            <ul class="space-y-1">
              <li
                v-for="s in g.items"
                :key="s.keys + s.desc"
                class="grid grid-cols-[160px_1fr] items-center gap-3"
              >
                <kbd
                  class="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-center font-mono text-[11px]"
                >
                  {{ s.keys }}
                </kbd>
                <span class="text-xs">{{ s.desc }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
