import {test, expect} from '../../fixtures/test'

// Formatting must work correctly when the cursor is inside a table cell.
// TinyMCE's formatting context changes when inside a table — these tests verify
// that inline formatting, block formatting, and content APIs all work within cells.
test.describe('table cell formatting', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    // Insert a 2x2 table
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('mceInsertTable', false, {rows: 2, columns: 2})
    })
  })

  test('bold can be applied inside a table cell', async ({page, rcePage}) => {
    const firstCell = rcePage.contentFrame().locator('td').first()
    await firstCell.click()
    await page.keyboard.type('cell content')
    await firstCell.press('Control+a')
    await page.keyboard.press('Control+b')

    const content = await rcePage.getContent()
    expect(content).toMatch(/<td[^>]*>[\s\S]*<strong>cell content<\/strong>[\s\S]*<\/td>/)
  })

  test('italic can be applied inside a table cell', async ({page, rcePage}) => {
    const firstCell = rcePage.contentFrame().locator('td').first()
    await firstCell.click()
    await page.keyboard.type('italic in cell')
    await firstCell.press('Control+a')
    await page.keyboard.press('Control+i')

    const content = await rcePage.getContent()
    expect(content).toMatch(/<td[^>]*>[\s\S]*<em>italic in cell<\/em>[\s\S]*<\/td>/)
  })

  test('each cell can contain independent formatting', async ({page, rcePage}) => {
    const cells = rcePage.contentFrame().locator('td')
    // Bold first cell
    await cells.nth(0).click()
    await page.keyboard.type('bold')
    await cells.nth(0).press('Control+a')
    await page.keyboard.press('Control+b')

    // Italic second cell
    await cells.nth(1).click()
    await page.keyboard.type('italic')
    await cells.nth(1).press('Control+a')
    await page.keyboard.press('Control+i')

    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>bold<\/strong>/)
    expect(content).toMatch(/<em>italic<\/em>/)
    // Bold should not have bled into italic cell
    expect(content).not.toMatch(/<strong>italic<\/strong>/)
    expect(content).not.toMatch(/<em>bold<\/em>/)
  })

  test('word count includes text inside table cells', async ({page, rcePage}) => {
    const firstCell = rcePage.contentFrame().locator('td').first()
    await firstCell.click()
    await page.keyboard.type('alpha beta gamma')

    await page.waitForTimeout(500)
    const wordCountText = await page.locator('[data-testid="status-bar-word-count"]').textContent()
    const count = parseInt(wordCountText?.match(/(\d+)/)?.[1] ?? '0', 10)
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('content inside table cells survives getContent round-trip', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<table><tr><td><strong>A</strong></td><td><em>B</em></td></tr></table>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<td[^>]*>[\s\S]*<strong>A<\/strong>[\s\S]*<\/td>/)
    expect(content).toMatch(/<td[^>]*>[\s\S]*<em>B<\/em>[\s\S]*<\/td>/)
  })
})
