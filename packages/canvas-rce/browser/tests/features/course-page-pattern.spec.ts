import {test, expect} from '../../fixtures/test'

// Realistic Canvas course page HTML — the kind of multi-section document
// instructors actually save. This exercises the full serialization pipeline
// with mixed headings, tables, lists, links, images, and formatted text
// all in one document. A refactoring regression would show up here first.
test.describe('realistic course page content pattern', () => {
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

  test('full course page with heading hierarchy and body text', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h1>Introduction to Computer Science</h1>
<p>Welcome to CS101. This course covers <strong>fundamental programming concepts</strong> using Python.</p>
<h2>Learning Objectives</h2>
<ol>
  <li>Understand variables and data types</li>
  <li>Write <em>functions</em> and loops</li>
  <li>Apply basic algorithms</li>
</ol>
<h2>Course Schedule</h2>
<table>
  <thead><tr><th>Week</th><th>Topic</th><th>Assignment</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Variables &amp; Types</td><td>Lab 1</td></tr>
    <tr><td>2</td><td>Control Flow</td><td>Lab 2</td></tr>
  </tbody>
</table>
<h2>Resources</h2>
<p>Visit <a href="https://docs.python.org" target="_blank" rel="noopener">Python docs</a> for reference.</p>`,
    )
    expect(content).toContain('Introduction to Computer Science')
    expect(content).toContain('fundamental programming concepts')
    expect(content).toContain('Learning Objectives')
    expect(content).toContain('Understand variables')
    expect(content).toContain('Course Schedule')
    expect(content).toContain('Control Flow')
    expect(content).toContain('Python docs')
  })

  test('course announcement with formatted greeting', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Dear students,</p>
<p>This week's <strong>midterm exam</strong> will cover chapters 1–5. Please review:</p>
<ul>
  <li>Chapter 1: Variables and expressions</li>
  <li>Chapter 2: Functions</li>
  <li>Chapter 3–5: Data structures</li>
</ul>
<p>Office hours this week: <em>Tuesday 3–5pm</em> and <em>Thursday 2–4pm</em>.</p>
<p>Good luck!<br />Prof. Johnson</p>`,
    )
    expect(content).toContain('Dear students')
    expect(content).toContain('midterm exam')
    expect(content).toContain('Data structures')
    expect(content).toContain('Prof. Johnson')
  })

  test('assignment description with grading criteria', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Assignment 3: Binary Search Tree</h2>
<p><strong>Due:</strong> Friday, 11:59pm | <strong>Points:</strong> 100</p>
<h3>Requirements</h3>
<p>Implement a BST with the following methods:</p>
<ul>
  <li><code>insert(value)</code> — O(log n) average</li>
  <li><code>search(value)</code> — returns boolean</li>
  <li><code>delete(value)</code> — handles all cases</li>
</ul>
<h3>Submission</h3>
<p>Submit via <a href="/courses/1/assignments/3">Canvas Assignments</a>.</p>`,
    )
    expect(content).toContain('Binary Search Tree')
    expect(content).toContain('insert(value)')
    expect(content).toContain('O(log n)')
    expect(content).toContain('Canvas Assignments')
  })
})
