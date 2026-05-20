import {test, expect} from '../../fixtures/test'

// Verifies canvas-rce handles unicode, emoji, and special HTML chars correctly.
// These are common sources of data corruption or XSS when sanitization is naive.
test.describe('special characters and unicode', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('unicode text round-trips correctly', async ({page, rcePage}) => {
    const text = 'Héllo Wörld — こんにちは'
    await page.evaluate((t: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(t)
    }, text)
    const content = await rcePage.getContent()
    // TinyMCE may encode accented chars as HTML entities (&eacute; etc.) — both are correct
    expect(content).toMatch(/H(&eacute;|é)llo/)
    expect(content).toContain('こんにちは')
  })

  test('emoji in content is preserved', async ({page, rcePage}) => {
    await rcePage.typeContent('emoji test 🎉🚀')
    const content = await rcePage.getContent()
    expect(content).toContain('🎉')
    expect(content).toContain('🚀')
  })

  test('HTML entities in typed text are escaped, not executed', async ({page, rcePage}) => {
    // Typing angle brackets should produce escaped entities, not raw tags
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('&lt;b&gt;not bold&lt;/b&gt;')
    })
    const content = await rcePage.getContent()
    // The content should contain escaped entities OR literal text, not an active <b> wrapping it
    expect(content).not.toMatch(/<b>not bold<\/b>/)
  })

  test('ampersand in content is preserved', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('R&amp;D department')
    })
    const content = await rcePage.getContent()
    // Should contain the ampersand in some form
    expect(content).toMatch(/R(&amp;|&)D/)
  })

  test('right-to-left text (Arabic) is preserved', async ({page, rcePage}) => {
    const arabic = 'مرحبا بالعالم'
    await rcePage.typeContent(arabic)
    const content = await rcePage.getContent()
    expect(content).toContain('مرحبا')
  })

  test('very long content does not truncate', async ({page, rcePage}) => {
    const longText = 'word '.repeat(500)
    await page.evaluate((text: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(text)
    }, longText)
    const content = await rcePage.getContent()
    // Should contain many instances of "word"
    const matches = content.match(/word/g) ?? []
    expect(matches.length).toBeGreaterThan(400)
  })
})
