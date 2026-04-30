<script setup lang="ts">
// Remote 관리 modal — `docs/plan/14 §4` Sprint B14-1.
//
// list / add / remove / rename / set-url 통합 UI.
// 변경 후 ['branches', repoId] + ['remotes', repoId] invalidate.
// Sprint 22-10 CM-12: 우클릭 메뉴 (Fetch (전체) / Rename / Set URL / Remove).
//   단일 remote fetch IPC 미존재 → fetchAll 매핑 + label "(전체)" 명시.
import { computed, ref, useTemplateRef } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  addRemote,
  fetchAll,
  listRemotes,
  removeRemote,
  renameRemote,
  setRemoteUrl,
  type RemoteInfo,
} from '@/api/git'
import { describeError } from '@/api/errors'
import { STALE_TIME } from '@/api/queryClient'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'
import ContextMenu, { type ContextMenuExpose, type ContextMenuItem } from './ContextMenu.vue'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '@/composables/useConfirm'

const { t } = useI18n()

const props = defineProps<{ open: boolean; repoId: number | null }>()
const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const qc = useQueryClient()

const repoIdRef = computed(() => props.repoId)

const remotesQuery = useQuery({
  queryKey: computed(() => ['remotes', repoIdRef.value]),
  queryFn: () => {
    if (repoIdRef.value == null) return Promise.resolve<RemoteInfo[]>([])
    return listRemotes(repoIdRef.value)
  },
  enabled: computed(() => props.open && repoIdRef.value != null),
  staleTime: STALE_TIME.NORMAL,
})

function invalidate() {
  if (repoIdRef.value == null) return
  qc.invalidateQueries({ queryKey: ['remotes', repoIdRef.value] })
  qc.invalidateQueries({ queryKey: ['branches', repoIdRef.value] })
}

// === add ===
const addName = ref('')
const addUrl = ref('')
const addMut = useMutation({
  mutationFn: () => {
    if (repoIdRef.value == null) throw new Error(t('remote.errRepoNotSelected'))
    return addRemote(repoIdRef.value, addName.value.trim(), addUrl.value.trim())
  },
  onSuccess: () => {
    toast.success(t('remote.addedTitle'), addName.value)
    addName.value = ''
    addUrl.value = ''
    invalidate()
  },
  onError: (e) => toast.error(t('remote.addFailed'), describeError(e)),
})

// === remove ===
const removeMut = useMutation({
  mutationFn: (name: string) => {
    if (repoIdRef.value == null) throw new Error(t('remote.errRepoNotSelected'))
    return removeRemote(repoIdRef.value, name)
  },
  onSuccess: (_v, name) => {
    toast.success(t('remote.removedTitle'), name)
    invalidate()
  },
  onError: (e) => toast.error(t('remote.removeFailed'), describeError(e)),
})

async function onRemove(name: string) {
  const ok = await confirmDialog({
    title: t('confirm.removeRemoteTitle'),
    message: t('confirm.removeRemoteMessage', { name }),
    danger: true,
  })
  if (!ok) return
  removeMut.mutate(name)
}

// === rename ===
const renameTarget = ref<string | null>(null)
const renameNew = ref('')
const renameMut = useMutation({
  mutationFn: () => {
    if (repoIdRef.value == null || !renameTarget.value)
      throw new Error(t('remote.errTargetNotSelected'))
    return renameRemote(repoIdRef.value, renameTarget.value, renameNew.value.trim())
  },
  onSuccess: () => {
    toast.success(
      t('remote.renamedTitle'),
      t('remote.renamedMessage', { from: renameTarget.value ?? '', to: renameNew.value }),
    )
    renameTarget.value = null
    renameNew.value = ''
    invalidate()
  },
  onError: (e) => toast.error(t('remote.renameFailed'), describeError(e)),
})

function startRename(name: string) {
  renameTarget.value = name
  renameNew.value = name
}

// === set URL ===
const urlTarget = ref<string | null>(null)
const urlNew = ref('')
const urlMut = useMutation({
  mutationFn: () => {
    if (repoIdRef.value == null || !urlTarget.value)
      throw new Error(t('remote.errTargetNotSelected'))
    return setRemoteUrl(repoIdRef.value, urlTarget.value, urlNew.value.trim())
  },
  onSuccess: () => {
    toast.success(t('remote.urlChangedTitle'), urlTarget.value ?? '')
    urlTarget.value = null
    urlNew.value = ''
    invalidate()
  },
  onError: (e) => toast.error(t('remote.urlChangeFailed'), describeError(e)),
})

function startUrlChange(r: RemoteInfo) {
  urlTarget.value = r.name
  urlNew.value = r.fetchUrl ?? r.pushUrl ?? ''
}

function close() {
  renameTarget.value = null
  renameNew.value = ''
  urlTarget.value = null
  urlNew.value = ''
  emit('close')
}

// === Sprint 22-10 CM-12 — 우클릭 ContextMenu ===
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')

const fetchAllMut = useMutation({
  mutationFn: () => {
    if (repoIdRef.value == null) throw new Error(t('remote.errRepoNotSelected'))
    return fetchAll(repoIdRef.value)
  },
  onSuccess: () => {
    toast.success(t('remote.fetchAllSuccess'), t('remote.fetchAllSuccessMessage'))
    invalidate()
    if (repoIdRef.value != null) {
      qc.invalidateQueries({ queryKey: ['status', repoIdRef.value] })
      qc.invalidateQueries({ queryKey: ['log', repoIdRef.value] })
      qc.invalidateQueries({ queryKey: ['graph', repoIdRef.value] })
    }
  },
  onError: (e) => toast.error(t('remote.fetchAllFailed'), describeError(e)),
})

