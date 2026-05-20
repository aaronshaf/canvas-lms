import {test, expect} from '../../fixtures/test'

// Elements with many data-* attributes appear in Canvas's custom element
// patterns for media embeds, LTI content, and interactive widgets. Each
// attribute carries metadata the JavaScript layer needs to initialize the
// component. Losing any one attribute can break the widget entirely.
test.describe('elements with many data-* attributes', () => {
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

  test('span with 5 data attributes — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span data-id="42" data-type="media" data-format="video" data-duration="180" data-title="Lecture 1">Media widget</span>',
    )
    expect(content).toContain('Media widget')
  })

  test('div with Canvas LTI data attributes — text around preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before</p><div data-lti-launch="true" data-course-id="123" data-tool-id="456" data-placement="course_navigation" data-width="800" data-height="600">LTI placeholder</div><p>After</p>',
    )
    expect(content).toContain('Before')
    expect(content).toContain('After')
  })

  test('img with Canvas file data attributes — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="/files/99/preview" alt="Lecture diagram" data-api-endpoint="/api/v1/files/99" data-api-returntype="File" data-id="99" data-course-id="1" data-usage-rights-required="false">',
    )
    expect(content).toContain('Lecture diagram')
  })

  test('element with data attributes containing JSON-like values — text preserved', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<div data-config=\'{"width":640,"height":480}\' data-version="2.0">Config element text</div>',
    )
    expect(content).toContain('Config element text')
  })

  test('10 data attributes on one element — no crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span data-a="1" data-b="2" data-c="3" data-d="4" data-e="5" data-f="6" data-g="7" data-h="8" data-i="9" data-j="10">Ten data attributes</span>',
    )
    expect(content).toContain('Ten data attributes')
  })
})
