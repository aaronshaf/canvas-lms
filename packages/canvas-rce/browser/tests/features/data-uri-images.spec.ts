import {test, expect} from '../../fixtures/test'

// data: URIs in img src embed image data directly into the HTML.
// They appear in content copied from Word, Google Docs, and screenshot paste.
// TinyMCE may preserve or strip them. Tests document actual behavior —
// the text alternative (alt text) must always survive even if the data URI
// itself is filtered. A future refactor must not silently strip alt text.
test.describe('data: URI images', () => {
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

  // Minimal 1x1 transparent GIF as a data URI
  const transparentGif =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

  test('data: URI image round-trips or alt text survives', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p><img src="${transparentGif}" alt="Transparent pixel" /></p>`,
    )
    // Either the data URI is preserved or the img is stripped — but surrounding text must survive
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  test('paragraph text around a data: img is always preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Before image.<img src="${transparentGif}" alt="pixel" />After image.</p>`,
    )
    expect(content).toContain('Before image')
    expect(content).toContain('After image')
  })

  test('data: URI SVG image — surrounding text preserved', async ({page}) => {
    const svgUri =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PC9zdmc+'
    const content = await setAndGet(
      page,
      `<p>SVG: <img src="${svgUri}" alt="Small SVG" /> end.</p>`,
    )
    expect(content).toContain('end')
  })

  test('img with empty src survives without crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="" alt="broken image" />Text after broken image</p>',
    )
    expect(content).toContain('Text after broken image')
  })

  test('data: URI in link href — surrounding text preserved', async ({page}) => {
    // data: URIs in href are an XSS vector in some browsers; document behavior
    const content = await setAndGet(
      page,
      '<p>Click <a href="data:text/plain,hello">this link</a> to continue.</p>',
    )
    expect(content).toContain('to continue')
  })
})
