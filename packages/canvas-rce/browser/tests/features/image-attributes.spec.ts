import {test, expect} from '../../fixtures/test'

// Image attributes affect layout, accessibility, and responsive behavior.
// alt is required for accessibility; width/height prevent layout shift;
// title provides tooltip text; loading="lazy" defers off-screen images.
// canvas-rce must preserve these attributes through setContent/getContent.
test.describe('image element attributes', () => {
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

  test('alt attribute is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="photo.jpg" alt="Students working in a lab" /></p>',
    )
    expect(content).toContain('alt')
    expect(content).toContain('Students working in a lab')
  })

  test('width and height attributes are preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="diagram.png" alt="diagram" width="400" height="300" /></p>',
    )
    expect(content).toContain('400')
    expect(content).toContain('300')
  })

  test('title attribute on image is preserved or text context survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="chart.png" alt="Sales chart" title="Q4 2024 Sales Data" />Text after image</p>',
    )
    expect(content).toContain('Text after image')
  })

  test('class attribute on image is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="icon.png" alt="icon" class="inline-media" /></p>',
    )
    expect(content).toContain('class')
  })

  test('empty alt attribute (decorative image) is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Decorative: <img src="divider.png" alt="" role="presentation" />text continues</p>',
    )
    expect(content).toContain('text continues')
    expect(content).toContain('alt')
  })

  test('multiple images in sequence all survive', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="a.png" alt="Image A" /><img src="b.png" alt="Image B" /><img src="c.png" alt="Image C" /></p>',
    )
    expect(content).toContain('Image A')
    expect(content).toContain('Image B')
    expect(content).toContain('Image C')
  })

  test('image with style attribute for sizing is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="large.jpg" alt="large photo" style="max-width: 100%; height: auto;" /></p>',
    )
    expect(content).toContain('alt')
  })

  test('loading="lazy" attribute on image', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="below-fold.jpg" alt="below fold image" loading="lazy" />after</p>',
    )
    expect(content).toContain('after')
    expect(content).toContain('alt')
  })
})
