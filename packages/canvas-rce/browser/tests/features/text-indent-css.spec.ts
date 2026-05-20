import {test, expect} from '../../fixtures/test'

// text-indent creates visual indentation for first lines of paragraphs.
// It is used in formal course documents, legal-style content, and imported
// Word documents. Negative text-indent is used for hanging indents (citations,
// bibliographies). Text must survive regardless of indent style handling.
test.describe('text-indent CSS property', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function setAndGet(page: any, html: string): Promise<string> {
    return page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(content)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
  }

  test('text-indent: 2em — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="text-indent: 2em;">Indented first line paragraph text here.</p>',
    )
    expect(content).toContain('Indented first line paragraph text here')
  })

  test('text-indent: 30px — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="text-indent: 30px;">Pixel-indented paragraph.</p>',
    )
    expect(content).toContain('Pixel-indented paragraph')
  })

  test('negative text-indent for hanging indent — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="padding-left: 2em; text-indent: -2em;">Hanging indent citation text here.</p>',
    )
    expect(content).toContain('Hanging indent citation text here')
  })

  test('multiple paragraphs with text-indent — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="text-indent: 1.5em;">First indented paragraph.</p><p style="text-indent: 1.5em;">Second indented paragraph.</p>',
    )
    expect(content).toContain('First indented paragraph')
    expect(content).toContain('Second indented paragraph')
  })

  test('text-indent on a blockquote — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote style="text-indent: 1em;"><p>Indented block quote content.</p></blockquote>',
    )
    expect(content).toContain('Indented block quote content')
  })
})
