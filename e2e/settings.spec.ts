import { expect, test } from '@playwright/test'

// Sprint c40 후속 / /analyze LOW 7 — Settings page e2e (5 sub-component 분해 검증).
//
// 검증:
//   1) /settings 진입 → 좌측 카테고리 nav 노출 (6 그룹)
//   2) 각 카테고리 클릭 → 해당 sub-component template 의 핵심 텍스트 노출
//      (General / UI Customization / Editor / Maintenance / Plugin / About)
//   3) c40 후속 분해 (5 sub-component) 의 마운트 정상 동작 검증

test.describe('Settings page — 5 sub-component 마운트 + 카테고리 nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
  })

  test('좌측 카테고리 nav + 기본 카테고리 (Profiles) 노출', async ({ page }) => {
    // 6 그룹 라벨 (account / workspace / editor / ui / maintenance / start) 중 일부.
    await expect(page.getByText(/Profiles/i).first()).toBeVisible()
    await expect(page.getByText(/Forge/i).first()).toBeVisible()
  })

  // 카테고리 nav 의 button 은 aria-label="그룹 > Item" 형식이라 textContent 로 매칭.
  // aria-pressed 가 있는 button (카테고리 버튼) 으로 좁혀 안전 선택.
  function navButton(page: import('@playwright/test').Page, text: string) {
    return page.locator('button[aria-pressed]').filter({ hasText: text }).first()
  }

  test('General 카테고리 → SettingsGeneral 마운트', async ({ page }) => {
    await navButton(page, 'General').click()
    await expect(page.getByRole('heading', { name: 'General', level: 2 })).toBeVisible()
    await expect(page.getByText(/Auto-Fetch 간격/)).toBeVisible()
    await expect(page.getByText(/Auto-Prune on fetch/)).toBeVisible()
  })

  test('UI Customization → SettingsUiCustomization 마운트 + Custom theme', async ({ page }) => {
    await navButton(page, 'UI Customization').click()
    await expect(page.getByRole('heading', { name: 'UI Customization', level: 2 })).toBeVisible()
    await expect(page.getByText(/Date locale/)).toBeVisible()
    await expect(page.getByText(/Custom theme \(JSON\)/)).toBeVisible()
  })

  test('Editor / Terminal → SettingsEditor 마운트', async ({ page }) => {
    await navButton(page, 'Editor / Terminal').click()
    await expect(page.getByRole('heading', { name: 'Editor / Terminal', level: 2 })).toBeVisible()
    await expect(page.getByText(/Zoom.*px/)).toBeVisible()
  })

  test('Maintenance → SettingsMaintenance 마운트', async ({ page }) => {
    await navButton(page, 'gc / fsck / LFS').click()
    await expect(page.getByRole('heading', { name: '레포 유지보수', level: 2 })).toBeVisible()
  })

  test('Plugin / Integration → SettingsPluginIntegration 마운트', async ({ page }) => {
    await navButton(page, '외부 도구 연결').click()
    await expect(
      page.getByRole('heading', { name: 'Plugin / Integration', level: 2 }),
    ).toBeVisible()
    await expect(page.getByText(/GitHub Actions/)).toBeVisible()
  })
})
