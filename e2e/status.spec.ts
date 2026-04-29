import { expect, test } from '@playwright/test'
import { ensureDetailVisible, selectFrontendRepo } from './helpers'

test.describe('상태 패널 — Sidebar mini / ChangeCountBadge / Path-Tree / sticky', () => {
  test.beforeEach(async ({ page }) => {
    await selectFrontendRepo(page)
  })

  test('ChangeCountBadge 영구 노출 + 12 file changes', async ({ page }) => {
    const badge = page
      .locator('[data-testid="change-count-badge"]')
      .filter({ hasText: 'file changes' })
      .first()
    await expect(badge).toBeVisible()
    await expect(badge).toContainText(/12/)
    await expect(badge).toContainText(/staged 3/)
    await expect(badge).toContainText(/mod 5/)
  })

  // Sprint c30 / GitKraken UX (Phase 2b) — Stage All Changes emerald 버튼.
  test('Stage All Changes 버튼 — unstaged > 0 시 표시', async ({ page }) => {
    // devMock 의 default state 는 unstaged 5 + untracked 4 → button 보여야.
    const stageAllBtn = page.locator('[data-testid="stage-all-changes"]').first()
    await expect(stageAllBtn).toBeVisible()
    await expect(stageAllBtn).toContainText(/Stage All Changes/i)
  })

  test('Sidebar 4 mini sections + collapsible 토글', async ({ page }) => {
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.branches"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.stash"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.worktree"]')).toBeVisible()
    await expect(page.locator('[data-testid="mini-section-active-repo-quick.pr"]')).toBeVisible()

    const stashToggle = page.locator('[data-testid="mini-section-toggle-active-repo-quick.stash"]')
    await expect(stashToggle).toHaveAttribute('title', /접기/)
    await stashToggle.click()
    await expect(stashToggle).toHaveAttribute('title', /펴기/)
  })

  // Phase 5 — auto-default 가 dirty 시 WIP_SHA 활성. StatusPanel 의 section 헤더는 'Staged'/'Modified'/'Untracked' (TitleCase).
  // ensureWipActive: auto-default + click 둘 다 시도 (timing 견고). ring-1 가 active 마커 (hover:bg-accent 와 충돌 회피).
  async function ensureWipActive(page: import('@playwright/test').Page) {
    const wipRow = page.locator('[data-testid="wip-row"]')
    await expect(wipRow).toBeVisible()
    const isActive = async () =>
      (await wipRow.evaluate((el) => el.className.includes('ring-1'))) === true
    // 최대 5번 시도 — auto-default 안 들어왔으면 click, click 으로 toggle off 됐으면 다시 click.
    for (let i = 0; i < 5; i++) {
      if (await isActive()) return
      await wipRow.click()
      await page.waitForTimeout(300)
    }
    await expect(wipRow).toHaveClass(/ring-1/, { timeout: 3_000 })
  }

  test('Path/Tree 토글 + 4 섹션 노출', async ({ page }) => {
    await ensureWipActive(page)
    await page.waitForFunction(
      () => {
        const t = document.body.innerText
        return /Staged.*Modified.*Untracked/is.test(t)
      },
      { timeout: 5_000 },
    )

    const treeBtn = page.locator('button[aria-label="디렉토리 트리 모드"]')
    await treeBtn.click()
    const stored = await page.evaluate(() => localStorage.getItem('git-fried.status.viewMode'))
    expect(stored).toBe('tree')
  })

  // Sprint c30 / GitKraken UX (Phase 2a + 5) — graph 위 sticky WIP pseudo-row.
  test('WipRow 표시 + 활성 → 우측 staging panel + ring highlight', async ({ page }) => {
    const wipRow = page.locator('[data-testid="wip-row"]')
    await expect(wipRow).toBeVisible()
    await expect(wipRow).toContainText('// WIP')
    await expect(wipRow).toContainText(/12/) // change count badge

    await ensureWipActive(page)
    // 우측 sidebar = StatusPanel (Staged/Modified/Untracked 등 텍스트로 검증).
    await page.waitForFunction(
      () => {
        const t = document.body.innerText
        return /Staged|Modified|Untracked/i.test(t)
      },
      { timeout: 5_000 },
    )
  })

  test('WipRow 재클릭 → 선택 해제 (toggle)', async ({ page }) => {
    const wipRow = page.locator('[data-testid="wip-row"]')
    await ensureWipActive(page)
    // 한 번 더 클릭 → 비활성화 (ring-1 사라짐).
    await wipRow.click()
    await expect(wipRow).not.toHaveClass(/ring-1/, { timeout: 3_000 })
  })

  // Sprint c30 / GitKraken UX (Phase 3 + 5) — 파일 row 더블클릭 → fullscreen diff
  test('Status 파일 row 더블클릭 → fullscreen diff + ESC 닫기', async ({ page }) => {
    await ensureWipActive(page)

    const firstUnstaged = page.locator('li[draggable="true"]').first()
    await expect(firstUnstaged).toBeVisible({ timeout: 5_000 })
    await firstUnstaged.dblclick()

    const fs = page.locator('[data-testid="fullscreen-diff"]')
    await expect(fs).toBeVisible({ timeout: 2_000 })

    await page.keyboard.press('Escape')
    await expect(fs).toHaveCount(0, { timeout: 2_000 })
  })

  test('fullscreen diff ✕ 버튼 → close', async ({ page }) => {
    await ensureWipActive(page)
    const firstUnstaged = page.locator('li[draggable="true"]').first()
    await expect(firstUnstaged).toBeVisible({ timeout: 5_000 })
    await firstUnstaged.dblclick()
    await expect(page.locator('[data-testid="fullscreen-diff"]')).toBeVisible({ timeout: 2_000 })

    await page.locator('[data-testid="fullscreen-diff-close"]').click()
    await expect(page.locator('[data-testid="fullscreen-diff"]')).toHaveCount(0)
  })

  test('Status 4 section sticky + STAGED bulk-unstage button', async ({ page }) => {
    await ensureDetailVisible(page)
    await ensureWipActive(page)

    const sticky = await page.evaluate(() => {
      const txts = ['Staged', 'Modified', 'Untracked', 'Conflicted']
      return txts.map((t) => {
        const span = Array.from(document.querySelectorAll('span, div')).find(
          (el) =>
            el.children.length === 0 &&
            new RegExp(`[▶▼]\\s*${t}\\s*\\(`).test(el.textContent ?? ''),
        )
        const header = span?.closest('div.sticky')
        return { name: t, sticky: !!header }
      })
    })
    expect(sticky.every((s) => s.sticky)).toBe(true)

    const unstageAllBtn = page.locator('button[title*="모두 unstage"]')
    await expect(unstageAllBtn).toBeVisible()
  })
})
