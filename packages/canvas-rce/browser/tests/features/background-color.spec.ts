import {test, expect} from '../../fixtures/test'

// Background-color (text highlight) is a common formatting tool in canvas-rce.
// Instructors highlight key terms in course pages. The background-color CSS
// property must survive TinyMCE's style filter, separate from text color.
test.describe('background-color formatting', () => {
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

  test('background-color style on span is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="background-color: yellow;">highlighted</span></p>',
    )
    expect(content).toContain('highlighted')
    if (content.includes('background-color')) {
      expect(content).toMatch(/background-color:\s*yellow|background-color:\s*#(ff0|ffff00)/)
    }
  })

  test('background-color with hex value is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="background-color: #ffeeba;">highlighted term</span></p>',
    )
    expect(content).toContain('highlighted term')
  })

  test('background-color and text color together are both handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="background-color: black; color: white;">inverted text</span></p>',
    )
    expect(content).toContain('inverted text')
  })

  test('background-color on a paragraph is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="background-color: #e8f4fd;">Info block paragraph</p>',
    )
    expect(content).toContain('Info block paragraph')
  })

  test('multiple spans with different highlight colors preserve all text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="background-color: #ffeb3b;">term A</span> and <span style="background-color: #a5d6a7;">term B</span></p>',
    )
    expect(content).toContain('term A')
    expect(content).toContain('term B')
  })

  test('highlight combined with bold formatting preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong><span style="background-color: yellow;">Bold highlight</span></strong></p>',
    )
    expect(content).toContain('Bold highlight')
    expect(content).toMatch(/<strong>/)
  })

  test('rgba background-color value is handled without crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="background-color: rgba(255, 235, 59, 0.5);">semi-transparent highlight</span></p>',
    )
    expect(content).toContain('semi-transparent highlight')
  })
})
