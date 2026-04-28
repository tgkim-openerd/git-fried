<script setup lang="ts">
// 단축키 도움말 — `?` 키로 열림.
// Sprint 22-5 Q-1/Q-2: BaseModal 마이그레이션 (focus trap + a11y dialog).
import BaseModal from './BaseModal.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

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
      { keys: '⌘⇧Enter', desc: 'Stage all + Commit' },
      { keys: '⌘⇧S', desc: '모두 stage' },
      { keys: '⌘⇧U', desc: '모두 unstage' },
      { keys: '⌘⇧M', desc: '메시지 입력창 focus' },
      { keys: '⌘N', desc: '새 PR 모달' },
      { keys: '⌘B', desc: 'Branch 탭으로 이동' },
      { keys: '⌘D', desc: '선택 commit diff 모달' },
      { keys: '⌘⇧D', desc: 'Inline diff panel 토글 (Sprint c25-4.5)' },
      { keys: 'Alt+↑ / Alt+↓', desc: 'Diff 이전/다음 hunk 점프 (Sprint c26-3)' },
      { keys: '⌘⇧H', desc: 'File history (현재 파일)' },
    ],
  },
  {
    title: '레이아웃 / Zoom',
    items: [
      { keys: '⌘J', desc: '좌측 사이드바 토글' },
      { keys: '⌘K', desc: '우측 패널 (변경/브랜치/...) 토글' },
      { keys: '⌘=', desc: 'Zoom in' },
      { keys: '⌘-', desc: 'Zoom out' },
      { keys: '⌘0', desc: 'Zoom reset' },
      { keys: '⌘W', desc: '활성 모달 닫기' },
      { keys: '⌘T', desc: 'Repo 빠른 전환 (⌘⇧P alias)' },
      { keys: '⌥O / Alt+O', desc: '레포 폴더 열기 (OS 파일 매니저)' },
      { keys: 'F11 / ⌃⌘F', desc: '전체화면 토글' },
      { keys: '⌘⌥F / Ctrl+Alt+F', desc: 'Sidebar 레포 필터 focus' },
    ],
  },
  {
    title: '레포 탭 (Sprint G)',
    items: [
      { keys: '⌃Tab', desc: '다음 탭' },
      { keys: '⌃⇧Tab', desc: '이전 탭' },
      { keys: '⌘⇧W', desc: '활성 탭 닫기' },
      { keys: 'Mouse middle-click', desc: '탭 닫기' },
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
      { keys: '⌘P → "rebase"', desc: 'Interactive rebase (옵션 A)' },
      { keys: '⌘`', desc: '통합 터미널 토글' },
    ],
  },
  {
    title: 'Vim navigation (입력창 외에서, 단일 키)',
    items: [
      { keys: 'J', desc: '커밋 그래프 다음 행' },
      { keys: 'K', desc: '커밋 그래프 이전 행' },
      { keys: 'L', desc: '(예약 — 우측 detail 확장)' },
      { keys: 'H', desc: '선택 해제' },
      { keys: 'S', desc: '현재 파일 stage (변경 패널)' },
      { keys: 'U', desc: '현재 파일 unstage' },
    ],
  },
]
</script>

<template>
  <BaseModal :open="open" max-width="2xl" title="⌨ 키보드 단축키" @close="emit('close')">
    <div class="p-4 text-sm">
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
  </BaseModal>
</template>
