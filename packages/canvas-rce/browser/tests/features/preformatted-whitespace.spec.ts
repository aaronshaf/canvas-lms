import {test, expect} from '../../fixtures/test'

// <pre> elements must preserve internal whitespace — indentation, multiple
// spaces, and newlines. TinyMCE and canvas-rce must not collapse whitespace
// inside <pre> during serialization, which would corrupt code examples.
test.describe('preformatted text whitespace preservation', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('<pre> with indentation preserves leading spaces', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<pre>    indented code</pre>')
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<pre/)
    expect(content).toContain('indented code')
    // The spaces must still be present inside the pre
    expect(content).toMatch(/    indented code|&nbsp;&nbsp;&nbsp;&nbsp;indented/)
  })

  test('<pre> with multiple lines preserves line structure', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<pre>line one\nline two\nline three</pre>')
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<pre/)
    expect(content).toContain('line one')
    expect(content).toContain('line two')
    expect(content).toContain('line three')
  })

  test('<pre> content with code syntax is preserved', async ({page, rcePage}) => {
    const codeSnippet = 'function hello() {\n  return "world";\n}'
    await page.evaluate((code: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(`<pre>${code}</pre>`)
    }, codeSnippet)
    const content = await rcePage.getContent()
    expect(content).toContain('function hello')
    expect(content).toContain('return')
    expect(content).toMatch(/<pre/)
  })

  test('switching from preformatted to paragraph loses <pre> wrapper', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<pre>some code</pre>')
    })
    await rcePage.contentFrame().locator('body').click()
    await rcePage.contentFrame().locator('body').press('Control+a')
    // Switch to paragraph via Blocks menu
    await page.locator('.tox-tbtn--bespoke[aria-label="Blocks"]').click()
    await page.locator('.tox-collection__item:has-text("Paragraph")').click()

    const content = await rcePage.getContent()
    expect(content).not.toMatch(/<pre/)
    expect(content).toMatch(/<p/)
    expect(content).toContain('some code')
  })

  test('<pre> element is not stripped by the sanitization pipeline', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<pre>safe code block</pre>')
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<pre/)
    expect(content).toContain('safe code block')
  })
})
