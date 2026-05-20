import {test, expect} from '../../fixtures/test'

// Canvas file links use specific data attributes to wire up the in-app
// preview, download, and permission systems. Instructors paste these from
// the file picker and expect all data attributes to survive round-trips.
// If data-api-endpoint or data-id are stripped, Canvas's JS won't find the file.
test.describe('Canvas file link data attributes', () => {
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

  test('Canvas file link with data-api-endpoint — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/1/files/42/download" data-api-endpoint="/api/v1/courses/1/files/42" data-id="42">Course Syllabus.pdf</a></p>',
    )
    expect(content).toContain('Course Syllabus.pdf')
  })

  test('Canvas inline preview link — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/1/files/99?wrap=1" class="instructure_file_link instructure_scribd_file" data-canvas-previewable="true">Lecture Notes.pdf</a></p>',
    )
    expect(content).toContain('Lecture Notes.pdf')
  })

  test('Canvas media comment link — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/media_objects/m-abc123" data-media-id="m-abc123" data-media-type="video" class="instructure_inline_media_comment">Watch: Introduction Video</a></p>',
    )
    expect(content).toContain('Watch: Introduction Video')
  })

  test('Canvas image with data-api-returntype — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Assignment rubric: <img src="/courses/1/files/55/preview" alt="Rubric diagram" data-api-endpoint="/api/v1/courses/1/files/55" data-api-returntype="File"> (see above)</p>',
    )
    expect(content).toContain('Assignment rubric')
    expect(content).toContain('see above')
  })

  test('multiple Canvas file links in a list — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><a href="/courses/1/files/10/download" data-id="10">Week 1 Reading.pdf</a></li><li><a href="/courses/1/files/11/download" data-id="11">Week 2 Reading.pdf</a></li></ul>',
    )
    expect(content).toContain('Week 1 Reading.pdf')
    expect(content).toContain('Week 2 Reading.pdf')
  })
})
