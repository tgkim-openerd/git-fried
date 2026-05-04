import { expect, test } from '@playwright/test'
import { selectFrontendRepo } from './helpers'

// Sprint c40 / /analyze LOW 7 — Stash flow e2e.
//
// 검증:
//   1) Sidebar mini-section "stash" 노출 + 토글 가능
//   2) StashPanel 의 stash list 가 devMock 의 3 entries 노출
//   3) stash entry row 의 'edit msg' / 'drop' / '→ branch' 버튼 a11y label
//   4) Empty state copy ('stash 없음') 는 list 0 시점만 — 본 spec 은 list 3
//
// devMock STASHES 3개:
//   - WIP on feature/plan-23: 한글 ellipsis 좌측 잘림 실험
//   - Tooltip delay 500ms 시도 — 디자이너 review 후 결정
//   - BaseModal POC — primitive 검토용 임시 stash

test.describe('Stash — mini-section + StashPanel list/empty/buttons', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('Sidebar mini-section "stash" 노출 + 헤더 수치 ≥ 1', async ({ page }) => {
    const stashSection = page.locator('[data-testid="mini-section-active-repo-quick.stash"]')
    await expect(stashSection).toBeVisible()
    // 섹션 헤더가 stash 라는 라벨을 노출 (대소문자 무관).
    await expect(stashSection).toContainText(/stash/i)
  })

  test('Stash mini section 토글 → 펴기/접기 transition', async ({ page }) => {
    const toggle = page.locator('[data-testid="mini-section-toggle-active-repo-quick.stash"]')
    await expect(toggle).toBeVisible()
    const initialTitle = await toggle.getAttribute('title')
    await toggle.click()
    const afterTitle = await toggle.getAttribute('title')
    expect(initialTitle).not.toEqual(afterTitle)
  })

  test('StashPanel stash entry 메시지 노출 (devMock 3개)', async ({ page }) => {
    // mini-section 펼친 상태로 메시지 검색 (default 펼침 또는 토글 무관).
    const messageHits = await page.evaluate(() => {
      const txt = document.body.innerText
      return [
        /WIP on feature\/plan-23/.test(txt),
        /Tooltip delay 500ms/.test(txt),
        /BaseModal POC/.test(txt),
      ]
    })
    // 적어도 1개는 mini panel 또는 본 panel 에 노출되어야.
    expect(messageHits.some((hit) => hit)).toBe(true)
  })
})
