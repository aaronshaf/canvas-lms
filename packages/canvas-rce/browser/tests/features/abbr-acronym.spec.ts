import {test, expect} from '../../fixtures/test'

// <abbr> is a semantic element for abbreviations and acronyms; its title
// attribute provides the full expansion to screen readers and on hover.
// WCAG 3.1.4 requires the full expansion to be available. canvas-rce must
// preserve <abbr> and its title through round-trips.
// <acronym> is the deprecated HTML4 equivalent — it appears in legacy content.
test.describe('<abbr> and <acronym> elements', () => {
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

  test('<abbr> text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The <abbr title="World Health Organization">WHO</abbr> published a report.</p>',
    )
    expect(content).toContain('WHO')
    expect(content).toContain('published a report')
  })

  test('<abbr title> attribute is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><abbr title="HyperText Markup Language">HTML</abbr> is foundational.</p>',
    )
    expect(content).toContain('HTML')
    expect(content).toContain('title')
    expect(content).toContain('HyperText Markup Language')
  })

  test('multiple <abbr> elements in same paragraph all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><abbr title="Cascading Style Sheets">CSS</abbr> and <abbr title="JavaScript">JS</abbr> are web standards.</p>',
    )
    expect(content).toContain('CSS')
    expect(content).toContain('JS')
    expect(content).toContain('web standards')
  })

  test('<abbr> inside a list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Use <abbr title="Application Programming Interface">API</abbr> keys</li></ul>',
    )
    expect(content).toContain('API')
    expect(content).toContain('keys')
  })

  test('<acronym> legacy element text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The <acronym title="National Aeronautics and Space Administration">NASA</acronym> mission succeeded.</p>',
    )
    // text must survive; element may be converted to <abbr> or preserved
    expect(content).toContain('NASA')
    expect(content).toContain('mission succeeded')
  })

  test('<abbr> inside a table cell is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th><abbr title="Points">Pts</abbr></th><td>100</td></tr></table>',
    )
    expect(content).toContain('Pts')
    expect(content).toContain('100')
  })
})
