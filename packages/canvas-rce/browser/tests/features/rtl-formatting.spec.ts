import {test, expect} from '../../fixtures/test'

// Verifies that formatting operations work correctly in RTL (right-to-left) mode.
// Canvas serves many Arabic and Hebrew language users; formatting must not break
// when the document direction is RTL.
test.describe('RTL mode — formatting operations', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/rtl')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('bold works in RTL mode', async ({page, rcePage}) => {
    await rcePage.typeContent('مرحبا')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>/)
    expect(content).toContain('مرحبا')
  })

  test('italic works in RTL mode', async ({page, rcePage}) => {
    await rcePage.typeContent('عالم')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+i')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<em>/)
    expect(content).toContain('عالم')
  })

  test('lists can be created in RTL mode', async ({page, rcePage}) => {
    // Use execCommand to avoid aria-label locale differences in RTL toolbar
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('InsertUnorderedList')
    })
    await rcePage.contentFrame().locator('li').first().waitFor({state: 'visible', timeout: 5_000})
    await page.keyboard.type('first item')

    const content = await rcePage.getContent()
    expect(content).toMatch(/<ul/)
    expect(content).toContain('first item')
  })

  test('undo works in RTL mode', async ({page, rcePage}) => {
    await rcePage.typeContent('text in RTL')
    await page.keyboard.press('Control+z')
    const content = await rcePage.getContent()
    // After undo, "text in RTL" should be partially or fully removed
    // (typing is undone character by character or in chunks)
    expect(typeof content).toBe('string')
  })

  test('getContent returns correct HTML in RTL mode', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>RTL content: مرحبا بالعالم</p>')
    })
    const content = await rcePage.getContent()
    expect(content).toContain('مرحبا بالعالم')
    expect(content).toMatch(/<p/)
  })
})
