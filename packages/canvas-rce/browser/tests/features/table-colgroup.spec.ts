import {test, expect} from '../../fixtures/test'

// <colgroup> and <col> elements define column-level formatting for tables.
// Instructors use them to set column widths in grade tables and schedules.
// They are structural HTML — canvas-rce should not silently drop them.
test.describe('table colgroup and col elements', () => {
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

  test('table cell content is preserved when colgroup is present', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <colgroup><col style="width: 30%"><col style="width: 70%"></colgroup>
        <tr><td>Label</td><td>Value</td></tr>
        <tr><td>Score</td><td>95</td></tr>
      </table>`,
    )
    expect(content).toContain('Label')
    expect(content).toContain('Value')
    expect(content).toContain('Score')
    expect(content).toContain('95')
  })

  test('colgroup with span attribute content round-trips', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <colgroup span="2" style="background-color: #f5f5f5;"></colgroup>
        <tr><th>A</th><th>B</th></tr>
        <tr><td>1</td><td>2</td></tr>
      </table>`,
    )
    expect(content).toContain('A')
    expect(content).toContain('B')
    expect(content).toContain('1')
    expect(content).toContain('2')
  })

  test('table with col width styles preserves all row data', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <colgroup>
          <col style="width: 200px">
          <col style="width: 100px">
          <col style="width: 100px">
          <col style="width: 100px">
        </colgroup>
        <thead><tr><th>Assignment</th><th>Points</th><th>Possible</th><th>Grade</th></tr></thead>
        <tbody>
          <tr><td>Essay 1</td><td>85</td><td>100</td><td>B</td></tr>
          <tr><td>Midterm</td><td>78</td><td>100</td><td>C+</td></tr>
        </tbody>
      </table>`,
    )
    expect(content).toContain('Assignment')
    expect(content).toContain('Essay 1')
    expect(content).toContain('Midterm')
    expect(content).toContain('Grade')
  })

  test('table without colgroup still works correctly', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td>no colgroup</td><td>still works</td></tr></table>',
    )
    expect(content).toContain('no colgroup')
    expect(content).toContain('still works')
  })
})
