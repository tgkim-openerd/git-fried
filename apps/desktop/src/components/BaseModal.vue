<script setup lang="ts">
// 공용 BaseModal — `docs/plan/22 §5 Q-1` Sprint 22-5.
//
// 21+ 위치에서 반복되던 Teleport + fixed inset-0 + z-50 + backdrop click + ESC close
// + max-w-* + max-h-[90vh] 을 단일 컴포넌트로 통합.
//
// 사용 패턴:
//   <BaseModal :open="open" max-width="md" title="제목" @close="open = false">
//     <p>본문</p>
//     <template #footer>
//       <button @click="confirm">확인</button>
//     </template>
//   </BaseModal>
//
// slots:
//   - default: 본문
//   - header: 커스텀 헤더 (title prop 대신, ✕ 버튼은 항상 추가)
//   - footer: 푸터 영역 (border-t)
//
// props:
//   - open: 열림/닫힘
//   - maxWidth: 'xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|full' (Tailwind max-w-* 매핑)
//   - title: 단순 헤더 텍스트 (header slot 미사용 시)
//   - closeOnBackdrop: 배경 클릭으로 닫기 (default true)
//   - closeOnEsc: ESC 로 닫기 (default true)
//   - showCloseButton: 헤더 우상단 ✕ (default true)
//
// 동작:
//   - useFocusTrap 자동 적용 (열릴 때 첫 focusable, Tab 순환, 닫힐 때 직전 focus 복원)
//   - z-50 통일 (이전 z-40/z-50 혼재 정리)
//   - role="dialog" + aria-modal="true" + aria-labelledby (title 있을 때)
import { computed, useTemplateRef } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

type MaxWidth =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | 'full'

const props = withDefaults(
  defineProps<{
    open: boolean
    maxWidth?: MaxWidth
    title?: string
    closeOnBackdrop?: boolean
    closeOnEsc?: boolean
    showCloseButton?: boolean
    /** 추가 컨테이너 클래스 (기본 layout 위에 덧붙임) */
    panelClass?: string
    /** 정렬: 'center' (기본) | 'top' (palette/switcher 용 — pt-24) */
    align?: 'center' | 'top'
  }>(),
  {
    maxWidth: 'lg',
    closeOnBackdrop: true,
    closeOnEsc: true,
    showCloseButton: true,
    panelClass: '',
    align: 'center',
  },
)

const emit = defineEmits<{ close: [] }>()

const rootRef = useTemplateRef<HTMLElement>('rootRef')
useFocusTrap(rootRef, computed(() => props.open))

const maxWidthClass = computed<string>(() => {
  // Tailwind 의 max-w-* 매핑 (full 만 별도)
  if (props.maxWidth === 'full') return 'max-w-full'
  return `max-w-${props.maxWidth}`
})

const titleId = computed(() => (props.title ? `bm-${Math.random().toString(36).slice(2, 8)}` : undefined))

function onBackdrop() {
  if (props.closeOnBackdrop) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (props.closeOnEsc && e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex justify-center bg-black/50 p-4"
      :class="align === 'top' ? 'items-start pt-24' : 'items-center'"
      @click.self="onBackdrop"
      @keydown="onKeydown"
    >
      <div
        ref="rootRef"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        class="flex max-h-[90vh] w-full flex-col rounded-lg border border-border bg-card text-card-foreground shadow-xl outline-none"
        :class="[maxWidthClass, panelClass]"
      >
        <!-- 헤더: header slot 우선, 없으면 title prop -->
        <header
          v-if="$slots.header || title || showCloseButton"
          class="flex items-center justify-between gap-2 border-b border-border px-4 py-2"
        >
          <div class="min-w-0 flex-1">
            <slot name="header">
              <h2 v-if="title" :id="titleId" class="truncate text-sm font-semibold">
                {{ title }}
              </h2>
            </slot>
          </div>
          <button
            v-if="showCloseButton"
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="닫기"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>

        <!-- 본문 -->
        <div class="flex-1 overflow-auto">
          <slot />
        </div>

        <!-- 푸터 (선택) -->
        <footer
          v-if="$slots.footer"
          class="border-t border-border px-4 py-2"
        >
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
