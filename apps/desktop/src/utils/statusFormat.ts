// File status (ChangeStatus) → 사용자 표시 라벨 / 색상 매핑.
// StatusPanel / DiffViewer / 향후 BulkOperationModal 등 공용.
//
// 한글 라벨 SoT — UI 어디서든 `추가 / 수정 / 삭제 / 이름변경 / 복사 / 타입변경` 일관 노출.
// 색상은 plan/28 옵션 C semantic class — diff-add / warning-amber / diff-delete / diff-rename.

import type { ChangeStatus } from '@/types/git'

export function statusLabel(s: ChangeStatus): string {
  switch (s) {
    case 'added':
      return '추가'
    case 'modified':
      return '수정'
    case 'deleted':
      return '삭제'
    case 'renamed':
      return '이름변경'
    case 'copied':
      return '복사'
    case 'typechange':
      return '타입변경'
    default:
      return '?'
  }
}

export function statusColor(s: ChangeStatus): string {
  switch (s) {
    case 'added':
      return 'text-diff-add'
    case 'modified':
      return 'text-warning-amber'
    case 'deleted':
      return 'text-diff-delete'
    case 'renamed':
    case 'copied':
      return 'text-diff-rename'
    default:
      return 'text-muted-foreground'
  }
}
