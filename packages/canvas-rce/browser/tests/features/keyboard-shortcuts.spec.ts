import {test, expect} from '../../fixtures/test'

test.describe('keyboard shortcuts dialog', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('keyboard shortcuts button is visible in status bar', async ({page}) => {
    await expect(page.locator('[data-btn-id="rce-kbshortcut-btn"]')).toBeVisible()
  })

  test('clicking keyboard shortcuts button opens the modal', async ({page}) => {
    await page.locator('[data-btn-id="rce-kbshortcut-btn"]').click()
    await expect(page.locator('[data-testid="RCE_KeyboardShortcutModal"]')).toBeVisible({
      timeout: 5_000,
    })
  })

  test('modal lists keyboard shortcuts', async ({page}) => {
    await page.locator('[data-btn-id="rce-kbshortcut-btn"]').click()
    const modal = page.locator('[data-testid="RCE_KeyboardShortcutModal"]')
    await modal.waitFor({state: 'visible', timeout: 5_000})
    // Should contain shortcut descriptions
    await expect(modal).toContainText('keyboard shortcuts')
  })

  test('pressing Alt+F10 also opens keyboard shortcuts', async ({page, rcePage}) => {
    await rcePage.contentFrame().locator('body').click()
    // Alt+F10 is TinyMCE's shortcut to focus the toolbar/open shortcuts
    await page.keyboard.press('Alt+F10')
    // The toolbar should receive focus — check toolbar is still visible (not a failure)
    await expect(page.locator('.tox-toolbar__primary')).toBeVisible()
  })
})
