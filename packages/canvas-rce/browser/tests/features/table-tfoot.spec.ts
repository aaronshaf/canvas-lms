import {test, expect} from '../../fixtures/test'

// <tfoot> is used in grade tables and financial summaries for totals rows.
// Screen readers use tfoot to distinguish summary data from body data.
// canvas-rce must preserve tfoot alongside thead/tbody without merging them.
test.describe('table tfoot element', () => {
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

  test('<tfoot> text is preserved in output', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <thead><tr><th>Item</th><th>Points</th></tr></thead>
        <tbody><tr><td>Assignment 1</td><td>85</td></tr></tbody>
        <tfoot><tr><td>Total</td><td>85</td></tr></tfoot>
      </table>`,
    )
    expect(content).toContain('Total')
    expect(content).toContain('Assignment 1')
    expect(content).toContain('85')
  })

  test('full thead/tbody/tfoot structure preserves all sections', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <thead><tr><th>Category</th><th>Score</th><th>Max</th></tr></thead>
        <tbody>
          <tr><td>Midterm</td><td>78</td><td>100</td></tr>
          <tr><td>Final</td><td>91</td><td>100</td></tr>
        </tbody>
        <tfoot><tr><td>Average</td><td>84.5</td><td>100</td></tr></tfoot>
      </table>`,
    )
    expect(content).toContain('Category')
    expect(content).toContain('Midterm')
    expect(content).toContain('Final')
    expect(content).toContain('Average')
    expect(content).toContain('84.5')
  })

  test('<tfoot> with th cells is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <tbody><tr><td>Data A</td><td>100</td></tr></tbody>
        <tfoot><tr><th>Grand Total</th><th>100</th></tr></tfoot>
      </table>`,
    )
    expect(content).toContain('Grand Total')
    expect(content).toContain('Data A')
  })

  test('<tfoot> with formatted content inside is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <tbody><tr><td>Item</td><td>$50</td></tr></tbody>
        <tfoot><tr><td><strong>Total Due</strong></td><td><strong>$50</strong></td></tr></tfoot>
      </table>`,
    )
    expect(content).toContain('Total Due')
    expect(content).toMatch(/<strong>/)
  })

  test('tfoot row count matches source', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <tbody>
          <tr><td>Row 1</td></tr>
          <tr><td>Row 2</td></tr>
        </tbody>
        <tfoot>
          <tr><td>Footer 1</td></tr>
          <tr><td>Footer 2</td></tr>
        </tfoot>
      </table>`,
    )
    expect(content).toContain('Footer 1')
    expect(content).toContain('Footer 2')
    expect(content).toContain('Row 1')
    expect(content).toContain('Row 2')
  })
})
