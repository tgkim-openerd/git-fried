// 레포 / 워크스페이스 글로벌 상태.
// 서버 데이터(Vue Query) 와 별개로 "현재 활성 레포 id" 같은 클라이언트 상태만 보관.
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useReposStore = defineStore('repos', () => {
  const activeRepoId = ref<number | null>(null)
  const activeWorkspaceId = ref<number | null>(null)

  function setActiveRepo(id: number | null) {
    activeRepoId.value = id
  }
  function setActiveWorkspace(id: number | null) {
    activeWorkspaceId.value = id
    // 워크스페이스 전환 시 레포 선택 초기화
    activeRepoId.value = null
  }

  return {
    activeRepoId,
    activeWorkspaceId,
    setActiveRepo,
    setActiveWorkspace,
  }
})
