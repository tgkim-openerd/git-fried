<script setup lang="ts">
// 헤더 우측 프로파일 토글 — 개인 ↔ 회사 1-click 전환.
// 활성 프로파일이 없으면 "프로파일 없음" 표시 + 설정 안내.
import { ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { activateProfile } from '@/api/git'
import { describeError } from '@/api/errors'
import { useProfiles } from '@/composables/useProfiles'

const { data: profiles, active } = useProfiles()
const qc = useQueryClient()
const open = ref(false)

const activateMut = useMutation({
  mutationFn: (id: number) => activateProfile(id),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['profiles'] })
    open.value = false
  },
  onError: (e) => alert(`프로파일 활성화 실패:\n${describeError(e)}`),
})

function pick(id: number) {
  if (active.value?.id === id) {
    open.value = false
    return
  }
  if (
    !window.confirm(
      '⚠ 이 프로파일을 활성화하면 글로벌 git config (user.name / user.email / signingKey) 가 덮여씌워집니다. 진행할까요?',
    )
  ) {
    return
  }
  activateMut.mutate(id)
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="rounded-md border border-input px-2 py-0.5 text-xs hover:bg-accent"
      :title="active ? `현재: ${active.name}` : '프로파일 미설정'"
      @click="open = !open"
    >
      <span v-if="active" class="font-medium">👤 {{ active.name }}</span>
      <span v-else class="text-muted-foreground">프로파일</span>
      <span class="ml-1 text-muted-foreground">▾</span>
    </button>

    <!-- 드롭다운 -->
    <div
      v-if="open"
      class="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-border bg-card shadow-lg"
      @keydown.esc="open = false"
    >
      <div class="border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        프로파일
      </div>
      <ul class="py-1">
        <li
          v-for="p in profiles"
          :key="p.id"
          class="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent/40"
          :class="p.isActive ? 'bg-accent/60 font-semibold' : ''"
          @click="pick(p.id)"
        >
          <div class="flex items-center justify-between">
            <span>
              <span v-if="p.isActive" class="text-emerald-500">●</span>
              {{ p.name }}
            </span>
            <span class="text-[10px] text-muted-foreground">
              {{ p.gitUserEmail || '(이메일 없음)' }}
            </span>
          </div>
        </li>
        <li
          v-if="profiles && profiles.length === 0"
          class="px-3 py-2 text-xs text-muted-foreground"
        >
          프로파일 없음. <RouterLink to="/settings" class="underline" @click="open = false">설정</RouterLink>
          에서 추가.
        </li>
      </ul>
      <div class="border-t border-border px-3 py-1.5 text-right text-[10px]">
        <RouterLink
          to="/settings"
          class="text-muted-foreground hover:text-foreground"
          @click="open = false"
        >
          관리...
        </RouterLink>
      </div>
    </div>
  </div>
</template>
