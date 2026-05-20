import {test, expect} from '../../fixtures/test'

// <mark> is an HTML5 semantic element for highlighted or marked text.
// It's used in study guides, search results, and annotated course materials.
// canvas-rce must preserve <mark> and its text through round-trips.
test.describe('<mark> highlight element', () => {
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

  test('<mark> text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Remember to study the <mark>highlighted terms</mark> before the exam.</p>',
    )
    expect(content).toContain('highlighted terms')
    expect(content).toContain('before the exam')
  })

  test('multiple <mark> spans in a paragraph all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><mark>First key point</mark> and <mark>second key point</mark> matter.</p>',
    )
    expect(content).toContain('First key point')
    expect(content).toContain('second key point')
  })

  test('<mark> inside a list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Definition: <mark>osmosis</mark> — movement of water</li></ul>',
    )
    expect(content).toContain('osmosis')
    expect(content).toContain('movement of water')
  })

  test('<mark> combined with <strong> preserves both', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><mark><strong>Critical concept</strong></mark> must be understood.</p>',
    )
    expect(content).toContain('Critical concept')
    expect(content).toMatch(/<strong>/)
  })

  test('<mark> inside a blockquote is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>The most important idea is <mark>feedback loops</mark>.</p></blockquote>',
    )
    expect(content).toContain('feedback loops')
    expect(content).toContain('most important idea')
  })

  test('<mark> with a data attribute preserves text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><mark data-annotation="vocab">photosynthesis</mark> produces glucose.</p>',
    )
    expect(content).toContain('photosynthesis')
    expect(content).toContain('produces glucose')
  })
})
