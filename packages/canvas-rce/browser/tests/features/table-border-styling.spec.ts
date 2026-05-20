import {test, expect} from '../../fixtures/test'

// Table border and background styles control visual presentation in course content.
// Instructors use border, background-color, and padding on table elements for
// rubric layouts and grade tables. These CSS properties must survive serialization.
test.describe('table border and visual styling', () => {
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

  test('table with border attribute preserves cell content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table border="1"><tr><td>Cell A</td><td>Cell B</td></tr></table>',
    )
    expect(content).toContain('Cell A')
    expect(content).toContain('Cell B')
  })

  test('table with border-collapse style preserves all rows', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table style="border-collapse: collapse;"><tr><td>Row 1</td></tr><tr><td>Row 2</td></tr></table>',
    )
    expect(content).toContain('Row 1')
    expect(content).toContain('Row 2')
  })

  test('table cell with padding style preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td style="padding: 8px;">Padded cell</td></tr></table>',
    )
    expect(content).toContain('Padded cell')
  })

  test('table cell with background-color preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td style="background-color: #e8f4fd;">Blue cell</td><td>Normal cell</td></tr></table>',
    )
    expect(content).toContain('Blue cell')
    expect(content).toContain('Normal cell')
  })

  test('table header row with background-color preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><thead><tr style="background-color: #333; color: white;"><th>Name</th><th>Grade</th></tr></thead><tbody><tr><td>Alice</td><td>A</td></tr></tbody></table>',
    )
    expect(content).toContain('Name')
    expect(content).toContain('Grade')
    expect(content).toContain('Alice')
  })

  test('table with width style preserves all content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table style="width: 100%;"><tr><td>Full width cell</td></tr></table>',
    )
    expect(content).toContain('Full width cell')
  })

  test('table cell with border style preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td style="border: 1px solid #ccc;">Bordered cell</td></tr></table>',
    )
    expect(content).toContain('Bordered cell')
  })

  test('striped table with alternating row styles preserves all rows', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <tr style="background-color: #f9f9f9;"><td>Row 1 data</td></tr>
        <tr style="background-color: #ffffff;"><td>Row 2 data</td></tr>
        <tr style="background-color: #f9f9f9;"><td>Row 3 data</td></tr>
      </table>`,
    )
    expect(content).toContain('Row 1 data')
    expect(content).toContain('Row 2 data')
    expect(content).toContain('Row 3 data')
  })
})
