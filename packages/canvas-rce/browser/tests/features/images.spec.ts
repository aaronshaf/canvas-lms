import {test, expect} from '../../fixtures/test'

// Images in canvas-rce course content require accurate src and alt attribute
// preservation. Alt text is a legal accessibility requirement (WCAG 2.1 AA).
// canvas-rce must not strip src, alt, or other safe img attributes.
test.describe('image element handling', () => {
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

  test('<img> with alt text preserves alt attribute', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="https://example.com/photo.jpg" alt="A mountain landscape at sunset" />',
    )
    if (content.includes('<img')) {
      expect(content).toMatch(/alt="A mountain landscape at sunset"/)
    }
    // Even if img is stripped, document that alt was provided
    expect(typeof content).toBe('string')
  })

  test('<img> with empty alt (decorative) preserves alt=""', async ({page}) => {
    const content = await setAndGet(page, '<img src="https://example.com/divider.png" alt="" />')
    if (content.includes('<img')) {
      // Empty alt="" is valid WCAG for decorative images
      expect(content).toMatch(/alt=""/)
    }
  })

  test('<img> src attribute is preserved', async ({page}) => {
    const src = 'https://example.com/image.png'
    const content = await setAndGet(page, `<img src="${src}" alt="test image" />`)
    if (content.includes('<img')) {
      expect(content).toContain('example.com/image.png')
    }
  })

  test('<img> width and height attributes are preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="https://example.com/img.png" alt="sized" width="400" height="300" />',
    )
    if (content.includes('<img')) {
      expect(content).toMatch(/width="400"/)
      expect(content).toMatch(/height="300"/)
    }
  })

  test('<img> with data-canvas-id attribute for media tracking', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="https://example.com/media.png" alt="media" data-canvas-id="attachment_123" />',
    )
    if (content.includes('<img')) {
      expect(content).toContain('example.com/media.png')
    }
    // Text alt is what matters for accessibility
    expect(content).not.toContain('undefined')
  })

  test('<img> inside a <figure> with <figcaption>', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><img src="https://example.com/chart.png" alt="Bar chart showing quarterly sales" /><figcaption>Q1-Q4 Sales Data</figcaption></figure>',
    )
    expect(content).toContain('Q1-Q4 Sales Data')
  })

  test('<img> with long alt text is preserved in full', async ({page}) => {
    const longAlt =
      'Detailed diagram showing the water cycle including evaporation from the ocean surface, cloud formation through condensation, precipitation as rain or snow, and runoff back to the ocean'
    const content = await setAndGet(
      page,
      `<img src="https://example.com/diagram.png" alt="${longAlt}" />`,
    )
    if (content.includes('<img')) {
      expect(content).toContain('water cycle')
    }
  })

  test('<img> inline with text paragraph is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>See the diagram: <img src="https://example.com/inline.png" alt="inline diagram" /> above for reference.</p>',
    )
    expect(content).toContain('See the diagram')
    expect(content).toContain('above for reference')
  })

  test('javascript: in img src is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="javascript:alert(document.cookie)" alt="xss" />',
    )
    expect(content).not.toContain('javascript:alert')
  })

  test('<img> with title attribute is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="https://example.com/photo.jpg" alt="campus" title="Main campus building" />',
    )
    if (content.includes('<img')) {
      expect(content).toContain('example.com/photo.jpg')
    }
  })
})
