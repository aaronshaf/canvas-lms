import {test, expect} from '../../fixtures/test'

// Tables with both rowspan and colspan in the same table are common in
// complex data tables (grade sheets, comparison matrices). These are the
// hardest table structures to serialize correctly — losing a span value
// silently corrupts the visual layout without a test to detect it.
test.describe('tables with combined rowspan and colspan', () => {
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

  test('cell with rowspan=2 and sibling cells all preserve text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td rowspan="2">Spans 2 rows</td><td>Row 1 Col 2</td></tr><tr><td>Row 2 Col 2</td></tr></table>',
    )
    expect(content).toContain('Spans 2 rows')
    expect(content).toContain('Row 1 Col 2')
    expect(content).toContain('Row 2 Col 2')
  })

  test('cell with colspan=2 alongside rowspan cell — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th rowspan="2">Category</th><th colspan="2">Values</th></tr><tr><td>Min</td><td>Max</td></tr><tr><td>Temperature</td><td>10</td><td>40</td></tr></table>',
    )
    expect(content).toContain('Category')
    expect(content).toContain('Values')
    expect(content).toContain('Min')
    expect(content).toContain('Max')
    expect(content).toContain('Temperature')
  })

  test('header cell with colspan=3 — all column headers preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><thead><tr><th colspan="3">Full year results</th></tr><tr><th>Q1</th><th>Q2</th><th>Q3</th></tr></thead><tbody><tr><td>10</td><td>20</td><td>30</td></tr></tbody></table>',
    )
    expect(content).toContain('Full year results')
    expect(content).toContain('Q1')
    expect(content).toContain('Q2')
    expect(content).toContain('Q3')
  })

  test('complex spanning matrix — all cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td colspan="2" rowspan="2">Top-left 2x2</td><td>Top right</td></tr><tr><td>Middle right</td></tr><tr><td>Bottom left</td><td>Bottom mid</td><td>Bottom right</td></tr></table>',
    )
    expect(content).toContain('Top-left 2x2')
    expect(content).toContain('Top right')
    expect(content).toContain('Bottom left')
    expect(content).toContain('Bottom right')
  })
})
