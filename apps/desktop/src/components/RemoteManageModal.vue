<script setup lang="ts">
// Remote 관리 modal — `docs/plan/14 §4` Sprint B14-1.
//
// list / add / remove / rename / set-url 통합 UI.
// 변경 후 ['branches', repoId] + ['remotes', repoId] invalidate.
// Sprint 22-10 CM-12: 우클릭 메뉴 (Fetch (전체) / Rename / Set URL / Remove).
//   단일 remote fetch IPC 미존재 → fetchAll 매핑 + label "(전체)" 명시.
//
// v0.4 #5 (UltraPlan plan/31) god comp wave A — 5 mutation + form state
// useRemoteMutations 분리 (168→<150 LOC).
import { computed, useTemplateRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { listRemotes, type RemoteInfo } from '@/api/git'
import { STALE_TIME } from '@/api/queryClient'
import BaseModal from './BaseModal.vue'
import ContextMenu, { type ContextMenuExpose } from './ContextMenu.vue'
import { useI18n } from 'vue-i18n'
// Sprint c53 — /analyze HIGH-1 — context menu + remove confirm 흡수 (Pattern 9 caller-decision).
import { useRemoteInteraction } from '@/composables/useRemoteInteraction'
// v0.4 #5 — 5 mutation + form state 추출.
import { useRemoteMutations } from '@/composables/useRemoteMutations'

const { t } = useI18n()

const props = defineProps<{ open: boolean; repoId: number | null }>()
const emit = defineEmits<{ close: [] }>()

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

const {
  addName,
  addUrl,
  renameTarget,
  renameNew,
  urlTarget,
  urlNew,
  addMut,
  removeMut,
  renameMut,
  urlMut,
  fetchAllMut,
  startRename,
  startUrlChange,
  resetFormState,
} = useRemoteMutations({ repoId: () => props.repoId })

function close() {
  resetFormState()
  emit('close')
}

// === Sprint 22-10 CM-12 + Sprint c53 ARCH-001 (Pattern 9 caller-decision) ===
// composable: ContextMenu items 빌드 + confirmDialog 흡수
// caller: 5 mutations + form state 보유, mutate fn 만 콜백으로 노출
const ctxMenu = useTemplateRef<ContextMenuExpose>('ctxMenu')

const { onRemoteContextMenu, removeRemoteSafely } = useRemoteInteraction({
  ctxMenu,
  onFetchAll: () => fetchAllMut.mutate(),
  onStartRename: (name) => startRename(name),
  onStartUrlChange: (r) => startUrlChange(r),
  onRemove: (name) => removeMut.mutate(name),
})
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
            <div class="flex gap-1 text-2xs">
              <button
                class="rounded border border-border px-2.5 py-1 min-h-[28px] text-xs hover:bg-accent/40"
                @click="startRename(r.name)"
              >
                {{ t('remote.rename') }}
              </button>
              <button
                class="rounded border border-border px-2.5 py-1 min-h-[28px] text-xs hover:bg-accent/40"
                @click="startUrlChange(r)"
              >
                {{ t('remote.changeUrl') }}
              </button>
              <button
                class="rounded border border-destructive/40 px-2.5 py-1 min-h-[28px] text-xs text-destructive hover:bg-destructive/10"
                @click="removeRemoteSafely(r.name)"
              >
                {{ t('remote.remove') }}
              </button>
            </div>
          </div>
          <div class="mt-1 text-2xs text-muted-foreground">
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
              class="rounded bg-primary px-2.5 py-1 min-h-[28px] text-xs text-primary-foreground"
              :disabled="
                !renameNew.trim() || renameNew.trim() === renameTarget || renameMut.isPending.value
              "
            >
              {{ t('remote.save') }}
            </button>
            <button
              type="button"
              class="rounded border border-border px-2.5 py-1 min-h-[28px] text-xs"
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
              class="flex-1 rounded border border-input bg-background px-2 py-0.5 font-mono text-2xs"
              :placeholder="t('remote.newUrl')"
            />
            <button
              type="submit"
              class="rounded bg-primary px-2.5 py-1 min-h-[28px] text-xs text-primary-foreground"
              :disabled="!urlNew.trim() || urlMut.isPending.value"
            >
              {{ t('remote.save') }}
            </button>
            <button
              type="button"
              class="rounded border border-border px-2.5 py-1 min-h-[28px] text-xs"
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
            class="rounded border border-input bg-background px-2 py-1 font-mono text-2xs"
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
