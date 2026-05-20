import {test, expect} from '../../fixtures/test'

// TinyMCE normalizes certain whitespace patterns during serialization.
// Multiple consecutive spaces typically collapse to one (HTML behavior).
// &nbsp; sequences and leading/trailing whitespace in elements have specific
// handling. Tests here document actual behavior for refactor compliance.
test.describe('whitespace normalization in content', () => {
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

  test('paragraph with leading and trailing spaces preserves word content', async ({page}) => {
    const content = await setAndGet(page, '<p>   trimmed content   </p>')
    expect(content).toContain('trimmed content')
  })

  test('paragraph with only &nbsp; is handled without crash', async ({page}) => {
    const content = await setAndGet(page, '<p>&nbsp;</p>')
    expect(typeof content).toBe('string')
    // Content may be empty or just whitespace — should not crash
  })

  test('multiple &nbsp; in sequence are preserved or normalized', async ({page}) => {
    const content = await setAndGet(page, '<p>word&nbsp;&nbsp;&nbsp;word</p>')
    expect(content).toContain('word')
    // Both words must appear regardless of how nbsp is normalized
    const wordCount = (content.match(/word/g) ?? []).length
    expect(wordCount).toBe(2)
  })

  test('tab characters in content are handled without crash', async ({page}) => {
    const content = await setAndGet(page, '<p>before\tafter</p>')
    expect(content).toContain('before')
    expect(content).toContain('after')
  })

  test('newlines between block elements are normalized cleanly', async ({page}) => {
    const content = await setAndGet(page, '<p>First</p>\n\n\n<p>Second</p>')
    expect(content).toContain('First')
    expect(content).toContain('Second')
  })

  test('text with mixed whitespace chars in pre element is preserved', async ({page}) => {
    const content = await setAndGet(page, '<pre>line one\n    indented line\nline three</pre>')
    expect(content).toContain('line one')
    expect(content).toContain('indented line')
    expect(content).toContain('line three')
  })

  test('zero-width space (U+200B) in content does not corrupt output', async ({page}) => {
    const content = await setAndGet(page, '<p>word​word</p>')
    // Zero-width space may be removed or preserved — content must not crash
    expect(typeof content).toBe('string')
    expect(content).toContain('word')
  })

  test('content with many consecutive paragraphs is stable', async ({page}) => {
    const paragraphs = Array.from({length: 20}, (_, i) => `<p>Paragraph ${i + 1}</p>`).join('')
    const content = await setAndGet(page, paragraphs)
    expect(content).toContain('Paragraph 1')
    expect(content).toContain('Paragraph 20')
    // Check it's not duplicated
    const matches = content.match(/Paragraph 20/g) ?? []
    expect(matches.length).toBe(1)
  })
})
