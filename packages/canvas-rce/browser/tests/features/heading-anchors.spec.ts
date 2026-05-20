import {test, expect} from '../../fixtures/test'

// Headings with id attributes create named anchors for in-page navigation.
// Instructors use these with #hash links to build course page tables of contents.
// canvas-rce must preserve id attributes on heading elements — stripping them
// breaks every internal anchor link in the document.
test.describe('heading anchor IDs', () => {
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

  test('id attribute on h2 is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h2 id="section-overview">Overview</h2>')
    expect(content).toContain('Overview')
    expect(content).toMatch(/<h2/)
    // id attribute is the anchor target — must survive
    expect(content).toMatch(/id="section-overview"/)
  })

  test('id attribute on h3 is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h3 id="learning-objectives">Learning Objectives</h3>')
    expect(content).toContain('Learning Objectives')
    expect(content).toMatch(/id="learning-objectives"/)
  })

  test('multiple headings with different ids are all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2 id="part-one">Part One</h2>
       <p>Introduction text.</p>
       <h2 id="part-two">Part Two</h2>
       <p>Body text.</p>
       <h2 id="part-three">Part Three</h2>`,
    )
    expect(content).toContain('Part One')
    expect(content).toContain('Part Two')
    expect(content).toContain('Part Three')
    expect(content).toMatch(/id="part-one"/)
    expect(content).toMatch(/id="part-two"/)
    expect(content).toMatch(/id="part-three"/)
  })

  test('anchor link pointing to heading id works end-to-end', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2 id="references">References</h2><p>See <a href="#references">References section</a> above.</p>',
    )
    expect(content).toContain('References')
    expect(content).toMatch(/id="references"/)
    expect(content).toMatch(/href="#references"/)
    expect(content).toContain('References section')
  })

  test('heading with id and class together are both preserved', async ({page}) => {
    const content = await setAndGet(page, '<h2 id="intro" class="course-heading">Introduction</h2>')
    expect(content).toContain('Introduction')
    expect(content).toMatch(/id="intro"/)
  })

  test('h1 through h4 all preserve id attribute', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h1 id="h1-anchor">Title</h1>
       <h2 id="h2-anchor">Section</h2>
       <h3 id="h3-anchor">Subsection</h3>
       <h4 id="h4-anchor">Detail</h4>`,
    )
    expect(content).toMatch(/id="h1-anchor"/)
    expect(content).toMatch(/id="h2-anchor"/)
    expect(content).toMatch(/id="h3-anchor"/)
    expect(content).toMatch(/id="h4-anchor"/)
  })

  test('kebab-case and underscore ids are preserved as-is', async ({page}) => {
    const content = await setAndGet(page, '<h2 id="module_3-week_2">Module 3 — Week 2</h2>')
    expect(content).toMatch(/id="module_3-week_2"/)
    expect(content).toContain('Module 3')
  })
})
