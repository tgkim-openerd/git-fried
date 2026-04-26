// UI 상태 — Zoom / Sidebar / Detail panel visibility (Sprint B5).
//
// localStorage 영속:
//   - zoom: html font-size px (기본 14, 8 ~ 24).
//   - sidebar: 좌측 280px 사이드바 visible.
//   - detail:  우측 360px 변경/브랜치/스태시... 패널 visible.

import { ref, watch } from 'vue'

const ZOOM_KEY = 'git-fried.zoom-px'
const SIDEBAR_KEY = 'git-fried.sidebar-visible'
const DETAIL_KEY = 'git-fried.detail-visible'

const ZOOM_MIN = 10
const ZOOM_MAX = 22
const ZOOM_DEFAULT = 14
const ZOOM_STEP = 1

function loadNumber(key: string, fallback: number): number {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return fallback
  return n
}

function loadBool(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  return raw === '1' || raw === 'true'
}

const zoomPx = ref<number>(
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, loadNumber(ZOOM_KEY, ZOOM_DEFAULT))),
)
const sidebarVisible = ref<boolean>(loadBool(SIDEBAR_KEY, true))
const detailVisible = ref<boolean>(loadBool(DETAIL_KEY, true))

// zoom 적용 — html 의 font-size 만 변경 (Tailwind rem 기반 자동 scale).
function applyZoom(px: number) {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = `${px}px`
}
applyZoom(zoomPx.value)

watch(zoomPx, (v) => {
  applyZoom(v)
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ZOOM_KEY, String(v))
    } catch {
      /* ignore */
    }
  }
})

watch(sidebarVisible, (v) => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SIDEBAR_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
})

watch(detailVisible, (v) => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(DETAIL_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
})

export function useUiState() {
  function zoomIn() {
    zoomPx.value = Math.min(ZOOM_MAX, zoomPx.value + ZOOM_STEP)
  }
  function zoomOut() {
    zoomPx.value = Math.max(ZOOM_MIN, zoomPx.value - ZOOM_STEP)
  }
  function zoomReset() {
    zoomPx.value = ZOOM_DEFAULT
  }
  function toggleSidebar() {
    sidebarVisible.value = !sidebarVisible.value
  }
  function toggleDetail() {
    detailVisible.value = !detailVisible.value
  }

  return {
    zoomPx,
    sidebarVisible,
    detailVisible,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleSidebar,
    toggleDetail,
  }
}
