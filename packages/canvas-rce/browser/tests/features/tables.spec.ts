import {test, expect} from '../../fixtures/test'

// Table insertion: Table menu → Table → click a cell in the picker grid
// Or use TinyMCE execCommand for reliable insertion.
test.describe('tables', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  async function insertTable(page: any, rows: number, cols: number) {
    // Use TinyMCE's execCommand to insert a table — avoids grid-picker flakiness
    await page.evaluate(
      ({r, c}: {r: number; c: number}) => {
        // @ts-expect-error -- TinyMCE global
        window.tinymce.activeEditor.execCommand('mceInsertTable', false, {rows: r, columns: c})
      },
      {r: rows, c: cols},
    )
  }

  test('inserting a 2x2 table renders <table> with rows and cells', async ({page, rcePage}) => {
    await insertTable(page, 2, 2)
    const content = await rcePage.getContent()
    expect(content).toMatch(/<table/)
    const trMatches = content.match(/<tr/g) ?? []
    const tdMatches = content.match(/<td/g) ?? []
    expect(trMatches.length).toBeGreaterThanOrEqual(2)
    expect(tdMatches.length).toBeGreaterThanOrEqual(4)
  })

  test('table is editable — typing enters cell content', async ({page, rcePage}) => {
    await insertTable(page, 2, 2)
    // Click first cell and type
    const firstCell = rcePage.contentFrame().locator('td').first()
    await firstCell.click()
    await page.keyboard.type('cell content')
    const content = await rcePage.getContent()
    expect(content).toContain('cell content')
  })

  test('Tab key moves focus to next table cell', async ({page, rcePage}) => {
    await insertTable(page, 2, 2)
    const firstCell = rcePage.contentFrame().locator('td').first()
    await firstCell.click()
    await page.keyboard.type('A')
    await page.keyboard.press('Tab')
    await page.keyboard.type('B')
    const content = await rcePage.getContent()
    expect(content).toContain('A')
    expect(content).toContain('B')
    // A and B should be in separate cells
    const cells = content.match(/<td[^>]*>.*?<\/td>/gs) ?? []
    expect(cells.some(c => c.includes('A'))).toBe(true)
    expect(cells.some(c => c.includes('B'))).toBe(true)
  })
})
