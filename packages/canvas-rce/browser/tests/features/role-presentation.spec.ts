import {test, expect} from '../../fixtures/test'

// role="presentation" and role="none" tell screen readers to ignore an element's
// native semantics — used for layout tables, decorative images, and spacer divs.
// role="grid", role="row", role="gridcell" mark interactive data grids.
// All text content must survive regardless of how TinyMCE handles these roles.
test.describe('ARIA role="presentation", role="none", and grid roles', () => {
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

  test('layout table with role="presentation" — cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table role="presentation"><tr><td>Logo area</td><td>Navigation area</td></tr></table>',
    )
    expect(content).toContain('Logo area')
    expect(content).toContain('Navigation area')
  })

  test('role="none" on decorative div — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="none"><img src="divider.png" alt=""> <span>Section break</span></div><p>Content continues.</p>',
    )
    expect(content).toContain('Content continues')
  })

  test('role="grid" table — cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table role="grid"><tr role="row"><th role="columnheader">Name</th><th role="columnheader">Score</th></tr><tr role="row"><td role="gridcell">Alice</td><td role="gridcell">95</td></tr></table>',
    )
    expect(content).toContain('Alice')
    expect(content).toContain('95')
  })

  test('role="list" and role="listitem" — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="list"><div role="listitem">First item</div><div role="listitem">Second item</div></div>',
    )
    expect(content).toContain('First item')
    expect(content).toContain('Second item')
  })

  test('role="figure" and role="img" — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="figure" aria-label="Bar chart of student grades"><p>Chart description: most students scored B or above.</p></div>',
    )
    expect(content).toContain('Chart description')
  })

  test('role="separator" — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Section A content.</p><div role="separator"></div><p>Section B content.</p>',
    )
    expect(content).toContain('Section A content')
    expect(content).toContain('Section B content')
  })
})
