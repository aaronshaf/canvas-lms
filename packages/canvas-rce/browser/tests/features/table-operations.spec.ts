import {test, expect} from '../../fixtures/test'

// Tests for table cell navigation and content editing.
// The basic tables.spec.ts covers insertion; these tests verify the editing contract.
test.describe('table operations', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
    // Insert a 2x2 table to work with
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('mceInsertTable', false, {rows: 2, columns: 2})
    })
  })

  test('Tab key moves focus to next table cell', async ({page, rcePage}) => {
    // Click into the first cell directly (not body — resizer overlay blocks body clicks)
    const firstCell = rcePage.contentFrame().locator('td').first()
    await firstCell.click()
    await page.keyboard.type('cell 1')
    // Tab to next cell
    await page.keyboard.press('Tab')
    await page.keyboard.type('cell 2')

    const content = await rcePage.getContent()
    expect(content).toContain('cell 1')
    expect(content).toContain('cell 2')
    const cell1InTd = content.match(/<td[^>]*>[^<]*cell 1[^<]*<\/td>/)
    const cell2InTd = content.match(/<td[^>]*>[^<]*cell 2[^<]*<\/td>/)
    expect(cell1InTd).toBeTruthy()
    expect(cell2InTd).toBeTruthy()
  })

  test('table maintains 2 rows after editing cells', async ({page, rcePage}) => {
    const firstCell = rcePage.contentFrame().locator('td').first()
    await firstCell.click()
    await page.keyboard.type('row1')
    // Tab through two cells to reach second row
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.type('row2')

    const content = await rcePage.getContent()
    expect(content).toContain('row1')
    expect(content).toContain('row2')
    const trMatches = content.match(/<tr/g) ?? []
    expect(trMatches.length).toBeGreaterThanOrEqual(2)
  })

  test('table content survives undo', async ({page, rcePage}) => {
    const firstCell = rcePage.contentFrame().locator('td').first()
    await firstCell.click()
    await page.keyboard.type('typed in cell')
    // Undo the typing
    await page.keyboard.press('Control+z')
    const content = await rcePage.getContent()
    // Table structure must remain even if cell content was removed
    expect(content).toMatch(/<table/)
  })

  test('table is included in getContent() output', async ({page, rcePage}) => {
    const content = await rcePage.getContent()
    expect(content).toMatch(/<table/)
    expect(content).toMatch(/<tr/)
    expect(content).toMatch(/<td/)
  })

  test('table rows contain correct number of cells', async ({page, rcePage}) => {
    const content = await rcePage.getContent()
    // Each row should have 2 cells (we inserted a 2x2 table)
    const rows = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) ?? []
    expect(rows.length).toBeGreaterThanOrEqual(2)
    rows.forEach(row => {
      const cells = row.match(/<td/g) ?? []
      expect(cells.length).toBeGreaterThanOrEqual(2)
    })
  })
})
