import {test, expect} from '../../fixtures/test'

// HTML5 landmark elements provide document structure for screen readers:
// <main> (primary content), <header> (page/section header), <footer>
// (page/section footer), <search> (search functionality). These appear
// in rich course pages and imported content from modern web frameworks.
test.describe('HTML5 landmark elements: main, header, footer, search', () => {
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

  test('<main> landmark — content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<main><h1>Course Introduction</h1><p>Welcome to the course.</p></main>',
    )
    expect(content).toContain('Course Introduction')
    expect(content).toContain('Welcome to the course')
  })

  test('<header> with heading and nav — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<header><h1>Module 1: Foundations</h1><nav><a href="#overview">Overview</a> | <a href="#objectives">Objectives</a></nav></header>',
    )
    expect(content).toContain('Module 1: Foundations')
    expect(content).toContain('Overview')
    expect(content).toContain('Objectives')
  })

  test('<footer> with attribution — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<footer><p>Content created by Dr. Smith. Last updated January 2025.</p></footer>',
    )
    expect(content).toContain('Last updated January 2025')
  })

  test('<header> and <footer> in same content — both preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<header><h2>Lecture Notes</h2></header><p>Main content body goes here.</p><footer><p>End of lecture notes.</p></footer>',
    )
    expect(content).toContain('Lecture Notes')
    expect(content).toContain('Main content body')
    expect(content).toContain('End of lecture notes')
  })

  test('<search> landmark — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<search><label>Search glossary:</label><p>Use Ctrl+F to search this page.</p></search>',
    )
    expect(content).toContain('Search glossary')
  })

  test('<main> inside <article> — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<article><header><h2>Case Study</h2></header><main><p>The study examined 200 participants.</p></main><footer><p>Source: Journal of Education, 2024</p></footer></article>',
    )
    expect(content).toContain('Case Study')
    expect(content).toContain('200 participants')
    expect(content).toContain('Journal of Education')
  })
})
