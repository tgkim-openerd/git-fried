/**
 * Sprint c75-B — App.vue onboarding detect 분리.
 *
 * Sprint 22-20 design §8-7 hard constraint — 첫 실행 시 GitKraken 데이터 자동 감지 →
 * toast.info 안내. localStorage 'git-fried.onboarded.v1' 부재 시 한 번만. detect 실패
 * silent (다음 실행 재시도, localStorage 마킹 안 함).
 *
 * v0.4 #2 (UltraPlan plan/31 §9 Q1 옵션 c 절충): toast 1회 + 7s 후 자동 wizard.
 * 사용자 dismiss 가능 — FirstRunWizard 의 localStorage
 * 'git-fried.firstRunWizard.completed.v1' 마킹.
 */
import { onMounted } from 'vue'
import { importGitKrakenDetect } from '@/api/git'
import { useToast } from '@/composables/useToast'
import { useFirstRunWizard } from '@/composables/useFirstRunWizard'

const ONBOARDED_KEY = 'git-fried.onboarded.v1'
/** v0.4 #2 — toast 후 wizard modal 자동 open 까지 delay (Q1 옵션 c). */
const WIZARD_AUTO_OPEN_DELAY_MS = 7_000

export function useOnboardingDetect() {
  const toast = useToast()
  const wizard = useFirstRunWizard()

  function scheduleWizardOpen(): void {
    setTimeout(() => {
      // wizard.open() 내부에서 hasCompleted() 체크 — 이미 완료 시 noop.
      wizard.open(1)
    }, WIZARD_AUTO_OPEN_DELAY_MS)
  }

  onMounted(async () => {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(ONBOARDED_KEY)) return
    try {
      const result = await importGitKrakenDetect()
      if (result && result.repoCount > 0) {
        toast.info(
          `GitKraken 데이터 발견 — ${result.repoCount} 레포`,
          `워크스페이스 ${result.workspaceCount}개 / 즐겨찾기 ${result.favoriteCount}개 / 탭 ${result.tabCount}개\n` +
            'Settings → 시작·마이그레이션 → GitKraken 가져오기 에서 진행',
          12_000,
        )
      } else {
        // Sprint c46 UX-1 — repo 0개 시 명시 toast (사용자 인지: detect 동작했으나 데이터 없음)
        toast.info(
          '환영합니다',
          'Sidebar 의 ➕ 버튼 또는 ⌘⇧P (Repo Switcher) 로 첫 레포를 추가하세요.\nGitKraken 사용 중이라면 Settings → 시작·마이그레이션 에서 가져올 수 있습니다.',
          10_000,
        )
      }
      localStorage.setItem(ONBOARDED_KEY, String(Date.now()))
      // v0.4 #2 — Q1 옵션 c 절충: toast 표시 + 7s 후 wizard 자동 open.
      scheduleWizardOpen()
    } catch {
      // detect 실패는 silent — 다음 실행에서 재시도. localStorage 마킹 안 함.
    }
  })
}
