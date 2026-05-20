import {test, expect} from '../../fixtures/test'

// Course content frequently uses complex tables with merged cells for schedules,
// rubrics, and grade tables. colspan and rowspan are standard HTML attributes
// that TinyMCE must preserve — stripping them collapses the table layout.
test.describe('table merged cells (colspan/rowspan)', () => {
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

  test('colspan attribute is preserved on td', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td colspan="2">Merged header</td></tr><tr><td>A</td><td>B</td></tr></table>',
    )
    expect(content).toContain('Merged header')
    expect(content).toContain('colspan="2"')
  })

  test('rowspan attribute is preserved on td', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td rowspan="2">Side label</td><td>Row 1</td></tr><tr><td>Row 2</td></tr></table>',
    )
    expect(content).toContain('Side label')
    expect(content).toContain('rowspan="2"')
  })

  test('colspan on th is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><thead><tr><th colspan="3">Quarter Results</th></tr></thead><tbody><tr><td>Q1</td><td>Q2</td><td>Q3</td></tr></tbody></table>',
    )
    expect(content).toContain('Quarter Results')
    expect(content).toMatch(/colspan="3"/)
  })

  test('table with both colspan and rowspan in same table', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <tr><th colspan="2">Header</th></tr>
        <tr><td rowspan="2">Tall cell</td><td>Top right</td></tr>
        <tr><td>Bottom right</td></tr>
      </table>`,
    )
    expect(content).toContain('Header')
    expect(content).toContain('Tall cell')
    expect(content).toContain('Top right')
    expect(content).toContain('Bottom right')
    expect(content).toMatch(/colspan="2"/)
    expect(content).toMatch(/rowspan="2"/)
  })

  test('colspan="1" (default, no-op) is handled gracefully', async ({page}) => {
    const content = await setAndGet(page, '<table><tr><td colspan="1">Normal</td></tr></table>')
    expect(content).toContain('Normal')
    // colspan="1" may be preserved or stripped (both are valid)
    expect(typeof content).toBe('string')
  })

  test('rubric-style table with complex spans preserves all content', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <thead>
          <tr>
            <th>Criterion</th>
            <th colspan="4">Rating Scale</th>
          </tr>
          <tr>
            <th></th>
            <th>4 - Excellent</th>
            <th>3 - Good</th>
            <th>2 - Fair</th>
            <th>1 - Poor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td rowspan="2">Writing quality</td>
            <td>Clear and concise</td>
            <td>Mostly clear</td>
            <td>Some clarity issues</td>
            <td>Hard to follow</td>
          </tr>
          <tr>
            <td>No errors</td>
            <td>Few errors</td>
            <td>Some errors</td>
            <td>Many errors</td>
          </tr>
        </tbody>
      </table>`,
    )
    expect(content).toContain('Criterion')
    expect(content).toContain('Rating Scale')
    expect(content).toContain('Writing quality')
    expect(content).toContain('Excellent')
    expect(content).toContain('No errors')
    const colspanMatch = content.match(/colspan="4"/)
    expect(colspanMatch).not.toBeNull()
  })

  test('cell content within merged cells is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td colspan="2"><strong>Bold merged content</strong></td></tr></table>',
    )
    expect(content).toMatch(/<strong>Bold merged content<\/strong>/)
  })
})
