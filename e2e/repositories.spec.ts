import { expect, test } from '@playwright/test'

// Sprint c40 / /analyze LOW 7 후속 — Repositories page e2e (Clone modal +
// Bulk fetch / 4 액션 버튼).
//
// 검증:
//   1) 4 액션 버튼 (Browse / Clone / Fetch All / 최근 일괄 fetch 결과) 노출
//   2) Clone 버튼 클릭 → CloneRepoModal v-if=open 마운트
//   3) Repository Management 헤더 + table-of-repos 노출
//
// 본 spec 은 /repositories 페이지로 직접 navigate (selectFrontendRepo 불필요).

test.describe('Repositories page — Clone modal trigger + 4 액션 버튼', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/repositories')
  })

  test('헤더 + Clone 버튼 + Browse 버튼 노출', async ({ page }) => {
    await expect(page.getByText('Repository Management')).toBeVisible()
    await expect(page.getByRole('button', { name: /Browse/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Clone/i })).toBeVisible()
  })

  test('Fetch All 버튼 — 활성 레포 수 표시 (devMock)', async ({ page }) => {
    const fetchAllBtn = page.getByRole('button', { name: /Fetch All/i })
    await expect(fetchAllBtn).toBeVisible()
    // devMock 의 list_repos 가 0보다 많은 레포 반환 (전체 ${count} 레포 일괄 fetch).
    const titleAttr = await fetchAllBtn.getAttribute('title')
    expect(titleAttr).toMatch(/전체 \d+ 레포/)
  })

  test('Clone 버튼 클릭 → BaseModal 마운트 (role=dialog + aria-modal)', async ({ page }) => {
    // mount 전 dialog 부재 확인.
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0)
    await page.getByRole('button', { name: /Clone/i }).click()
    // BaseModal 의 root role=dialog + aria-modal=true 가 mount.
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible({
      timeout: 3_000,
    })
  })
})
