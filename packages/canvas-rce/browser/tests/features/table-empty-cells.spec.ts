import {test, expect} from '../../fixtures/test'

// Tables with empty cells are common in schedules, calendars, and grids where
// some slots are intentionally blank. TinyMCE must not collapse or merge empty
// cells — the table structure (cell count per row) must be preserved so the
// visual layout matches what the instructor designed.
test.describe('table cells with empty or whitespace-only content', () => {
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

  test('table with empty td — neighboring cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td>Content cell</td><td></td><td>Another cell</td></tr></table>',
    )
    expect(content).toContain('Content cell')
    expect(content).toContain('Another cell')
  })

  test('table with empty th in header — other headers preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th>Name</th><th></th><th>Grade</th></tr><tr><td>Bob</td><td>A</td><td>Pass</td></tr></table>',
    )
    expect(content).toContain('Name')
    expect(content).toContain('Grade')
    expect(content).toContain('Bob')
  })

  test('calendar grid with many empty cells — content cells preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td></td><td></td><td>1</td><td>2</td><td>3</td></tr><tr><td>4</td><td>5</td><td>6 - Quiz</td><td>7</td><td>8</td></tr></table>',
    )
    expect(content).toContain('6 - Quiz')
  })

  test('table with colspan spanning empty cells — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td colspan="2">Spans two</td><td>Third</td></tr><tr><td></td><td></td><td>Bottom right</td></tr></table>',
    )
    expect(content).toContain('Spans two')
    expect(content).toContain('Third')
    expect(content).toContain('Bottom right')
  })

  test('table with &nbsp; in cells — cells render', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td>Filled</td><td>&nbsp;</td><td>Also filled</td></tr></table>',
    )
    expect(content).toContain('Filled')
    expect(content).toContain('Also filled')
  })
})
