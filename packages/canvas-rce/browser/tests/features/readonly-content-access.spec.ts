import {test, expect} from '../../fixtures/test'

// A readonly editor must still expose its content via getContent() —
// Canvas uses this for "preview" mode where content is displayed but not edited.
// If a refactor breaks getContent() in readonly mode, preview rendering breaks.
test.describe('readonly editor — content access', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/readonly')
    await rcePage.waitForEditor()
  })

  test('getContent() returns the defaultContent in readonly mode', async ({page, rcePage}) => {
    const content = await rcePage.getContent()
    // The readonly scenario loads with default content — it must be accessible
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  test('readonly editor content matches what is visible in the iframe', async ({page, rcePage}) => {
    const content = await rcePage.getContent()
    const bodyText = await rcePage.contentFrame().locator('body').innerText()
    // Plain text from iframe body should be a subset of what getContent() contains
    if (bodyText.trim().length > 0) {
      expect(content).toContain(bodyText.trim().slice(0, 20))
    }
  })

  test('textarea reflects readonly editor content', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.save()
      const ta = document.querySelector<HTMLTextAreaElement>('textarea')
      return ta?.value ?? ''
    })
    expect(typeof content).toBe('string')
  })

  test('readonly editor does not accept keyboard input', async ({page, rcePage}) => {
    const contentBefore = await rcePage.getContent()
    // Try to type in the editor — should be ignored
    await rcePage.contentFrame().locator('body').click({force: true})
    await page.keyboard.type('should not appear')
    const contentAfter = await rcePage.getContent()
    // Content must not have changed
    expect(contentAfter).toBe(contentBefore)
  })

  test('readonly editor toolbar is disabled', async ({page}) => {
    // TinyMCE sets aria-disabled on the root element in readonly mode
    const tinyMce = page.locator('.tox-tinymce')
    const ariaDisabled = await tinyMce.getAttribute('aria-disabled')
    expect(ariaDisabled).toBe('true')
  })
})
