import {test, expect} from '../../fixtures/test'

// <br> elements inside block-level elements (headings, blockquotes, list items,
// table cells) appear in pasted content from Word and other sources. TinyMCE
// may normalize them or preserve them — both are acceptable, but surrounding
// text must never be lost in the process.
test.describe('<br> line breaks inside block elements', () => {
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

  test('<br> inside a heading preserves both lines of text', async ({page}) => {
    const content = await setAndGet(page, '<h2>First Line<br />Second Line</h2>')
    expect(content).toContain('First Line')
    expect(content).toContain('Second Line')
    expect(content).toMatch(/<h2/)
  })

  test('<br> inside a blockquote preserves all text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>Line one.<br />Line two.<br />Line three.</p></blockquote>',
    )
    expect(content).toContain('Line one')
    expect(content).toContain('Line two')
    expect(content).toContain('Line three')
  })

  test('<br> inside a list item preserves both parts', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>First part<br />Second part</li><li>Normal item</li></ul>',
    )
    expect(content).toContain('First part')
    expect(content).toContain('Second part')
    expect(content).toContain('Normal item')
  })

  test('<br> inside a table cell preserves both lines', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td>Cell line 1<br />Cell line 2</td><td>Other cell</td></tr></table>',
    )
    expect(content).toContain('Cell line 1')
    expect(content).toContain('Cell line 2')
    expect(content).toContain('Other cell')
  })

  test('multiple <br> in sequence inside a paragraph', async ({page}) => {
    const content = await setAndGet(page, '<p>Line A<br /><br />Line B after blank line</p>')
    expect(content).toContain('Line A')
    expect(content).toContain('Line B after blank line')
  })

  test('<br> between formatted elements in a heading', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h3><strong>Bold first</strong><br /><em>Italic second</em></h3>',
    )
    expect(content).toContain('Bold first')
    expect(content).toContain('Italic second')
    expect(content).toMatch(/<h3/)
  })

  test('<br> inside a paragraph followed by another paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before break<br />After break</p><p>Separate paragraph</p>',
    )
    expect(content).toContain('Before break')
    expect(content).toContain('After break')
    expect(content).toContain('Separate paragraph')
  })
})
