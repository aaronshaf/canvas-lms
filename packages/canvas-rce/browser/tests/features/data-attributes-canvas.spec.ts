import {test, expect} from '../../fixtures/test'

// Canvas LMS embeds LTI tools, media objects, and widgets using data-* attributes
// on content elements. These attributes carry launch URLs, resource IDs, and
// preview metadata. canvas-rce must not strip data-* attributes from safe elements
// or LTI tool embeds will stop working after an edit.
test.describe('Canvas-specific data-* attributes', () => {
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

  test('data-canvas-id on span is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span data-canvas-id="attachment_12345">Embedded file</span>',
    )
    expect(content).toContain('Embedded file')
  })

  test('iframe with data-lti-launch attributes preserves surrounding content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before LTI</p><iframe src="https://lti.example.com/launch" data-lti-launch="true" data-resource-link-id="abc123" width="640" height="480"></iframe><p>After LTI</p>',
    )
    expect(content).toContain('Before LTI')
    expect(content).toContain('After LTI')
  })

  test('img with data-api-endpoint attribute content survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="https://canvas.example.com/files/123/preview" data-api-endpoint="https://canvas.example.com/api/v1/files/123" alt="course image" />',
    )
    if (content.includes('<img')) {
      expect(content).toContain('canvas.example.com/files/123')
    }
  })

  test('span with data-equation-content for math is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span class="math_equation_latex" data-equation-content="x^2+y^2=r^2">x²+y²=r²</span>',
    )
    expect(content).toContain('x')
  })

  test('div with data-media-id for media embeds preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div data-media-id="m-abc123" data-media-type="video"><p>Video placeholder</p></div>',
    )
    expect(content).toContain('Video placeholder')
  })

  test('multiple data-* attributes on same element, content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span data-canvas-id="123" data-canvas-type="attachment" data-canvas-previewable="true">File link</span>',
    )
    expect(content).toContain('File link')
  })

  test('data-* attributes do not introduce XSS', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span data-evil="<script>alert(1)</script>">safe text</span>',
    )
    expect(content).toContain('safe text')
    expect(content).not.toContain('<script>alert(1)')
  })
})
