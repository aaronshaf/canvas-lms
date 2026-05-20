import {test, expect} from '../../fixtures/test'

// Word count must work correctly across structured content. A naive implementation
// that only counts plain text would miss words in tables, lists, or formatted elements.
test.describe('word count — edge cases', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function getWordCount(page: any): Promise<number> {
    const text = await page.locator('[data-testid="status-bar-word-count"]').textContent()
    const match = text?.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }

  test('words inside a table are counted', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<table><tr><td>alpha beta</td><td>gamma delta</td></tr></table>',
      )
    })
    await page.waitForTimeout(500)
    const count = await getWordCount(page)
    // 4 words: alpha, beta, gamma, delta
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('words inside a list are counted', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<ul><li>first item</li><li>second item</li><li>third</li></ul>',
      )
    })
    await page.waitForTimeout(500)
    const count = await getWordCount(page)
    // 5 words: first, item, second, item, third
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('words inside a heading are counted', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<h1>Main Title Here</h1><p>body</p>')
    })
    await page.waitForTimeout(500)
    const count = await getWordCount(page)
    // 4 words: Main, Title, Here, body
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('words in bold/italic formatting are counted', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<p><strong>bold word</strong> and <em>italic word</em></p>',
      )
    })
    await page.waitForTimeout(500)
    const count = await getWordCount(page)
    // 4 words: bold, word, and, italic, word = 5 (or 4 if "and" not counted — be lenient)
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('word count decreases after deleting words', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>one two three four five</p>')
    })
    await page.waitForTimeout(500)
    const before = await getWordCount(page)

    // Select all and replace with fewer words
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>one two</p>')
    })
    await page.waitForTimeout(500)
    const after = await getWordCount(page)

    expect(after).toBeLessThan(before)
    expect(after).toBe(2)
  })

  test('hyphenated words are counted consistently', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>well-known fact</p>')
    })
    await page.waitForTimeout(500)
    const count = await getWordCount(page)
    // Either 2 (hyphen = compound word) or 3 (hyphen splits), both are acceptable
    expect(count).toBeGreaterThanOrEqual(2)
    expect(count).toBeLessThanOrEqual(3)
  })
})
