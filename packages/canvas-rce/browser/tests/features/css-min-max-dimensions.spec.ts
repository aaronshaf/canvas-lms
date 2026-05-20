import {test, expect} from '../../fixtures/test'

// min-width, max-width, min-height, max-height appear in responsive course
// content — limiting image sizes, constraining video embeds, and setting
// readable text column widths. These are common in imported Word/Google Docs
// content and hand-crafted HTML.
test.describe('CSS min/max width and height properties', () => {
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

  test('max-width on paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="max-width: 600px;">Readable width paragraph text content.</p>',
    )
    expect(content).toContain('Readable width paragraph text content')
  })

  test('min-width on table — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table style="min-width: 400px;"><tr><td>Minimum width table cell</td></tr></table>',
    )
    expect(content).toContain('Minimum width table cell')
  })

  test('max-height with overflow — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="max-height: 200px; overflow-y: auto;">Scrollable content area text.</div>',
    )
    expect(content).toContain('Scrollable content area text')
  })

  test('min-height on div — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="min-height: 100px; background: #f5f5f5;">Minimum height container.</div>',
    )
    expect(content).toContain('Minimum height container')
  })

  test('max-width: 100% on image — no crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Responsive image: <img src="/image.png" alt="Responsive image" style="max-width: 100%; height: auto;"> below text.</p>',
    )
    expect(content).toContain('Responsive image')
    expect(content).toContain('below text')
  })

  test('width range constraints combined — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="min-width: 200px; max-width: 800px; width: 100%;">Constrained width container text.</div>',
    )
    expect(content).toContain('Constrained width container text')
  })

  test('viewport unit dimensions — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="min-height: 50vh; max-width: 80vw;">Viewport unit sized content.</div>',
    )
    expect(content).toContain('Viewport unit sized content')
  })
})
