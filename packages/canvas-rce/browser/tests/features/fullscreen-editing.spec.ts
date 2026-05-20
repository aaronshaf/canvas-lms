import {test, expect} from '../../fixtures/test'

// Verifies that the editor is fully functional while in fullscreen mode.
// Fullscreen is a React portal — this tests that it doesn't break TinyMCE's
// iframe context or the canvas-rce content pipeline.
test.describe('fullscreen editing', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    // Enter fullscreen
    await page.locator('[data-btn-id="rce-fullscreen-btn"]').click()
    await page.waitForTimeout(500)
  })

  test('editor is still functional after entering fullscreen', async ({page, rcePage}) => {
    await rcePage.contentFrame().locator('body').click()
    await rcePage.typeContent('typed in fullscreen')
    const content = await rcePage.getContent()
    expect(content).toContain('typed in fullscreen')
  })

  test('bold formatting works in fullscreen mode', async ({page, rcePage}) => {
    await rcePage.contentFrame().locator('body').click()
    await rcePage.typeContent('fullscreen bold')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>fullscreen bold<\/strong>/)
  })

  test('content persists after exiting fullscreen', async ({page, rcePage}) => {
    await rcePage.contentFrame().locator('body').click()
    await rcePage.typeContent('persisted after exit')
    // Exit fullscreen
    await page.locator('[data-btn-id="rce-fullscreen-btn"]').click()
    await page.waitForTimeout(500)
    const content = await rcePage.getContent()
    expect(content).toContain('persisted after exit')
  })

  test('toolbar container is visible in fullscreen mode', async ({page, rcePage}) => {
    // TinyMCE toolbar should still be visible in fullscreen (toolbar is outside the iframe)
    await expect(page.locator('.tox-toolbar__primary')).toBeVisible()
    await expect(page.locator('.tox-editor-header')).toBeVisible()
  })

  test('word count is visible in fullscreen mode', async ({page, rcePage}) => {
    const wordCount = page.locator('[data-testid="status-bar-word-count"]')
    await expect(wordCount).toBeVisible()
  })
})