function onRemoteContextMenu(ev: MouseEvent, r: RemoteInfo) {
  ev.preventDefault()
  ev.stopPropagation()
  const items: ContextMenuItem[] = [
    {
      // 단일 remote fetch IPC 부재 → fetchAll 일괄 매핑.
      label: t('remote.ctxFetchAll'),
      icon: '⬇',
      action: () => fetchAllMut.mutate(),
    },
    { divider: true },
    {
      label: t('remote.ctxRename'),
      icon: '✏',
      action: () => startRename(r.name),
    },
    {
      label: t('remote.ctxChangeUrl'),
      icon: '🔗',
      action: () => startUrlChange(r),
    },
    { divider: true },
    {
      label: t('remote.ctxRemove'),
      icon: '🗑',
      destructive: true,
      action: () => onRemove(r.name),
    },
  ]
  ctxMenu.value?.openAt(ev, items)
}
</script>

<template>
  <BaseModal
    :open="open"
    max-width="2xl"
    :title="t('remote.title')"
    panel-class="max-h-[85vh]"
    @close="close"
  >
    <div class="p-4 text-sm">
      <!-- list -->
      <div v-if="remotesQuery.isFetching.value" class="text-muted-foreground">
        {{ t('remote.loading') }}
      </div>
      <div v-else-if="!remotesQuery.data.value?.length" class="text-muted-foreground">
        {{ t('remote.empty') }}
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="r in remotesQuery.data.value"
          :key="r.name"
          class="rounded border border-border bg-muted/20 p-2"
          @contextmenu="onRemoteContextMenu($event, r)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-xs font-semibold">{{ r.name }}</span>
            <div class="flex gap-1 text-[11px]">
              <button
                class="rounded border border-border px-2 py-0.5 hover:bg-accent/40"
                @click="startRename(r.name)"
              >
                {{ t('remote.rename') }}
              </button>
              <button
                class="rounded border border-border px-2 py-0.5 hover:bg-accent/40"
                @click="startUrlChange(r)"
              >
                {{ t('remote.changeUrl') }}
              </button>
              <button
                class="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10"
                @click="onRemove(r.name)"
              >
                {{ t('remote.remove') }}
              </button>
            </div>
          </div>
          <div class="mt-1 text-[11px] text-muted-foreground">
            <div>
              fetch: <span class="font-mono">{{ r.fetchUrl ?? '—' }}</span>
            </div>
            <div v-if="r.pushUrl !== r.fetchUrl">
              push: <span class="font-mono">{{ r.pushUrl ?? '—' }}</span>
            </div>
          </div>

          <!-- inline rename form -->
          <form
            v-if="renameTarget === r.name"
            class="mt-2 flex gap-1"
            @submit.prevent="renameMut.mutate()"
          >
            <input
              v-model="renameNew"
              class="flex-1 rounded border border-input bg-background px-2 py-0.5 text-xs"
              :placeholder="t('remote.renameNewName')"
            />
            <button
              type="submit"
              class="rounded bg-primary px-2 py-0.5 text-[11px] text-primary-foreground"
              :disabled="
                !renameNew.trim() || renameNew.trim() === renameTarget || renameMut.isPending.value
              "
            >
              {{ t('remote.save') }}
            </button>
            <button
              type="button"
              class="rounded border border-border px-2 py-0.5 text-[11px]"
              @click="renameTarget = null"
            >
              {{ t('remote.cancel') }}
            </button>
          </form>

          <!-- inline url form -->
          <form
            v-if="urlTarget === r.name"
            class="mt-2 flex gap-1"
            @submit.prevent="urlMut.mutate()"
          >
            <input
              v-model="urlNew"
              class="flex-1 rounded border border-input bg-background px-2 py-0.5 font-mono text-[11px]"
              :placeholder="t('remote.newUrl')"
            />
            <button
              type="submit"
              class="rounded bg-primary px-2 py-0.5 text-[11px] text-primary-foreground"
              :disabled="!urlNew.trim() || urlMut.isPending.value"
            >
              {{ t('remote.save') }}
            </button>
            <button
              type="button"
              class="rounded border border-border px-2 py-0.5 text-[11px]"
              @click="urlTarget = null"
            >
              {{ t('remote.cancel') }}
            </button>
          </form>
        </li>
      </ul>

      <!-- add new -->
      <div class="mt-5 rounded border border-dashed border-border p-3">
        <h3 class="mb-2 text-xs font-semibold">{{ t('remote.addNewTitle') }}</h3>
        <form class="flex flex-col gap-2" @submit.prevent="addMut.mutate()">
          <input
            v-model="addName"
            :placeholder="t('remote.namePlaceholder')"
            class="rounded border border-input bg-background px-2 py-1 text-xs"
          />
          <input
            v-model="addUrl"
            :placeholder="t('remote.urlPlaceholder')"
            class="rounded border border-input bg-background px-2 py-1 font-mono text-[11px]"
          />
          <button
            type="submit"
            class="self-end rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
            :disabled="!addName.trim() || !addUrl.trim() || addMut.isPending.value"
          >
            {{ t('remote.addButton') }}
          </button>
        </form>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end text-xs">
        <button
          type="button"
          class="rounded border border-border px-3 py-1 hover:bg-muted/40"
          @click="close"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </template>
    <ContextMenu ref="ctxMenu" />
  </BaseModal>
</template>
