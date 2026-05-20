import {test, expect} from '../../fixtures/test'

// <nav> is an HTML5 landmark element for navigation menus. It appears in
// course page templates with table-of-contents navigation and skip links.
// canvas-rce must preserve <nav> and its link text through round-trips.
test.describe('<nav> navigation landmark element', () => {
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

  test('<nav> link text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<nav aria-label="Table of contents"><ul><li><a href="#section-1">Section 1</a></li><li><a href="#section-2">Section 2</a></li></ul></nav>',
    )
    expect(content).toContain('Section 1')
    expect(content).toContain('Section 2')
  })

  test('<nav> with heading is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<nav><h2>Contents</h2><ol><li><a href="#intro">Introduction</a></li><li><a href="#methods">Methods</a></li></ol></nav>',
    )
    expect(content).toContain('Contents')
    expect(content).toContain('Introduction')
    expect(content).toContain('Methods')
  })

  test('text around <nav> block is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Course overview:</p><nav><ul><li><a href="#week-1">Week 1</a></li></ul></nav><p>Start with Week 1.</p>',
    )
    expect(content).toContain('Course overview')
    expect(content).toContain('Week 1')
    expect(content).toContain('Start with Week 1')
  })

  test('<nav> with aria-label — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<nav aria-label="Secondary navigation"><a href="/help">Help</a> | <a href="/contact">Contact</a></nav>',
    )
    expect(content).toContain('Help')
    expect(content).toContain('Contact')
  })
})
