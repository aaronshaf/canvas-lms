import {test, expect} from '../../fixtures/test'

// <object> with data/type attributes embeds PDFs, Flash (legacy), and other
// media. Canvas uses <object> for some media embeds and PDF previews.
// TinyMCE preserves <object> src/data intact (no client-side URL sanitization;
// the backend/CSP handles that). Tests document actual behavior.
test.describe('<object> element with data and type attributes', () => {
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

  test('text around <object> PDF embed is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>See the document:</p><object data="course.pdf" type="application/pdf" width="600" height="400"><p>PDF viewer not supported.</p></object><p>End of document.</p>',
    )
    expect(content).toContain('See the document')
    expect(content).toContain('End of document')
  })

  test('<object> fallback paragraph text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<object data="media.swf" type="application/x-shockwave-flash"><p>Flash not supported. <a href="media.swf">Download instead</a>.</p></object>',
    )
    expect(content).toContain('Flash not supported')
    expect(content).toContain('Download instead')
  })

  test('<object> with <param> children — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Interactive:</p><object type="application/x-java-applet"><param name="code" value="Main.class" /><p>Java not supported.</p></object><p>After object.</p>',
    )
    expect(content).toContain('Interactive')
    expect(content).toContain('After object')
  })

  test('multiple <object> embeds — all surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Object 1</p><object data="a.pdf" type="application/pdf"></object><p>Object 2</p><object data="b.pdf" type="application/pdf"></object><p>End</p>',
    )
    expect(content).toContain('Object 1')
    expect(content).toContain('Object 2')
    expect(content).toContain('End')
  })
})
