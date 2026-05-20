import {test, expect} from '../../fixtures/test'

// <section> and <article> are HTML5 sectioning elements. Nested combinations
// appear in course content with standalone articles (case studies) inside
// sections (course modules). <aside> inside an article marks sidebars.
// All text must be preserved through the serialization pipeline.
test.describe('nested <section>, <article>, and <aside> elements', () => {
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

  test('<article> inside <section> — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<section><h2>Module 1</h2><article><h3>Case Study: Dijkstra</h3><p>Explore the algorithm.</p></article></section>',
    )
    expect(content).toContain('Module 1')
    expect(content).toContain('Case Study: Dijkstra')
    expect(content).toContain('Explore the algorithm')
  })

  test('<aside> inside <article> — aside text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<article><p>Main content here.</p><aside><p>Key term: algorithm</p></aside><p>Continued content.</p></article>',
    )
    expect(content).toContain('Main content here')
    expect(content).toContain('Key term: algorithm')
    expect(content).toContain('Continued content')
  })

  test('multiple articles in a section — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<section><article><h3>Topic A</h3><p>Content A.</p></article><article><h3>Topic B</h3><p>Content B.</p></article></section>',
    )
    expect(content).toContain('Topic A')
    expect(content).toContain('Content A')
    expect(content).toContain('Topic B')
    expect(content).toContain('Content B')
  })

  test('three levels of sectioning nesting — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<section><h1>Course</h1><section><h2>Module</h2><article><h3>Lesson</h3><p>Lesson body.</p></article></section></section>',
    )
    expect(content).toContain('Course')
    expect(content).toContain('Module')
    expect(content).toContain('Lesson')
    expect(content).toContain('Lesson body')
  })

  test('<section> with aria-labelledby — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<section aria-labelledby="sec-heading"><h2 id="sec-heading">Accessible Section</h2><p>Section content.</p></section>',
    )
    expect(content).toContain('Accessible Section')
    expect(content).toContain('Section content')
  })
})
