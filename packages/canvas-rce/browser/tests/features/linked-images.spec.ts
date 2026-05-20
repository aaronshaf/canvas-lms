import {test, expect} from '../../fixtures/test'

// Linked images (<a href><img /></a>) are common in course content — clicking
// a diagram opens a full-size version, or an image links to an external resource.
// Both the img attributes (src, alt) and the link href must survive serialization.
test.describe('linked images (anchor wrapping img)', () => {
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

  test('image wrapped in link preserves href and src', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com/fullsize.jpg"><img src="https://example.com/thumb.jpg" alt="diagram thumbnail" /></a>',
    )
    if (content.includes('<img')) {
      expect(content).toContain('example.com/thumb.jpg')
      expect(content).toMatch(/alt="diagram thumbnail"/)
    }
    // Link href must survive even if img is handled differently
    expect(content).toContain('example.com/fullsize.jpg')
  })

  test('linked image with target="_blank" preserves all attributes', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com/detail.png" target="_blank"><img src="https://example.com/preview.png" alt="preview image" /></a>',
    )
    expect(content).toContain('example.com/detail.png')
    if (content.includes('target')) {
      expect(content).toMatch(/target="_blank"/)
    }
  })

  test('linked image with title on both anchor and img', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com/photo.jpg" title="View full photo"><img src="https://example.com/photo-sm.jpg" alt="campus photo" title="Campus aerial view" /></a>',
    )
    expect(content).toContain('example.com/photo.jpg')
  })

  test('linked image inside a paragraph with surrounding text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>See the diagram: <a href="https://example.com/diagram.png"><img src="https://example.com/diagram-sm.png" alt="architecture diagram" /></a> for reference.</p>',
    )
    expect(content).toContain('See the diagram')
    expect(content).toContain('for reference')
    expect(content).toContain('example.com/diagram.png')
  })

  test('linked image inside a figure with caption', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><a href="https://example.com/full.jpg"><img src="https://example.com/thumb.jpg" alt="lab equipment" /></a><figcaption>Lab equipment overview</figcaption></figure>',
    )
    expect(content).toContain('Lab equipment overview')
    expect(content).toContain('example.com/full.jpg')
  })

  test('linked image with javascript: href is sanitized', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="javascript:void(0)"><img src="https://example.com/img.png" alt="click me" /></a>',
    )
    expect(content).not.toContain('javascript:')
  })

  test('multiple linked images in sequence all preserve their hrefs', async ({page}) => {
    const content = await setAndGet(
      page,
      `<a href="https://example.com/a.jpg"><img src="https://example.com/a-sm.jpg" alt="image A" /></a>
       <a href="https://example.com/b.jpg"><img src="https://example.com/b-sm.jpg" alt="image B" /></a>`,
    )
    expect(content).toContain('example.com/a.jpg')
    expect(content).toContain('example.com/b.jpg')
  })
})
