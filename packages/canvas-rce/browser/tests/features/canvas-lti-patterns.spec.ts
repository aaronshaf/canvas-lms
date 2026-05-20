import {test, expect} from '../../fixtures/test'

// Canvas-specific content patterns for LTI tools, media embeds, and
// course content identifiers. These use specific data-* attributes and
// iframe patterns that canvas-rce must preserve for LTI launches to work.
// A refactor must not strip canvas_* data attributes or the LTI iframe structure.
test.describe('Canvas LTI and media embed patterns', () => {
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

  test('LTI iframe with data-lti-launch attributes — surrounding text preserved', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<p>Launch below:</p><iframe src="/courses/1/external_tools/retrieve?url=https%3A%2F%2Ftool.example.com" data-lti-launch="true" width="800" height="600" title="LTI Tool" allowfullscreen></iframe><p>After launch.</p>',
    )
    expect(content).toContain('Launch below')
    expect(content).toContain('After launch')
  })

  test('Canvas media comment iframe — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Watch:</p><iframe id="media_comment_xyz123" src="/media_objects/xyz123/redirect" class="instructure_inline_media_comment" data-media_comment_id="xyz123" width="640" height="360" title="Canvas Media"></iframe><p>Discuss.</p>',
    )
    expect(content).toContain('Watch')
    expect(content).toContain('Discuss')
  })

  test('Canvas image with data attributes — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="/courses/1/files/123/preview" alt="Course diagram" data-api-endpoint="/api/v1/files/123" data-api-returntype="File" />',
    )
    expect(content).toContain('alt')
    expect(content).toContain('Course diagram')
  })

  test('span.instructure_file_link — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Download: <a href="/courses/1/files/456/download" class="instructure_file_link" data-canvas-previewable="true">Assignment handout.pdf</a></p>',
    )
    expect(content).toContain('Assignment handout.pdf')
  })

  test('Canvas equation span — LaTeX preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The formula <span class="math_equation_latex" data-equation-content="\\sqrt{x^2+y^2}">\\sqrt{x^2+y^2}</span> represents distance.</p>',
    )
    expect(content).toContain('sqrt')
    expect(content).toContain('represents distance')
  })
})
