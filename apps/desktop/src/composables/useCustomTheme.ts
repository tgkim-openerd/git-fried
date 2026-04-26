// Custom theme JSON export/import — Sprint C4 (`docs/plan/11 §24`).
//
// GitKraken 11.8 부터 일시 비활성된 custom theme. git-fried 가 단순 CSS
// 변수 export/import 로 흡수.
//
// 형식 (JSON):
//   {
//     "name": "...",
//     "mode": "dark" | "light",
//     "vars": {
//       "--background": "240 10% 3.9%",
//       "--foreground": "0 0% 98%",
//       ...
//     }
//   }
//
// 적용: html element 의 .style.setProperty(name, value).
// localStorage 'git-fried.custom-theme' 에 직렬화.

import { ref, watch } from 'vue'

export interface CustomTheme {
  name: string
  mode: 'dark' | 'light'
  vars: Record<string, string>
}

const KEY = 'git-fried.custom-theme.v1'

/** 사용자 편집 가능한 CSS 변수 목록 (color tokens). */
export const EDITABLE_VARS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
] as const

function loadInitial(): CustomTheme | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object') return null
    const t = obj as Record<string, unknown>
    if (typeof t.name !== 'string') return null
    if (t.mode !== 'dark' && t.mode !== 'light') return null
    if (!t.vars || typeof t.vars !== 'object') return null
    const vars: Record<string, string> = {}
    for (const [k, v] of Object.entries(t.vars as Record<string, unknown>)) {
      if (typeof v === 'string') vars[k] = v
    }
    return { name: t.name, mode: t.mode, vars }
  } catch {
    return null
  }
}

const customTheme = ref<CustomTheme | null>(loadInitial())

function applyVars(vars: Record<string, string>) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v)
  }
}

function clearVars(vars: Record<string, string>) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const k of Object.keys(vars)) {
    root.style.removeProperty(k)
  }
}

// 초기 적용.
if (customTheme.value) {
  applyVars(customTheme.value.vars)
}

watch(customTheme, (next, prev) => {
  if (prev) clearVars(prev.vars)
  if (next) {
    applyVars(next.vars)
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
    }
  } else if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }
})

export function useCustomTheme() {
  function exportJson(): string {
    const t: CustomTheme = customTheme.value ?? {
      name: 'git-fried-custom',
      mode: 'dark',
      vars: readCurrentVars(),
    }
    return JSON.stringify(t, null, 2)
  }

  function readCurrentVars(): Record<string, string> {
    if (typeof document === 'undefined') return {}
    const styles = getComputedStyle(document.documentElement)
    const out: Record<string, string> = {}
    for (const k of EDITABLE_VARS) {
      const v = styles.getPropertyValue(k).trim()
      if (v) out[k] = v
    }
    return out
  }

  function importJson(raw: string): { ok: boolean; error?: string } {
    try {
      const obj = JSON.parse(raw) as unknown
      if (!obj || typeof obj !== 'object') {
        return { ok: false, error: '유효한 JSON 객체가 아님' }
      }
      const t = obj as Record<string, unknown>
      const name = typeof t.name === 'string' ? t.name : 'imported'
      const mode = t.mode === 'light' ? 'light' : 'dark'
      if (!t.vars || typeof t.vars !== 'object') {
        return { ok: false, error: 'vars 필드 누락' }
      }
      const vars: Record<string, string> = {}
      for (const [k, v] of Object.entries(t.vars as Record<string, unknown>)) {
        if (typeof v !== 'string') continue
        if (!k.startsWith('--')) continue
        vars[k] = v
      }
      if (Object.keys(vars).length === 0) {
        return { ok: false, error: 'vars 에 유효한 항목 없음' }
      }
      customTheme.value = { name, mode, vars }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }

  function reset() {
    customTheme.value = null
  }

  return {
    customTheme,
    exportJson,
    importJson,
    reset,
    readCurrentVars,
  }
}
