// v0.4 #6 (UltraPlan plan/31) — 외부 editor 통합 (GitKraken Settings 매트릭스 GK7).
//
// VSCode / Sublime / IntelliJ / WebStorm / Cursor 의 URI scheme 으로 shell.open.
// OS handler (Windows: protocol handler, macOS: URI scheme handler, Linux: xdg-open)
// 가 editor launch. Tauri `Command` API 직접 spawn 대신 URI 방식 — capabilities 단순.
//
// 외부 사례:
//  - VSCode: `vscode://file/<absolute-path>`
//  - VSCode Insiders: `vscode-insiders://file/<absolute-path>`
//  - Cursor: `cursor://file/<absolute-path>`
//  - Sublime Text: subl 의 protocol handler 미흡 → file:// 경로로 fallback
//  - IntelliJ / WebStorm: `idea://open?file=<absolute-path>` / `webstorm://open?file=...`
//    (JetBrains URL Protocol Handler 활성화 시)
//
// 호출:
//   const { isAvailable, openInExternalEditor } = useExternalEditor()
//   if (isAvailable.value) await openInExternalEditor('/path/to/repo')
//
// 권한: capabilities/default.json 의 `shell:allow-open` 필요 (이미 등록됨).

import { computed, type ComputedRef } from 'vue'
import { open as openShell } from '@tauri-apps/plugin-shell'
import { useUiSettingsStore, type ExternalEditorKind } from '@/composables/useUserSettings'

/** editor 별 URI 생성. None / 미지원 시 null. */
export function buildEditorUri(kind: ExternalEditorKind, absolutePath: string): string | null {
  // 절대경로 보장 + URL-encode (한글 safety — Windows 경로 backslash 도 forward 로 변환).
  const normalized = absolutePath.replace(/\\/g, '/')
  const encoded = encodeURI(normalized)
  switch (kind) {
    case 'none':
      return null
    case 'vscode':
      return `vscode://file/${encoded}`
    case 'vscode-insiders':
      return `vscode-insiders://file/${encoded}`
    case 'cursor':
      return `cursor://file/${encoded}`
    case 'intellij':
      return `idea://open?file=${encoded}`
    case 'webstorm':
      return `webstorm://open?file=${encoded}`
    case 'sublime':
      // subl 자체 URI scheme 미정착 → file:// 경로로 OS 의 default file handler 호출.
      // 사용자가 .gitignore / .vue / .ts 등 확장자별 default 를 Sublime 으로 설정해 있어야 함.
      return `file://${encoded}`
    default:
      return null
  }
}

/**
 * 외부 editor 통합 composable.
 *
 * - `isAvailable` — UiSettings.externalEditor !== 'none'
 * - `openInExternalEditor(absolutePath)` — URI 생성 + shell.open
 *
 * 실패 (URI handler 미등록 / 사용자 OS 거부) 시 silent — 사용자 OS-level 알림.
 * Tauri shell.open 의 error 는 caller 가 catch.
 */
export function useExternalEditor(): {
  isAvailable: ComputedRef<boolean>
  openInExternalEditor: (absolutePath: string) => Promise<void>
} {
  const ui = useUiSettingsStore()

  const isAvailable = computed(() => ui.value.externalEditor !== 'none')

  async function openInExternalEditor(absolutePath: string): Promise<void> {
    const uri = buildEditorUri(ui.value.externalEditor, absolutePath)
    if (uri == null) return
    await openShell(uri)
  }

  return { isAvailable, openInExternalEditor }
}
