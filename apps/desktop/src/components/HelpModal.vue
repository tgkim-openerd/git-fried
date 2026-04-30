<script setup lang="ts">
// 단축키 도움말 — `?` 키로 열림.
// Sprint 22-5 Q-1/Q-2: BaseModal 마이그레이션 (focus trap + a11y dialog).
// Sprint c31 — 단축키 catalog i18n 마이그레이션 (~57 키 추가, ko/en 양쪽).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()

// keys (mod 표기) 는 그대로 두고 desc 만 i18n. 카테고리 그룹 제목도 i18n.
const groups = computed<Group[]>(() => [
  {
    title: t('shortcuts.groups.global'),
    items: [
      { keys: '⌘P / Ctrl+P', desc: t('shortcuts.global.commandPalette') },
      { keys: '⌘⇧P / Ctrl+⇧P', desc: t('shortcuts.global.repoSwitch') },
      { keys: '⌘F / Ctrl+F', desc: t('shortcuts.global.graphSearch') },
      { keys: '?', desc: t('shortcuts.global.help') },
      { keys: 'Esc', desc: t('shortcuts.global.escape') },
    ],
  },
  {
    title: t('shortcuts.groups.sync'),
    items: [
      { keys: '⌘L / Ctrl+L', desc: t('shortcuts.sync.fetch') },
      { keys: '⌘⇧L / Ctrl+⇧L', desc: t('shortcuts.sync.pull') },
      { keys: '⌘⇧K / Ctrl+⇧K', desc: t('shortcuts.sync.push') },
    ],
  },
  {
    title: t('shortcuts.groups.edit'),
    items: [
      { keys: '⌘Enter', desc: t('shortcuts.edit.commit') },
      { keys: '⌘⇧Enter', desc: t('shortcuts.edit.stageAndCommit') },
      { keys: '⌘⇧S', desc: t('shortcuts.edit.stageAll') },
      { keys: '⌘⇧U', desc: t('shortcuts.edit.unstageAll') },
      { keys: '⌘⇧M', desc: t('shortcuts.edit.focusMessage') },
      { keys: '⌘N', desc: t('shortcuts.edit.newPr') },
      { keys: '⌘B', desc: t('shortcuts.edit.branchTab') },
      { keys: '⌘D', desc: t('shortcuts.edit.diff') },
      { keys: '⌘⇧D', desc: t('shortcuts.edit.inlineDiff') },
      { keys: 'Alt+↑ / Alt+↓', desc: t('shortcuts.edit.hunkNav') },
      { keys: '⌘⇧H', desc: t('shortcuts.edit.fileHistory') },
    ],
  },
  {
    title: t('shortcuts.groups.layout'),
    items: [
      { keys: '⌘J', desc: t('shortcuts.layout.toggleSidebar') },
      { keys: '⌘K', desc: t('shortcuts.layout.toggleDetail') },
      { keys: '⌘=', desc: t('shortcuts.layout.zoomIn') },
      { keys: '⌘-', desc: t('shortcuts.layout.zoomOut') },
      { keys: '⌘0', desc: t('shortcuts.layout.zoomReset') },
      { keys: '⌘W', desc: t('shortcuts.layout.closeModal') },
      { keys: '⌘T', desc: t('shortcuts.layout.newTab') },
      { keys: '⌥O / Alt+O', desc: t('shortcuts.layout.openInExplorer') },
      { keys: 'F11 / ⌃⌘F', desc: t('shortcuts.layout.fullscreen') },
      { keys: '⌘⌥F / Ctrl+Alt+F', desc: t('shortcuts.layout.filterRepos') },
    ],
  },
  {
    title: t('shortcuts.groups.tabs'),
    items: [
      { keys: '⌃Tab', desc: t('shortcuts.tabs.nextTab') },
      { keys: '⌃⇧Tab', desc: t('shortcuts.tabs.prevTab') },
      { keys: '⌘⇧W', desc: t('shortcuts.tabs.closeTab') },
      { keys: 'Mouse middle-click', desc: t('shortcuts.tabs.middleClick') },
    ],
  },
  {
    title: t('shortcuts.groups.rightPanel'),
    items: [
      { keys: '⌘1', desc: t('shortcuts.rightPanel.tab1') },
      { keys: '⌘2', desc: t('shortcuts.rightPanel.tab2') },
      { keys: '⌘3', desc: t('shortcuts.rightPanel.tab3') },
      { keys: '⌘4', desc: t('shortcuts.rightPanel.tab4') },
      { keys: '⌘5', desc: t('shortcuts.rightPanel.tab5') },
      { keys: '⌘6', desc: t('shortcuts.rightPanel.tab6') },
      { keys: '⌘7', desc: t('shortcuts.rightPanel.tab7') },
    ],
  },
  {
    title: t('shortcuts.groups.modal'),
    items: [
      { keys: '⌘P → "sync"', desc: t('shortcuts.modal.syncTemplate') },
      { keys: '⌘P → "bisect"', desc: t('shortcuts.modal.bisect') },
      { keys: '⌘P → "reflog"', desc: t('shortcuts.modal.reflog') },
      { keys: '⌘P → "rebase"', desc: t('shortcuts.modal.rebase') },
      { keys: '⌘`', desc: t('shortcuts.modal.terminal') },
    ],
  },
  {
    title: t('shortcuts.groups.vim'),
    items: [
      { keys: 'J', desc: t('shortcuts.vim.j') },
      { keys: 'K', desc: t('shortcuts.vim.k') },
      { keys: 'L', desc: t('shortcuts.vim.l') },
      { keys: 'H', desc: t('shortcuts.vim.h') },
      { keys: 'S', desc: t('shortcuts.vim.s') },
      { keys: 'U', desc: t('shortcuts.vim.u') },
    ],
  },
])
</script>

<template>
  <BaseModal :open="open" max-width="2xl" :title="t('shortcuts.title')" @close="emit('close')">
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
