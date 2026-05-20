import {test, expect} from '../../fixtures/test'

// letter-spacing and word-spacing are CSS typography properties used for
// stylistic headings and accessible reading layouts. WCAG 1.4.12 (Text Spacing)
// requires that content not lose functionality when letter/word spacing is
// increased. canvas-rce must preserve these properties through serialization.
test.describe('letter-spacing and word-spacing CSS properties', () => {
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

  test('letter-spacing on a span preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="letter-spacing: 0.1em;">Spaced out text</span></p>',
    )
    expect(content).toContain('Spaced out text')
  })

  test('letter-spacing on a heading preserves content', async ({page}) => {
    const content = await setAndGet(page, '<h2 style="letter-spacing: 2px;">Stylized Heading</h2>')
    expect(content).toContain('Stylized Heading')
    expect(content).toMatch(/<h2/)
  })

  test('word-spacing on a paragraph preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="word-spacing: 0.25em;">Words with extra spacing between them.</p>',
    )
    expect(content).toContain('Words with extra spacing')
  })

  test('letter-spacing negative value preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="letter-spacing: -0.05em;">Tight condensed text</span></p>',
    )
    expect(content).toContain('Tight condensed text')
  })

  test('letter-spacing in px preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="letter-spacing: 3px;">Wide tracking</span></p>',
    )
    expect(content).toContain('Wide tracking')
  })

  test('word-spacing combined with line-height preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="word-spacing: 0.3em; line-height: 1.8;">Accessible text spacing.</p>',
    )
    expect(content).toContain('Accessible text spacing')
  })

  test('letter-spacing and word-spacing together on same element', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="letter-spacing: 0.08em; word-spacing: 0.2em;">Both properties applied.</p>',
    )
    expect(content).toContain('Both properties applied')
  })
})
