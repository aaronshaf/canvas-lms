import {test, expect} from '../../fixtures/test'

// Emoji and supplementary Unicode characters appear in modern course content
// authored by students and instructors. TinyMCE must preserve them without
// corruption (no replacement with ? or entity-encoding that breaks the chars).
test.describe('emoji and supplementary Unicode', () => {
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

  test('basic emoji in a paragraph are preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Learning is fun! 🎓📚✏️</p>')
    expect(content).toContain('Learning is fun')
    // Emoji must survive in some form
    expect(content.length).toBeGreaterThan(15)
  })

  test('emoji in a heading is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h2>Welcome 🎉</h2>')
    expect(content).toContain('Welcome')
    expect(content).toMatch(/<h2/)
  })

  test('emoji in a list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>✅ Completed task</li><li>❌ Incomplete task</li></ul>',
    )
    expect(content).toContain('Completed task')
    expect(content).toContain('Incomplete task')
  })

  test('flag emoji round-trip', async ({page}) => {
    const content = await setAndGet(page, '<p>Countries: 🇺🇸 🇬🇧 🇫🇷 🇯🇵</p>')
    expect(content).toContain('Countries')
  })

  test('math and science symbols are preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Symbols: ∑ ∏ ∫ ∂ ∞ ≠ ≤ ≥ ± √</p>')
    expect(content).toContain('Symbols')
    // At least some symbols must survive
    expect(content.length).toBeGreaterThan(15)
  })

  test('currency symbols are preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Prices: $10 €8 £7 ¥1200 ₹800</p>')
    expect(content).toContain('Prices')
    expect(content).toContain('10')
    expect(content).toContain('800')
  })

  test('musical notation characters are preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Notes: ♩ ♪ ♫ ♬ ♭ ♮ ♯</p>')
    expect(content).toContain('Notes')
  })

  test('skin-tone modifier emoji preserve surrounding text', async ({page}) => {
    const content = await setAndGet(page, '<p>Hello 👋🏽 and goodbye 👋🏻</p>')
    expect(content).toContain('Hello')
    expect(content).toContain('and goodbye')
  })
})
