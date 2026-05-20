import {test, expect} from '../../fixtures/test'

// Idempotency: calling setContent(getContent()) must produce stable output.
// If each round-trip mutates the HTML (adds extra tags, changes attributes,
// double-encodes entities), then saving a page multiple times in Canvas will
// corrupt content. A refactor must not break this property.
test.describe('setContent idempotency — stable on repeated round-trips', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function roundTrip(page: any, html: string): Promise<string> {
    return page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(content)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
  }

  test('plain paragraph is stable after two round-trips', async ({page}) => {
    const first = await roundTrip(page, '<p>Hello world</p>')
    const second = await roundTrip(page, first)
    expect(second).toBe(first)
  })

  test('bold text is stable after two round-trips', async ({page}) => {
    const first = await roundTrip(page, '<p><strong>Bold text</strong> normal</p>')
    const second = await roundTrip(page, first)
    expect(second).toBe(first)
  })

  test('table with headers is stable after two round-trips', async ({page}) => {
    const first = await roundTrip(
      page,
      '<table><thead><tr><th>Col A</th><th>Col B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    )
    const second = await roundTrip(page, first)
    expect(second).toBe(first)
  })

  test('ordered list is stable after two round-trips', async ({page}) => {
    const first = await roundTrip(
      page,
      '<ol><li>First item</li><li>Second item</li><li>Third item</li></ol>',
    )
    const second = await roundTrip(page, first)
    expect(second).toBe(first)
  })

  test('heading with id is stable after two round-trips', async ({page}) => {
    const first = await roundTrip(page, '<h2 id="intro">Introduction</h2><p>Opening.</p>')
    const second = await roundTrip(page, first)
    expect(second).toBe(first)
  })

  test('link with rel attributes is stable after two round-trips', async ({page}) => {
    const first = await roundTrip(
      page,
      '<p><a href="https://example.com" rel="noopener noreferrer" target="_blank">Link text</a></p>',
    )
    const second = await roundTrip(page, first)
    expect(second).toBe(first)
  })

  test('blockquote with nested paragraph is stable', async ({page}) => {
    const first = await roundTrip(page, '<blockquote><p>Quoted paragraph text.</p></blockquote>')
    const second = await roundTrip(page, first)
    expect(second).toBe(first)
  })
})
