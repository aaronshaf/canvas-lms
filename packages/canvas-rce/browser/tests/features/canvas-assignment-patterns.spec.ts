import {test, expect} from '../../fixtures/test'

// Realistic Canvas assignment description HTML combines all content types:
// headings, paragraphs, lists, tables, links to course files, rubric info,
// due date info, and submission instructions. These full-page patterns are
// the primary use case for canvas-rce and the most important to keep intact.
test.describe('Canvas assignment description content patterns', () => {
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

  test('assignment with overview, requirements, submission — all text preserved', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      `<h2>Research Paper Assignment</h2>
      <p><strong>Due:</strong> Friday, March 15 at 11:59 PM</p>
      <h3>Overview</h3>
      <p>Write a 5–7 page research paper on a topic from the list below.</p>
      <h3>Requirements</h3>
      <ul>
        <li>Minimum 5 pages, maximum 7 pages</li>
        <li>At least 8 peer-reviewed sources</li>
        <li>APA 7th edition format</li>
        <li>12-point Times New Roman, double-spaced</li>
      </ul>
      <h3>Submission</h3>
      <p>Submit as a PDF via the <a href="/courses/1/assignments/2">submission portal</a>.</p>`,
    )
    expect(content).toContain('Research Paper Assignment')
    expect(content).toContain('peer-reviewed sources')
    expect(content).toContain('submission portal')
  })

  test('assignment with grading table and file links — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Lab Report: Photosynthesis</h2>
      <p>Complete the lab experiment and submit your report using the <a href="/files/42/download">lab report template</a>.</p>
      <h3>Grading Breakdown</h3>
      <table>
        <tr><th>Section</th><th>Points</th></tr>
        <tr><td>Introduction and Hypothesis</td><td>20</td></tr>
        <tr><td>Methods</td><td>15</td></tr>
        <tr><td>Results and Discussion</td><td>40</td></tr>
        <tr><td>Conclusion</td><td>25</td></tr>
      </table>
      <p><strong>Total: 100 points</strong></p>`,
    )
    expect(content).toContain('Lab Report: Photosynthesis')
    expect(content).toContain('lab report template')
    expect(content).toContain('Introduction and Hypothesis')
    expect(content).toContain('Total: 100 points')
  })

  test('programming assignment with code examples — code preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Assignment 3: Binary Search Tree</h2>
      <p>Implement a BST with the following interface:</p>
      <pre><code class="language-python">class BST:
    def insert(self, value): pass
    def search(self, value): pass
    def delete(self, value): pass</code></pre>
      <h3>Test Cases</h3>
      <p>Your implementation must pass all provided test cases in <code>test_bst.py</code>.</p>`,
    )
    expect(content).toContain('Binary Search Tree')
    expect(content).toContain('def insert')
    expect(content).toContain('test_bst.py')
  })
})
