import {test, expect} from '../../fixtures/test'

// Tables with mixed cell content — paragraphs, images, lists, headings, and
// code — appear in rubrics, comparison charts, and reference tables.
// TinyMCE's serializer must handle the mixed block/inline model inside td/th
// without flattening or dropping content types.
test.describe('tables with mixed block content in cells', () => {
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

  test('table cell with heading and paragraph — both preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td><h3>Key Concept</h3><p>Detailed explanation of the concept.</p></td><td>Score</td></tr></table>',
    )
    expect(content).toContain('Key Concept')
    expect(content).toContain('Detailed explanation')
  })

  test('table cell with image and caption — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td><img src="diagram.png" alt="Process diagram"><p>Figure 1: Process flow</p></td><td>Description text</td></tr></table>',
    )
    expect(content).toContain('Process diagram')
    expect(content).toContain('Figure 1: Process flow')
    expect(content).toContain('Description text')
  })

  test('comparison table: cell with code block — code preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th>Language</th><th>Example</th></tr><tr><td>Python</td><td><pre><code>print("Hello")</code></pre></td></tr><tr><td>JavaScript</td><td><pre><code>console.log("Hello")</code></pre></td></tr></table>',
    )
    expect(content).toContain('Python')
    expect(content).toContain('print("Hello")')
    expect(content).toContain('console.log("Hello")')
  })

  test('rubric table with criteria lists — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th>Criterion</th><th>Excellent (4)</th><th>Good (3)</th></tr><tr><td>Analysis</td><td><ul><li>Deep insight</li><li>Novel perspective</li></ul></td><td><ul><li>Solid analysis</li><li>Clear reasoning</li></ul></td></tr></table>',
    )
    expect(content).toContain('Analysis')
    expect(content).toContain('Deep insight')
    expect(content).toContain('Solid analysis')
  })

  test('table cell with bold, italic, and link — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td><p><strong>Required reading:</strong> <em>Introduction to Algorithms</em> by <a href="/courses/1/pages/mit-press">MIT Press</a>.</p></td></tr></table>',
    )
    expect(content).toContain('Required reading')
    expect(content).toContain('Introduction to Algorithms')
    expect(content).toContain('MIT Press')
  })
})
