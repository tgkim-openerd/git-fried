import { expect, test } from '@playwright/test'
import { setKoreanLocale } from './helpers'

// Sprint c40 후속 / /analyze LOW 7 — Settings page e2e (5 sub-component 분해 검증).
//
// 검증:
//   1) /settings 진입 → 좌측 카테고리 nav 노출 (6 그룹)
//   2) 각 카테고리 클릭 → 해당 sub-component template 의 핵심 텍스트 노출
//      (General / UI Customization / Editor / Maintenance / Plugin / About)
//   3) c40 후속 분해 (5 sub-component) 의 마운트 정상 동작 검증

test.describe('Settings page — 5 sub-component 마운트 + 카테고리 nav', () => {
  test.beforeEach(async ({ page }) => {
    // 한국어 i18n assertion 대상 — locale 'ko' 강제 (Chromium 기본 navigator='en-US' 회피).
    await page.goto('/')
    await setKoreanLocale(page)
    await page.goto('/settings')
  })

  test('좌측 카테고리 nav + 기본 카테고리 (Profiles) 노출', async ({ page }) => {
    // testid SoT — i18n drift / locale 무관 (UltraPlan v0.4 ARCH-003 회복).
    await expect(page.locator('[data-testid="settings-category-profiles"]')).toBeVisible()
    await expect(page.locator('[data-testid="settings-category-forge"]')).toBeVisible()
  })

  // category id 별 testid SoT — i18n / nav label 변경 무관 안정성.
  function navTestId(page: import('@playwright/test').Page, id: string) {
    return page.locator(`[data-testid="settings-category-${id}"]`)
  }

  test('General 카테고리 → SettingsGeneral 마운트', async ({ page }) => {
    await navTestId(page, 'general').click()
    await expect(page.getByRole('heading', { name: 'General', level: 2 })).toBeVisible()
    await expect(page.getByText(/Auto-Fetch 간격/)).toBeVisible()
    await expect(page.getByText(/Auto-Prune on fetch/)).toBeVisible()
  })

  test('UI Customization → SettingsUiCustomization 마운트 + Custom theme', async ({ page }) => {
    await navTestId(page, 'ui').click()
    await expect(page.getByRole('heading', { name: 'UI Customization', level: 2 })).toBeVisible()
    await expect(page.getByText(/Date locale/)).toBeVisible()
    await expect(page.getByText(/Custom theme \(JSON\)/)).toBeVisible()
  })

  test('Editor / Terminal → SettingsEditor 마운트', async ({ page }) => {
    await navTestId(page, 'editor').click()
    await expect(page.getByRole('heading', { name: 'Editor / Terminal', level: 2 })).toBeVisible()
    await expect(page.getByText(/Zoom.*px/)).toBeVisible()
  })

  test('Maintenance → SettingsMaintenance 마운트', async ({ page }) => {
    await navTestId(page, 'maintenance').click()
    await expect(page.getByRole('heading', { name: '레포 유지보수', level: 2 })).toBeVisible()
  })

  test('Plugin / Integration — futureRelease 비활성 (v0.5 예정)', async ({ page }) => {
    // settings.vue:83 의 plugin item futureRelease: true — click 차단 + tooltip 노출 검증.
    // UltraPlan v0.4 ARCH-003 후속 — Plugin/Integration 마운트 test 는 v0.5 출시 후 활성화.
    const btn = navTestId(page, 'plugin')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('aria-disabled', 'true')
    await expect(btn).toHaveAttribute('title', /v0\.5/)
  })
})
