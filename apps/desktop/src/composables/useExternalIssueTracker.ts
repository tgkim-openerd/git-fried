// v0.4 #7 (UltraPlan plan/31) — Linear / Jira / Trello 외부 issue tracker 통합 skeleton.
//
// SettingsPluginIntegration 의 placeholder eta='v0.5' 를 실 API 진입점으로 승격.
// 현재는 **mutation skeleton + 타입 정의만** — 실 API 호출은 사용자 PAT 등록 후.
//
// 외부 API:
//   - Linear: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
//   - Jira REST v3: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
//   - Trello: https://developer.atlassian.com/cloud/trello/rest/

import { ref } from 'vue'

export type IssueTracker = 'linear' | 'jira' | 'trello'

export interface IssueTrackerCredential {
  tracker: IssueTracker
  /** Linear API key / Jira Email+API token / Trello key+token */
  apiKey: string
  /** Jira 도메인 (https://your-domain.atlassian.net) — Jira/Trello 만 */
  baseUrl?: string
  /** Jira 사용자 email — Jira basic auth 만 */
  email?: string
}

export interface IssueRef {
  tracker: IssueTracker
  id: string
  title: string
  url: string
  state: 'open' | 'closed' | 'in_progress'
}

const LS_KEY = 'git-fried.issue-tracker-credentials.v1'

function readCreds(): IssueTrackerCredential[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as IssueTrackerCredential[]
  } catch {
    return []
  }
}

function writeCreds(creds: IssueTrackerCredential[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(creds))
  } catch {
    // localStorage 비활성 — silent
  }
}

// ARCH-002 fix (code-review 2026-05-13) — lazy localStorage load.
// 기존: 모듈-스코프 즉시 readCreds() — SSR / pre-hydrate / 시크릿 모드 환경에서
// localStorage 미준비 시 빈 배열 영구 고정 (사용자 credentials lost). null 초기 +
// 첫 호출 lazy read 로 회피.
const credsRef = ref<IssueTrackerCredential[] | null>(null)

function ensureLoaded(): IssueTrackerCredential[] {
  if (credsRef.value == null) {
    credsRef.value = readCreds()
  }
  return credsRef.value
}

export function useExternalIssueTracker() {
  ensureLoaded()

  function addCredential(c: IssueTrackerCredential): void {
    // 같은 tracker 중복 시 update.
    const current = ensureLoaded()
    const next = current.filter((x) => x.tracker !== c.tracker).concat(c)
    credsRef.value = next
    writeCreds(next)
  }

  function deleteCredential(tracker: IssueTracker): void {
    const current = ensureLoaded()
    const next = current.filter((x) => x.tracker !== tracker)
    credsRef.value = next
    writeCreds(next)
  }

  /**
   * commit message / PR body 안 issue ref 검색. skeleton — 실 API 호출은
   * Linear (GraphQL `Issue` query), Jira (`/rest/api/3/issue/{id}`), Trello
   * (`/cards/{id}`). v0.5+ phase.
   */
  async function findIssue(_query: string): Promise<IssueRef | null> {
    // v0.5 — API 호출. 본 skeleton 은 null 반환.
    return null
  }

  return {
    credentials: credsRef,
    addCredential,
    deleteCredential,
    findIssue,
  }
}

/** 테스트 — credentials 초기화. */
export function __resetExternalIssueTrackerForTest(): void {
  credsRef.value = []
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // ignore
  }
}
