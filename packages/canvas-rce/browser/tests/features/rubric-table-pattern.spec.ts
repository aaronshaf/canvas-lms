import {test, expect} from '../../fixtures/test'

// Rubric tables describe grading criteria with performance levels.
// Canvas stores rubric descriptions as HTML in the RCE. A complex rubric
// table with headers, colspan, and detailed cell text exercises many
// table serialization code paths simultaneously.
test.describe('rubric-style grading tables', () => {
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

  test('grading rubric with criteria and performance levels', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
  <thead>
    <tr>
      <th>Criteria</th>
      <th>Excellent (4)</th>
      <th>Proficient (3)</th>
      <th>Developing (2)</th>
      <th>Beginning (1)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Code Quality</th>
      <td>Clean, well-commented, follows style guide</td>
      <td>Readable with minor issues</td>
      <td>Some logic issues</td>
      <td>Hard to read</td>
    </tr>
    <tr>
      <th scope="row">Correctness</th>
      <td>All tests pass</td>
      <td>Most tests pass</td>
      <td>Some tests fail</td>
      <td>Many failures</td>
    </tr>
  </tbody>
</table>`,
    )
    expect(content).toContain('Criteria')
    expect(content).toContain('Excellent (4)')
    expect(content).toContain('Code Quality')
    expect(content).toContain('Clean, well-commented')
    expect(content).toContain('Correctness')
    expect(content).toContain('All tests pass')
  })

  test('rubric with point values in header — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
  <caption>Essay Rubric — 100 points total</caption>
  <tr><th>Category</th><th>Points</th><th>Description</th></tr>
  <tr><td>Thesis</td><td>20</td><td>Clear central argument stated in introduction</td></tr>
  <tr><td>Evidence</td><td>30</td><td>Three or more supporting examples with citations</td></tr>
  <tr><td>Analysis</td><td>30</td><td>Connects evidence to thesis effectively</td></tr>
  <tr><td>Writing</td><td>20</td><td>Grammar, mechanics, and style</td></tr>
</table>`,
    )
    expect(content).toContain('Essay Rubric')
    expect(content).toContain('Thesis')
    expect(content).toContain('20')
    expect(content).toContain('Clear central argument')
    expect(content).toContain('citations')
  })
})
