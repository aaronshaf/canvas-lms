import {test, expect} from '../../fixtures/test'

// Elements with many simultaneous inline style properties appear in content
// imported from Word, Google Docs, or hand-crafted by instructors using the
// HTML editor. Tests verify text survives even as TinyMCE may normalize or
// reorder the style declaration.
test.describe('elements with multiple combined inline styles', () => {
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

  test('font + color + background combined — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="font-size: 18px; font-family: Georgia, serif; color: #333; background-color: #fffbcc;">Styled highlight paragraph</p>',
    )
    expect(content).toContain('Styled highlight paragraph')
  })

  test('margin + padding + border — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="margin: 10px 20px; padding: 15px; border: 2px solid #0066cc; border-radius: 4px;">Boxed content text</div>',
    )
    expect(content).toContain('Boxed content text')
  })

  test('layout + typography combined — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="line-height: 1.8; letter-spacing: 0.05em; text-align: justify; text-indent: 2em;">Justified paragraph with letter spacing and line height applied together.</p>',
    )
    expect(content).toContain('Justified paragraph with letter spacing')
  })

  test('5 properties on a span — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Normal text <span style="color: #c00; font-weight: bold; font-style: italic; text-decoration: underline; font-size: 14px;">five-property span</span> more normal text.</p>',
    )
    expect(content).toContain('five-property span')
    expect(content).toContain('more normal text')
  })

  test('positioning with display — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="position: relative; display: block; width: 100%; min-height: 50px; overflow: hidden;">Positioned container text</div>',
    )
    expect(content).toContain('Positioned container text')
  })

  test('print-specific styles — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="page-break-inside: avoid; break-inside: avoid; widows: 2; orphans: 2;">Print-safe paragraph content.</p>',
    )
    expect(content).toContain('Print-safe paragraph content')
  })

  test('10 inline style properties on one element — no crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="color: #333; background: #fff; padding: 8px; margin: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 14px; line-height: 1.5; font-family: sans-serif; text-align: left;">Ten properties element</div>',
    )
    expect(content).toContain('Ten properties element')
  })
})
