import {test, expect} from '../../fixtures/test'

// CSS print break properties control page breaking when content is printed —
// break-before: page forces a new page before an element, break-inside: avoid
// keeps tables and figures together. Canvas instructors printing syllabi and
// rubrics rely on these; the text content must survive the RCE round-trip.
test.describe('CSS print break properties', () => {
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

  test('break-before: page on section heading — heading preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2>Week 1: Introduction</h2><p>Overview content here.</p><h2 style="break-before: page;">Week 2: Core Concepts</h2><p>Each week starts on a new page when printed.</p>',
    )
    expect(content).toContain('Week 1: Introduction')
    expect(content).toContain('Week 2: Core Concepts')
    expect(content).toContain('new page when printed')
  })

  test('break-inside: avoid on table — table data preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table style="break-inside: avoid;"><caption>Grading rubric — kept together when printing</caption><tr><th>Criterion</th><th>Points</th></tr><tr><td>Analysis depth</td><td>40</td></tr><tr><td>Writing quality</td><td>30</td></tr></table>',
    )
    expect(content).toContain('kept together when printing')
    expect(content).toContain('Analysis depth')
    expect(content).toContain('Writing quality')
  })

  test('break-after: page on footer — surrounding content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>End of course policies section.</p><div style="break-after: page;"><p>Please sign and return the acknowledgment form below.</p></div><h2>Appendix A: Reference Materials</h2>',
    )
    expect(content).toContain('course policies section')
    expect(content).toContain('acknowledgment form')
    expect(content).toContain('Appendix A')
  })

  test('page-break-before legacy property — content preserved', async ({page}) => {
    // Legacy page-break-* aliases for break-*
    const content = await setAndGet(
      page,
      '<h2 style="page-break-before: always;">Module 3: Advanced Topics</h2><p>This section begins on a fresh page in printed handouts.</p>',
    )
    expect(content).toContain('Module 3: Advanced Topics')
    expect(content).toContain('fresh page in printed handouts')
  })

  test('orphans and widows on paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="orphans: 3; widows: 3;">Typography-aware paragraphs avoid leaving single lines stranded at the top or bottom of a printed page. This setting applies to multi-paragraph essay content.</p>',
    )
    expect(content).toContain('single lines stranded')
    expect(content).toContain('printed page')
  })
})
