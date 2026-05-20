import {test, expect} from '../../fixtures/test'

// ARIA table attributes extend native table semantics for complex grids:
// aria-sort marks sortable column headers, aria-rowcount/aria-colcount
// communicate total size for virtual scroll grids, aria-rowindex/aria-colindex
// identify position within the full grid. Course grade tables and schedules use these.
test.describe('ARIA table and grid attributes', () => {
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

  test('aria-sort="ascending" on th — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th aria-sort="ascending">Name ↑</th><th aria-sort="none">Score</th></tr><tr><td>Alice</td><td>95</td></tr></table>',
    )
    expect(content).toContain('Name')
    expect(content).toContain('Alice')
  })

  test('aria-sort="descending" — header text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th aria-sort="descending">Date ↓</th><th>Event</th></tr><tr><td>2025-01-15</td><td>Exam</td></tr></table>',
    )
    expect(content).toContain('Date')
    expect(content).toContain('Exam')
  })

  test('aria-rowcount and aria-colcount — cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table aria-rowcount="100" aria-colcount="5"><tr><th aria-rowindex="1">ID</th><th>Name</th></tr><tr aria-rowindex="2"><td>001</td><td>Alice</td></tr></table>',
    )
    expect(content).toContain('Alice')
  })

  test('aria-colspan / aria-rowspan — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table role="grid"><tr><td role="gridcell" aria-colspan="2" colspan="2">Merged cell content</td></tr><tr><td role="gridcell">Left</td><td role="gridcell">Right</td></tr></table>',
    )
    expect(content).toContain('Merged cell content')
    expect(content).toContain('Left')
    expect(content).toContain('Right')
  })

  test('aria-readonly on grid cell — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table role="grid"><tr><td role="gridcell" aria-readonly="true">Read-only grade value</td></tr></table>',
    )
    expect(content).toContain('Read-only grade value')
  })
})
