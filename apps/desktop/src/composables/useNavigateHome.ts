// Sprint c50 — useNavigateHome composable (Pattern 8 in vue3-composable-extraction).
//
// `router.push('/')` 가드 (currentRoute path !== '/') 를 한 곳에 모음.
// 동일 path push 시 history duplicate 방지 — ⌘← back 한 번이 같은 페이지에 stuck 되는 사고 차단.
//
// 4 LOC composable 이지만 5+ callsite (RepoTabBar / RepoSwitcherModal / repositories.vue /
// useCommandCatalog) 가 일관 가드 적용을 얻는 가치.
import { useRouter } from 'vue-router'

export function useNavigateHome(): () => void {
  const router = useRouter()
  return () => {
    if (router.currentRoute.value.path !== '/') void router.push('/')
  }
}
