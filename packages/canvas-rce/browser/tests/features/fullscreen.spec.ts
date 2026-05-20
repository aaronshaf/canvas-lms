import {test, expect} from '../../fixtures/test'

test.describe('fullscreen toggle', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('fullscreen button exists in status bar', async ({page}) => {
    await expect(page.locator('[data-btn-id="rce-fullscreen-btn"]')).toBeVisible()
  })

  test('clicking fullscreen expands editor', async ({page}) => {
    await page.locator('[data-btn-id="rce-fullscreen-btn"]').click()
    // In fullscreen, the RCE wrapper gets a fullscreen class or the editor fills the viewport
    // aria-label changes to "Exit Fullscreen" or the button title changes
    await expect(page.locator('[data-btn-id="rce-fullscreen-btn"]')).toBeVisible()
    // Editor container should now have expanded dimensions
    const editorBox = await page.locator('.tox-tinymce').boundingBox()
    expect(editorBox?.width).toBeGreaterThan(800)
  })
})
