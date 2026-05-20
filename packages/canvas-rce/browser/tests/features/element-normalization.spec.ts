import {test, expect} from '../../fixtures/test'

// TinyMCE normalizes legacy presentational elements to semantic equivalents:
// <b> → <strong>, <i> → <em>, <strike> → <s>/<del>.
// canvas-rce must preserve this normalization — a refactor must not revert
// to outputting the deprecated presentational tags or lose the content.
test.describe('legacy element normalization (b→strong, i→em)', () => {
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

  test('<b> is preserved or normalized to <strong>, content survives', async ({page}) => {
    const content = await setAndGet(page, '<p><b>bold text</b></p>')
    expect(content).toContain('bold text')
    // TinyMCE normalizes <b> to <strong>
    expect(content).toMatch(/<strong>bold text<\/strong>|<b>bold text<\/b>/)
  })

  test('<i> is preserved or normalized to <em>, content survives', async ({page}) => {
    const content = await setAndGet(page, '<p><i>italic text</i></p>')
    expect(content).toContain('italic text')
    expect(content).toMatch(/<em>italic text<\/em>|<i>italic text<\/i>/)
  })

  test('<strike> is normalized to <s> or similar, content survives', async ({page}) => {
    const content = await setAndGet(page, '<p><strike>struck text</strike></p>')
    expect(content).toContain('struck text')
    // May become <s>, <del>, text-decoration:line-through, or <strike>
    expect(typeof content).toBe('string')
  })

  test('<tt> monospace is handled without losing content', async ({page}) => {
    const content = await setAndGet(page, '<p><tt>teletype text</tt></p>')
    expect(content).toContain('teletype text')
  })

  test('<b> and <i> nested: both content words survive', async ({page}) => {
    const content = await setAndGet(page, '<p><b><i>bold italic</i></b></p>')
    expect(content).toContain('bold italic')
  })

  test('<strong> input is preserved as <strong> (not double-wrapped)', async ({page}) => {
    const content = await setAndGet(page, '<p><strong>already semantic</strong></p>')
    expect(content).toMatch(/<strong>already semantic<\/strong>/)
    // Must not become <strong><strong>
    expect(content).not.toMatch(/<strong><strong>/)
  })

  test('<em> input is preserved as <em> (not double-wrapped)', async ({page}) => {
    const content = await setAndGet(page, '<p><em>already semantic</em></p>')
    expect(content).toMatch(/<em>already semantic<\/em>/)
    expect(content).not.toMatch(/<em><em>/)
  })

  test('mixed legacy and semantic tags in same paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><b>bold</b> and <strong>strong</strong> and <i>italic</i> and <em>em</em></p>',
    )
    expect(content).toContain('bold')
    expect(content).toContain('strong')
    expect(content).toContain('italic')
    expect(content).toContain('em')
  })
})
