import {test, expect} from '../../fixtures/test'

// Very long attribute values appear in content with base64-encoded data
// attributes, long class strings from CSS frameworks, and deep JSON in
// data attributes. These stress the attribute serializer and must not
// cause truncation or crashes.
test.describe('long attribute values', () => {
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

  test('100-character class name — text preserved', async ({page}) => {
    const longClass = 'a'.repeat(100)
    const content = await setAndGet(page, `<p class="${longClass}">Text with long class</p>`)
    expect(content).toContain('Text with long class')
  })

  test('long data-* attribute value — text preserved', async ({page}) => {
    const longData = 'x'.repeat(500)
    const content = await setAndGet(page, `<p data-content="${longData}">Paragraph text</p>`)
    expect(content).toContain('Paragraph text')
  })

  test('long alt text on image — surrounding text preserved', async ({page}) => {
    const longAlt = 'A detailed description of '.repeat(10).trim()
    const content = await setAndGet(
      page,
      `<p><img src="chart.png" alt="${longAlt}" />Caption follows.</p>`,
    )
    expect(content).toContain('Caption follows')
  })

  test('long title attribute — text preserved', async ({page}) => {
    const longTitle = 'Tooltip text. '.repeat(20).trim()
    const content = await setAndGet(page, `<p><span title="${longTitle}">Span text</span></p>`)
    expect(content).toContain('Span text')
  })

  test('multiple long attributes on same element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<div class="${'cls-'.repeat(20)}" data-meta="${'meta-'.repeat(30)}" id="section-1">Content here</div>`,
    )
    expect(content).toContain('Content here')
  })
})
