// IPC / 앱 전반의 에러 표시 helper.
//
// Tauri IPC 에러는 Rust AppError 가 `{ kind, message, ... }` 객체로 직렬화됨.
// 일반 throw 된 Error / 문자열 / null 도 모두 표시 가능하게 통합.

export interface AppErrorPayload {
  kind?: string
  message?: string
  stderr?: string
  exitCode?: number | null
}

/**
 * 어떤 에러든 사람이 읽을 수 있는 한 줄 메시지로 변환.
 *
 * - Tauri AppError 객체: `[kind] message` 형식
 * - JS Error: `error.message`
 * - 문자열: 그대로
 * - 그 외: JSON.stringify 폴백
 */
export function formatError(e: unknown): string {
  if (e == null) return ''
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message

  if (typeof e === 'object') {
    const obj = e as AppErrorPayload & Record<string, unknown>
    if (typeof obj.message === 'string') {
      const kind = typeof obj.kind === 'string' ? `[${obj.kind}] ` : ''
      const stderr =
        typeof obj.stderr === 'string' && obj.stderr.trim()
          ? `\n${obj.stderr.trim()}`
          : ''
      return `${kind}${obj.message}${stderr}`
    }
    try {
      return JSON.stringify(e, null, 2)
    } catch {
      return Object.prototype.toString.call(e)
    }
  }

  return String(e)
}

/**
 * git CLI / forge / IPC 에러 메시지에서 흔한 패턴을 감지해 한국어 힌트 추가.
 * 원본 메시지 + 줄바꿈 + 가이드.
 */
export function humanizeGitError(rawMessage: string): string {
  const m = rawMessage
  let hint: string | null = null

  // Pull / Fetch 빈 remote
  if (
    m.includes('no such ref was fetched') ||
    m.includes("couldn't find remote ref")
  ) {
    hint =
      '⚠ 원격 저장소에 해당 브랜치가 아직 없습니다.\n' +
      '   - 첫 push 가 필요할 수 있습니다: `git push -u origin <branch>`\n' +
      '   - 또는 remote 가 다른 기본 브랜치를 사용 중인지 확인 (예: master vs main)'
  } else if (m.includes('remote: Repository not found')) {
    hint =
      '⚠ remote 저장소를 찾을 수 없습니다 (404).\n' +
      '   - URL 오타 / private 레포 인증 여부 확인'
  } else if (
    m.includes('Authentication failed') ||
    m.includes('could not read Username') ||
    m.includes('Permission denied (publickey)')
  ) {
    hint =
      '⚠ 인증 실패. 다음 중 하나를 확인하세요:\n' +
      '   - PAT 가 만료되지 않았는지 (설정 → Forge 계정)\n' +
      '   - SSH 키가 ssh-agent 에 추가됐는지\n' +
      '   - credential.helper 가 정상 동작하는지'
  } else if (
    // Sprint 22-6 F-I2: Forge HTTP 401 / 403 (PAT 만료 / 권한 부족)
    m.includes('401 Unauthorized') ||
    m.includes('HTTP 401') ||
    m.includes('"status":401') ||
    /\bstatus\s*[=:]\s*401\b/.test(m) ||
    m.includes('Bad credentials') ||
    m.includes('token expired') ||
    m.includes('invalid token')
  ) {
    hint =
      '⚠ Forge 인증 만료 — PAT (Personal Access Token) 를 재발급/갱신하세요.\n' +
      '   - 설정 → Forge 계정 → 새 토큰 입력\n' +
      '   - GitHub: Settings → Developer settings → Personal access tokens\n' +
      '   - Gitea: 우상단 프로필 → Settings → Applications → Generate Token'
  } else if (
    m.includes('403 Forbidden') ||
    m.includes('HTTP 403') ||
    m.includes('"status":403') ||
    /\bstatus\s*[=:]\s*403\b/.test(m)
  ) {
    hint =
      '⚠ 권한 부족 (403) — 토큰의 scope 또는 레포 접근 권한 확인.\n' +
      '   - GitHub PAT: `repo` scope 필요 (private 레포)\n' +
      '   - Gitea PAT: `repo` + `write:issue` 등 필요 작업별 scope 추가'
  } else if (m.includes('CONFLICT')) {
    hint =
      '⚠ 머지 충돌 발생. 변경사항 패널에서 충돌 파일을 해결하고 stage + commit.'
  } else if (
    m.includes('non-fast-forward') ||
    m.includes('Updates were rejected')
  ) {
    hint =
      '⚠ non-fast-forward push 가 거부됐습니다.\n' +
      '   - 먼저 pull 또는 rebase 후 다시 push\n' +
      '   - 또는 강제 푸시 (force-with-lease) — 단, 공유 브랜치는 위험'
  } else if (
    m.includes('safe.directory') ||
    m.includes('dubious ownership')
  ) {
    hint =
      '⚠ Git 의 safe.directory 정책 거부.\n' +
      '   git-fried 는 safe.directory=* 를 자동 주입하지만 외부 git 호출이 막힐 수 있습니다.'
  } else if (m.includes('No such file or directory')) {
    hint = '⚠ 경로가 존재하지 않거나 삭제됨.'
  }

  return hint ? `${m}\n\n${hint}` : m
}

/** 토스트/alert 용 — formatError + humanizeGitError 통합. */
export function describeError(e: unknown): string {
  return humanizeGitError(formatError(e))
}
