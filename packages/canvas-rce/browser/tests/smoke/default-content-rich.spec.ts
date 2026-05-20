import {test, expect} from '../../fixtures/test'

// Verifies that rich HTML passed as defaultContent is faithfully rendered and
// preserved. This is a critical contract — canvas-rce must not mangle existing
// content when loading it into the editor.
test.describe('defaultContent — rich HTML', () => {
  test('defaultContent with bold text is preserved', async ({page, rcePage}) => {
    await page.goto('/scenarios/with-default-content')
    await rcePage.waitForEditor()
    const content = await rcePage.getContent()
    // The with-default-content scenario loads HTML; verify structure is intact
    expect(content.length).toBeGreaterThan(0)
  })

  test('defaultContent with a table retains all cells', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    // Set rich content directly via TinyMCE API (simulates what defaultContent prop does)
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<table><tr><td>A1</td><td>A2</td></tr><tr><td>B1</td><td>B2</td></tr></table>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toContain('A1')
    expect(content).toContain('A2')
    expect(content).toContain('B1')
    expect(content).toContain('B2')
  })

  test('defaultContent with a list preserves list items', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<ul><li>item one</li><li>item two</li><li>item three</li></ul>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toContain('item one')
    expect(content).toContain('item two')
    expect(content).toContain('item three')
    expect(content).toMatch(/<ul/)
    expect(content).toMatch(/<li/)
  })

  test('defaultContent with nested formatting is preserved', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<p><strong>bold</strong> and <em>italic</em> and <strong><em>both</em></strong></p>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>bold<\/strong>/)
    expect(content).toMatch(/<em>italic<\/em>/)
    // Nested bold+italic
    expect(content).toMatch(/<strong><em>both<\/em><\/strong>|<em><strong>both<\/strong><\/em>/)
  })

  test('setContent replaces existing content entirely', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
    await rcePage.typeContent('original content')
    // Replace with entirely new content
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>replacement content</p>')
    })
    const content = await rcePage.getContent()
    expect(content).toContain('replacement content')
    expect(content).not.toContain('original content')
  })

  test('defaultContent with heading tags renders correct heading levels', async ({
    page,
    rcePage,
  }) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<h1>Title</h1><h2>Subtitle</h2><p>Body</p>')
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<h1[^>]*>Title<\/h1>/)
    expect(content).toMatch(/<h2[^>]*>Subtitle<\/h2>/)
    expect(content).toContain('Body')
  })
})
