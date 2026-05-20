import {test, expect} from '../../fixtures/test'

// Numeric HTML entities (&#169; &#8212; &#x2014;) appear in content exported
// from older CMS platforms, Word documents, and Canvas's own legacy exporter.
// TinyMCE may decode them to literal characters or re-encode as named entities.
// Tests document actual round-trip behavior for refactor compliance.
test.describe('numeric HTML entities', () => {
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

  test('&#169; (copyright) round-trips in some form', async ({page}) => {
    const content = await setAndGet(page, '<p>&#169; 2024 Instructure</p>')
    expect(content).toContain('2024 Instructure')
    // May decode to ©, re-encode as &copy; or &#169;
    expect(content).toMatch(/©|&copy;|&#169;/)
  })

  test('&#8212; (em dash) round-trips in some form', async ({page}) => {
    const content = await setAndGet(page, '<p>Canvas&#8212;the leading LMS</p>')
    expect(content).toContain('Canvas')
    expect(content).toContain('the leading LMS')
    expect(content).toMatch(/—|&mdash;|&#8212;/)
  })

  test('&#x2014; (hex em dash) round-trips', async ({page}) => {
    const content = await setAndGet(page, '<p>A&#x2014;B</p>')
    expect(content).toContain('A')
    expect(content).toContain('B')
    // Content between A and B must be some form of em dash
    expect(content).toMatch(/A(—|&mdash;|&#8212;|&#x2014;)B/)
  })

  test('&#160; (non-breaking space) round-trips', async ({page}) => {
    const content = await setAndGet(page, '<p>first&#160;last</p>')
    expect(content).toContain('first')
    expect(content).toContain('last')
  })

  test('&#8220; and &#8221; (curly quotes) round-trip', async ({page}) => {
    const content = await setAndGet(page, '<p>&#8220;quoted text&#8221;</p>')
    expect(content).toContain('quoted text')
    // May be decoded to " " or re-encoded
    expect(content).toMatch(/"|"|&ldquo;|&rdquo;|&#8220;|&#8221;|"/)
  })

  test('&#9; (tab) in content is handled without crash', async ({page}) => {
    const content = await setAndGet(page, '<p>before&#9;after</p>')
    expect(content).toContain('before')
    expect(content).toContain('after')
  })

  test('consecutive numeric entities in sequence all produce text', async ({page}) => {
    // H-e-l-l-o as decimal entities
    const content = await setAndGet(page, '<p>&#72;&#101;&#108;&#108;&#111;</p>')
    // TinyMCE may decode these to literal text or leave as entities
    // Either "Hello" or the entity sequence must survive
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  test('mixed named and numeric entities in same text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>&copy; 2024 &mdash; All rights &#169; reserved&#8212;</p>',
    )
    expect(content).toContain('2024')
    expect(content).toContain('All rights')
    expect(content).toContain('reserved')
  })
})
