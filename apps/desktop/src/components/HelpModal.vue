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

// A-23 — 플랫폼별 단축키 표기 통일 (mac ⌘/⌥/⇧/⌃ vs Windows·Linux Ctrl/Alt/Shift).
// 기존: 일부는 dual 표기(⌘P / Ctrl+P), 일부는 mac 전용(⌘Enter) — 혼용.
// navigator.platform 은 deprecated — userAgent 기반 감지 (Mac UA 는 "Macintosh" 포함).
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent || '')
const MOD = isMac ? '⌘' : 'Ctrl+'
const SHIFT = isMac ? '⇧' : 'Shift+'
const ALT = isMac ? '⌥' : 'Alt+'
const CTRL = isMac ? '⌃' : 'Ctrl+'

// keys (mod 표기) 는 플랫폼별, desc 만 i18n. 카테고리 그룹 제목도 i18n.
const groups = computed<Group[]>(() => [
  {
    title: t('shortcuts.groups.global'),
    items: [
      { keys: `${MOD}P`, desc: t('shortcuts.global.commandPalette') },
      { keys: `${MOD}${SHIFT}P`, desc: t('shortcuts.global.repoSwitch') },
      { keys: `${MOD}F`, desc: t('shortcuts.global.graphSearch') },
      { keys: '?', desc: t('shortcuts.global.help') },
      { keys: 'Esc', desc: t('shortcuts.global.escape') },
    ],
  },
  {
    title: t('shortcuts.groups.sync'),
    items: [
      { keys: `${MOD}L`, desc: t('shortcuts.sync.fetch') },
      { keys: `${MOD}${SHIFT}L`, desc: t('shortcuts.sync.pull') },
      { keys: `${MOD}${SHIFT}K`, desc: t('shortcuts.sync.push') },
    ],
  },
  {
    title: t('shortcuts.groups.edit'),
    items: [
      { keys: `${MOD}Enter`, desc: t('shortcuts.edit.commit') },
      { keys: `${MOD}${SHIFT}Enter`, desc: t('shortcuts.edit.stageAndCommit') },
      { keys: `${MOD}${SHIFT}S`, desc: t('shortcuts.edit.stageAll') },
      { keys: `${MOD}${SHIFT}U`, desc: t('shortcuts.edit.unstageAll') },
      { keys: `${MOD}${SHIFT}M`, desc: t('shortcuts.edit.focusMessage') },
      { keys: `${MOD}N`, desc: t('shortcuts.edit.newPr') },
      { keys: `${MOD}B`, desc: t('shortcuts.edit.branchTab') },
      { keys: `${MOD}D`, desc: t('shortcuts.edit.diff') },
      { keys: `${MOD}${SHIFT}D`, desc: t('shortcuts.edit.inlineDiff') },
      { keys: `${ALT}↑ / ${ALT}↓`, desc: t('shortcuts.edit.hunkNav') },
      { keys: `${MOD}${SHIFT}H`, desc: t('shortcuts.edit.fileHistory') },
    ],
  },
  {
    title: t('shortcuts.groups.layout'),
    items: [
      { keys: `${MOD}J`, desc: t('shortcuts.layout.toggleSidebar') },
      { keys: `${MOD}K`, desc: t('shortcuts.layout.toggleDetail') },
      { keys: `${MOD}=`, desc: t('shortcuts.layout.zoomIn') },
      { keys: `${MOD}-`, desc: t('shortcuts.layout.zoomOut') },
      { keys: `${MOD}0`, desc: t('shortcuts.layout.zoomReset') },
      { keys: `${MOD}W`, desc: t('shortcuts.layout.closeModal') },
      { keys: `${MOD}T`, desc: t('shortcuts.layout.newTab') },
      { keys: `${ALT}O`, desc: t('shortcuts.layout.openInExplorer') },
      { keys: isMac ? '⌃⌘F' : 'F11', desc: t('shortcuts.layout.fullscreen') },
      { keys: `${MOD}${ALT}F`, desc: t('shortcuts.layout.filterRepos') },
    ],
  },
  {
    title: t('shortcuts.groups.tabs'),
    items: [
      { keys: `${CTRL}Tab`, desc: t('shortcuts.tabs.nextTab') },
      { keys: `${CTRL}${SHIFT}Tab`, desc: t('shortcuts.tabs.prevTab') },
      { keys: `${MOD}${SHIFT}W`, desc: t('shortcuts.tabs.closeTab') },
      { keys: 'Mouse middle-click', desc: t('shortcuts.tabs.middleClick') },
    ],
  },
  {
    title: t('shortcuts.groups.rightPanel'),
    items: [
      { keys: `${MOD}1`, desc: t('shortcuts.rightPanel.tab1') },
      { keys: `${MOD}2`, desc: t('shortcuts.rightPanel.tab2') },
      { keys: `${MOD}3`, desc: t('shortcuts.rightPanel.tab3') },
      { keys: `${MOD}4`, desc: t('shortcuts.rightPanel.tab4') },
      { keys: `${MOD}5`, desc: t('shortcuts.rightPanel.tab5') },
      { keys: `${MOD}6`, desc: t('shortcuts.rightPanel.tab6') },
      { keys: `${MOD}7`, desc: t('shortcuts.rightPanel.tab7') },
    ],
  },
  {
    title: t('shortcuts.groups.modal'),
    items: [
      { keys: `${MOD}P → "sync"`, desc: t('shortcuts.modal.syncTemplate') },
      { keys: `${MOD}P → "bisect"`, desc: t('shortcuts.modal.bisect') },
      { keys: `${MOD}P → "reflog"`, desc: t('shortcuts.modal.reflog') },
      { keys: `${MOD}P → "rebase"`, desc: t('shortcuts.modal.rebase') },
      { keys: `${MOD}\``, desc: t('shortcuts.modal.terminal') },
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
              class="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-center font-mono text-2xs"
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
