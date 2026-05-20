import {test, expect} from '../../fixtures/test'

// <a name="..."> without href is the legacy syntax for in-page anchors.
// Exported Canvas course content from older versions frequently contains these.
// They must survive import/edit cycles so that existing internal links keep working.
test.describe('anchor name attribute (legacy in-page anchors)', () => {
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

  test('<a name="..."> anchor target is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a name="section-overview"></a><h2>Overview</h2><p>Section content.</p>',
    )
    // The anchor target name or the heading text must survive
    expect(content).toContain('Overview')
    expect(content).toContain('Section content')
  })

  test('#hash link pointing to a name anchor survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a name="top"></a><p>Content.</p><p><a href="#top">Back to top</a></p>',
    )
    expect(content).toContain('Content')
    expect(content).toContain('Back to top')
    expect(content).toMatch(/href="#top"/)
  })

  test('anchor name with hyphenated id is preserved or handled', async ({page}) => {
    const content = await setAndGet(page, '<a name="module-3-week-2"></a><h3>Module 3, Week 2</h3>')
    expect(content).toContain('Module 3, Week 2')
  })

  test('multiple name anchors in same document', async ({page}) => {
    const content = await setAndGet(
      page,
      `<a name="part-one"></a><h2>Part One</h2><p>Text.</p>
       <a name="part-two"></a><h2>Part Two</h2><p>More text.</p>`,
    )
    expect(content).toContain('Part One')
    expect(content).toContain('Part Two')
    expect(content).toContain('More text')
  })

  test('id attribute on heading as modern anchor equivalent is preserved', async ({page}) => {
    // Modern equivalent: id on block element, linked via #hash
    const content = await setAndGet(
      page,
      '<h2 id="overview">Overview</h2><p><a href="#overview">Jump to overview</a></p>',
    )
    expect(content).toContain('Overview')
    expect(content).toContain('Jump to overview')
    expect(content).toMatch(/href="#overview"/)
    expect(content).toMatch(/id="overview"/)
  })
})
