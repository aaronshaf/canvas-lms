import {test, expect} from '../../fixtures/test'

// Legacy HTML table attributes (align, valign, width, bgcolor, cellpadding,
// cellspacing) were the standard way to style tables before CSS. Canvas courses
// authored before ~2010 or imported from Word contain these attributes.
// Tests document whether TinyMCE preserves or converts them so refactors can
// detect behavioral changes.
test.describe('legacy table alignment and presentational attributes', () => {
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

  test('table cell text is preserved regardless of align attribute', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td align="center">Centered cell</td><td align="right">Right cell</td></tr></table>',
    )
    expect(content).toContain('Centered cell')
    expect(content).toContain('Right cell')
  })

  test('valign attribute on td — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td valign="top">Top aligned</td><td valign="bottom">Bottom aligned</td></tr></table>',
    )
    expect(content).toContain('Top aligned')
    expect(content).toContain('Bottom aligned')
  })

  test('width attribute on td — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td width="200">Fixed width cell</td><td width="50%">Percentage cell</td></tr></table>',
    )
    expect(content).toContain('Fixed width cell')
    expect(content).toContain('Percentage cell')
  })

  test('bgcolor on table row — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr bgcolor="#ffeecc"><td>Colored row cell</td></tr></table>',
    )
    expect(content).toContain('Colored row cell')
  })

  test('cellpadding and cellspacing on table — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table cellpadding="8" cellspacing="4"><tr><td>Padded cell</td></tr></table>',
    )
    expect(content).toContain('Padded cell')
  })

  test('table with border="1" — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table border="1"><tr><td>Bordered table</td></tr></table>',
    )
    expect(content).toContain('Bordered table')
  })

  test('th with scope attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th scope="col">Column Header</th></tr><tr><td>Data</td></tr></table>',
    )
    expect(content).toContain('Column Header')
    expect(content).toContain('Data')
  })

  test('table align="center" (deprecated) — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table align="center"><tr><td>Centered table</td></tr></table>',
    )
    expect(content).toContain('Centered table')
  })
})
