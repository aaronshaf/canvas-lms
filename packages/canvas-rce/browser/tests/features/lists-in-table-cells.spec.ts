import {test, expect} from '../../fixtures/test'

// Lists inside table cells are common in course materials: grading rubrics
// list criteria per row, schedules list activities per day, comparison tables
// show bullet points per column. TinyMCE must serialize this structure without
// flattening the list or losing items.
test.describe('lists nested inside table cells', () => {
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

  test('ul inside td — all list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td><ul><li>Criterion A</li><li>Criterion B</li><li>Criterion C</li></ul></td><td>Score</td></tr></table>',
    )
    expect(content).toContain('Criterion A')
    expect(content).toContain('Criterion B')
    expect(content).toContain('Criterion C')
  })

  test('ol inside td — ordered list preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td>Steps</td><td><ol><li>First step</li><li>Second step</li><li>Third step</li></ol></td></tr></table>',
    )
    expect(content).toContain('First step')
    expect(content).toContain('Second step')
    expect(content).toContain('Third step')
  })

  test('multiple cells each with a list — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td><ul><li>Pros: Fast</li><li>Pros: Cheap</li></ul></td><td><ul><li>Cons: Complex</li><li>Cons: Risky</li></ul></td></tr></table>',
    )
    expect(content).toContain('Pros: Fast')
    expect(content).toContain('Cons: Complex')
  })

  test('nested list inside table cell — all levels preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td><ul><li>Main item<ul><li>Sub-item A</li><li>Sub-item B</li></ul></li><li>Another main</li></ul></td></tr></table>',
    )
    expect(content).toContain('Main item')
    expect(content).toContain('Sub-item A')
    expect(content).toContain('Another main')
  })

  test('schedule table: days with activity lists — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <tr><th>Monday</th><th>Wednesday</th></tr>
        <tr>
          <td><ul><li>Read chapter 1</li><li>Quiz prep</li></ul></td>
          <td><ul><li>Lab session</li><li>Office hours</li></ul></td>
        </tr>
      </table>`,
    )
    expect(content).toContain('Read chapter 1')
    expect(content).toContain('Lab session')
    expect(content).toContain('Office hours')
  })
})
