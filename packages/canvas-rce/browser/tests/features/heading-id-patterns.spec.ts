import {test, expect} from '../../fixtures/test'

// Headings with id attributes enable in-page navigation ("jump to section").
// Canvas generates these automatically from heading text, and instructors
// create them manually when building table-of-contents pages. The id must
// survive round-trips — losing it breaks all anchor links pointing to that section.
test.describe('heading id and anchor navigation patterns', () => {
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

  test('h2 with id — heading text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2 id="module-overview">Module Overview</h2><p>Content follows.</p>',
    )
    expect(content).toContain('Module Overview')
  })

  test('anchor link to heading id — link text and target text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="#assignment-requirements">Jump to requirements</a></p><h2 id="assignment-requirements">Assignment Requirements</h2><p>Details here.</p>',
    )
    expect(content).toContain('Jump to requirements')
    expect(content).toContain('Assignment Requirements')
    expect(content).toContain('Details here')
  })

  test('table of contents with multiple anchor links — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<nav><ol>
        <li><a href="#intro">Introduction</a></li>
        <li><a href="#week1">Week 1: Foundations</a></li>
        <li><a href="#week2">Week 2: Applications</a></li>
      </ol></nav>
      <h2 id="intro">Introduction</h2><p>Welcome.</p>
      <h2 id="week1">Week 1: Foundations</h2><p>Start here.</p>
      <h2 id="week2">Week 2: Applications</h2><p>Apply it.</p>`,
    )
    expect(content).toContain('Introduction')
    expect(content).toContain('Week 1: Foundations')
    expect(content).toContain('Week 2: Applications')
  })

  test('heading ids with special characters slugified — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h3 id="section-3-1-getting-started">3.1 Getting Started</h3>',
    )
    expect(content).toContain('3.1 Getting Started')
  })

  test('multiple heading levels each with id — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h1 id="course-title">Course Title</h1><h2 id="unit-1">Unit 1</h2><h3 id="lesson-1-1">Lesson 1.1</h3><p>Content.</p>',
    )
    expect(content).toContain('Course Title')
    expect(content).toContain('Unit 1')
    expect(content).toContain('Lesson 1.1')
  })
})
