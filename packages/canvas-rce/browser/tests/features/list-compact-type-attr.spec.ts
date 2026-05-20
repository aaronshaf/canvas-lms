import {test, expect} from '../../fixtures/test'

// Unordered list `type` attribute (disc/circle/square) and the deprecated
// `compact` attribute appear in legacy course content from older HTML editors.
// HTML5 deprecated these in favor of CSS list-style-type, but instructors may
// paste content with them from older sources.
test.describe('<ul> type and compact attributes', () => {
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

  test('ul type="circle" — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul type="circle"><li>Circle item one</li><li>Circle item two</li></ul>',
    )
    expect(content).toContain('Circle item one')
    expect(content).toContain('Circle item two')
  })

  test('ul type="square" — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul type="square"><li>Square item A</li><li>Square item B</li></ul>',
    )
    expect(content).toContain('Square item A')
    expect(content).toContain('Square item B')
  })

  test('ul type="disc" (default) — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul type="disc"><li>Disc item one</li><li>Disc item two</li></ul>',
    )
    expect(content).toContain('Disc item one')
    expect(content).toContain('Disc item two')
  })

  test('nested ul with different types — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul type="disc"><li>Outer item<ul type="circle"><li>Inner circle item</li></ul></li><li>Second outer</li></ul>',
    )
    expect(content).toContain('Outer item')
    expect(content).toContain('Inner circle item')
    expect(content).toContain('Second outer')
  })

  test('li with value attribute in ol — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li value="3">Third item explicitly</li><li>Fourth item</li></ol>',
    )
    expect(content).toContain('Third item explicitly')
    expect(content).toContain('Fourth item')
  })
})
