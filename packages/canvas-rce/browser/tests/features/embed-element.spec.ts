import {test, expect} from '../../fixtures/test'

// <embed> appears in legacy course content importing PDF documents, Flash
// animations (now dead), and media players. TinyMCE must not crash on these
// elements. Text around them must survive since TinyMCE is not the sanitizer
// for embed src values.
test.describe('<embed> element handling', () => {
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

  test('<embed> PDF — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Course syllabus:</p><embed src="/files/syllabus.pdf" type="application/pdf" width="800" height="600"><p>See above for details.</p>',
    )
    expect(content).toContain('Course syllabus')
    expect(content).toContain('See above for details')
  })

  test('<embed> with type attribute — no crash, content is string', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Media player:</p><embed src="media.mp4" type="video/mp4" width="640" height="480">',
    )
    expect(typeof content).toBe('string')
    expect(content).toContain('Media player')
  })

  test('<embed> with width/height — text around preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before embed</p><embed src="file.swf" width="400" height="300"><p>After embed</p>',
    )
    expect(content).toContain('Before embed')
    expect(content).toContain('After embed')
  })
})
